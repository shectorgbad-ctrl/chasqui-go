import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'client' | 'driver';
  vehicleType?: 'delivery' | 'taxi' | 'taxi_premium' | 'flete';
  vehiclePlate?: string;
}

export interface Message {
  sender: 'client' | 'driver';
  text: string;
  time: string;
}

export interface Driver {
  name: string;
  rating: number;
  vehicle: string;
  plate: string;
  eta: number;
}

export interface ClientState {
  orderId?: string;
  origin: string;
  destination: string;
  service: 'taxi' | 'taxi_premium' | 'delivery' | 'flete' | null;
  suggestedPrice: string;
  paymentMethod: 'Efectivo' | 'Yape' | 'Plin';
  status: 'idle' | 'searching' | 'driver_incoming' | 'in_progress' | 'completed';
  assignedDriver: Driver | null;
  chatMessages: Message[];
}

export interface DriverDocuments {
  license: 'missing' | 'uploaded' | 'verified' | 'expired';
  soat: 'missing' | 'uploaded' | 'verified' | 'expired';
  revision: 'missing' | 'uploaded' | 'verified' | 'expired';
  property: 'missing' | 'uploaded' | 'verified' | 'expired';
}

export interface DriverState {
  isAvailable: boolean;
  activeJob: any | null;
  earnings: number;
  jobsCompleted: number;
  hoursActive: number;
  documents: DriverDocuments;
}

