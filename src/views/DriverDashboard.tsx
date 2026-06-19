import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import { 
  ShieldCheck, 
  User, 
  LogOut, 
  CheckCircle,
  CheckCircle2,
  List,
  TrendingUp,
  MoreVertical,
  Filter,
  Menu,
  Car,
  History,
  Bell,
  Shield,
  Settings,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Navigation
} from 'lucide-react';

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#1E1E20" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8F909A" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0F0F10" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#3A3A3E" }, { visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2D2D30" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8F909A" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3D3D42" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] }
];

export const DriverDashboard: React.FC = () => {
  const { user, logout, switchRole, driverState, setDriverState, setStep, isPlaceholder } = useApp();
  const [activeTab, setActiveTab] = useState<'inicio' | 'ganancias' | 'perfil'>('inicio');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);

  // Google Maps States
  const [isMapApiLoaded, setIsMapApiLoaded] = useState(false);
  const [isMapApiFailed, setIsMapApiFailed] = useState(false);
  const [googleMap, setGoogleMap] = useState<any>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<any>(null);
  const [vehicleMarker, setVehicleMarker] = useState<any>(null);
  const [routePathPoints, setRoutePathPoints] = useState<any[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Simulation states
  const [activeOrderSimulation, setActiveOrderSimulation] = useState<any | null>(null);
  const [simulationStep, setSimulationStep] = useState<number>(0);

  // Detailed view states
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<any | null>(null);
  const [bidPrice, setBidPrice] = useState<number>(0);

  const formatTripAddress = (address: string) => {
    if (!address || address === 'Obteniendo GPS...') return 'Obteniendo GPS...';
    const parts = address.split(',');
    if (parts.length >= 2) {
      return `${parts[0].trim()}, ${parts[1].trim()}`;
    }
    return address;
  };

  const [preferredNavigationApp, setPreferredNavigationApp] = useState<'google_maps' | 'waze'>(() => {
    return (localStorage.getItem('preferred_navigation_app') as 'google_maps' | 'waze') || 'google_maps';
  });

  const handleSetNavigationApp = (app: 'google_maps' | 'waze') => {
    setPreferredNavigationApp(app);
    localStorage.setItem('preferred_navigation_app', app);
  };

  const handleOpenExternalNavigation = () => {
    if (!activeOrderSimulation) return;
    
    let destinationAddress = activeOrderSimulation.destination;
    if (destinationAddress.includes(' ||| ')) {
      destinationAddress = destinationAddress.split(' ||| ')[0];
    }
    
    const targetAddress = simulationStep === 1 
      ? activeOrderSimulation.origin 
      : destinationAddress;

    const encodedAddress = encodeURIComponent(targetAddress);
    
    let url = '';
    if (preferredNavigationApp === 'waze') {
      url = `https://waze.com/ul?q=${encodedAddress}&navigate=yes`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
    }
    
    window.open(url, '_blank');
  };

  // Filter states (Destino Preferido y Radio)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState<boolean>(false);
  const [isFilterActive, setIsFilterActive] = useState<boolean>(false);
  const [filterDestination, setFilterDestination] = useState<string>('none');
  const [filterRadius, setFilterRadius] = useState<number>(5); // Radio en km

  // Waiting for client state (Backup flow simulator)
  const [waitingState, setWaitingState] = useState<{
    isOpen: boolean;
    order: any | null;
    countdown: number;
    status: 'sending' | 'waiting' | 'accepted' | 'rejected';
  }>({
    isOpen: false,
    order: null,
    countdown: 8,
    status: 'sending'
  });

  const waitingStateRef = useRef(waitingState);
  useEffect(() => {
    waitingStateRef.current = waitingState;
  }, [waitingState]);

  // Countdown timer for active bid waiting state
  useEffect(() => {
    if (!waitingState.isOpen || waitingState.status !== 'waiting') return;

    const interval = setInterval(() => {
      let expired = false;
      let orderToUpdate: any = null;

      setWaitingState(prev => {
        if (prev.countdown <= 1) {
          clearInterval(interval);
          if (prev.status === 'waiting') {
            expired = true;
            orderToUpdate = prev.order;
            return { ...prev, status: 'rejected', countdown: 0 };
          }
          return prev;
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });

      // Ejecutar la actualización de Supabase fuera del setState para evitar efectos secundarios
      if (expired && !isPlaceholder && orderToUpdate) {
        supabase
          .from('orders')
          .update({ driver_id: null })
          .eq('id', orderToUpdate.id)
          .then(({ error }) => {
            if (error) {
              console.warn("El conductor no pudo limpiar driver_id por RLS, confiando en el timeout del pasajero:", error.message);
            } else {
              console.log("El conductor limpió con éxito el driver_id al expirar la oferta.");
            }
          });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [waitingState.isOpen, waitingState.status, isPlaceholder]);

  // 1. Google Maps Script Loader
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    // Fallback if Google Maps fails to authenticate
    (window as any).gm_authFailure = () => {
      console.warn('Google Maps authentication failed. Falling back to Demo Mode.');
      setIsMapApiFailed(true);
    };

    const google = (window as any).google;
    if (google) {
      setIsMapApiLoaded(true);
      return;
    }

    const scriptId = 'google-maps-api-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = apiKey 
        ? `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
        : `https://maps.googleapis.com/maps/api/js?libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => setIsMapApiLoaded(true);
      document.body.appendChild(script);
    } else {
      script.addEventListener('load', () => setIsMapApiLoaded(true));
    }
  }, []);

  // 2. Google Map Instance Initializer
  useEffect(() => {
    const google = (window as any).google;
    if (isMapApiLoaded && !isMapApiFailed && mapContainerRef.current && !googleMap && google && activeOrderSimulation) {
      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: -12.046374, lng: -77.042793 }, // Lima default center
        zoom: 13,
        disableDefaultUI: true,
        styles: darkMapStyles
      });

      const renderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#D4AF37', // Lime green color
          strokeWeight: 5
        }
      });

      setGoogleMap(map);
      setDirectionsRenderer(renderer);
    }
  }, [isMapApiLoaded, isMapApiFailed, googleMap, activeOrderSimulation, simulationStep]);

  // 3. Calculate route when order simulation changes
  useEffect(() => {
    const google = (window as any).google;
    if (!isMapApiLoaded || isMapApiFailed || !googleMap || !directionsRenderer || !activeOrderSimulation || !google) return;

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: activeOrderSimulation.origin,
        destination: activeOrderSimulation.destination,
        travelMode: google.maps.TravelMode.DRIVING
      },
      (result: any, status: any) => {
        if (status === google.maps.DirectionsStatus.OK) {
          directionsRenderer.setDirections(result);
          
          if (result.routes && result.routes[0] && result.routes[0].overview_path) {
            setRoutePathPoints(result.routes[0].overview_path);
          }
        } else {
          console.error('Directions request failed due to ' + status);
        }
      }
    );
  }, [googleMap, directionsRenderer, activeOrderSimulation, isMapApiLoaded]);

  // 4. Update vehicle marker position along the route
  useEffect(() => {
    const google = (window as any).google;
    if (!googleMap || routePathPoints.length === 0 || !google || !activeOrderSimulation) return;

    const pathLength = routePathPoints.length;
    let targetPos = routePathPoints[0];

    if (simulationStep === 1) {
      targetPos = routePathPoints[0];
    } else if (simulationStep === 2) {
      targetPos = routePathPoints[Math.floor(pathLength * 0.33)];
    } else if (simulationStep === 3) {
      targetPos = routePathPoints[Math.floor(pathLength * 0.66)];
    } else if (simulationStep === 4) {
      targetPos = routePathPoints[pathLength - 1];
    }

    if (!vehicleMarker) {
      // Draw emoji to canvas
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = '24px sans-serif';
        ctx.fillText(activeOrderSimulation.type === 'taxi' ? '🚗' : '🏍️', 4, 24);
      }
      
      const marker = new google.maps.Marker({
        position: targetPos,
        map: googleMap,
        icon: canvas.toDataURL()
      });
      setVehicleMarker(marker);
    } else {
      vehicleMarker.setPosition(targetPos);
      googleMap.panTo(targetPos);
    }
  }, [googleMap, routePathPoints, simulationStep, vehicleMarker, activeOrderSimulation]);

  // 5. Cleanup maps state when order finishes
  useEffect(() => {
    if (!activeOrderSimulation) {
      setGoogleMap(null);
      setDirectionsRenderer(null);
      setRoutePathPoints([]);
      if (vehicleMarker) {
        vehicleMarker.setMap(null);
        setVehicleMarker(null);
      }
    }
  }, [activeOrderSimulation]);

  const [nearbyOrders, setNearbyOrders] = useState<any[]>([]);

  // Helper para formatear órden de base de datos
  const formatDbOrder = (dbOrder: any) => {
    let cleanDest = dbOrder.destination || '';
    let metadata: any = null;

    if (cleanDest.includes(' ||| ')) {
      const parts = cleanDest.split(' ||| ');
      cleanDest = parts[0];
      try {
        metadata = JSON.parse(parts[1]);
      } catch (e) {
        console.error('Error parsing order metadata:', e);
      }
    }

    const badges = [dbOrder.payment_method];
    if (metadata?.category) {
      const catFormatted = metadata.category.charAt(0).toUpperCase() + metadata.category.slice(1);
      badges.push(catFormatted);
    }

    return {
      id: dbOrder.id,
      price: Number(dbOrder.suggested_price) || 10.0,
      clientName: dbOrder.client_profile?.name || 'Cliente',
      clientAvatar: '👤',
      clientRating: '5.0(1)',
      timeAgo: 'Justo ahora',
      distToClient: '1.5 km',
      distRoute: '4.8 km',
      pickupTitle: dbOrder.origin.split(',')[0],
      pickupDetail: dbOrder.origin,
      badges: badges,
      comment: metadata?.comment || '',
      type: dbOrder.service === 'delivery' || dbOrder.service === 'flete' ? 'delivery' : 'taxi',
      origin: dbOrder.origin,
      destination: cleanDest,
      pickupPhone: metadata?.pickupPhone || dbOrder.client_profile?.phone || '',
      deliveryPhone: metadata?.deliveryPhone || '',
      category: metadata?.category || null
    };
  };

  // Helper para actualizar estado de orden en base de datos
  const updateDbOrderStatus = async (orderId: string, status: string) => {
    if (isPlaceholder) return;
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);
      if (error) throw error;
    } catch (err: any) {
      console.error(`Error actualizando orden a ${status}:`, err.message);
    }
  };



  // Carga inicial y suscripción Realtime en Supabase
  useEffect(() => {
    if (isPlaceholder || !user || user.role !== 'driver') return;

    let isMounted = true;

    const fetchActiveOrders = async () => {
      try {
        let query = supabase
          .from('orders')
          .select('*, client_profile:profiles!client_id(name, phone)')
          .eq('status', 'searching');

        if (user.vehicleType) {
          query = query.eq('service', user.vehicleType);
        }

        const { data, error } = await query
          .or(`driver_id.is.null,driver_id.eq.${user.id}`)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (isMounted && data) {
          const formatted = data.map(formatDbOrder);
          setNearbyOrders(formatted);
        }
      } catch (err: any) {
        console.error('Error fetching active orders:', err.message);
      }
    };

    fetchActiveOrders();

    const channel = supabase
      .channel('driver-orders-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        async (payload: any) => {
          if (!isMounted) return;

          const eventType = payload.eventType;
          const newRow = payload.new;
          const oldRow = payload.old;

          // Check if this update relates to our active bid
          const activeBid = waitingStateRef.current;
          if (activeBid.isOpen && activeBid.order && activeBid.order.id === newRow.id) {
            if (newRow.status === 'driver_incoming' && newRow.driver_id === user.id) {
              setWaitingState(prev => ({ ...prev, status: 'accepted' }));
              setTimeout(() => {
                handleAcceptOrder(formatDbOrder(newRow));
                setWaitingState({ isOpen: false, order: null, countdown: 30, status: 'sending' });
              }, 1200);
            } else if (newRow.driver_id === null || newRow.status === 'cancelled') {
              setWaitingState(prev => ({ ...prev, status: 'rejected' }));
              setTimeout(() => {
                setWaitingState({ isOpen: false, order: null, countdown: 30, status: 'sending' });
              }, 1500);
            }
          }

          const matchesVehicleType = !user.vehicleType || newRow.service === user.vehicleType;

          if (eventType === 'INSERT') {
            if (newRow.status === 'searching' && matchesVehicleType && (newRow.driver_id === null || newRow.driver_id === user.id)) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('name, phone')
                .eq('id', newRow.client_id)
                .single();

              const fullOrder = { ...newRow, client_profile: profile };
              setNearbyOrders(prev => {
                if (prev.some(o => o.id === fullOrder.id)) return prev;
                return [formatDbOrder(fullOrder), ...prev];
              });
            }
          } else if (eventType === 'UPDATE') {
            if (newRow.status === 'searching' && matchesVehicleType && (newRow.driver_id === null || newRow.driver_id === user.id)) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('name, phone')
                .eq('id', newRow.client_id)
                .single();

              const fullOrder = { ...newRow, client_profile: profile };
              setNearbyOrders(prev => {
                const filtered = prev.filter(o => o.id !== fullOrder.id);
                return [formatDbOrder(fullOrder), ...filtered];
              });
            } else {
              setNearbyOrders(prev => prev.filter(o => o.id !== newRow.id));
            }
          } else if (eventType === 'DELETE') {
            setNearbyOrders(prev => prev.filter(o => o.id !== oldRow.id));
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user, isPlaceholder]);

  const handleToggleAvailability = () => {
    setDriverState(prev => ({
      ...prev,
      isAvailable: !prev.isAvailable
    }));
  };

  const handleOpenOrderDetail = (order: any) => {
    setSelectedOrderForDetail(order);
    setBidPrice(order.price);
  };

  const handleAcceptOrder = (order: any) => {
    setActiveOrderSimulation(order);
    setSimulationStep(1); // Paso 1: "Ve a recoger el paquete/cliente"
  };

  const handleRejectOrder = (orderId: string) => {
    setNearbyOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const handleNextSimulationStep = () => {
    if (simulationStep === 1) {
      setSimulationStep(2); // Paso 2: "Pasajero/Paquete recogido"
      updateDbOrderStatus(activeOrderSimulation.id, 'in_progress');
    } else if (simulationStep === 2) {
      setSimulationStep(3); // Paso 3: "En camino al destino"
    } else if (simulationStep === 3) {
      setSimulationStep(4); // Paso 4: "Viaje completado"
      updateDbOrderStatus(activeOrderSimulation.id, 'completed');
    } else if (simulationStep === 4) {
      // Finalizar simulación y sumar ganancias
      const payout = activeOrderSimulation.price;
      setDriverState(prev => ({
        ...prev,
        earnings: prev.earnings + payout,
        jobsCompleted: prev.jobsCompleted + 1
      }));
      setActiveOrderSimulation(null);
      setSimulationStep(0);
      setActiveTab('inicio');
    }
  };

  // Flujo de espera para aprobación del cliente (Bidding / Backup flow)
  const initiateAcceptanceFlow = async (order: any) => {
    if (!isPlaceholder) {
      // Real database order acceptance (bidding/offer stage)
      setWaitingState({
        isOpen: true,
        order,
        countdown: 30,
        status: 'sending'
      });

      try {
        const { error } = await supabase
          .from('orders')
          .update({
            driver_id: user?.id || null,
            suggested_price: order.price
          })
          .eq('id', order.id);

        if (error) throw error;

        setWaitingState(prev => ({ ...prev, status: 'waiting' }));
      } catch (err: any) {
        console.error('Error updating order for acceptance:', err.message);
        setWaitingState(prev => ({ ...prev, status: 'rejected', countdown: 0 }));
        alert('Error al ofertar tarifa: ' + err.message);
        setTimeout(() => {
          setWaitingState({ isOpen: false, order: null, countdown: 30, status: 'sending' });
        }, 1500);
      }
      return;
    }

    setWaitingState({
      isOpen: true,
      order,
      countdown: 8,
      status: 'sending'
    });

    let currentCountdown = 8;
    const timerId = setInterval(() => {
      currentCountdown -= 1;
      
      setWaitingState(prev => {
        if (!prev.isOpen) {
          clearInterval(timerId);
          return prev;
        }

        let nextStatus = prev.status;
        if (currentCountdown === 6) {
          nextStatus = 'waiting';
        } else if (currentCountdown === 3) {
          // 75% éxito de aceptación, 25% rechazo (otro motorizado seleccionado)
          const rand = Math.random();
          nextStatus = rand < 0.75 ? 'accepted' : 'rejected';
        }

        if (currentCountdown <= 0) {
          clearInterval(timerId);
          
          // Acción final tras terminar la cuenta regresiva
          setTimeout(() => {
            if (nextStatus === 'accepted') {
              handleAcceptOrder(prev.order);
            }
            setWaitingState({ isOpen: false, order: null, countdown: 8, status: 'sending' });
          }, 1200);
        }

        return {
          ...prev,
          countdown: currentCountdown,
          status: nextStatus
        };
      });
    }, 1000);
  };

  const handleCancelWaiting = async () => {
    if (!isPlaceholder && waitingState.order) {
      try {
        await supabase
          .from('orders')
          .update({ driver_id: null })
          .eq('id', waitingState.order.id);
      } catch (err: any) {
        console.error('Error al cancelar oferta del conductor:', err.message);
      }
    }
    setWaitingState({ isOpen: false, order: null, countdown: 30, status: 'sending' });
  };

  // Filtrado de solicitudes basado en la distancia al destino preferido del motorizado
  const getFilteredOrders = () => {
    if (!isFilterActive || filterDestination === 'none') {
      return nearbyOrders;
    }

    return nearbyOrders.filter(order => {
      let distanceToPrefDest = 999;
      
      if (filterDestination === 'La Molina') {
        if (order.id === 'o3') distanceToPrefDest = 2.5; // Nataly (La Molina)
        if (order.id === 'o1') distanceToPrefDest = 18.2; // Rubí (Bellavista)
        if (order.id === 'o2') distanceToPrefDest = 21.0; // usuario (Los Olivos)
      } else if (filterDestination === 'Bellavista') {
        if (order.id === 'o1') distanceToPrefDest = 1.2; // Rubí (Bellavista)
        if (order.id === 'o2') distanceToPrefDest = 11.5; // usuario (Los Olivos)
        if (order.id === 'o3') distanceToPrefDest = 22.0; // Nataly (La Molina)
      } else if (filterDestination === 'Los Olivos') {
        if (order.id === 'o2') distanceToPrefDest = 1.8; // usuario (Los Olivos)
        if (order.id === 'o1') distanceToPrefDest = 9.8; // Rubí (Bellavista)
        if (order.id === 'o3') distanceToPrefDest = 24.5; // Nataly (La Molina)
      }

      return distanceToPrefDest <= filterRadius;
    });
  };

  const visibleOrders = getFilteredOrders();

  return (
    <div className="mobile-container dark-theme">
      <div className="peru-bg-watermark tumi-sipan-bg"></div>
      {/* SIMULACIÓN DE RUTA ACTIVA (AQUÍ APARECE EL MAPA UNA VEZ ACEPTADO) */}
      {activeOrderSimulation && simulationStep > 0 && (
        <div className="driver-route-simulation-layout">
          {/* MAPA FLOTANTE EN SIMULACIÓN */}
          <div className="mock-map" style={{ height: '55%', position: 'relative', overflow: 'hidden' }}>
            {isMapApiLoaded && !isMapApiFailed ? (
              <>
                <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
                
                {/* Indicador de Google Maps Real en la cabecera */}
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: '72px', 
                    right: '12px', 
                    backgroundColor: 'rgba(212, 175, 55, 0.1)', 
                    color: 'var(--accent-lime)', 
                    fontSize: '9px', 
                    fontWeight: '800', 
                    padding: '4px 8px', 
                    borderRadius: '20px', 
                    border: '1px solid rgba(212, 175, 55, 0.2)',
                    zIndex: 10
                  }}
                >
                  ⚡ MAPA REAL ACTIVO
                </div>
              </>
            ) : (
              <>
                <div className="map-grid-pattern" />
                
                {/* Indicador de Modo Demo */}
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: '72px', 
                    right: '12px', 
                    backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                    color: '#EF4444', 
                    fontSize: '9px', 
                    fontWeight: '800', 
                    padding: '4px 8px', 
                    borderRadius: '20px', 
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    zIndex: 10
                  }}
                >
                  ⚠️ MODO DEMO (SIMULADO)
                </div>

                {/* Línea de ruta simulada animada en Demo Mode */}
                <svg 
                  viewBox="0 0 100 100"
                  style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    height: '100%', 
                    pointerEvents: 'none',
                    zIndex: 2 
                  }}
                >
                  <path
                    d="M 50 65 Q 43 53, 42 35"
                    fill="none"
                    stroke="var(--accent-lime)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeDasharray="2, 3"
                    style={{
                      animation: 'routeFlow 1.2s linear infinite'
                    }}
                  />
                </svg>

                <style>{`
                  @keyframes routeFlow {
                    to {
                      stroke-dashoffset: -5;
                    }
                  }
                `}</style>

                {/* Origen */}
                <div className="map-marker origin-pin" style={{ top: '65%', left: '50%' }}>
                  <div className="marker-core" />
                  <span className="marker-label">A</span>
                </div>
                
                {/* Destino */}
                <div className="map-marker dest-pin" style={{ top: '35%', left: '42%' }}>
                  <div className="marker-core" />
                  <span className="marker-label">B</span>
                </div>

                {/* Vehículo en movimiento según paso */}
                {simulationStep === 1 && (
                  <div className="map-marker driver-car pulse" style={{ top: '62%', left: '49%' }}>
                    <span>🏍️</span>
                  </div>
                )}
                {simulationStep === 2 && (
                  <div className="map-marker driver-car pulse" style={{ top: '65%', left: '50%' }}>
                    <span>📦</span>
                  </div>
                )}
                {simulationStep === 3 && (
                  <div className="map-marker driver-car pulse" style={{ top: '48%', left: '45%' }}>
                    <span>📦</span>
                  </div>
                )}
                {simulationStep === 4 && (
                  <div className="map-marker driver-car pulse" style={{ top: '35%', left: '42%' }}>
                    <span>✓</span>
                  </div>
                )}
              </>
            )}

            {/* Botón flotante para Navegación Externa */}
            <button
              onClick={handleOpenExternalNavigation}
              style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                backgroundColor: '#1E1E20',
                border: '2px solid var(--accent-lime)',
                color: 'var(--accent-lime)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4)',
                zIndex: 100,
                transition: 'transform 0.2s',
              }}
              className="nav-app-btn"
              title="Abrir navegador externo"
            >
              <Navigation size={22} style={{ fill: 'currentColor' }} />
            </button>

            {/* Indicador de Estado Superior */}
            <div className="floating-header" style={{ width: '90%', zIndex: 10 }}>
              <div className="trip-stage-banner">
                {simulationStep === 1 && <span className="stage-title">1. Ve a recoger el paquete/cliente</span>}
                {simulationStep === 2 && <span className="stage-title">2. Paquete / Pasajero Recogido</span>}
                {simulationStep === 3 && <span className="stage-title">3. En camino al destino de entrega</span>}
                {simulationStep === 4 && <span className="stage-title">4. Mandado Completado</span>}
              </div>
            </div>
          </div>

          {/* DETALLES DE NAVEGACIÓN INFERIOR */}
          <div className="driver-nav-details-panel">
            {simulationStep < 4 ? (
              <>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
                  <div className="driver-avatar-circle" style={{ width: '40px', height: '40px', fontSize: '18px' }}>
                    <span>{activeOrderSimulation.clientAvatar || '👤'}</span>
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: '800' }}>{activeOrderSimulation.clientName}</span>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--accent-lime)' }}>S/ {activeOrderSimulation.price.toFixed(2)}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      ⭐ {activeOrderSimulation.clientRating} • Pago en efectivo
                    </span>
                  </div>
                </div>

                <div className="trip-locations-box" style={{ width: '100%', marginTop: '12px', backgroundColor: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '11.5px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--accent-lime)', marginTop: '3px' }}>●</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: '700' }}>PUNTO DE RECOJO:</span>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '12px' }}>{activeOrderSimulation.origin}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                    <span style={{ color: '#EF4444', marginTop: '3px' }}>●</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: '700' }}>DESTINO DE ENTREGA:</span>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '12px' }}>{activeOrderSimulation.destination}</strong>
                    </div>
                  </div>
                </div>

                {/* Detalles del paquete/envío */}
                {(activeOrderSimulation.category || activeOrderSimulation.comment || activeOrderSimulation.pickupPhone || activeOrderSimulation.deliveryPhone) && (
                  <div style={{ width: '100%', marginTop: '10px', backgroundColor: 'rgba(212, 175, 55, 0.05)', padding: '10px 12px', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '11.5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--accent-lime)', fontWeight: '800', letterSpacing: '0.5px' }}>DETALLES DEL ENVÍO</span>
                    {activeOrderSimulation.category && (
                      <div>
                        📦 <strong>Categoría:</strong> {
                          activeOrderSimulation.category === 'alimentos' ? '🍔 Alimentos' : 
                          activeOrderSimulation.category === 'ropa' ? '👕 Ropa' : 
                          activeOrderSimulation.category === 'documentos' ? '📄 Documentos' : 
                          activeOrderSimulation.category === 'medicinas' ? '💊 Prod. Farmacéuticos' : 
                          activeOrderSimulation.category
                        }
                      </div>
                    )}
                    {activeOrderSimulation.comment && (
                      <div style={{ fontStyle: 'italic' }}>
                        💬 <strong>Indicaciones:</strong> "{activeOrderSimulation.comment}"
                      </div>
                    )}
                    {(activeOrderSimulation.pickupPhone || activeOrderSimulation.deliveryPhone) && (
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', marginTop: '2px' }}>
                        {activeOrderSimulation.pickupPhone && (
                          <span>📞 <strong>Recojo:</strong> <a href={`tel:${activeOrderSimulation.pickupPhone}`} style={{ color: 'var(--accent-lime)', textDecoration: 'none', fontWeight: 'bold' }}>{activeOrderSimulation.pickupPhone}</a></span>
                        )}
                        {activeOrderSimulation.deliveryPhone && (
                          <span>📞 <strong>Entrega:</strong> <a href={`tel:${activeOrderSimulation.deliveryPhone}`} style={{ color: 'var(--accent-lime)', textDecoration: 'none', fontWeight: 'bold' }}>{activeOrderSimulation.deliveryPhone}</a></span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%', marginTop: '12px', fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  <div className="stat-mini-card">
                    <span>DISTANCIA</span>
                    <strong>{activeOrderSimulation.distRoute}</strong>
                  </div>
                  <div className="stat-mini-card">
                    <span>TIEMPO</span>
                    <strong>~22 min</strong>
                  </div>
                </div>

                <button className="btn btn-primary btn-block" onClick={handleNextSimulationStep} style={{ marginTop: '16px', height: '44px' }}>
                  {simulationStep === 1 && 'Iniciar navegación (Llegué al origen)'}
                  {simulationStep === 2 && 'Marcar como: Paquete Recogido'}
                  {simulationStep === 3 && 'Marcar como: Entregado (Completar viaje)'}
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(212, 175, 55, 0.1)', color: 'var(--accent-lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                  <CheckCircle size={28} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '800' }}>¡Viaje Completado con Éxito!</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Has ganado **S/ {activeOrderSimulation.price.toFixed(2)}** en este servicio.
                </p>

                <button className="btn btn-primary btn-block" onClick={handleNextSimulationStep} style={{ marginTop: '18px' }}>
                  Volver al inicio
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PANTALLA INICIO CONDUCTOR (SOLO SOLICITUDES COMPLETAS) */}
      {activeTab === 'inicio' && !activeOrderSimulation && (
        <div className="view-layout">
          {/* Header de la pantalla de solicitudes (estilo captura de referencia) */}
          <div className="view-header-requests">
            <button className="header-icon-btn" onClick={() => setIsDrawerOpen(true)}>
              <Menu size={20} />
            </button>
            
            <button 
              className={`status-capsule-btn ${driverState.isAvailable ? 'available' : 'busy'}`}
              onClick={handleToggleAvailability}
            >
              <span>{driverState.isAvailable ? 'Disponible' : 'Ocupado'}</span>
            </button>

            {/* BOTÓN NUEVO: FILTRO DE DESTINO */}
            <button 
              className={`header-icon-btn ${isFilterActive ? 'active' : ''}`} 
              onClick={() => setIsFilterModalOpen(true)}
              style={{ position: 'relative', color: isFilterActive ? 'var(--accent-lime)' : 'var(--text-primary)' }}
            >
              <Filter size={18} />
              {isFilterActive && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-lime)', position: 'absolute', top: '8px', right: '8px' }} />
              )}
            </button>
            
            <button className="header-icon-btn" onClick={() => alert('Configuración')}>
              <span>⚙️</span>
            </button>
          </div>

          <div className="view-body-requests">
            <div className="nearby-requests-section-full">
              <div className="requests-list-full">
                {visibleOrders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {isFilterActive 
                      ? 'No hay solicitudes hacia tu destino preferido dentro de este radio.' 
                      : 'No hay solicitudes de viaje cercanas en este momento.'}
                  </div>
                ) : (
                  visibleOrders.map(order => (
                    <div 
                      key={order.id} 
                      className="request-card-driver-premium"
                      onClick={() => handleOpenOrderDetail(order)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Fila Principal de la Tarjeta */}
                      <div className="request-card-body-row">
                        
                        {/* Columna Izquierda: Cliente */}
                        <div className="client-column">
                          <div className="client-avatar-circle-mini">
                            {order.clientAvatar}
                          </div>
                          <span className="client-name-label">{order.clientName}</span>
                          <span className="client-rating-label">⭐ {order.clientRating}</span>
                          <span className="client-time-label">{order.timeAgo}</span>
                        </div>

                        {/* Columna Derecha: Detalles del Viaje */}
                        <div className="details-column">
                          
                          {/* Cabecera del Detalle: Precio y Distancias */}
                          <div className="details-header-row">
                            <div className="price-tag-large">
                              PEN {order.price.toFixed(2)}
                            </div>
                            
                            <div className="distance-indicators">
                              <span className="dist-indicator">
                                <span className="dist-icon-a">A</span> ~{order.distToClient}
                              </span>
                              <span className="dist-indicator">
                                <span className="dist-icon-route">🛣️</span> ~{order.distRoute}
                              </span>
                            </div>

                            <div className="more-options-btn">
                              <MoreVertical size={16} />
                            </div>
                          </div>

                          {/* Direcciones (Recojo y Entrega) */}
                          <div className="address-section" style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '6px' }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', fontSize: '12.5px', lineHeight: '1.3' }}>
                              <span style={{ color: 'var(--accent-lime)', marginTop: '3px' }}>●</span>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                Recojo: <strong style={{ color: 'var(--text-primary)' }}>{formatTripAddress(order.origin)}</strong>
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', fontSize: '12.5px', lineHeight: '1.3' }}>
                              <span style={{ color: '#EF4444', marginTop: '3px' }}>●</span>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                Entrega: <strong style={{ color: 'var(--text-primary)' }}>{formatTripAddress(order.destination)}</strong>
                              </span>
                            </div>
                          </div>

                          {/* Etiquetas/Badges */}
                          {order.badges && order.badges.length > 0 && (
                            <div className="badges-row">
                              {order.badges.map((badge: any) => (
                                <span 
                                  key={badge} 
                                  className={`tag-badge ${badge.toLowerCase() === 'yape' ? 'yape' : 'general'}`}
                                >
                                  {badge}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Comentario del Cliente */}
                          {order.comment && (
                            <div className="client-comment-box">
                              {order.comment}
                            </div>
                          )}

                        </div>
                      </div>

                      {/* Botones de Acción */}
                      <div className="request-card-actions-row" onClick={(e) => e.stopPropagation()}>
                        <button 
                          className="btn-reject-custom" 
                          onClick={() => handleRejectOrder(order.id)}
                        >
                          Rechazar
                        </button>
                        <button 
                          className="btn-accept-custom" 
                          onClick={() => initiateAcceptanceFlow(order)}
                        >
                          Aceptar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANTALLA RENDIMIENTO/GANANCIAS */}
      {activeTab === 'ganancias' && (
        <div className="view-layout">
          <div className="view-header" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <h2 className="view-title" style={{ fontSize: '17px', margin: 0 }}>Desempeño</h2>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Historial de tus ingresos como motorizado</span>
          </div>

          <div className="view-body" style={{ padding: '16px 14px' }}>
            <div className="wallet-card" style={{ backgroundColor: 'rgba(212, 175, 55, 0.05)', borderColor: 'var(--accent-lime)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '800' }}>TOTAL ESTA SEMANA</span>
              <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--accent-lime)', marginTop: '4px' }}>S/ {driverState.earnings.toFixed(2)}</span>
              <button className="btn btn-primary btn-md" style={{ marginTop: '12px', height: '36px', fontSize: '12px' }} onClick={() => alert('Retiro procesado a tu Yape.')}>
                Retirar fondos a Yape / Cuenta
              </button>
            </div>

            {/* MUDADO: RESUMEN DE ESTADÍSTICAS DEL CONDUCTOR */}
            <div className="driver-stats-grid" style={{ marginTop: '20px', marginBottom: '20px' }}>
              <div className="stat-card-driver">
                <span className="stat-card-val">{driverState.jobsCompleted}</span>
                <span className="stat-card-label">Viajes</span>
              </div>
              <div className="stat-card-driver">
                <span className="stat-card-val">{driverState.hoursActive}h</span>
                <span className="stat-card-label">Horas activo</span>
              </div>
              <div className="stat-card-driver">
                <span className="stat-card-val">4.92★</span>
                <span className="stat-card-label">Calificación</span>
              </div>
            </div>

            {/* GRÁFICO SIMULADO */}
            <div style={{ marginTop: '10px' }}>
              <span className="section-title">GANANCIAS POR DÍA</span>
              <div className="earnings-chart-mock" style={{ display: 'flex', gap: '8px', height: '140px', alignItems: 'end', marginTop: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                {[
                  { day: 'Lun', val: 35 },
                  { day: 'Mar', val: 80 },
                  { day: 'Mié', val: 50 },
                  { day: 'Jue', val: 95 },
                  { day: 'Vie', val: 75 },
                  { day: 'Sáb', val: 120 },
                  { day: 'Dom', val: 100 }
                ].map(d => (
                  <div key={d.day} style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '100%', height: `${d.val}px`, backgroundColor: d.day === 'Dom' ? 'var(--accent-lime)' : 'rgba(212, 175, 55, 0.3)', borderRadius: '4px' }} />
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{d.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANTALLA PERFIL */}
      {activeTab === 'perfil' && (
        <div className="view-layout">
          <div className="view-body" style={{ padding: '24px 14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '24px' }}>
              <div className="profile-avatar-large" style={{ borderColor: 'var(--accent-lime)' }}>
                <span>👨</span>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', marginTop: '12px' }}>{user?.name || 'Carlos Quispe'}</h3>
              <p style={{ fontSize: '11px', color: 'var(--accent-lime)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                <CheckCircle2 size={12} />
                CONDUCTOR VERIFICADO
              </p>
            </div>

            <span className="section-title">MI VEHÍCULO</span>
            <div className="vehicle-card" style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: '8px 0 18px 0', padding: '10px 12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <span style={{ fontSize: '24px' }}>🛵</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', fontWeight: '700' }}>Moto Lineal (2022)</span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>Placa: ABC-123 • Color: Negro</span>
              </div>
            </div>

            <span className="section-title">DOCUMENTOS PRESENTADOS</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {[
                { name: 'Licencia de conducir', status: '✓ OK' },
                { name: 'SOAT vigente', status: '✓ OK' },
                { name: 'Revisión técnica', status: '✓ OK' },
                { name: 'Tarjeta de propiedad', status: '✓ OK' }
              ].map(doc => (
                <div key={doc.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
                  <span>{doc.name}</span>
                  <span style={{ color: 'var(--accent-lime)', fontWeight: '700' }}>{doc.status}</span>
                </div>
              ))}
            </div>

            <span className="section-title" style={{ marginTop: '18px', display: 'block' }}>APLICATIVO DE NAVEGACIÓN</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '10px 12px', 
                  backgroundColor: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  borderColor: preferredNavigationApp === 'google_maps' ? 'var(--accent-lime)' : 'var(--border-color)'
                }}
                onClick={() => handleSetNavigationApp('google_maps')}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '20px' }}>🗺️</span>
                  <span style={{ fontSize: '12.5px', fontWeight: '700' }}>Google Maps</span>
                </div>
                <input 
                  type="radio" 
                  checked={preferredNavigationApp === 'google_maps'} 
                  onChange={() => handleSetNavigationApp('google_maps')} 
                  style={{ accentColor: 'var(--accent-lime)' }}
                />
              </div>

              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '10px 12px', 
                  backgroundColor: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  borderColor: preferredNavigationApp === 'waze' ? 'var(--accent-lime)' : 'var(--border-color)'
                }}
                onClick={() => handleSetNavigationApp('waze')}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '20px' }}>🚙</span>
                  <span style={{ fontSize: '12.5px', fontWeight: '700' }}>Waze</span>
                </div>
                <input 
                  type="radio" 
                  checked={preferredNavigationApp === 'waze'} 
                  onChange={() => handleSetNavigationApp('waze')} 
                  style={{ accentColor: 'var(--accent-lime)' }}
                />
              </div>
            </div>

            <div className="menu-list-group" style={{ marginTop: '24px' }}>
              <div 
                className="menu-item-row" 
                onClick={() => switchRole('client')}
                style={{ color: 'var(--accent-lime)', fontWeight: '700' }}
              >
                <User size={15} />
                <span>Cambiar a Modo Pasajero</span>
              </div>

              <div className="menu-item-row" onClick={() => setStep('verification')}>
                <ShieldCheck size={15} />
                <span>Re-verificar documentos</span>
              </div>

              <div className="menu-item-row" onClick={logout} style={{ color: '#EF4444' }}>
                <LogOut size={15} />
                <span>Cerrar sesión</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DETALLE DE SOLICITUD (BOTTOM SHEET) */}
      {selectedOrderForDetail && (
        <div className="modal-overlay" onClick={() => setSelectedOrderForDetail(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ borderTopLeftRadius: '24px', borderTopRightRadius: '24px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <span className="modal-title" style={{ fontSize: '15px', fontWeight: '800' }}>Detalle de la solicitud</span>
              <button className="modal-close-btn" onClick={() => setSelectedOrderForDetail(null)}>
                <span>✕</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
              
              {/* Información del Cliente */}
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div className="client-avatar-circle-mini" style={{ width: '48px', height: '48px', fontSize: '22px', borderRight: 'none', paddingRight: 0 }}>
                  {selectedOrderForDetail.clientAvatar}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '800', margin: 0 }}>{selectedOrderForDetail.clientName}</h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>⭐ {selectedOrderForDetail.clientRating} • Cliente Verificado</span>
                </div>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{selectedOrderForDetail.timeAgo}</span>
              </div>

              {/* Distancias */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="stat-mini-card" style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>DISTANCIA AL RECOJO</span>
                  <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>~{selectedOrderForDetail.distToClient}</strong>
                </div>
                <div className="stat-mini-card" style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>DISTANCIA DE RUTA</span>
                  <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>~{selectedOrderForDetail.distRoute}</strong>
                </div>
              </div>

              {/* Ruta Detallada */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div>
                  <span style={{ color: 'var(--success)', fontSize: '11px', fontWeight: '800', marginRight: '6px' }}>[A] RECOJO:</span>
                  <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{selectedOrderForDetail.pickupTitle}</strong>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '0px', marginTop: '2px' }}>{selectedOrderForDetail.pickupDetail}</div>
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
                  <span style={{ color: 'var(--danger)', fontSize: '11px', fontWeight: '800', marginRight: '6px' }}>[B] ENTREGA:</span>
                  <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{selectedOrderForDetail.destination}</strong>
                </div>
              </div>

              {/* Comentarios o Notas especiales */}
              {selectedOrderForDetail.comment && (
                <div style={{ backgroundColor: 'rgba(212, 175, 55, 0.05)', borderLeft: '3px solid var(--accent-lime)', padding: '10px 12px', borderRadius: '4px', fontSize: '11.5px', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                  <strong>Nota del cliente:</strong> {selectedOrderForDetail.comment}
                </div>
              )}

              {/* Contraoferta (Bidding) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700' }}>TARIFA PROPUESTA</span>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                  <button 
                    className="bid-adjust-btn" 
                    onClick={() => setBidPrice(prev => Math.max(selectedOrderForDetail.price, prev - 1))}
                    disabled={bidPrice <= selectedOrderForDetail.price}
                  >
                    -
                  </button>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    S/ {bidPrice.toFixed(2)}
                  </div>
                  <button 
                    className="bid-adjust-btn" 
                    onClick={() => setBidPrice(prev => prev + 1)}
                  >
                    +
                  </button>
                </div>

                {/* Accesos rápidos de tarifa */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  {[0, 1, 2, 3].map(add => {
                    const priceOption = selectedOrderForDetail.price + add;
                    return (
                      <button 
                        key={add} 
                        className="btn btn-secondary btn-sm"
                        style={{ borderColor: bidPrice === priceOption ? 'var(--accent-lime)' : 'var(--border-color)', color: bidPrice === priceOption ? 'var(--accent-lime)' : 'var(--text-primary)' }}
                        onClick={() => setBidPrice(priceOption)}
                      >
                        S/ {priceOption.toFixed(0)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botones de Aceptación */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  className="btn btn-secondary btn-block" 
                  onClick={() => setSelectedOrderForDetail(null)}
                  style={{ height: '46px', flex: 1 }}
                >
                  Cancelar
                </button>
                <button 
                  className="btn btn-primary btn-block" 
                  onClick={() => {
                    initiateAcceptanceFlow({ ...selectedOrderForDetail, price: bidPrice });
                    setSelectedOrderForDetail(null);
                  }}
                  style={{ height: '46px', flex: 2 }}
                >
                  Ofrecer Tarifa (S/ {bidPrice.toFixed(2)})
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL DE FILTRO DE DESTINO PREFERIDO */}
      {isFilterModalOpen && (
        <div className="modal-overlay" onClick={() => setIsFilterModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ borderTopLeftRadius: '24px', borderTopRightRadius: '24px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <span className="modal-title" style={{ fontSize: '15px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={16} style={{ color: 'var(--accent-lime)' }} />
                Filtro de Destino Preferido
              </span>
              <button className="modal-close-btn" onClick={() => setIsFilterModalOpen(false)}>
                <span>✕</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Selecciona tu destino preferido y establece el radio máximo de perímetro. Filtrará los pedidos en tiempo real.
              </p>

              {/* Selección de Destino */}
              <div className="input-field-group">
                <label className="input-label">DIRECCIÓN O ZONA DE DESTINO</label>
                <select 
                  className="form-select"
                  value={filterDestination}
                  onChange={(e) => setFilterDestination(e.target.value)}
                  style={{ width: '100%', height: '44px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', padding: '0 10px' }}
                >
                  <option value="none">-- Selecciona una zona preferida --</option>
                  <option value="La Molina">La Molina / Surco (Mall Aventura / Javier Prado)</option>
                  <option value="Bellavista">Bellavista / San Miguel (Los Heros / El Trebol)</option>
                  <option value="Los Olivos">Los Olivos / Cono Norte (Panamericana / Montero)</option>
                </select>
              </div>

              {/* Selección de Radio de Perímetro */}
              <div className="input-field-group">
                <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>RADIO DE PERÍMETRO AL DESTINO</span>
                  <span style={{ color: 'var(--accent-lime)', fontWeight: '800' }}>{filterRadius} km</span>
                </label>
                
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  {[2, 5, 10, 20].map(r => (
                    <button 
                      key={r}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ 
                        flex: 1, 
                        borderColor: filterRadius === r ? 'var(--accent-lime)' : 'var(--border-color)',
                        color: filterRadius === r ? 'var(--accent-lime)' : 'var(--text-primary)',
                        backgroundColor: filterRadius === r ? 'rgba(212, 175, 55, 0.05)' : 'var(--bg-card)'
                      }}
                      onClick={() => setFilterRadius(r)}
                    >
                      {r} km
                    </button>
                  ))}
                </div>
              </div>

              {/* Estado de activación */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: '700' }}>Activar Filtro Preferido</span>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>Solo ver pedidos en el perímetro</span>
                </div>
                
                <button 
                  type="button"
                  onClick={() => setIsFilterActive(prev => !prev)}
                  style={{
                    width: '44px',
                    height: '24px',
                    borderRadius: '12px',
                    backgroundColor: isFilterActive ? 'var(--accent-lime)' : 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <span 
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: isFilterActive ? 'var(--bg-main)' : 'var(--text-secondary)',
                      position: 'absolute',
                      top: '2px',
                      left: isFilterActive ? '22px' : '2px',
                      transition: 'left 0.2s'
                    }}
                  />
                </button>
              </div>

              {/* Botones de acción del filtro */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button"
                  className="btn btn-secondary btn-block" 
                  onClick={() => {
                    setIsFilterActive(false);
                    setFilterDestination('none');
                    setIsFilterModalOpen(false);
                  }}
                  style={{ height: '46px', flex: 1 }}
                >
                  Desactivar
                </button>
                
                <button 
                  type="button"
                  className="btn btn-primary btn-block" 
                  onClick={() => {
                    if (filterDestination === 'none') {
                      alert('Por favor selecciona una zona o destino.');
                      return;
                    }
                    setIsFilterActive(true);
                    setIsFilterModalOpen(false);
                  }}
                  style={{ height: '46px', flex: 2 }}
                >
                  Aplicar Filtro
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL ESPERANDO ACEPTACIÓN DEL CLIENTE (BACKUP / NEGOCIACIÓN DE TARIFAS) */}
      {waitingState.isOpen && waitingState.order && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={handleCancelWaiting}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px 20px', textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              
              {/* Spinner animado según el estado */}
              <div className="waiting-spinner-container">
                {waitingState.status === 'sending' && (
                  <div className="spinner-ring sending">
                    <span>⚡</span>
                  </div>
                )}
                {waitingState.status === 'waiting' && (
                  <div className="spinner-ring pulsing">
                    <span>💬</span>
                  </div>
                )}
                {waitingState.status === 'accepted' && (
                  <div className="spinner-ring success-check">
                    <span>✓</span>
                  </div>
                )}
                {waitingState.status === 'rejected' && (
                  <div className="spinner-ring error-cross">
                    <span>✕</span>
                  </div>
                )}
              </div>

              {/* Títulos y Estados explicativos */}
              <div>
                {waitingState.status === 'sending' && (
                  <>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>Enviando tu oferta...</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Enviando tarifa de **S/ {waitingState.order.price.toFixed(2)}** a {waitingState.order.clientName}
                    </p>
                  </>
                )}
                {waitingState.status === 'waiting' && (
                  <>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>Esperando respuesta...</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {waitingState.order.clientName} está revisando tu oferta de servicio.
                    </p>
                  </>
                )}
                {waitingState.status === 'accepted' && (
                  <>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--success)', margin: 0 }}>¡Oferta Aceptada!</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {waitingState.order.clientName} te ha seleccionado. Iniciando viaje...
                    </p>
                  </>
                )}
                {waitingState.status === 'rejected' && (
                  <>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#EF4444', margin: 0 }}>Oferta no seleccionada</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      El cliente seleccionó a otro conductor o canceló la solicitud.
                    </p>
                  </>
                )}
              </div>

              {/* Barra de progreso de cuenta regresiva */}
              <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden', marginTop: '4px' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    backgroundColor: waitingState.status === 'accepted' 
                      ? 'var(--success)' 
                      : waitingState.status === 'rejected' 
                        ? '#EF4444' 
                        : 'var(--accent-lime)', 
                    width: `${(waitingState.countdown / 8) * 100}%`,
                    transition: 'width 1s linear'
                  }} 
                />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tiempo restante: {waitingState.countdown}s</span>

              {/* Botón de Cancelar Oferta */}
              {waitingState.status !== 'accepted' && (
                <button 
                  className="btn btn-secondary btn-block"
                  onClick={handleCancelWaiting}
                  style={{ height: '42px', marginTop: '8px' }}
                >
                  Cancelar Oferta
                </button>
              )}

            </div>
          </div>
        </div>
      )}

      {/* BARRA DE NAVEGACIÓN INFERIOR */}
      {!activeOrderSimulation && (
        <div className="bottom-nav-bar">
          <div 
            className={`nav-tab ${activeTab === 'inicio' ? 'active' : ''}`}
            onClick={() => setActiveTab('inicio')}
          >
            <List size={18} />
            <span>Solicitudes</span>
          </div>

          <div 
            className={`nav-tab ${activeTab === 'ganancias' ? 'active' : ''}`}
            onClick={() => setActiveTab('ganancias')}
          >
            <TrendingUp size={18} />
            <span>Desempeño</span>
          </div>

          <div 
            className={`nav-tab ${activeTab === 'perfil' ? 'active' : ''}`}
            onClick={() => setActiveTab('perfil')}
          >
            <User size={18} />
            <span>Mi Cuenta</span>
          </div>
        </div>
      )}

      {/* SIDE DRAWER (MENÚ LATERAL) */}
      {isDrawerOpen && (
        <div 
          className="drawer-overlay" 
          onClick={() => setIsDrawerOpen(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: 2000,
            display: 'flex',
            justifyContent: 'flex-start',
            backdropFilter: 'blur(4px)',
            transition: 'all 0.3s ease'
          }}
        >
          <div 
            className="drawer-container" 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '82%',
              maxWidth: '300px',
              height: '100%',
              backgroundColor: '#0F0F10',
              borderRight: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px 18px',
              boxSizing: 'border-box',
              animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* 1. SECCIÓN DE PERFIL */}
            <div 
              className="drawer-profile-section" 
              onClick={() => {
                setIsDrawerOpen(false);
                setActiveTab('perfil');
              }}
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                paddingBottom: '20px', 
                borderBottom: '1px solid var(--border-color)',
                cursor: 'pointer',
                marginBottom: '20px'
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div 
                  className="drawer-avatar" 
                  style={{ 
                    width: '46px', 
                    height: '46px', 
                    borderRadius: '50%', 
                    backgroundColor: 'var(--bg-secondary)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    border: '1.5px solid var(--border-color)',
                    overflow: 'hidden'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>👤</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '15px', fontWeight: '800', color: '#FFFFFF' }}>
                    {user?.name || 'Hector Manuel'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <span style={{ color: '#EAB308', fontSize: '11px' }}>⭐⭐⭐⭐⭐</span>
                    <span style={{ fontSize: '10px', color: '#8F909A', fontWeight: '600' }}>5.00 (98)</span>
                  </div>
                </div>
              </div>
              <ChevronRight size={18} style={{ color: '#8F909A' }} />
            </div>

            {/* 2. OPCIONES DEL MENÚ */}
            <div className="drawer-menu-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
              <div 
                className={`drawer-menu-item ${activeTab === 'inicio' ? 'active' : ''}`} 
                onClick={() => { 
                  setIsDrawerOpen(false); 
                  setActiveTab('inicio'); 
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: activeTab === 'inicio' ? 'var(--text-primary)' : '#8F909A',
                  backgroundColor: activeTab === 'inicio' ? 'rgba(212, 175, 55, 0.08)' : 'transparent',
                  fontWeight: activeTab === 'inicio' ? '700' : '500',
                  fontSize: '13.5px',
                  transition: 'all 0.2s'
                }}
              >
                <Car size={18} style={{ color: activeTab === 'inicio' ? 'var(--accent-lime)' : '#8F909A' }} />
                <span>Ciudad</span>
              </div>

              <div 
                className={`drawer-menu-item ${activeTab === 'ganancias' ? 'active' : ''}`} 
                onClick={() => { 
                  setIsDrawerOpen(false); 
                  setActiveTab('ganancias'); 
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: activeTab === 'ganancias' ? 'var(--text-primary)' : '#8F909A',
                  backgroundColor: activeTab === 'ganancias' ? 'rgba(212, 175, 55, 0.08)' : 'transparent',
                  fontWeight: activeTab === 'ganancias' ? '700' : '500',
                  fontSize: '13.5px',
                  transition: 'all 0.2s'
                }}
              >
                <History size={18} style={{ color: activeTab === 'ganancias' ? 'var(--accent-lime)' : '#8F909A' }} />
                <span>Historial de solicitudes</span>
              </div>

              <div 
                className="drawer-menu-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: '#8F909A',
                  fontWeight: '500',
                  fontSize: '13.5px'
                }}
              >
                <Bell size={18} />
                <span style={{ flexGrow: 1 }}>Notificaciones</span>
                <span 
                  style={{
                    backgroundColor: '#EF4444',
                    color: '#FFFFFF',
                    fontSize: '9px',
                    fontWeight: '800',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  1
                </span>
              </div>

              <div 
                className="drawer-menu-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: '#8F909A',
                  fontWeight: '500',
                  fontSize: '13.5px'
                }}
              >
                <Shield size={18} />
                <span>Seguridad</span>
              </div>

              <div 
                className={`drawer-menu-item ${activeTab === 'perfil' ? 'active' : ''}`} 
                onClick={() => { 
                  setIsDrawerOpen(false); 
                  setActiveTab('perfil'); 
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: activeTab === 'perfil' ? 'var(--text-primary)' : '#8F909A',
                  backgroundColor: activeTab === 'perfil' ? 'rgba(212, 175, 55, 0.08)' : 'transparent',
                  fontWeight: activeTab === 'perfil' ? '700' : '500',
                  fontSize: '13.5px',
                  transition: 'all 0.2s'
                }}
              >
                <Settings size={18} style={{ color: activeTab === 'perfil' ? 'var(--accent-lime)' : '#8F909A' }} />
                <span>Configuración</span>
              </div>

              <div 
                className="drawer-menu-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: '#8F909A',
                  fontWeight: '500',
                  fontSize: '13.5px'
                }}
              >
                <HelpCircle size={18} />
                <span>Ayuda</span>
              </div>
            </div>

            {/* 3. SECCIÓN INFERIOR: SELECTOR DE MODO */}
            <div className="drawer-footer" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="drawer-mode-dropdown-container" style={{ position: 'relative', width: '100%' }}>
                <button 
                  className="drawer-mode-dropdown-btn" 
                  onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                  style={{
                    width: '100%',
                    height: '46px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--accent-lime)',
                    border: 'none',
                    color: '#000000',
                    fontSize: '13px',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 16px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(212, 175, 55, 0.15)'
                  }}
                >
                  <span>Modo conductor</span>
                  {isModeDropdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {isModeDropdownOpen && (
                  <div 
                    className="drawer-mode-dropdown-content"
                    style={{
                      position: 'absolute',
                      bottom: '52px',
                      left: 0,
                      width: '100%',
                      backgroundColor: '#1E1E20',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      zIndex: 2010,
                      boxShadow: '0 -6px 16px rgba(0,0,0,0.5)'
                    }}
                  >
                    <div 
                      className="mode-dropdown-item clickable"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        setIsModeDropdownOpen(false);
                        switchRole('client');
                      }}
                      style={{
                        padding: '12px 16px',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#FFFFFF',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span>Modo pasajero</span>
                    </div>
                    <div 
                      className="mode-dropdown-item active"
                      style={{
                        padding: '12px 16px',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: 'var(--accent-lime)',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>Modo conductor</span>
                      <span>✓</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Redes sociales */}
              <div 
                className="drawer-socials" 
                style={{ 
                  display: 'flex', 
                  gap: '24px', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  paddingTop: '6px',
                  borderTop: '1px solid var(--border-color)'
                }}
              >
                <a 
                  href="https://facebook.com" 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ color: '#8F909A', cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#8F909A'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-facebook"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                </a>
                <a 
                  href="https://instagram.com" 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ color: '#8F909A', cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#8F909A'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-instagram"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                </a>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
