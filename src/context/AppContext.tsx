import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'client' | 'driver';
  vehicleType?: 'moto' | 'taxi' | 'camion';
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
  service: 'mototaxi' | 'taxi' | 'delivery' | 'express' | 'flete' | 'camion';
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
  selectVehicleType: (vehicleType: 'moto' | 'taxi' | 'camion') => Promise<void>;
  logout: () => void;
  isPlaceholder: boolean;
  // Cliente
  clientState: ClientState;
  setClientState: React.Dispatch<React.SetStateAction<ClientState>>;
  resetClientState: () => void;
  placeRealOrder: (price: number) => Promise<void>;
  // Conductor
  driverState: DriverState;
  setDriverState: React.Dispatch<React.SetStateAction<DriverState>>;
  updateDocumentStatus: (doc: keyof DriverDocuments, status: any, docNumber?: string, fileUrl?: string) => Promise<void>;
  uploadDocumentEvidence: (docType: string, file: File) => Promise<string>;
  switchRole: (newRole: 'client' | 'driver') => Promise<void>;
  // Historial
  history: any[];
  addHistoryItem: (item: any) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const isPlaceholder = !SUPABASE_URL || SUPABASE_URL.includes('your-project-id');

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Estado de sesión
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('chasqui_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [step, setStep] = useState<'welcome' | 'role_select' | 'register' | 'sms' | 'vehicle_select' | 'dashboard' | 'verification'>(() => {
    const savedUser = localStorage.getItem('chasqui_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser) as User;
      if (parsed.role === 'driver' && !parsed.vehicleType) {
        return 'vehicle_select';
      }
      return 'dashboard';
    }
    return 'welcome';
  });

  // Estado del Cliente
  const [clientState, setClientState] = useState<ClientState>({
    origin: 'Av. Larco 1045, Miraflores',
    destination: '',
    service: 'delivery',
    suggestedPrice: '10.00',
    paymentMethod: 'Efectivo',
    status: 'idle',
    assignedDriver: null,
    chatMessages: []
  });

  // Estado del Conductor
  const [driverState, setDriverState] = useState<DriverState>({
    isAvailable: true,
    activeJob: null,
    earnings: 521.00,
    jobsCompleted: 43,
    hoursActive: 38,
    documents: {
      license: 'missing',
      soat: 'missing',
      revision: 'missing',
      property: 'missing'
    }
  });

  // Historial de servicios
  const [history, setHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('chasqui_history');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: '1',
        type: 'delivery',
        date: 'Lunes, 08:00',
        origin: 'San Miguel',
        destination: 'Miraflores',
        driverName: 'Ana F.',
        rating: 5,
        price: 12.00
      },
      {
        id: '2',
        type: 'taxi',
        date: 'Hoy, 10:30',
        origin: 'Miraflores',
        destination: 'San Isidro',
        driverName: 'Carlos Q.',
        rating: 5,
        price: 14.50
      },
      {
        id: '3',
        type: 'mototaxi',
        date: 'Ayer, 19:15',
        origin: 'Barranco',
        destination: 'La Molina',
        driverName: 'José R.',
        rating: 4,
        price: 7.00
      }
    ];
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
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${clientState.orderId}`
        },
        async (payload: any) => {
          const updatedOrder = payload.new;
          if (updatedOrder.status === 'driver_incoming' && updatedOrder.driver_id) {
            const { data: driverProfile } = await supabase
              .from('profiles')
              .select('name, phone')
              .eq('id', updatedOrder.driver_id)
              .single();

            setClientState(prev => ({
              ...prev,
              status: 'driver_incoming',
              assignedDriver: {
                name: driverProfile?.name || 'Carlos Quispe Mamani',
                rating: 4.92,
                vehicle: 'Honda GL125 (Moto) • ABC-123',
                plate: 'ABC-123',
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
              driverName: 'Carlos Q.',
              rating: 5,
              price: Number(updatedOrder.suggested_price)
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientState.orderId, user]);

  // Carga inicial de documentos y suscripción en tiempo real para conductores
  useEffect(() => {
    if (isPlaceholder || !user || user.role !== 'driver') return;

    let isMounted = true;

    const fetchAndSubscribeDocs = async () => {
      try {
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
        
        docs?.forEach(d => {
          if (d.document_type in mappedDocs) {
            mappedDocs[d.document_type as keyof DriverDocuments] = d.status;
          }
        });

        if (isMounted) {
          setDriverState(prev => ({ ...prev, documents: mappedDocs }));
          
          const allVerified = Object.values(mappedDocs).every(status => status === 'verified');
          if (!allVerified) {
            setStep(prev => {
              if (prev === 'dashboard' || prev === 'verification') {
                return 'verification';
              }
              return prev;
            });
          } else {
            setStep(prev => {
              if (prev === 'dashboard' || prev === 'verification') {
                return 'dashboard';
              }
              return prev;
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
            
            // Si todos los documentos ahora están verificados, pasamos al dashboard
            const allVerified = Object.values(updatedDocs).every(status => status === 'verified');
            if (allVerified) {
              setStep(prev => (prev === 'verification' ? 'dashboard' : prev));
            } else {
              setStep(prev => (prev === 'dashboard' ? 'verification' : prev));
            }
            
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

  const registerUser = async (name: string, email: string, phone: string, role: 'client' | 'driver') => {
    if (isPlaceholder) {
      const mockId = Math.random().toString(36).substring(2, 11);
      const newUser: User = { id: mockId, name, email, phone, role };
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password: dummyPassword,
        options: {
          data: { name, phone, role }
        }
      });

      if (error) {
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          const { data: logData, error: logError } = await supabase.auth.signInWithPassword({
            email,
            password: dummyPassword
          });
          if (logError) throw logError;

          // Actualizar el rol en la base de datos para que coincida con el seleccionado en pantalla
          const { error: updateRoleError } = await supabase
            .from('profiles')
            .update({ role } as any)
            .eq('id', logData.user?.id);

          if (updateRoleError) throw updateRoleError;
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', logData.user?.id)
            .single();

          if (profile) {
            const loggedUser: User = {
              id: profile.id,
              name: profile.name,
              email: profile.email,
              phone: profile.phone,
              role: profile.role,
              vehicleType: profile.vehicle_type
            };
            setUser(loggedUser);
            localStorage.setItem('chasqui_user', JSON.stringify(loggedUser));
            
            if (profile.role === 'driver') {
              const { data: docs } = await supabase
                .from('driver_documents')
                .select('*')
                .eq('driver_id', profile.id);

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
              
              if (!profile.vehicle_type) {
                setStep('vehicle_select');
              } else {
                const allVerified = isPlaceholder
                  ? Object.values(mappedDocs).every(status => status === 'verified' || status === 'uploaded')
                  : Object.values(mappedDocs).every(status => status === 'verified');
                setStep(allVerified ? 'dashboard' : 'verification');
              }
            } else {
              setStep('dashboard');
            }
            return;
          }
        }
        throw error;
      }

      if (data.user) {
        const newUser: User = {
          id: data.user.id,
          name,
          email,
          phone,
          role
        };
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
      }
    } catch (err: any) {
      console.error('Supabase Auth Error:', err.message);
      alert('Error en registro con Supabase: ' + err.message);
    }
  };

  const selectVehicleType = async (vehicleType: 'moto' | 'taxi' | 'camion') => {
    if (!user) return;
    const updatedUser: User = { ...user, vehicleType };
    setUser(updatedUser);
    localStorage.setItem('chasqui_user', JSON.stringify(updatedUser));

    if (!isPlaceholder) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ vehicle_type: vehicleType } as any)
          .eq('id', user.id);
        if (error) throw error;
      } catch (err: any) {
        console.error('Error actualizando tipo de vehículo:', err.message);
      }
    }

    setStep('verification');
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

  const switchRole = async (newRole: 'client' | 'driver') => {
    if (!user) return;
    const updatedUser = { ...user, role: newRole };
    setUser(updatedUser);
    localStorage.setItem('chasqui_user', JSON.stringify(updatedUser));

    if (!isPlaceholder) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ role: newRole } as any)
          .eq('id', user.id);
        
        if (error) throw error;
        
        if (newRole === 'driver') {
          const { data: docs } = await supabase
            .from('driver_documents')
            .select('*')
            .eq('driver_id', user.id);

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
          
          const allVerified = Object.values(mappedDocs).every(status => status === 'verified');
          setStep(allVerified ? 'dashboard' : 'verification');
        } else {
          setStep('dashboard');
        }
      } catch (err: any) {
        console.error('Error switching role in Supabase:', err.message);
      }
    } else {
      // Offline simulation mode
      if (newRole === 'driver') {
        const allVerified = Object.values(driverState.documents).every(status => status === 'verified' || status === 'uploaded');
        setStep(allVerified ? 'dashboard' : 'verification');
      } else {
        setStep('dashboard');
      }
    }
  };

  const resetClientState = () => {
    setClientState({
      origin: 'Av. Larco 1045, Miraflores',
      destination: '',
      service: 'delivery',
      suggestedPrice: '10.00',
      paymentMethod: 'Efectivo',
      status: 'idle',
      assignedDriver: null,
      chatMessages: []
    });
  };

  const uploadDocumentEvidence = async (docType: string, file: File) => {
    if (isPlaceholder || !user) {
      console.log('Mock: Subiendo archivo de evidencia localmente:', file.name);
      return 'mock_url_path_' + docType;
    }

    try {
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
    setDriverState(prev => {
      const updatedDocs = { ...prev.documents, [doc]: status };
      const allDone = Object.values(updatedDocs).every(s => s === 'verified' || s === 'uploaded');
      if (allDone && step === 'verification' && isPlaceholder) {
        setTimeout(() => {
          setStep('dashboard');
          alert('¡Documentos enviados a revisión! Simulación de Demostración: Has sido aprobado automáticamente para pruebas del panel de conductor.');
        }, 1500);
      }
      return {
        ...prev,
        documents: updatedDocs
      };
    });

    if (isPlaceholder || !user) return;

    try {
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
            status: status,
            updated_at: new Date()
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
            status: status,
            updated_at: new Date()
          });

        if (insertError) throw insertError;
      }
    } catch (err: any) {
      console.error('Error guardando documento en base de datos:', err.message);
    }
  };

  const placeRealOrder = async (price: number) => {
    if (isPlaceholder || !user) {
      setClientState(prev => ({
        ...prev,
        status: 'searching',
        suggestedPrice: price.toString()
      }));
      return;
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .insert({
          client_id: user.id,
          origin: clientState.origin,
          destination: clientState.destination,
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
        history,
        addHistoryItem
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