interface AppContextType {
  user: User | null;
  step: 'welcome' | 'role_select' | 'register' | 'sms' | 'vehicle_select' | 'dashboard' | 'verification';
  setStep: (step: any) => void;
  registerUser: (name: string, email: string, phone: string, role: 'client' | 'driver') => Promise<void>;
  selectVehicleType: (vehicleType: 'delivery' | 'taxi' | 'taxi_premium' | 'flete') => Promise<void>;
  logout: () => void;
  isPlaceholder: boolean;
  // Cliente
  clientState: ClientState;
  setClientState: React.Dispatch<React.SetStateAction<ClientState>>;
  resetClientState: () => void;
  placeRealOrder: (price: number, metadata?: { pickupPhone?: string; deliveryPhone?: string; category?: string; comment?: string }) => Promise<void>;
  originCoords: {lat: number, lng: number};
  setOriginCoords: React.Dispatch<React.SetStateAction<{lat: number, lng: number}>>;
  hasRealGPSLocation: boolean;
  setHasRealGPSLocation: React.Dispatch<React.SetStateAction<boolean>>;
  // Conductor
  driverState: DriverState;
  setDriverState: React.Dispatch<React.SetStateAction<DriverState>>;
  updateDocumentStatus: (doc: keyof DriverDocuments, status: any, docNumber?: string, fileUrl?: string) => Promise<void>;
  uploadDocumentEvidence: (docType: string, file: File) => Promise<string>;
  updateVehiclePlate: (plate: string) => Promise<void>;
  switchRole: (newRole: 'client' | 'driver', targetVehicle?: 'delivery' | 'taxi' | 'taxi_premium' | 'flete') => Promise<void>;
  verifiedVehicles: { [key: string]: boolean };
  // Historial
  history: any[];
  addHistoryItem: (item: any) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_SUPABASE_URL = 'https://rkvmspuwzgicijbbcsma.supabase.co';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const isPlaceholder = !SUPABASE_URL || SUPABASE_URL.includes('your-project-id');

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Estado de sesión
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('chasqui_user');
    if (saved) {
      const parsed = JSON.parse(saved) as User;
      if ((parsed.vehicleType as any) === 'moto') {
        parsed.vehicleType = 'delivery';
      }
      return parsed;
    }
    return null;
  });

  const [step, setStep] = useState<'welcome' | 'role_select' | 'register' | 'sms' | 'vehicle_select' | 'dashboard' | 'verification'>(() => {
    const savedUser = localStorage.getItem('chasqui_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser) as User;
      if ((parsed.vehicleType as any) === 'moto') {
        parsed.vehicleType = 'delivery';
      }
      if (parsed.role === 'driver' && !parsed.vehicleType) {
        return 'vehicle_select';
      }
      return 'dashboard';
    }
    return 'welcome';
  });

  // Estado del Cliente
  const [clientState, setClientState] = useState<ClientState>({
    origin: 'Obteniendo GPS...',
    destination: '',
    service: null,
    suggestedPrice: '10.00',
    paymentMethod: 'Efectivo',
    status: 'idle',
    assignedDriver: null,
    chatMessages: []
  });

  const [originCoords, setOriginCoords] = useState<{lat: number, lng: number}>({ lat: -12.121493, lng: -77.029490 }); // Miraflores (default)
  const [hasRealGPSLocation, setHasRealGPSLocation] = useState(false);

  // Estado del Conductor
  const [driverState, setDriverState] = useState<DriverState>({
    isAvailable: true,
    activeJob: null,
    earnings: 0.00,
    jobsCompleted: 0,
    hoursActive: 0,
    documents: {
      license: 'missing',
      soat: 'missing',
      revision: 'missing',
      property: 'missing'
    }
  });

  const [verifiedVehicles] = useState<{ [key: string]: boolean }>(() => {
    const saved = localStorage.getItem('chasqui_verified_vehicles');
    if (saved) return JSON.parse(saved);
    // Por defecto, motorizado (delivery) está verificado
    return {
      delivery: true,
      taxi: false,
      taxi_premium: false,
      flete: false
    };
  });

  // Historial de servicios
  const [history, setHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('chasqui_history');
    if (saved) return JSON.parse(saved);
    return [];
  });

  useEffect(() => {
    localStorage.setItem('chasqui_history', JSON.stringify(history));
  }, [history]);

  // Suscripción Realtime para pedidos si Supabase está activo
  useEffect(() => {
    if (isPlaceholder || !user || !clientState.orderId) return;

    const channel = supabase
      .channel(`order-${clientState.orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${clientState.orderId}`
        },
        async (payload: any) => {
          if (payload.eventType === 'DELETE') {
            resetClientState();
            return;
          }
          const updatedOrder = payload.new;
          if (!updatedOrder) return;
          if (updatedOrder.status === 'searching' && updatedOrder.driver_id) {
            const { data: driverProfile } = await supabase
              .from('profiles')
              .select('name, phone, vehicle_type')
              .eq('id', updatedOrder.driver_id)
              .maybeSingle();

            const { data: driverDocs } = await supabase
              .from('driver_documents')
              .select('document_type, document_number')
              .eq('driver_id', updatedOrder.driver_id);

            const propDoc = driverDocs?.find(d => d.document_type === 'property' && d.document_number && d.document_number !== '00000000');
            const soatDoc = driverDocs?.find(d => d.document_type === 'soat' && d.document_number && d.document_number !== '00000000');
            const plateText = propDoc ? propDoc.document_number : (soatDoc ? soatDoc.document_number : '');

            const vType = driverProfile?.vehicle_type;
            const vehicleName = (vType === 'moto' || vType === 'delivery') 
              ? 'Moto Lineal' 
              : (vType === 'taxi_premium' 
                ? 'Taxi Premium' 
                : (vType === 'flete' 
                  ? 'Flete / Carga' 
                  : 'Auto / Taxi'));
            const fullDesc = plateText ? `${vehicleName} • Placa: ${plateText}` : vehicleName;

            setClientState(prev => ({
              ...prev,
              suggestedPrice: updatedOrder.suggested_price.toString(),
              assignedDriver: {
                name: driverProfile?.name || 'Conductor',
                rating: 4.92,
                vehicle: fullDesc,
                plate: plateText || 'Sin placa',
                eta: 4
              }
            }));
          } else if (updatedOrder.status === 'searching' && !updatedOrder.driver_id) {
            setClientState(prev => ({
              ...prev,
              assignedDriver: null
            }));
          } else if (updatedOrder.status === 'driver_incoming' && updatedOrder.driver_id) {
            const { data: driverProfile } = await supabase
              .from('profiles')
              .select('name, phone, vehicle_type')
              .eq('id', updatedOrder.driver_id)
              .maybeSingle();

            const { data: driverDocs } = await supabase
              .from('driver_documents')
              .select('document_type, document_number')
              .eq('driver_id', updatedOrder.driver_id);

            const propDoc = driverDocs?.find(d => d.document_type === 'property' && d.document_number && d.document_number !== '00000000');
            const soatDoc = driverDocs?.find(d => d.document_type === 'soat' && d.document_number && d.document_number !== '00000000');
            const plateText = propDoc ? propDoc.document_number : (soatDoc ? soatDoc.document_number : '');

            const vType = driverProfile?.vehicle_type;
            const vehicleName = (vType === 'moto' || vType === 'delivery') 
              ? 'Moto Lineal' 
              : (vType === 'taxi_premium' 
                ? 'Taxi Premium' 
                : (vType === 'flete' 
                  ? 'Flete / Carga' 
                  : 'Auto / Taxi'));
            const fullDesc = plateText ? `${vehicleName} • Placa: ${plateText}` : vehicleName;

            setClientState(prev => ({
              ...prev,
              status: 'driver_incoming',
              suggestedPrice: updatedOrder.suggested_price.toString(),
              assignedDriver: {
                name: driverProfile?.name || 'Conductor',
                rating: 4.92,
                vehicle: fullDesc,
                plate: plateText || 'Sin placa',
                eta: 4
              },
              chatMessages: [
                { sender: 'driver', text: 'Hola, buenas tardes. Ya estoy saliendo para recoger tu paquete.', time: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) }
              ]
            }));
          } else if (updatedOrder.status === 'in_progress') {
            setClientState(prev => ({
              ...prev,
              status: 'in_progress',
              chatMessages: [
                ...prev.chatMessages,
                { sender: 'driver', text: 'Paquete recogido correctamente. Voy en ruta de entrega.', time: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) }
              ]
            }));
          } else if (updatedOrder.status === 'completed') {
            setClientState(prev => ({
              ...prev,
              status: 'completed'
            }));
            addHistoryItem({
              id: updatedOrder.id,
              type: updatedOrder.service,
              date: 'Hoy, ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
              origin: updatedOrder.origin,
              destination: updatedOrder.destination,
              driverName: clientState.assignedDriver?.name || 'Carlos Q.',
              rating: 5,
              price: Number(updatedOrder.suggested_price)
            });
          } else if (updatedOrder.status === 'cancelled') {
            resetClientState();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientState.orderId, user]);

  const ensureSupabaseAuth = async () => {
    if (isPlaceholder || !user?.email) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const dummyPassword = 'ChasquiGo123_!';
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: dummyPassword
        });

        if (signInError) {
          console.warn('Auto sign-in failed, attempting signUp to re-create account:', signInError.message);
          const { data: signUpData } = await supabase.auth.signUp({
            email: user.email,
            password: dummyPassword,
            options: {
              data: { name: user.name, phone: user.phone, role: user.role }
            }
          });

          if (signUpData?.user) {
            const updatedUser = { ...user, id: signUpData.user.id };
            setUser(updatedUser);
            localStorage.setItem('chasqui_user', JSON.stringify(updatedUser));
          }
        } else if (signInData?.user && signInData.user.id !== user.id) {
          const updatedUser = { ...user, id: signInData.user.id };
          setUser(updatedUser);
          localStorage.setItem('chasqui_user', JSON.stringify(updatedUser));
        }
      }
    } catch (err: any) {
      console.warn('Error verifying Supabase auth session:', err.message);
    }
  };

  // Carga inicial de documentos y suscripción en tiempo real para conductores
  useEffect(() => {
    if (isPlaceholder || !user || user.role !== 'driver') return;

    let isMounted = true;

    const fetchAndSubscribeDocs = async () => {
      try {
        await ensureSupabaseAuth();
        const { data: docs, error } = await supabase
          .from('driver_documents')
          .select('*')
          .eq('driver_id', user.id);

        if (error) throw error;

        const mappedDocs: DriverDocuments = {
          license: 'missing',
          soat: 'missing',
          revision: 'missing',
          property: 'missing'
        };
        
        const propDoc = docs?.find(d => d.document_type === 'property' && d.document_number && d.document_number !== '00000000');
        const soatDoc = docs?.find(d => d.document_type === 'soat' && d.document_number && d.document_number !== '00000000');
        const foundPlate = propDoc ? propDoc.document_number : (soatDoc ? soatDoc.document_number : '');

        docs?.forEach(d => {
          if (d.document_type in mappedDocs) {
            mappedDocs[d.document_type as keyof DriverDocuments] = (d.status === 'uploaded' || d.status === 'verified') ? 'verified' : d.status;
          }
        });

        if (isMounted) {
          setDriverState(prev => ({ ...prev, documents: mappedDocs }));
          if (foundPlate) {
            setUser(prev => {
              if (!prev) return null;
              const updated = { ...prev, vehiclePlate: foundPlate };
              localStorage.setItem('chasqui_user', JSON.stringify(updated));
              return updated;
            });
          }
        }
      } catch (err: any) {
        console.error('Error fetching driver documents:', err.message);
      }
    };

    fetchAndSubscribeDocs();

    const channel = supabase
      .channel(`driver-docs-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_documents',
          filter: `driver_id=eq.${user.id}`
        },
        (payload: any) => {
          const updatedDoc = payload.new;
          if (!updatedDoc) return;
          
          setDriverState(prev => {
            const updatedDocs = { 
              ...prev.documents, 
              [updatedDoc.document_type]: updatedDoc.status 
            };
            return {
              ...prev,
              documents: updatedDocs
            };
          });
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user, isPlaceholder]);

  const registerUser = async (name: string, rawEmail: string, phone: string, role: 'client' | 'driver') => {
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '900000000';
    // Generar un correo único por registro para que Supabase Auth jamás reporte duplicados o cuentas no confirmadas
    const userEmail = (rawEmail && rawEmail.trim()) ? rawEmail.trim() : `${cleanPhone}_${Date.now()}@chasquigo.app`;

    if (isPlaceholder) {
      const mockId = Math.random().toString(36).substring(2, 11);
      const newUser: User = { id: mockId, name: name || 'Usuario', email: userEmail, phone: cleanPhone, role };
      setUser(newUser);
      localStorage.setItem('chasqui_user', JSON.stringify(newUser));
      
      if (role === 'driver') {
        setDriverState(prev => ({
          ...prev,
          documents: {
            license: 'missing',
            soat: 'missing',
            revision: 'missing',
            property: 'missing'
          }
        }));
        setStep('vehicle_select');
      } else {
        setStep('dashboard');
      }
      return;
    }

    try {
      const dummyPassword = 'ChasquiGo123_!';
      let activeUserId: string | null = null;

      // 1. Intentar registrar en Supabase Auth
      const { data: signData } = await supabase.auth.signUp({
        email: userEmail,
        password: dummyPassword,
        options: {
          data: { name: name || 'Usuario', phone: cleanPhone, role }
        }
      });

      if (signData?.user) {
        activeUserId = signData.user.id;
      } else {
        // Fallback: intentar login o generar ID válido
        const { data: logData } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: dummyPassword
        });
        activeUserId = logData?.user?.id || `usr_${cleanPhone}_${Date.now()}`;
      }

      // 2. Guardar en la tabla profiles
      try {
        await supabase
          .from('profiles')
          .upsert({
            id: activeUserId,
            name: name || 'Usuario',
            email: userEmail,
            phone: cleanPhone,
            role
          });
      } catch (err: any) {
        console.warn('Profile upsert notice:', err.message);
      }

      const loggedUser: User = {
        id: activeUserId,
        name: name || 'Usuario',
        email: userEmail,
        phone: cleanPhone,
        role
      };
      setUser(loggedUser);
      localStorage.setItem('chasqui_user', JSON.stringify(loggedUser));

      if (role === 'driver') {
        const { data: docs } = await supabase
          .from('driver_documents')
          .select('*')
          .eq('driver_id', activeUserId);

        const mappedDocs: DriverDocuments = {
          license: 'missing',
          soat: 'missing',
          revision: 'missing',
          property: 'missing'
        };
        
        docs?.forEach(d => {
          if (d.document_type in mappedDocs) {
            mappedDocs[d.document_type as keyof DriverDocuments] = d.status;
          }
        });

        setDriverState(prev => ({ ...prev, documents: mappedDocs }));
        
        const { data: profData } = await supabase
          .from('profiles')
          .select('vehicle_type')
          .eq('id', activeUserId)
          .maybeSingle();

        if (!profData?.vehicle_type) {
          setStep('vehicle_select');
        } else {
          const allDone = Object.values(mappedDocs).every(status => status === 'verified' || status === 'uploaded');
          setStep(allDone ? 'dashboard' : 'verification');
        }
      } else {
        setStep('dashboard');
      }
    } catch (err: any) {
      console.error('Supabase Auth Fallback:', err);
      const fallbackId = `usr_${cleanPhone}_${Date.now()}`;
      const fallbackUser: User = {
        id: fallbackId,
        name: name || 'Usuario',
        email: userEmail,
        phone: cleanPhone,
        role
      };
      setUser(fallbackUser);
      localStorage.setItem('chasqui_user', JSON.stringify(fallbackUser));
      if (role === 'driver') {
        setStep('vehicle_select');
      } else {
        setStep('dashboard');
      }
    }
  };

  const selectVehicleType = async (vehicleType: 'delivery' | 'taxi' | 'taxi_premium' | 'flete') => {
    if (!user) return;
    const updatedUser: User = { ...user, vehicleType };
    setUser(updatedUser);
    localStorage.setItem('chasqui_user', JSON.stringify(updatedUser));

    if (!isPlaceholder) {
      try {
        const dbVehicleType = vehicleType === 'delivery' ? 'moto' : vehicleType;
        const { error } = await supabase
          .from('profiles')
          .update({ vehicle_type: dbVehicleType } as any)
          .eq('id', user.id);
        if (error) throw error;
      } catch (err: any) {
        console.error('Error actualizando tipo de vehículo:', err.message);
      }
    }

    setStep('dashboard');
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('chasqui_user');
    setStep('welcome');
    resetClientState();
    if (!isPlaceholder) {
      supabase.auth.signOut();
    }
  };

  const switchRole = async (newRole: 'client' | 'driver', targetVehicle?: 'delivery' | 'taxi' | 'taxi_premium' | 'flete') => {
    if (!user) return;

    const vehicle = targetVehicle || user.vehicleType || 'delivery';

    if (!isPlaceholder) {
      try {
        const updates: any = { role: newRole };
        if (newRole === 'driver') {
          updates.vehicle_type = vehicle === 'delivery' ? 'moto' : vehicle;
        }

        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id);
        
        if (error) throw error;

        const updatedUser = { ...user, role: newRole, vehicleType: newRole === 'driver' ? vehicle : user.vehicleType };
        setUser(updatedUser);
        localStorage.setItem('chasqui_user', JSON.stringify(updatedUser));
        
        if (newRole === 'driver') {
          const isVerified = verifiedVehicles[vehicle];
          if (isVerified) {
            setDriverState(prev => ({
              ...prev,
              documents: {
                license: 'verified',
                soat: 'verified',
                revision: 'verified',
                property: 'verified'
              }
            }));
            setStep('dashboard');
          } else {
            setDriverState(prev => ({
              ...prev,
              documents: {
                license: 'missing',
                soat: 'missing',
                revision: 'missing',
                property: 'missing'
              }
            }));
            setStep('verification');
          }
        } else {
          setStep('dashboard');
        }
      } catch (err: any) {
        console.error('Error switching role in Supabase:', err.message);
      }
    } else {
      // Offline simulation mode
      const updatedUser = { ...user, role: newRole, vehicleType: newRole === 'driver' ? vehicle : user.vehicleType };
      setUser(updatedUser);
      localStorage.setItem('chasqui_user', JSON.stringify(updatedUser));

      if (newRole === 'driver') {
        const isVerified = verifiedVehicles[vehicle];
        if (isVerified) {
          setDriverState(prev => ({
            ...prev,
            documents: {
              license: 'verified',
              soat: 'verified',
              revision: 'verified',
              property: 'verified'
            }
          }));
          setStep('dashboard');
        } else {
          setDriverState(prev => ({
            ...prev,
            documents: {
              license: 'missing',
              soat: 'missing',
              revision: 'missing',
              property: 'missing'
            }
          }));
          setStep('verification');
        }
      } else {
        setStep('dashboard');
      }
    }
  };

  const resetClientState = () => {
    setClientState({
      origin: 'Obteniendo GPS...',
      destination: '',
      service: null,
      suggestedPrice: '10.00',
      paymentMethod: 'Efectivo',
      status: 'idle',
      assignedDriver: null,
      chatMessages: []
    });
    setOriginCoords({ lat: -12.121493, lng: -77.029490 });
    setHasRealGPSLocation(false);
  };

  const uploadDocumentEvidence = async (docType: string, file: File) => {
    if (isPlaceholder || !user) {
      console.log('Mock: Subiendo archivo de evidencia localmente:', file.name);
      return 'mock_url_path_' + docType;
    }

    try {
      await ensureSupabaseAuth();
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${docType}_${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage
        .from('driver-documents')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('driver-documents')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (err: any) {
      console.error('Storage Upload Error:', err.message);
      throw err;
    }
  };

  const updateDocumentStatus = async (
    doc: keyof DriverDocuments, 
    status: any, 
    docNumber?: string, 
    fileUrl?: string
  ) => {
    // Modo de prueba: la aprobación se realiza automáticamente en Supabase al subir el documento
    const effectiveStatus = status === 'uploaded' ? 'verified' : status;
    const verifiedTimestamp = effectiveStatus === 'verified' ? new Date().toISOString() : null;

    if ((doc === 'soat' || doc === 'property') && docNumber && docNumber.trim() && docNumber !== '00000000') {
      const cleanPlate = docNumber.toUpperCase().trim();
      setUser(prev => {
        if (!prev) return null;
        const updated = { ...prev, vehiclePlate: cleanPlate };
        localStorage.setItem('chasqui_user', JSON.stringify(updated));
        return updated;
      });
    }

    setDriverState(prev => {
      const updatedDocs = { ...prev.documents, [doc]: effectiveStatus };
      const allDone = Object.values(updatedDocs).every(s => s === 'verified');
      if (allDone) {
        setTimeout(() => {
          setStep('dashboard');
        }, 1000);
      }
      return {
        ...prev,
        documents: updatedDocs
      };
    });

    if (isPlaceholder || !user) return;

    try {
      await ensureSupabaseAuth();
      // Buscar si ya existe un registro para este conductor y tipo de documento
      const { data: existing, error: findError } = await supabase
        .from('driver_documents')
        .select('id')
        .eq('driver_id', user.id)
        .eq('document_type', doc)
        .maybeSingle();

      if (findError) throw findError;

      if (existing) {
        const { error: updateError } = await supabase
          .from('driver_documents')
          .update({
            document_number: docNumber || '00000000',
            file_path: fileUrl || '',
            status: effectiveStatus,
            verified_at: verifiedTimestamp,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('driver_documents')
          .insert({
            driver_id: user.id,
            document_type: doc,
            document_number: docNumber || '00000000',
            file_path: fileUrl || '',
            status: effectiveStatus,
            verified_at: verifiedTimestamp,
            updated_at: new Date().toISOString()
          });

        if (insertError) throw insertError;
      }
    } catch (err: any) {
      console.error('Error guardando documento en base de datos:', err.message);
      throw err;
    }
  };

  const placeRealOrder = async (price: number, metadata?: { pickupPhone?: string; deliveryPhone?: string; category?: string; comment?: string }) => {
    if (isPlaceholder || !user) {
      setClientState(prev => ({
        ...prev,
        status: 'searching',
        suggestedPrice: price.toString()
      }));
      return;
    }

    try {
      await ensureSupabaseAuth();
      const currentUserId = user.id;

      let finalDestination = clientState.destination;
      if (metadata) {
        finalDestination += ' ||| ' + JSON.stringify(metadata);
      }

      const { data, error } = await supabase
        .from('orders')
        .insert({
          client_id: currentUserId,
          origin: clientState.origin,
          destination: finalDestination,
          service: clientState.service,
          suggested_price: price,
          payment_method: clientState.paymentMethod,
          status: 'searching'
        })
        .select()
        .single();

      if (error) throw error;

      setClientState(prev => ({
        ...prev,
        orderId: data.id,
        status: 'searching',
        suggestedPrice: price.toString()
      }));
    } catch (err: any) {
      console.error('Error insertando orden en Supabase:', err.message);
      alert('Error al procesar orden: ' + err.message);
    }
  };

  const addHistoryItem = (item: any) => {
    setHistory(prev => [item, ...prev]);
  };

  const updateVehiclePlate = async (plate: string) => {
    if (!user) return;
    const cleanPlate = plate.toUpperCase().trim();
    const updatedUser: User = { ...user, vehiclePlate: cleanPlate };
    setUser(updatedUser);
    localStorage.setItem('chasqui_user', JSON.stringify(updatedUser));

    if (!isPlaceholder) {
      try {
        await ensureSupabaseAuth();
        const { data: existing } = await supabase
          .from('driver_documents')
          .select('id')
          .eq('driver_id', user.id)
          .in('document_type', ['soat', 'property'])
          .maybeSingle();

        if (existing) {
          await supabase
            .from('driver_documents')
            .update({ document_number: cleanPlate, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('driver_documents')
            .insert({
              driver_id: user.id,
              document_type: 'soat',
              document_number: cleanPlate,
              file_path: '',
              status: 'verified',
              verified_at: new Date().toISOString()
            });
        }
      } catch (err: any) {
        console.error('Error actualizando placa en BD:', err.message);
      }
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        step,
        setStep,
        registerUser,
        selectVehicleType,
        logout,
        switchRole,
        isPlaceholder,
        clientState,
        setClientState,
        resetClientState,
        placeRealOrder,
        driverState,
        setDriverState,
        updateDocumentStatus,
        uploadDocumentEvidence,
        updateVehiclePlate,
        history,
        addHistoryItem,
        originCoords,
        setOriginCoords,
        hasRealGPSLocation,
        setHasRealGPSLocation,
        verifiedVehicles
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
