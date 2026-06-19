import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import { 
  Search, 
  MapPin, 
  Clock, 
  MessageSquare, 
  Phone, 
  X, 
  Plus, 
  Minus, 
  Send,
  CreditCard,
  History,
  LogOut,
  ChevronRight,
  CheckCircle,
  Menu,
  Shield,
  Settings,
  HelpCircle,
  Bell,
  Car,
  ChevronDown,
  ChevronUp
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

export const ClientDashboard: React.FC = () => {
  const { user, logout, switchRole, clientState, setClientState, resetClientState, placeRealOrder, history, addHistoryItem, isPlaceholder, originCoords, setOriginCoords, hasRealGPSLocation, setHasRealGPSLocation } = useApp();
  const [activeTab, setActiveTab] = useState<'inicio' | 'historial' | 'billetera' | 'perfil' | 'seguridad'>('inicio');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);

  // Google Maps States
  const [isMapApiLoaded, setIsMapApiLoaded] = useState(false);
  const [isMapApiFailed, setIsMapApiFailed] = useState(false);
  const [destCoords, setDestCoords] = useState<{lat: number, lng: number} | null>(null);
  const [googleMap, setGoogleMap] = useState<any>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<any>(null);
  const [isUsingSimulatedRoute, setIsUsingSimulatedRoute] = useState(false);

  // Refs
  const originInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Booking states
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [destinationInput, setDestinationInput] = useState('');
  const [priceOffer, setPriceOffer] = useState(12);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatText, setChatText] = useState('');
  
  // Quick location and map picking states (InDrive style)
  const [activeSearchField, setActiveSearchField] = useState<'origin' | 'destination' | null>(null);
  const [isMapPicking, setIsMapPicking] = useState(false);
  const [pickingAddress, setPickingAddress] = useState('');
  const [pickingCoords, setPickingCoords] = useState<{lat: number, lng: number} | null>(null);

  // Delivery details states (celulares, categoría y comentarios)
  const [pickupPhone, setPickupPhone] = useState(user?.phone || '');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryCategory, setDeliveryCategory] = useState<'alimentos' | 'ropa' | 'documentos' | 'medicinas' | null>(null);
  const [courierComments, setCourierComments] = useState('');

  // Mudanza/Carga specific states
  const [requiresHelper, setRequiresHelper] = useState<'con_ayudante' | 'sin_ayudante'>('sin_ayudante');
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [scheduledTime, setScheduledTime] = useState<string>('');

  // Search stages (radar or driver offers)
  const [searchingStage, setSearchingStage] = useState<'radar' | 'driver_offers'>('radar');
  const [autoAccept, setAutoAccept] = useState<boolean>(false);
  const [offerCountdown, setOfferCountdown] = useState<number>(30);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const formatHeaderAddress = (address: string) => {
    if (!address || address === 'Obteniendo GPS...') return 'Obteniendo GPS...';
    const parts = address.split(',');
    if (parts.length >= 2) {
      return `${parts[0].trim()}, ${parts[1].trim()}`;
    }
    return address;
  };

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
    if (isMapApiLoaded && !isMapApiFailed && mapContainerRef.current && !googleMap && google) {
      const map = new google.maps.Map(mapContainerRef.current, {
        center: originCoords,
        zoom: 14,
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
  }, [isMapApiLoaded, isMapApiFailed, googleMap]);

  // 2.b. Auto-geolocation on load or fallback to empty/GPS label
  useEffect(() => {
    if (hasRealGPSLocation) return; // Si ya se tiene una ubicación GPS real en el contexto, no re-geolocalizar

    const defaultLat = -11.9708;
    const defaultLng = -77.0815;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setHasRealGPSLocation(true);
          setOriginCoords({ lat, lng });
        },
        (error) => {
          console.warn("Auto-geolocation denied or failed:", error);
          // Si el GPS falla o es denegado, dejamos el origen vacío en lugar de autocompletar una dirección fija
          setHasRealGPSLocation(false);
          setClientState(prev => ({ ...prev, origin: "" }));
          setOriginCoords({ lat: defaultLat, lng: defaultLng });
        }
      );
    } else {
      setHasRealGPSLocation(false);
      setClientState(prev => ({ ...prev, origin: "" }));
      setOriginCoords({ lat: defaultLat, lng: defaultLng });
    }
  }, []); // Run exactly once on mount

  // 2.c. Geocode coordinates once Google Maps API loads
  useEffect(() => {
    const google = (window as any).google;
    if (isMapApiLoaded && !isMapApiFailed && google && originCoords && hasRealGPSLocation) {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: originCoords }, (results: any, status: any) => {
        if (status === 'OK' && results[0]) {
          setClientState(prev => ({ ...prev, origin: results[0].formatted_address }));
        } else {
          setClientState(prev => ({ ...prev, origin: "Mi ubicación (GPS)" }));
        }
      });
    }
  }, [isMapApiLoaded, isMapApiFailed, originCoords, hasRealGPSLocation]);

  // 3. Autocomplete Setup for search modal
  useEffect(() => {
    const google = (window as any).google;
    if (showSearchModal && isMapApiLoaded && !isMapApiFailed && google) {
      let autocompleteOrigin: any = null;
      let autocompleteDest: any = null;

      if (originInputRef.current) {
        autocompleteOrigin = new google.maps.places.Autocomplete(originInputRef.current, {
          componentRestrictions: { country: 'pe' }
        });
        autocompleteOrigin.addListener('place_changed', () => {
          const place = autocompleteOrigin.getPlace();
          if (place.geometry && place.geometry.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            setClientState(prev => ({ ...prev, origin: place.formatted_address || place.name }));
            setOriginCoords({ lat, lng });
          }
        });
      }

      if (destInputRef.current) {
        autocompleteDest = new google.maps.places.Autocomplete(destInputRef.current, {
          componentRestrictions: { country: 'pe' }
        });
        autocompleteDest.addListener('place_changed', () => {
          const place = autocompleteDest.getPlace();
          if (place.geometry && place.geometry.location) {
            const address = place.formatted_address || place.name;
            setDestinationInput(address);
            setDestCoords({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            });
          }
        });
      }
    }
  }, [showSearchModal, isMapApiLoaded, isMapApiFailed]);

  // 4. Calculate route and dynamic price based on distance
  useEffect(() => {
    const google = (window as any).google;
    
    // Determine the rate factor: S/ 1.00 per KM for moto (delivery), default S/ 1.50 for others
    const isMoto = clientState.service === 'delivery';
    const rateFactor = isMoto ? 1.00 : 1.50;

    const runSimulationPricing = () => {
      if (clientState.destination) {
        let distanceKm = 8.5;
        const destLower = clientState.destination.toLowerCase();
        if (destLower.includes('javier prado')) distanceKm = 8.2;
        else if (destLower.includes('unión')) distanceKm = 11.5;
        else if (destLower.includes('brasil')) distanceKm = 5.8;
        else if (destLower.includes('mega plaza')) distanceKm = 17.2;
        else {
          distanceKm = Math.max(3, (clientState.destination.length % 15) + 3.5);
        }
        // Base is S/ 0 (single factor) or min S/ 5.00
        const calculatedPrice = Math.max(5, Math.round(distanceKm * rateFactor));
        setPriceOffer(calculatedPrice);
        setIsUsingSimulatedRoute(true);
      }
    };

    // Si no está cargada la API de Google o falló la autenticación, usamos cálculo simulado (Modo Demo)
    if (!isMapApiLoaded || isMapApiFailed || !googleMap || !directionsRenderer || !google) {
      runSimulationPricing();
      return;
    }

    if (!clientState.destination) return;

    const directionsService = new google.maps.DirectionsService();
    
    // Usar coordenadas directamente para evitar fallas de geocodificación de texto (ej. si Geocoding API está inactiva)
    const originLocation = originCoords;
    const destLocation = destCoords || clientState.destination;

    directionsService.route(
      {
        origin: originLocation,
        destination: destLocation,
        travelMode: google.maps.TravelMode.DRIVING
      },
      (result: any, status: any) => {
        if (status === google.maps.DirectionsStatus.OK) {
          directionsRenderer.setDirections(result);
          setIsUsingSimulatedRoute(false);
          
          const route = result.routes[0];
          const leg = route.legs[0];
          const distanceKm = leg.distance.value / 1000;
          
          // Dynamic pricing: Min S/ 5.00, factor based on service type
          const calculatedPrice = Math.max(5, Math.round(distanceKm * rateFactor));
          setPriceOffer(calculatedPrice);
        } else {
          console.warn('Directions request failed due to ' + status + '. Falling back to simulated route.');
          runSimulationPricing();
        }
      }
    );
  }, [googleMap, directionsRenderer, clientState.origin, clientState.destination, clientState.service, isMapApiLoaded, isMapApiFailed, destCoords]);

  // 5. Automatic reset of route when idle
  useEffect(() => {
    if (clientState.status === 'idle') {
      setIsUsingSimulatedRoute(false);
      if (!clientState.destination) {
        setDestCoords(null);
      }
      if (directionsRenderer) {
        directionsRenderer.setDirections({ routes: [] });
      }
      if (googleMap) {
        googleMap.setCenter(originCoords);
        googleMap.setZoom(14);
      }
    }
  }, [clientState.status, clientState.destination, googleMap, directionsRenderer]);

  // 5.b. Listen to map 'idle' event for manual map picking address resolver
  useEffect(() => {
    if (!googleMap || !isMapPicking) return;
    const google = (window as any).google;
    if (!google) return;
    
    const listener = googleMap.addListener('idle', () => {
      updateAddressFromMapCenter();
    });
    
    // Trigger once initially
    updateAddressFromMapCenter();
    
    return () => {
      if (google.maps && google.maps.event) {
        google.maps.event.removeListener(listener);
      }
    };
  }, [googleMap, isMapPicking]);

  // Auto-scroll chat
  useEffect(() => {
    if (showChatModal) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [clientState.chatMessages, showChatModal]);

  // Simulation timer for passenger search flow (matching user screenshots)
  useEffect(() => {
    let timeoutId: any;
    
    if (clientState.status === 'searching') {
      setSearchingStage('radar');

      if (isPlaceholder) {
        // En modo demo, mostrar oferta simulada de conductor tras 3 segundos
        timeoutId = setTimeout(() => {
          setSearchingStage('driver_offers');
        }, 3000);
      }
    } else {
      setSearchingStage('radar');
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [clientState.status]);

  // Countdown timer for driver offers in passenger dashboard
  useEffect(() => {
    let intervalId: any;
    const isOfferActive = isPlaceholder
      ? (clientState.status === 'searching' && searchingStage === 'driver_offers')
      : (clientState.status === 'searching' && clientState.assignedDriver !== null);

    if (isOfferActive) {
      setOfferCountdown(30);

      intervalId = setInterval(() => {
        setOfferCountdown(prev => {
          if (prev <= 1) {
            clearInterval(intervalId);
            handleRejectDriverOffer(); // Expired! Auto-reject and clean database
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setOfferCountdown(30);
    }

    return () => clearInterval(intervalId);
  }, [clientState.status, clientState.assignedDriver, searchingStage, isPlaceholder]);

  // Auto accept simulation
  useEffect(() => {
    if (clientState.status === 'searching' && searchingStage === 'driver_offers' && autoAccept && isPlaceholder) {
      const timeout = setTimeout(() => {
        handleAcceptDriverOffer();
        alert('¡Oferta aceptada automáticamente por el conductor más cercano!');
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [clientState.status, searchingStage, autoAccept]);

  // Simulated active order timeline
  useEffect(() => {
    if (!isPlaceholder) return;
    let timeoutId: any;

    if (clientState.status === 'driver_incoming') {
      timeoutId = setTimeout(() => {
        // Conductor recoge paquete e inicia ruta
        setClientState(prev => ({
          ...prev,
          status: 'in_progress',
          assignedDriver: prev.assignedDriver 
            ? { ...prev.assignedDriver, eta: 12 } 
            : null,
          chatMessages: [
            ...prev.chatMessages,
            { sender: 'driver', text: 'Paquete recogido correctamente. Voy en ruta de entrega.', time: '10:36' }
          ]
        }));
      }, 10000);
    } else if (clientState.status === 'in_progress') {
      timeoutId = setTimeout(() => {
        // Completar entrega
        setClientState(prev => ({
          ...prev,
          status: 'completed'
        }));
        
        // Agregar al historial
        addHistoryItem({
          id: String(Date.now()),
          type: clientState.service,
          date: 'Hoy, ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
          origin: clientState.origin.split(',')[0],
          destination: clientState.destination.split(',')[0],
          driverName: clientState.assignedDriver?.name || 'Anthony',
          rating: 5,
          price: priceOffer
        });

      }, 12000);
    }

    return () => clearTimeout(timeoutId);
  }, [clientState.status]);

  const handleSelectRecentRoute = (origin: string, dest: string, service: any, price: number) => {
    setClientState(prev => ({
      ...prev,
      origin,
      destination: dest,
      service
    }));
    
    // Configurar coordenadas para las rutas recientes para evitar fallas de geocodificación
    if (origin.includes('Larco')) {
      setOriginCoords({ lat: -12.121493, lng: -77.029490 });
      setDestCoords({ lat: -12.0863, lng: -77.0096 });
    } else if (origin.includes('Barranco')) {
      setOriginCoords({ lat: -12.1487, lng: -77.0211 });
      setDestCoords({ lat: -12.0734, lng: -76.9427 });
    }
    
    setPriceOffer(price);
  };

  const handleStartSearch = () => {
    if (!destinationInput) {
      alert('Por favor, ingresa una dirección de destino.');
      return;
    }
    setClientState(prev => ({
      ...prev,
      destination: destinationInput
    }));
    setShowSearchModal(false);
  };

  const handleConfirmOrder = () => {
    if (!clientState.service) {
      alert('Por favor, selecciona un tipo de servicio primero.');
      return;
    }
    if (!clientState.origin || clientState.origin === 'Obteniendo GPS...') {
      alert('Aún estamos obteniendo tu ubicación GPS. Por favor, espera un momento o selecciona una dirección de recojo manual.');
      return;
    }
    const isTaxiService = clientState.service === 'taxi' || clientState.service === 'taxi_premium';
    const isFleteService = clientState.service === 'flete';

    let finalComment = courierComments;
    if (isFleteService) {
      const helperText = requiresHelper === 'con_ayudante' ? 'Con ayudante' : 'Sin ayudante';
      const scheduleText = isScheduled 
        ? `Programado: ${scheduledTime ? new Date(scheduledTime).toLocaleString('es-PE') : 'No especificado'}` 
        : 'Inmediato (Ahora)';
      finalComment = `[Mudanza/Carga] Ayudante: ${helperText} | Horario: ${scheduleText}${courierComments ? ` | Notas: ${courierComments}` : ''}`;
    }

    placeRealOrder(priceOffer, {
      pickupPhone: isTaxiService ? '' : pickupPhone,
      deliveryPhone: isTaxiService ? '' : deliveryPhone,
      category: (isTaxiService || isFleteService) ? undefined : (deliveryCategory || undefined),
      comment: finalComment || undefined
    });
  };

  const handleCancelOrder = async () => {
    if (!isPlaceholder && clientState.orderId) {
      try {
        await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', clientState.orderId);
      } catch (err: any) {
        console.error('Error al cancelar la orden en Supabase:', err.message);
      }
    }
    resetClientState();
    setSearchingStage('radar');
  };

  const handleAcceptDriverOffer = async () => {
    if (!isPlaceholder && clientState.orderId) {
      try {
        const { error } = await supabase
          .from('orders')
          .update({ status: 'driver_incoming' })
          .eq('id', clientState.orderId);
        if (error) throw error;
      } catch (err: any) {
        console.error('Error al aceptar oferta del conductor en Supabase:', err.message);
        alert('Error al aceptar oferta: ' + err.message);
      }
      return;
    }

    setClientState(prev => ({
      ...prev,
      status: 'driver_incoming',
      assignedDriver: {
        name: 'Anthony',
        rating: 4.92,
        vehicle: 'Chevrolet Sail (Auto) • DEF-456',
        plate: 'DEF-456',
        eta: 4
      },
      chatMessages: [
        { sender: 'driver', text: 'Hola, buenas tardes. Ya estoy saliendo para recoger tu paquete.', time: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) }
      ]
    }));
  };

  const handleRejectDriverOffer = async () => {
    if (!isPlaceholder && clientState.orderId) {
      try {
        const { error } = await supabase
          .from('orders')
          .update({ driver_id: null })
          .eq('id', clientState.orderId);
        if (error) throw error;
        setClientState(prev => ({ ...prev, assignedDriver: null }));
      } catch (err: any) {
        console.error('Error al rechazar oferta en Supabase:', err.message);
      }
      return;
    }

    // Retorna a radar temporalmente y vuelve a ofertar en 4 segundos
    setSearchingStage('radar');
    
    setTimeout(() => {
      // Si el cliente no ha cancelado, genera otra oferta
      setClientState(prev => {
        if (prev.status === 'searching') {
          setSearchingStage('driver_offers');
        }
        return prev;
      });
    }, 4000);
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;

    const timeStr = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    setClientState(prev => ({
      ...prev,
      chatMessages: [
        ...prev.chatMessages,
        { sender: 'client', text: chatText, time: timeStr }
      ]
    }));

    setChatText('');

    // Simular respuesta del conductor después de 2 segundos
    setTimeout(() => {
      setClientState(prev => ({
        ...prev,
        chatMessages: [
          ...prev.chatMessages,
          { sender: 'driver', text: 'Entendido. Voy con cuidado 👍', time: timeStr }
        ]
      }));
    }, 2000);
  };

  // 6. Reverse geocode map center in map picking mode
  const updateAddressFromMapCenter = () => {
    if (!googleMap) return;
    const center = googleMap.getCenter();
    if (!center) return;
    const lat = center.lat();
    const lng = center.lng();
    
    const google = (window as any).google;
    if (isMapApiLoaded && !isMapApiFailed && google) {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
        if (status === 'OK' && results[0]) {
          setPickingAddress(results[0].formatted_address);
          setPickingCoords({ lat, lng });
        } else {
          setPickingAddress("Ubicación seleccionada en mapa"); // Mostrar letras descriptivas en vez de coordenadas numéricas
          setPickingCoords({ lat, lng });
        }
      });
    } else {
      // Demo Mode Fallback
      // Generate some simulated location name based on Lima coordinates
      const demoAddresses = [
        "Av. Larco 1045, Miraflores",
        "Parque Kennedy, Miraflores",
        "Av. Arequipa 5200, Miraflores",
        "Calle Shell 340, Miraflores",
        "Av. Diagonal 400, Miraflores"
      ];
      // Pick a semi-random but stable address based on coordinates
      const index = Math.abs(Math.floor((lat + lng) * 1000)) % demoAddresses.length;
      setPickingAddress(demoAddresses[index]);
      setPickingCoords({ lat, lng });
    }
  };

  // 7. Geolocation handler ("Mi ubicación")
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert('La geolocalización no es compatible con este navegador.');
      return;
    }
    
    const targetField = activeSearchField;
    if (!targetField) return;
    
    // Set a loading text
    if (targetField === 'origin') {
      setClientState(prev => ({ ...prev, origin: 'Obteniendo GPS...' }));
    } else {
      setDestinationInput('Obteniendo GPS...');
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        const google = (window as any).google;
        if (isMapApiLoaded && !isMapApiFailed && google) {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
            if (status === 'OK' && results[0]) {
              const address = results[0].formatted_address;
              if (targetField === 'origin') {
                setHasRealGPSLocation(true);
                setClientState(prev => ({ ...prev, origin: address }));
                setOriginCoords({ lat, lng });
                if (googleMap) {
                  googleMap.setCenter({ lat, lng });
                }
              } else {
                setDestinationInput(address);
                setDestCoords({ lat, lng });
              }
            } else {
              const fallbackAddr = "Mi ubicación (GPS)"; // Letras amigables en vez de coordenadas
              if (targetField === 'origin') {
                setHasRealGPSLocation(true);
                setClientState(prev => ({ ...prev, origin: fallbackAddr }));
                setOriginCoords({ lat, lng });
                if (googleMap) {
                  googleMap.setCenter({ lat, lng });
                }
              } else {
                setDestinationInput(fallbackAddr);
                setDestCoords({ lat, lng });
              }
            }
          });
        } else {
          // Demo fallback
          const demoAddr = "Mi ubicación (Av. Larco 1045, Miraflores)";
          if (targetField === 'origin') {
            setHasRealGPSLocation(true);
            setClientState(prev => ({ ...prev, origin: demoAddr }));
            setOriginCoords({ lat: -12.121493, lng: -77.029490 });
            if (googleMap) {
              googleMap.setCenter({ lat: -12.121493, lng: -77.029490 });
            }
          } else {
            setDestinationInput(demoAddr);
            setDestCoords({ lat: -12.121493, lng: -77.029490 });
          }
        }
      },
      (error) => {
        console.warn('Error getting location:', error);
        alert('No se pudo acceder al GPS. Asegúrate de otorgar permisos de ubicación en tu navegador y acceder desde una conexión segura (HTTPS).');
        
        if (targetField === 'origin') {
          setHasRealGPSLocation(false);
          setClientState(prev => ({ ...prev, origin: "" }));
        } else {
          setDestinationInput("");
        }
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  // 8. Map picking control handlers
  const handleStartMapPicking = () => {
    setIsMapPicking(true);
    setShowSearchModal(false);
    
    // Set map center initially to current origin coordinates
    if (googleMap) {
      googleMap.setCenter(originCoords);
      googleMap.setZoom(16);
    }
  };

  const handleConfirmMapPicking = () => {
    if (activeSearchField === 'origin') {
      setClientState(prev => ({ ...prev, origin: pickingAddress }));
      if (pickingCoords) {
        setOriginCoords(pickingCoords);
      }
    } else if (activeSearchField === 'destination') {
      setDestinationInput(pickingAddress);
      if (pickingCoords) {
        setDestCoords(pickingCoords); // CORREGIDO: Guardar coordenadas de destino para trazar ruta y evitar fallas
      }
    }
    
    setIsMapPicking(false);
    setShowSearchModal(true);
    setPickingAddress('');
    setPickingCoords(null);
  };

  const handleCancelMapPicking = () => {
    setIsMapPicking(false);
    setShowSearchModal(true);
    setPickingAddress('');
    setPickingCoords(null);
  };

  const services = [
    { 
      id: 'taxi', 
      name: 'Auto (4 pers.)', 
      desc: 'S/ 12-18', 
      icon: '/images/3d_auto.png'
    },
    { 
      id: 'taxi_premium', 
      name: 'Auto Grande (6 pers.)', 
      desc: 'S/ 18-25', 
      icon: '/images/3d_auto_grande.png'
    },
    { 
      id: 'delivery', 
      name: 'Motorizado', 
      desc: 'S/ 8-15', 
      icon: '/images/3d_motorizado.png'
    },
    { 
      id: 'flete', 
      name: 'Mudanza / Carga', 
      desc: 'S/ 45-80', 
      icon: '/images/3d_mudanza.png'
    }
  ];

  const isSearchFieldEmpty = activeSearchField 
    ? (activeSearchField === 'origin' ? clientState.origin !== 'Obteniendo GPS...' : destinationInput !== 'Obteniendo GPS...')
    : true;

  return (
    <div className="mobile-container dark-theme">
      <div className="peru-bg-watermark nazca-lines-bg"></div>
      {/* PANTALLA INICIO */}
      {activeTab === 'inicio' && (
        <div className="client-dashboard-layout">
          {/* MAP BACKGROUND */}
          <div className="mock-map" style={{ 
            height: isMapPicking ? '100%' : (clientState.status === 'searching' ? '55%' : '240px'), 
            position: isMapPicking ? 'absolute' : 'relative',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            zIndex: isMapPicking ? 1000 : 1,
            overflow: 'hidden' 
          }}>
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
                  ⚡ MAPA REAL ACTIVO {isUsingSimulatedRoute && "(RUTA SIMULADA)"}
                </div>

                {/* Línea de ruta simulada animada si falla la API de Google Directions */}
                {isUsingSimulatedRoute && clientState.destination && (
                  <>
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
                  </>
                )}
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

                {/* Marcadores */}
                {clientState.status === 'idle' ? (
                  <div className="map-marker active-pin pulse" style={{ top: '55%', left: '50%' }}>
                    <div className="marker-core" />
                  </div>
                ) : (
                  <>
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

                    {/* Coches cercanos moviéndose en simulación de radar */}
                    {clientState.status === 'searching' && (
                      <>
                        <div className="map-marker driver-car" style={{ top: '48%', left: '48%', fontSize: '14px' }}>🚗</div>
                        <div className="map-marker driver-car" style={{ top: '58%', left: '40%', fontSize: '14px' }}>🚗</div>
                        <div className="map-marker driver-car" style={{ top: '40%', left: '55%', fontSize: '14px' }}>🏍️</div>
                        <div className="map-marker driver-car" style={{ top: '68%', left: '52%', fontSize: '14px' }}>🚗</div>
                      </>
                    )}

                    {/* Motorizado asignado en camino */}
                    {clientState.status === 'driver_incoming' && (
                      <div className="map-marker driver-car pulse" style={{ top: '55%', left: '48%' }}>
                        <span>🏍️</span>
                      </div>
                    )}
                    {clientState.status === 'in_progress' && (
                      <div className="map-marker driver-car pulse" style={{ top: '48%', left: '45%' }}>
                        <span>📦</span>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Cabecera flotante */}
            {clientState.status !== 'searching' && (
              <div className="floating-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '92%', left: '4%', right: '4%' }}>
                <button 
                  className="hamburger-menu-btn" 
                  onClick={() => setIsDrawerOpen(true)}
                  aria-label="Abrir menú"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(8px)',
                    flexShrink: 0
                  }}
                >
                  <Menu size={20} />
                </button>
                <div 
                  className="location-selector" 
                  style={{ 
                    flexGrow: 1, 
                    margin: 0, 
                    width: 'auto',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <MapPin size={15} style={{ color: 'var(--accent-lime)', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Ubicación actual: <strong>{formatHeaderAddress(clientState.origin)}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* Central Floating Pin for Map Picking */}
            {isMapPicking && (
              <div 
                className="map-picking-pin-container"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -100%)',
                  zIndex: 1050,
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  marginTop: '-12px'
                }}
              >
                <div style={{
                  filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))',
                  fontSize: '38px',
                  transform: 'translateY(-4px)',
                  animation: 'pinBounce 0.5s ease infinite alternate'
                }}>
                  📍
                </div>
                <div style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  borderRadius: '50%',
                  filter: 'blur(2px)',
                  transform: 'scaleX(2)',
                  marginTop: '-2px'
                }} />
                
                <style>{`
                  @keyframes pinBounce {
                    from { transform: translateY(-4px); }
                    to { transform: translateY(0); }
                  }
                `}</style>
              </div>
            )}

            {/* Bottom Panel for Map Picking Confirmation */}
            {isMapPicking && (
              <div 
                className="map-picking-footer-panel"
                style={{
                  position: 'absolute',
                  bottom: '16px',
                  left: '16px',
                  right: '16px',
                  backgroundColor: '#0F0F10',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '16px',
                  zIndex: 1100,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--accent-lime)', fontWeight: '800', letterSpacing: '0.05em' }}>
                    SELECCIONAR DIRECCIÓN EN MAPA
                  </span>
                  <span style={{ fontSize: '13px', color: '#FFFFFF', fontWeight: '800', lineHeight: '1.4' }}>
                    {pickingAddress || 'Buscando dirección...'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    style={{ flex: 1, height: '40px', fontSize: '12px', border: '1px solid var(--border-color)', color: '#FFFFFF', borderRadius: '12px', cursor: 'pointer' }}
                    onClick={handleCancelMapPicking}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button"
                    className="btn btn-primary" 
                    style={{ flex: 2, height: '40px', fontSize: '12px', fontWeight: '800', borderRadius: '12px', cursor: 'pointer', backgroundColor: 'var(--accent-lime)', color: '#000000', border: 'none' }}
                    onClick={handleConfirmMapPicking}
                    disabled={!pickingAddress}
                  >
                    Confirmar ubicación
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* PANEL DE SERVICIOS */}
          {clientState.status === 'idle' && !clientState.destination && (
            <div className="client-services-panel">
              <div className="drag-handle" />

              {/* Barra de Búsqueda */}
              <div className="search-bar-trigger" onClick={() => setShowSearchModal(true)}>
                <Search size={18} style={{ color: 'var(--text-secondary)' }} />
                <span>Lugar de destino</span>
                <span className="search-btn-badge">Buscar</span>
              </div>

              {/* Categorías de Servicios */}
              <div className="services-section">
                <span className="section-title">SERVICIOS DISPONIBLES</span>
                <div className="services-grid">
                  {services.map(s => (
                    <div 
                      key={s.id} 
                      className={`service-card ${clientState.service === s.id ? 'active' : ''}`}
                      onClick={() => {
                        setClientState(prev => ({ ...prev, service: s.id as any }));
                        setShowSearchModal(true);
                      }}
                    >
                      <div className="service-card-img-container">
                        <img src={s.icon} className="service-card-img" alt={s.name} />
                      </div>
                      <div className="service-card-info">
                        <span className="service-name">{s.name}</span>
                        <span className="service-desc">{s.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rutas Recientes */}
              <div className="recent-routes-section">
                <div className="section-header">
                  <span className="section-title">RECIENTES</span>
                </div>
                <div className="recent-list">
                  <div 
                    className="recent-item"
                    onClick={() => handleSelectRecentRoute('Av. Larco 1045, Miraflores', 'Av. Javier Prado 3375, Surco', 'taxi', 12.00)}
                  >
                    <Clock size={14} className="recent-icon" />
                    <div className="recent-details">
                      <span className="recent-title">Av. Larco 1045 → Av. Javier Prado 3375</span>
                      <span className="recent-subtitle">Taxi • S/ 12.00</span>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
                  </div>

                  <div 
                    className="recent-item"
                    onClick={() => handleSelectRecentRoute('Barranco', 'La Molina', 'delivery', 15.00)}
                  >
                    <Clock size={14} className="recent-icon" />
                    <div className="recent-details">
                      <span className="recent-title">Barranco → La Molina</span>
                      <span className="recent-subtitle">Delivery • S/ 15.00</span>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PANEL DE CONFIRMACIÓN DE VIAJE (TIPO INDRIVE AL SELECCIONAR DESTINO) */}
          {clientState.status === 'idle' && clientState.destination && (
            <div className="client-services-panel booking-summary-panel">
              <div className="drag-handle" />

              {/* Ruta resumen */}
              <div className="booking-route-summary" style={{ position: 'relative' }}>
                {/* Botón para editar toda la solicitud */}
                <button 
                  type="button" 
                  onClick={() => {
                    setShowSearchModal(true);
                    setActiveSearchField('destination');
                  }}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--accent-lime)',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ✏️ Editar
                </button>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingRight: '60px' }}>
                  <span style={{ color: 'var(--accent-lime)' }}>●</span>
                  <span className="route-text">De: <strong>{clientState.origin}</strong></span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', borderTop: '1px solid #27272A', paddingTop: '6px', paddingRight: '60px' }}>
                  <span style={{ color: '#EF4444' }}>●</span>
                  <span className="route-text">A: <strong>{clientState.destination}</strong></span>
                </div>

                {/* Mostrar detalles adicionales de la solicitud en el resumen de viaje */}
                {(pickupPhone || deliveryPhone || deliveryCategory || courierComments) && (
                  <div style={{ marginTop: '8px', borderTop: '1px dashed #27272A', paddingTop: '8px', fontSize: '11px', color: '#8F909A', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {deliveryCategory && (
                      <div>
                        📦 Categoría: <strong style={{ color: '#FFFFFF' }}>{deliveryCategory === 'alimentos' ? '🍔 Alimentos' : deliveryCategory === 'ropa' ? '👕 Ropa' : deliveryCategory === 'documentos' ? '📄 Documentos' : '💊 Prod. Farmacéuticos'}</strong>
                      </div>
                    )}
                    {(pickupPhone || deliveryPhone) && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {pickupPhone && <span>📞 Recojo: <strong style={{ color: '#FFFFFF' }}>{pickupPhone}</strong></span>}
                        {deliveryPhone && <span>📞 Entrega: <strong style={{ color: '#FFFFFF' }}>{deliveryPhone}</strong></span>}
                      </div>
                    )}
                    {courierComments && (
                      <div style={{ fontStyle: 'italic' }}>
                        💬 Indicaciones: "{courierComments}"
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selector de Servicios Horizontal */}
              <div className="services-horizontal-list">
                {services.map(s => {
                  const isSelected = clientState.service === s.id;
                  return (
                    <div 
                      key={s.id} 
                      className={`service-card-horizontal ${isSelected ? 'active' : ''}`}
                      onClick={() => setClientState(prev => ({ ...prev, service: s.id as any }))}
                    >
                      <img src={s.icon} alt={s.name} className="service-card-horizontal-img" style={{ width: '36px', height: '36px', objectFit: 'contain', marginBottom: '4px' }} />
                      <span className="service-name">{s.name}</span>
                    </div>
                  );
                })}
              </div>

              {/* Método de Pago */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', color: '#8F909A', fontWeight: '800' }}>MEDIO DE PAGO</span>
                <select 
                  className="form-select"
                  value={clientState.paymentMethod}
                  onChange={(e) => setClientState(prev => ({ ...prev, paymentMethod: e.target.value as any }))}
                  style={{ height: '30px', backgroundColor: '#1A1A1C', border: '1px solid #27272A', borderRadius: '6px', color: '#FFFFFF', padding: '0 8px', fontSize: '11px' }}
                >
                  <option value="Efectivo">💵 Efectivo</option>
                  <option value="Yape">📱 Yape</option>
                  <option value="Plin">📱 Plin</option>
                </select>
              </div>

              {/* Ajuste de Tarifa (Estilo InDrive) */}
              <div className="fare-adjust-container">
                <button className="fare-btn minus" onClick={() => setPriceOffer(prev => Math.max(5, prev - 1))}>
                  <Minus size={18} />
                </button>
                <div className="fare-value-box">
                  <span className="fare-currency">S/</span>
                  <span className="fare-amount">{priceOffer}</span>
                  <span className="fare-label">Tarifa recomendada: S/ {priceOffer}</span>
                </div>
                <button className="fare-btn plus" onClick={() => setPriceOffer(prev => prev + 1)}>
                  <Plus size={18} />
                </button>
              </div>

              {/* Botón de solicitud */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-secondary btn-lg" 
                  onClick={handleCancelOrder}
                  style={{ width: '60px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '14px', backgroundColor: '#27272A', border: 'none' }}
                >
                  <X size={20} style={{ color: '#FFFFFF', margin: 'auto' }} />
                </button>
                <button 
                  className="btn btn-primary btn-lg btn-block request-ride-btn" 
                  onClick={handleConfirmOrder}
                  style={{ flexGrow: 1 }}
                >
                  Encontrar ofertas
                </button>
              </div>
            </div>
          )}

          {/* SECUENCIA 1: BUSCANDO RADAR (CORRESPONDE A LA CAPTURA 2) */}
          {clientState.status === 'searching' && (isPlaceholder ? (searchingStage === 'radar') : (clientState.assignedDriver === null)) && (
            <div className="passenger-searching-sequence-container">
              
              {/* Flotante: Vistos por conductores (solo en modo demo) */}
              {isPlaceholder && (
                <div className="conductores-visto-badge">
                  <div className="avatar-group-mini">
                    <span className="mini-avatar">👨</span>
                    <span className="mini-avatar">🧑</span>
                    <span className="mini-avatar">👨</span>
                  </div>
                  <span>3 conductores han visto tu solicitud</span>
                </div>
              )}

              {/* Card inferior blanca (Mejor Tarifa / Aumentar) */}
              <div className="bottom-sheet-white">
                <div className="drag-handle-grey" />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#18181B' }}>
                    Mejor tarifa. Tu solicitud tiene prioridad
                  </span>
                  <span style={{ fontSize: '12px', color: '#22C55E', fontWeight: '700' }}>
                    ● En tiempo real
                  </span>
                </div>
                <div style={{ height: '12px' }} />

                {/* Ajustador de Precio PEN */}
                <div className="price-adjuster-row-white">
                  <button 
                    className="btn-adjust-white" 
                    onClick={() => setPriceOffer(prev => Math.max(5, prev - 0.50))}
                    disabled={priceOffer <= 5}
                  >
                    -0.50
                  </button>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#18181B' }}>
                    PEN {priceOffer.toFixed(2).replace('.00', '')}
                  </div>
                  <button 
                    className="btn-adjust-white" 
                    onClick={() => setPriceOffer(prev => prev + 0.50)}
                  >
                    +0.50
                  </button>
                </div>

                {/* Botón Aumentar Tarifa */}
                <button 
                  className="btn btn-block" 
                  style={{ backgroundColor: '#F4F4F5', color: '#A1A1AA', height: '44px', fontWeight: '700' }}
                  onClick={() => alert(`Tarifa aumentada a S/ ${priceOffer.toFixed(2)}`)}
                >
                  Aumentar tarifa
                </button>

                {/* Botón Cancelar Solicitud */}
                <button 
                  className="btn-cancel-request-sheet" 
                  onClick={handleCancelOrder}
                >
                  ✕ Cancelar solicitud
                </button>
              </div>

              {/* Fila inferior flotante: Aceptar Automáticamente */}
              <div className="auto-accept-row-capsule">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1 }}>
                  <span style={{ fontSize: '16px', color: '#71717A' }}>⚡</span>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#18181B', lineHeight: '1.3' }}>
                    Aceptar automáticamente al conductor más cercano por PEN {priceOffer.toFixed(0)}
                  </span>
                </div>
                
                {/* Switch de activación */}
                <button 
                  type="button"
                  onClick={() => setAutoAccept(!autoAccept)}
                  style={{
                    width: '38px',
                    height: '22px',
                    borderRadius: '11px',
                    backgroundColor: autoAccept ? 'var(--accent-lime)' : '#E4E4E7',
                    border: 'none',
                    position: 'relative',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  <span 
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: '#FFFFFF',
                      position: 'absolute',
                      top: '3px',
                      left: autoAccept ? '19px' : '3px',
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }}
                  />
                </button>
              </div>
            </div>
          )}

          {/* SECUENCIA 2: SELECCIONAR CONDUCTOR (CORRESPONDE A LA CAPTURA 3) */}
          {clientState.status === 'searching' && (isPlaceholder ? (searchingStage === 'driver_offers') : (clientState.assignedDriver !== null)) && (
            <div className="passenger-driver-offers-sequence-container">
              {/* Botón flotante superior */}
              <button 
                className="btn-cancel-request-floating" 
                onClick={handleCancelOrder}
              >
                ✕ Cancelar solicitud
              </button>

              {/* Título flotante superior */}
              <h2 className="select-driver-title-floating">
                Elige a un conductor
              </h2>

              {/* Tarjeta de Oferta de Conductor (Anthony) */}
              <div className="driver-offer-card-white-wrapper">
                <div className="driver-offer-card-white">
                  
                  {/* Tarifa y ETA */}
                  <div className="offer-header-row">
                    <span className="offer-price-lbl">
                      PEN {isPlaceholder ? (priceOffer + 2.30).toFixed(2) : Number(clientState.suggestedPrice).toFixed(2)}
                    </span>
                    <span className="offer-eta-lbl">
                      {isPlaceholder ? '4 min' : `${clientState.assignedDriver?.eta || 5} min`}
                    </span>
                  </div>

                  {/* Fila del Conductor */}
                  <div className="offer-driver-row">
                    <div className="offer-driver-avatar">
                      👨
                    </div>
                    <div className="offer-driver-details">
                      <div className="driver-name-rating">
                        <strong>{isPlaceholder ? 'Anthony' : (clientState.assignedDriver?.name || 'Conductor')}</strong>
                        <span className="driver-rating-badge">★ {isPlaceholder ? '4.92' : (clientState.assignedDriver?.rating || '5.00')}</span>
                        <span className="driver-trips-count">{isPlaceholder ? '2796' : '98'} viajes</span>
                      </div>
                      <div className="driver-car-desc">
                        {isPlaceholder ? 'Chevrolet Sail' : (clientState.assignedDriver?.vehicle || 'Moto')}
                      </div>
                    </div>
                  </div>

                  {/* Tiempo restante de oferta */}
                  <div style={{ textAlign: 'center', fontSize: '11px', color: '#EF4444', fontWeight: '700', margin: '8px 0 2px 0' }}>
                    La oferta expira en {offerCountdown} segundos
                  </div>

                  {/* Acciones */}
                  <div className="offer-actions-row">
                    <button 
                      className="btn-reject-offer-white"
                      onClick={handleRejectDriverOffer}
                    >
                      Rechazar
                    </button>
                    
                    <button 
                      className="btn-accept-offer-white"
                      onClick={handleAcceptDriverOffer}
                    >
                      Aceptar
                    </button>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* CONDUCTOR ASIGNADO / EN CAMINO */}
          {(clientState.status === 'driver_incoming' || clientState.status === 'in_progress') && clientState.assignedDriver && (
            <div className="client-overlay-panel">
              <div className="driver-status-badge">
                <span className="status-dot" />
                <span>{clientState.status === 'driver_incoming' ? 'REPARTIDOR EN CAMINO' : 'EN RUTA A DESTINO'}</span>
              </div>

              <div className="driver-main-card" style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%', marginTop: '12px' }}>
                <div className="driver-avatar-circle">
                  <span>👨</span>
                </div>
                <div style={{ flexGrow: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800' }}>{clientState.assignedDriver.name}</span>
                    <span className="driver-eta-badge">{clientState.assignedDriver.eta} min</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <span>⭐ {clientState.assignedDriver.rating}</span>
                    <span>•</span>
                    <span>{clientState.assignedDriver.vehicle}</span>
                  </div>
                </div>
              </div>

              <div className="trip-locations-box" style={{ width: '100%', marginTop: '12px', backgroundColor: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '11.5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--accent-lime)', marginTop: '3px' }}>●</span>
                  <span>Recojo: <strong>{formatHeaderAddress(clientState.origin)}</strong></span>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                  <span style={{ color: '#EF4444', marginTop: '3px' }}>●</span>
                  <span>Entrega: <strong>{formatHeaderAddress(clientState.destination)}</strong></span>
                </div>
              </div>

              <div className="driver-action-buttons-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', width: '100%', marginTop: '16px' }}>
                <button className="btn btn-secondary" onClick={() => setShowChatModal(true)} style={{ gap: '6px', fontSize: '12px', height: '38px' }}>
                  <MessageSquare size={13} />
                  Chat
                </button>
                <button className="btn btn-secondary" onClick={() => alert('Llamando al repartidor...')} style={{ gap: '6px', fontSize: '12px', height: '38px' }}>
                  <Phone size={13} />
                  Llamar
                </button>
                <button className="btn btn-secondary" onClick={handleCancelOrder} style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderColor: 'transparent', fontSize: '12px', height: '38px' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* VIAJE COMPLETADO / FEEDBACK */}
          {clientState.status === 'completed' && (
            <div className="client-overlay-panel" style={{ textAlign: 'center' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'rgba(212, 175, 55, 0.1)', color: 'var(--accent-lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                <CheckCircle size={28} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: '800' }}>¡Mandado Completado!</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Tu paquete ha sido entregado exitosamente y con seguridad.
              </p>
              
              <div style={{ margin: '14px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Califica tu experiencia con **Anthony**:
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '6px', fontSize: '20px' }}>
                  {['⭐', '⭐', '⭐', '⭐', '⭐'].map((s, i) => (
                    <span key={i} style={{ cursor: 'pointer' }}>{s}</span>
                  ))}
                </div>
              </div>

              <button className="btn btn-primary btn-block" onClick={resetClientState}>
                Volver al Inicio
              </button>
            </div>
          )}
        </div>
      )}

      {/* PANTALLA HISTORIAL */}
      {activeTab === 'historial' && (
        <div className="view-layout">
          <div className="view-header" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <h2 className="view-title" style={{ fontSize: '17px', margin: 0 }}>Historial</h2>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Tus mandados y viajes recientes</span>
          </div>

          <div className="view-body" style={{ padding: '10px 14px' }}>
            <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {history.map(item => (
                <div key={item.id} className="history-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="history-type-tag">
                        {item.type === 'delivery' ? '🛵 Motorizado' 
                          : item.type === 'flete' ? '🚚 Mudanza / Carga' 
                          : item.type === 'taxi' ? '🚗 Auto (4 pers.)' 
                          : item.type === 'taxi_premium' ? '🚙 Auto Grande (6 pers.)' 
                          : '🛵 Motorizado'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{item.date}</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--accent-lime)' }}>S/ {item.price.toFixed(2)}</span>
                  </div>

                  <div className="history-route" style={{ marginTop: '8px', fontSize: '11.5px', borderLeft: '1px dashed var(--border-color)', paddingLeft: '8px', marginLeft: '4px' }}>
                    <div>{item.origin}</div>
                    <div style={{ marginTop: '4px' }}>{item.destination}</div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span>Conductor: <strong>{item.driverName}</strong></span>
                    <span>{'⭐'.repeat(item.rating)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PANTALLA BILLETERA */}
      {activeTab === 'billetera' && (
        <div className="view-layout">
          <div className="view-header" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <h2 className="view-title" style={{ fontSize: '17px', margin: 0 }}>Billetera</h2>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Métodos de pago en Gamarra y Lima</span>
          </div>

          <div className="view-body" style={{ padding: '16px 14px' }}>
            <div className="wallet-card">
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '800' }}>Balance Virtual</span>
              <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px' }}>S/ 35.00</span>
              <span style={{ fontSize: '10px', color: 'var(--accent-lime)', marginTop: '2px' }}>✓ 1 cupón de descuento activo</span>
            </div>

            <div style={{ marginTop: '20px' }}>
              <span className="section-title">MÉTODOS DE PAGO VINCULADOS</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                <div className="wallet-item">
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div className="wallet-icon-bg" style={{ backgroundColor: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '32px', height: '32px', color: '#FFF' }}>
                      📱
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700' }}>Yape / Plin</span>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>QR instantáneo 0% comisión</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--accent-lime)', fontWeight: '700' }}>VINCULADO</span>
                </div>

                <div className="wallet-item">
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div className="wallet-icon-bg" style={{ backgroundColor: '#1B1B1E', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '32px', height: '32px', color: '#FFF' }}>
                      💵
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700' }}>Efectivo</span>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Moneda local (Soles)</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--accent-lime)', fontWeight: '700' }}>PREDETERMINADO</span>
                </div>
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
              <div className="profile-avatar-large">
                <span>👤</span>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', marginTop: '12px' }}>{user?.name || 'Cliente'}</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>+51 {user?.phone}</p>
            </div>

            <div className="menu-list-group">
              <div className="menu-item-row" onClick={() => setActiveTab('billetera')}>
                <CreditCard size={15} />
                <span>Métodos de pago</span>
              </div>

              <div className="menu-item-row" onClick={() => setActiveTab('historial')}>
                <History size={15} />
                <span>Historial de viajes</span>
              </div>

              <div className="menu-item-row" onClick={logout} style={{ color: '#EF4444' }}>
                <LogOut size={15} />
                <span>Cerrar sesión</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANTALLA SEGURIDAD (SOLICITADA POR EL USUARIO) */}
      {activeTab === 'seguridad' && (
        <div className="view-layout">
          {/* Cabecera de pantalla */}
          <div className="view-header" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 14px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)'
          }}>
            <button 
              onClick={() => setActiveTab('inicio')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-lime)',
                cursor: 'pointer',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px'
              }}
            >
              ⬅️
            </button>
            <h2 className="view-title" style={{ fontSize: '18px', margin: 0, fontWeight: '800', fontFamily: 'var(--font-title)', color: 'var(--accent-gold)', letterSpacing: '1px', textTransform: 'uppercase' }}>Centro de Seguridad</h2>
          </div>

          <div className="view-body" style={{ padding: '16px 14px', overflowY: 'auto', height: 'calc(100% - 60px)' }}>
            
            {/* Escudo de Protección Inca */}
            <div className="inka-shield-container">
              <div className="inka-shield-outer-pulse">
                <div className="inka-shield-glow">
                  <div className="inka-shield-icon">🛡️</div>
                </div>
              </div>
              <div className="inka-shield-text">
                <h3 className="inka-shield-title">Protección Activa Inka</h3>
                <p className="inka-shield-status">Monitoreo de ruta Chasqui Guard activado y resguardando tu trayecto 24/7</p>
              </div>
            </div>

            {/* Cuadrícula de Acciones de Seguridad */}
            <div className="security-grid-2x2">
              {/* Llamada de Emergencia 105 */}
              <div 
                className="security-grid-card emergency" 
                onClick={() => {
                  if (window.confirm('¿Deseas realizar una llamada de emergencia al 105 (Policía Nacional)?')) {
                    window.open('tel:105');
                  }
                }}
              >
                <div className="card-icon">🚨</div>
                <div className="card-info">
                  <span className="card-title">Ayuda 105</span>
                  <span className="card-desc">Llamada de pánico directa a emergencias</span>
                </div>
              </div>

              {/* Canal de Soporte */}
              <div 
                className="security-grid-card" 
                onClick={() => alert('Conectando con el canal de soporte prioritario de Chasqui Go. Un asesor se comunicará contigo en breve.')}
              >
                <div className="card-icon">💬</div>
                <div className="card-info">
                  <span className="card-title">Soporte Inka</span>
                  <span className="card-desc">Atención inmediata de incidencias</span>
                </div>
              </div>

              {/* Contactos de Confianza */}
              <div 
                className="security-grid-card" 
                onClick={() => alert('Accediendo a la configuración de tu Círculo de Contactos de Confianza para compartir tu viaje en tiempo real.')}
              >
                <div className="card-icon">👥</div>
                <div className="card-info">
                  <span className="card-title">Contactos</span>
                  <span className="card-desc">Comparte tu ubicación con tu círculo</span>
                </div>
              </div>
            </div>

            {/* Sección Informativa: Protocolos de Seguridad */}
            <h3 className="security-section-title">
              ¿Cómo garantizamos tu tranquilidad?
            </h3>

            <div className="security-accordion-container">
              <details className="security-accordion">
                <summary className="security-summary">
                  <span className="summary-icon">🪪</span>
                  <span className="summary-text">Validación de los conductores por los E.</span>
                  <span className="summary-chevron">▼</span>
                </summary>
                <div className="security-details-content">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <strong style={{ display: 'block', color: 'var(--accent-gold)', marginBottom: '4px', fontSize: '11.5px', fontFamily: 'var(--font-title)' }}>1. SELECCIÓN LIBRE DEL CONDUCTOR</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Antes de aceptar una oferta, tienes la libertad de revisar la calificación en estrellas del conductor y el número total de servicios completados de manera exitosa.</span>
                    </div>
                    <div>
                      <strong style={{ display: 'block', color: 'var(--accent-gold)', marginBottom: '4px', fontSize: '11.5px', fontFamily: 'var(--font-title)' }}>2. SOCIOS VERIFICADOS Y ACTIVADOS</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Cada miembro del equipo debe aprobar un estricto proceso de admisión. Validamos licencias de conducir vigentes, antecedentes del conductor y la documentación reglamentaria del vehículo.</span>
                    </div>
                    <div>
                      <strong style={{ display: 'block', color: 'var(--accent-gold)', marginBottom: '4px', fontSize: '11.5px', fontFamily: 'var(--font-title)' }}>3. FOTOGRAFÍA DE PERFIL EN VIVO</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Para un reconocimiento rápido y seguro al abordar, exigimos selfies reales tomadas directamente durante el registro oficial, evitando cualquier tipo de suplantación de identidad.</span>
                    </div>
                  </div>
                </div>
              </details>

              <details className="security-accordion">
                <summary className="security-summary">
                  <span className="summary-icon">🔒</span>
                  <span className="summary-text">Protección de la privacidad</span>
                  <span className="summary-chevron">▼</span>
                </summary>
                <div className="security-details-content">
                  Protegemos tu identidad ocultando tu número de teléfono real. Las llamadas y comunicaciones se realizan mediante números enmascarados para evitar compartir información sensible.
                </div>
              </details>

              <details className="security-accordion">
                <summary className="security-summary">
                  <span className="summary-icon" style={{ padding: '6px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                      <path d="M3 5l18 14" />
                      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" stroke="none" />
                      <path d="M12 9v6" stroke="var(--bg-card)" strokeWidth="1.5" />
                    </svg>
                  </span>
                  <span className="summary-text">Protocolo de Confort y Bienestar</span>
                  <span className="summary-chevron">▼</span>
                </summary>
                <div className="security-details-content">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <strong style={{ display: 'block', color: 'var(--accent-gold)', marginBottom: '4px', fontSize: '11.5px', fontFamily: 'var(--font-title)' }}>1. COINCIDENCIA DE DATOS Y VEHÍCULO</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Asegúrate de que la identidad del conductor y las características del vehículo coincidan con los datos mostrados en la aplicación. Si notas diferencias, cancela el viaje de inmediato y notifícalo a Soporte.</span>
                    </div>
                    <div>
                      <strong style={{ display: 'block', color: 'var(--accent-gold)', marginBottom: '4px', fontSize: '11.5px', fontFamily: 'var(--font-title)' }}>2. PRECISIÓN EN EL PUNTO DE RECOGIDA</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Añade notas específicas a tu punto de recogida o selecciónalo detalladamente sobre el mapa interactivo. Esto ayuda a los conductores a encontrarte de forma más ágil y rápida.</span>
                    </div>
                    <div>
                      <strong style={{ display: 'block', color: 'var(--accent-gold)', marginBottom: '4px', fontSize: '11.5px', fontFamily: 'var(--font-title)' }}>3. RESPETO MUTUO Y PRIVACIDAD EN RUTA</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Mantén una conducta respetuosa, evitando preguntas íntimas o distracciones al conductor. Además, comunícate siempre usando el chat interno de la app para proteger tu información de contacto.</span>
                    </div>
                  </div>
                </div>
              </details>

              <details className="security-accordion">
                <summary className="security-summary">
                  <span className="summary-icon">⚠️</span>
                  <span className="summary-text">Qué hacer en caso de un accidente</span>
                  <span className="summary-chevron">▼</span>
                </summary>
                <div className="security-details-content">
                  Ante un eventual siniestro o desperfecto mecánico, contamos con una guía clara de asistencia telefónica y cobertura total del seguro contra accidentes (SOAT) de manera inmediata.
                </div>
              </details>
            </div>

          </div>
        </div>
      )}

      {/* MODAL BUSCADOR DE DESTINO */}
      {showSearchModal && (
        <div className="modal-overlay">
          <div className="modal-content search-modal-content">
            <div className="modal-header">
              <span className="modal-title">¿A dónde enviamos?</span>
              <button className="modal-close-btn" onClick={() => { setShowSearchModal(false); setActiveSearchField(null); }}>
                <X size={18} />
              </button>
            </div>

            <div className="search-modal-body">
              {/* Ruta inputs */}
              <div className="search-inputs-group">
                <div className="input-row-search">
                  <span className="dot-marker-green">●</span>
                  <input 
                    ref={originInputRef}
                    type="text" 
                    className="input-control-search" 
                    placeholder="Ingresa una ubicación"
                    value={clientState.origin}
                    onChange={(e) => setClientState(prev => ({ ...prev, origin: e.target.value }))}
                    onFocus={() => setActiveSearchField('origin')}
                  />
                </div>
                <div className="input-row-search" style={{ borderTop: '1px solid var(--border-color)' }}>
                  <span className="dot-marker-red">●</span>
                  <input 
                    ref={destInputRef}
                    type="text" 
                    className="input-control-search" 
                    placeholder="¿A dónde vas?" 
                    value={destinationInput}
                    onChange={(e) => setDestinationInput(e.target.value)}
                    onFocus={() => setActiveSearchField('destination')}
                    autoFocus
                  />
                </div>
              </div>

              {/* Posicionamiento y Localización GPS/Mapa */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px', marginBottom: '8px' }}>
                <div 
                  onClick={isSearchFieldEmpty ? handleUseMyLocation : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    backgroundColor: '#1E1E20',
                    border: '1px solid #27272A',
                    borderRadius: '12px',
                    cursor: isSearchFieldEmpty ? 'pointer' : 'not-allowed',
                    opacity: isSearchFieldEmpty ? 1 : 0.5,
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontSize: '18px', color: 'var(--accent-lime)' }}>📍</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#FFFFFF' }}>Fijar mi GPS actual</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Usa el satélite del celular para ubicarte</span>
                  </div>
                </div>

                <div 
                  onClick={isSearchFieldEmpty ? handleStartMapPicking : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    backgroundColor: '#1E1E20',
                    border: '1px solid #27272A',
                    borderRadius: '12px',
                    cursor: isSearchFieldEmpty ? 'pointer' : 'not-allowed',
                    opacity: isSearchFieldEmpty ? 1 : 0.5,
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontSize: '18px', color: 'var(--accent-lime)' }}>🗺️</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#FFFFFF' }}>Ubicar punto en el mapa táctil</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Arrastra el alfiler sobre la vista satelital</span>
                  </div>
                </div>
              </div>

              {/* DETALLES DE SOLICITUD */}
              {clientState.service !== 'taxi' && clientState.service !== 'taxi_premium' && (
                <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <span className="section-title" style={{ display: 'block', marginBottom: '10px' }}>DETALLES DE SOLICITUD</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#8F909A', fontWeight: '700', marginBottom: '4px' }}>
                        Celular de contacto (Recojo en origen)
                      </label>
                      <input 
                        type="tel"
                        className="form-control"
                        placeholder="Ej. 987654321"
                        value={pickupPhone}
                        onChange={(e) => setPickupPhone(e.target.value)}
                        style={{
                          width: '100%',
                          height: '38px',
                          backgroundColor: '#1E1E20',
                          border: '1px solid #27272A',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          padding: '0 12px',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#8F909A', fontWeight: '700', marginBottom: '4px' }}>
                        Celular de contacto (Entrega en destino)
                      </label>
                      <input 
                        type="tel"
                        className="form-control"
                        placeholder="Ej. 912345678"
                        value={deliveryPhone}
                        onChange={(e) => setDeliveryPhone(e.target.value)}
                        style={{
                          width: '100%',
                          height: '38px',
                          backgroundColor: '#1E1E20',
                          border: '1px solid #27272A',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          padding: '0 12px',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ¿QUÉ VOY A ENTREGAR? */}
              {clientState.service !== 'taxi' && clientState.service !== 'taxi_premium' && clientState.service !== 'flete' && (
                <div style={{ marginTop: '20px' }}>
                  <span className="section-title" style={{ display: 'block', marginBottom: '8px' }}>¿QUÉ VOY A ENTREGAR?</span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                      { id: 'alimentos', label: '🍔 Alimentos' },
                      { id: 'ropa', label: '👕 Ropa' },
                      { id: 'documentos', label: '📄 Documentos' },
                      { id: 'medicinas', label: '💊 Prod. Farmacéuticos' }
                    ].map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setDeliveryCategory(cat.id as any)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '20px',
                          border: '1px solid #27272A',
                          backgroundColor: deliveryCategory === cat.id ? 'var(--accent-lime)' : '#1E1E20',
                          color: deliveryCategory === cat.id ? '#000000' : '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ¿AYUDANTE PARA CARGA Y DESCARGA? (Solo para Mudanza / Carga) */}
              {clientState.service === 'flete' && (
                <div style={{ marginTop: '20px' }}>
                  <span className="section-title" style={{ display: 'block', marginBottom: '8px' }}>¿AYUDANTE PARA CARGA Y DESCARGA?</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setRequiresHelper('con_ayudante')}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: '12px',
                        border: '1px solid #27272A',
                        backgroundColor: requiresHelper === 'con_ayudante' ? 'var(--accent-lime)' : '#1E1E20',
                        color: requiresHelper === 'con_ayudante' ? '#000000' : '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>💪</span> Con ayudante
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequiresHelper('sin_ayudante')}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: '12px',
                        border: '1px solid #27272A',
                        backgroundColor: requiresHelper === 'sin_ayudante' ? 'var(--accent-lime)' : '#1E1E20',
                        color: requiresHelper === 'sin_ayudante' ? '#000000' : '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>🚫</span> Sin ayudante
                    </button>
                  </div>
                </div>
              )}

              {/* PROGRAMAR HORARIO DE RECOJO (Solo para Mudanza / Carga) */}
              {clientState.service === 'flete' && (
                <div style={{ marginTop: '20px' }}>
                  <span className="section-title" style={{ display: 'block', marginBottom: '8px' }}>PROGRAMAR HORARIO DE RECOJO</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setIsScheduled(false)}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: '12px',
                          border: '1px solid #27272A',
                          backgroundColor: !isScheduled ? 'var(--accent-lime)' : '#1E1E20',
                          color: !isScheduled ? '#000000' : '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>⚡</span> Inmediato (Ahora)
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsScheduled(true)}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: '12px',
                          border: '1px solid #27272A',
                          backgroundColor: isScheduled ? 'var(--accent-lime)' : '#1E1E20',
                          color: isScheduled ? '#000000' : '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>📅</span> Programar
                      </button>
                    </div>
                    {isScheduled && (
                      <div className="animated fadeIn" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                        <input
                          type="datetime-local"
                          className="form-control"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          style={{
                            width: '100%',
                            height: '38px',
                            backgroundColor: '#1E1E20',
                            border: '1px solid #27272A',
                            borderRadius: '8px',
                            color: '#FFFFFF',
                            padding: '0 12px',
                            fontSize: '13px'
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* COMENTARIOS PARA EL CONDUCTOR / REPARTIDOR */}
              <div style={{ 
                marginTop: '20px', 
                marginBottom: '12px',
                borderTop: (clientState.service === 'taxi' || clientState.service === 'taxi_premium' || clientState.service === 'flete') ? '1px solid var(--border-color)' : 'none',
                paddingTop: (clientState.service === 'taxi' || clientState.service === 'taxi_premium' || clientState.service === 'flete') ? '16px' : '0'
              }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#8F909A', fontWeight: '700', marginBottom: '6px' }}>
                  {clientState.service === 'taxi' || clientState.service === 'taxi_premium' 
                    ? 'COMENTARIOS PARA EL CONDUCTOR' 
                    : clientState.service === 'flete'
                      ? 'COMENTARIOS ADICIONALES PARA LA MUDANZA'
                      : 'COMENTARIOS PARA EL REPARTIDOR'}
                </label>
                <textarea
                  className="form-control"
                  placeholder={clientState.service === 'taxi' || clientState.service === 'taxi_premium'
                    ? "Ej. Llevar cambio de S/ 50, llamar al llegar, aire acondicionado..."
                    : clientState.service === 'flete'
                      ? "Ej. Indicar si hay ascensor, objetos frágiles o pesados (cama, ropero)..."
                      : "Ej. Entregar en portería del edificio, tocar el timbre 302..."}
                  rows={2}
                  value={courierComments}
                  onChange={(e) => setCourierComments(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#1E1E20',
                    border: '1px solid #27272A',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    padding: '8px 12px',
                    fontSize: '13px',
                    resize: 'none'
                  }}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '12px' }}>
              <button className="btn btn-primary btn-md btn-block" onClick={handleStartSearch} disabled={!destinationInput}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHAT CON EL CONDUCTOR */}
      {showChatModal && clientState.assignedDriver && (
        <div className="modal-overlay">
          <div className="modal-content chat-modal-content">
            <div className="modal-header">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div className="driver-avatar-circle" style={{ width: '28px', height: '28px', fontSize: '13px' }}>
                  <span>👨</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800' }}>{clientState.assignedDriver.name}</span>
                  <span style={{ fontSize: '9px', color: 'var(--accent-lime)' }}>En línea • Conductor</span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowChatModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="chat-messages-container">
              {clientState.chatMessages.map((msg, i) => (
                <div key={i} className={`chat-bubble-row ${msg.sender === 'client' ? 'outgoing' : 'incoming'}`}>
                  <div className="chat-bubble">
                    <p className="chat-bubble-text">{msg.text}</p>
                    <span className="chat-bubble-time">{msg.time}</span>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendChatMessage} className="chat-input-bar">
              <input 
                type="text" 
                className="chat-input-control" 
                placeholder="Escribe un mensaje..."
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
              />
              <button type="submit" className="chat-send-btn" disabled={!chatText.trim()}>
                <Send size={14} />
              </button>
            </form>
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
                className={`drawer-menu-item ${activeTab === 'historial' ? 'active' : ''}`} 
                onClick={() => { 
                  setIsDrawerOpen(false); 
                  setActiveTab('historial'); 
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: activeTab === 'historial' ? 'var(--text-primary)' : '#8F909A',
                  backgroundColor: activeTab === 'historial' ? 'rgba(212, 175, 55, 0.08)' : 'transparent',
                  fontWeight: activeTab === 'historial' ? '700' : '500',
                  fontSize: '13.5px',
                  transition: 'all 0.2s'
                }}
              >
                <History size={18} style={{ color: activeTab === 'historial' ? 'var(--accent-lime)' : '#8F909A' }} />
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
                className={`drawer-menu-item ${activeTab === 'seguridad' ? 'active' : ''}`} 
                onClick={() => { 
                  setIsDrawerOpen(false); 
                  setActiveTab('seguridad'); 
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: activeTab === 'seguridad' ? 'var(--text-primary)' : '#8F909A',
                  backgroundColor: activeTab === 'seguridad' ? 'rgba(212, 175, 55, 0.08)' : 'transparent',
                  fontWeight: activeTab === 'seguridad' ? '700' : '500',
                  fontSize: '13.5px',
                  transition: 'all 0.2s'
                }}
              >
                <Shield size={18} style={{ color: activeTab === 'seguridad' ? 'var(--accent-lime)' : '#8F909A' }} />
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
                  <span>Modo pasajero</span>
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
                      className="mode-dropdown-item active"
                      style={{
                        padding: '12px 16px',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: 'var(--accent-lime)',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>Modo pasajero</span>
                      <span>✓</span>
                    </div>
                    <div 
                      className="mode-dropdown-item clickable"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        setIsModeDropdownOpen(false);
                        switchRole('driver');
                      }}
                      style={{
                        padding: '12px 16px',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span>Modo conductor</span>
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
