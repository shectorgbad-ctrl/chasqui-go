import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import { 
  ArrowRight, 
  ArrowLeft, 
  MapPin, 
  Box, 
  TrendingUp, 
  User, 
  ShieldCheck,
  CheckCircle2,
  Info,
  Bike,
  Car,
  Truck,
  Sparkles
} from 'lucide-react';

export const Welcome: React.FC = () => {
  const { step, setStep, registerUser, selectVehicleType, isPlaceholder } = useApp();
  const [slide, setSlide] = useState(0);

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    if (isPlaceholder) {
      const mockName = provider === 'google' ? 'Hector Google Simbron' : 'Hector Facebook Simbron';
      const mockEmail = provider === 'google' ? 'hector.google@gmail.com' : 'hector.facebook@hotmail.com';
      setName(mockName);
      setEmail(mockEmail);
      alert(`Datos importados con éxito de ${provider === 'google' ? 'Google' : 'Facebook'}. Por favor, completa tu número de teléfono para continuar.`);
    } else {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: window.location.origin
          }
        });
        if (error) throw error;
      } catch (err: any) {
        alert(`Error al iniciar sesión con ${provider}: ` + err.message);
      }
    }
  };

  // States para Registro
  const [role, setRole] = useState<'client' | 'driver'>('client');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState<'delivery' | 'taxi' | 'taxi_premium' | 'flete'>('delivery');
  
  // States para SMS
  const [smsCode, setSmsCode] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(45);

  // Slides de Onboarding
  const slides = [
    {
      title: 'Llega a donde quieres',
      subtitle: 'Mototaxi, taxi, delivery y más. Todo en una sola app diseñada para el Perú.',
      icon: <MapPin size={48} className="slide-icon-main" style={{ color: 'var(--accent-lime)' }} />,
      btnText: 'Siguiente'
    },
    {
      title: 'Envíos al instante',
      subtitle: 'Envía paquetes express a cualquier punto de Lima y provincias con seguimiento en tiempo real.',
      icon: <Box size={48} className="slide-icon-main" style={{ color: 'var(--accent-lime)' }} />,
      btnText: 'Siguiente'
    },
    {
      title: 'Gana más conduciendo',
      subtitle: 'Únete como conductor o repartidor. Recibe pedidos cerca de ti y retira tus ganancias al instante.',
      icon: <TrendingUp size={48} className="slide-icon-main" style={{ color: 'var(--accent-lime)' }} />,
      btnText: 'Crear cuenta gratis'
    }
  ];

  useEffect(() => {
    let interval: any;
    if (step === 'sms' && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  const handleNextSlide = () => {
    if (slide < slides.length - 1) {
      setSlide(slide + 1);
    } else {
      setStep('role_select');
    }
  };

  const handleRoleSelectSubmit = () => {
    setStep('register');
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone) {
      alert('Por favor, completa todos los campos.');
      return;
    }
    setStep('sms');
  };

  const handleSmsChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return;
    const newCode = [...smsCode];
    newCode[index] = value;
    setSmsCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`sms-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleSmsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !smsCode[index] && index > 0) {
      const prevInput = document.getElementById(`sms-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleSmsVerify = () => {
    const code = smsCode.join('');
    if (code.length < 6) {
      alert('Por favor, ingresa el código completo de 6 dígitos.');
      return;
    }
    // Completar Registro
    registerUser(name, email, phone, role);
  };

  return (
    <div className="mobile-container dark-theme">
      <div className="peru-bg-watermark machu-picchu-bg"></div>
      {/* 1. SLIDES DE ONBOARDING */}
      {step === 'welcome' && (
        <div className="onboarding-layout">
          <div className="onboarding-content">
            <div className="logo-area">
              <span className="app-badge-title">ChasquiGo</span>
            </div>
            
            <div className="slide-icon-wrapper">
              <div className="pulse-container">
                {slides[slide].icon}
              </div>
            </div>

            <div className="slide-text-group">
              <h2 className="slide-title">{slides[slide].title}</h2>
              <p className="slide-subtitle">{slides[slide].subtitle}</p>
            </div>

            <div className="slide-dots">
              {slides.map((_, idx) => (
                <span 
                  key={idx} 
                  className={`dot ${idx === slide ? 'active' : ''}`}
                />
              ))}
            </div>
          </div>

          <div className="onboarding-actions">
            <button 
              className="btn btn-primary btn-lg" 
              onClick={handleNextSlide}
            >
              <span>{slides[slide].btnText}</span>
              <ArrowRight size={18} />
            </button>
            {slide === slides.length - 1 && (
              <button 
                className="btn btn-text"
                onClick={() => {
                  // Simular cuenta existente para pruebas
                  setName('Hector Simbron');
                  setEmail('hector@gmail.com');
                  setPhone('943483601');
                  setRole('client');
                  registerUser('Hector Simbron', 'hector@gmail.com', '943483601', 'client');
                }}
                style={{ marginTop: '8px' }}
              >
                Ya tengo cuenta
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. SELECTOR DE ROL */}
      {step === 'role_select' && (
        <div className="view-layout">
          <div className="view-header">
            <button className="back-btn" onClick={() => setStep('welcome')}>
              <ArrowLeft size={20} />
            </button>
            <span className="step-indicator">Paso 1 de 3</span>
          </div>

          <div className="view-body">
            <h2 className="view-title" style={{ marginTop: '10px' }}>Crear cuenta</h2>
            <p className="view-subtitle">¿Cómo quieres usar ChasquiGo?</p>

            <div className="options-list" style={{ marginTop: '24px' }}>
              <div 
                className={`option-card ${role === 'client' ? 'active' : ''}`}
                onClick={() => setRole('client')}
              >
                <div className="option-icon-bg">
                  <User size={22} />
                </div>
                <div className="option-text">
                  <span className="option-title">Soy cliente</span>
                  <span className="option-desc">Pedir rides y delivery express</span>
                </div>
                <div className="option-checkbox" />
              </div>

              <div 
                className={`option-card ${role === 'driver' ? 'active' : ''}`}
                onClick={() => setRole('driver')}
              >
                <div className="option-icon-bg">
                  <ShieldCheck size={22} />
                </div>
                <div className="option-text">
                  <span className="option-title">Soy conductor / motorizado</span>
                  <span className="option-desc">Ganar dinero haciendo mandados</span>
                </div>
                <div className="option-checkbox" />
              </div>
            </div>

            <div className="info-banner" style={{ marginTop: '30px' }}>
              <Info size={16} style={{ color: 'var(--accent-lime)', flexShrink: 0 }} />
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {role === 'driver' 
                  ? 'Como motorizado legalmente verificado, deberás adjuntar foto de tu SOAT, Brevete y DNI para ser aprobado.' 
                  : 'Podrás pedir delivery express de cualquier paquete en Lima con seguimiento y seguridad certificada.'}
              </p>
            </div>
          </div>

          <div className="view-footer">
            <button className="btn btn-primary btn-lg btn-block" onClick={handleRoleSelectSubmit}>
              <span>Continuar</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* 3. FORMULARIO DE REGISTRO */}
      {step === 'register' && (
        <form onSubmit={handleRegisterSubmit} className="view-layout">
          <div className="view-header">
            <button type="button" className="back-btn" onClick={() => setStep('role_select')}>
              <ArrowLeft size={20} />
            </button>
            <span className="step-indicator">Paso 2 de 3</span>
          </div>

          <div className="view-body">
            <h2 className="view-title" style={{ marginTop: '10px' }}>Tus Datos</h2>
            <p className="view-subtitle">Registra tu información para emitir tus comprobantes y verificar tu seguridad.</p>

            {/* Social Logins */}
            <div className="social-login-container" style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  className="btn-social-login google-btn"
                  onClick={() => handleSocialLogin('google')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  <span>Google</span>
                </button>
                <button 
                  type="button" 
                  className="btn-social-login facebook-btn"
                  onClick={() => handleSocialLogin('facebook')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
                  </svg>
                  <span>Facebook</span>
                </button>
              </div>

              <div className="social-or-divider">
                <span>o ingresa tus datos manuales</span>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <div className="input-field-group">
                <label className="input-label">NOMBRE COMPLETO</label>
                <input 
                  type="text" 
                  className="input-control" 
                  placeholder="Juan Pérez García" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="input-field-group">
                <label className="input-label">CORREO ELECTRÓNICO</label>
                <input 
                  type="email" 
                  className="input-control" 
                  placeholder="juan@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="input-field-group">
                <label className="input-label">TELÉFONO CELULAR</label>
                <div style={{ position: 'relative' }}>
                  <span className="phone-prefix">+51</span>
                  <input 
                    type="tel" 
                    className="input-control phone-input" 
                    placeholder="999 000 000" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    maxLength={9}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="view-footer">
            <button type="submit" className="btn btn-primary btn-lg btn-block">
              <span>Continuar</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </form>
      )}

      {/* 4. VERIFICACIÓN SMS */}
      {step === 'sms' && (
        <div className="view-layout">
          <div className="view-header">
            <button className="back-btn" onClick={() => setStep('register')}>
              <ArrowLeft size={20} />
            </button>
            <span className="step-indicator">Paso 3 de 3</span>
          </div>

          <div className="view-body">
            <h2 className="view-title" style={{ marginTop: '10px' }}>Verifica tu número</h2>
            <p className="view-subtitle">Enviamos un código SMS de verificación al teléfono **+51 {phone}**</p>

            <div className="sms-code-row" style={{ marginTop: '30px' }}>
              {smsCode.map((digit, idx) => (
                <input
                  key={idx}
                  id={`sms-${idx}`}
                  type="text"
                  maxLength={1}
                  className="sms-digit-input"
                  value={digit}
                  onChange={(e) => handleSmsChange(e.target.value, idx)}
                  onKeyDown={(e) => handleSmsKeyDown(e, idx)}
                />
              ))}
            </div>

            <div className="sms-timer-wrapper" style={{ marginTop: '20px', textAlign: 'center' }}>
              {timer > 0 ? (
                <span className="sms-timer">Reenviar código en: <strong>0:{timer.toString().padStart(2, '0')}</strong></span>
              ) : (
                <button 
                  className="btn btn-text" 
                  onClick={() => setTimer(45)}
                  style={{ color: 'var(--accent-lime)', fontSize: '12.5px', fontWeight: '700' }}
                >
                  Reenviar código SMS
                </button>
              )}
            </div>
          </div>

          <div className="view-footer">
            <button 
              className="btn btn-primary btn-lg btn-block" 
              onClick={handleSmsVerify}
              disabled={smsCode.some(d => d === '')}
            >
              <CheckCircle2 size={18} />
              <span>Verificar y entrar</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. SELECCIÓN DE VEHÍCULO */}
      {step === 'vehicle_select' && (
        <div className="view-layout">
          <div className="view-header">
            <button className="back-btn" onClick={() => setStep('sms')}>
              <ArrowLeft size={20} />
            </button>
            <span className="step-indicator">Paso 4 de 4</span>
          </div>

          <div className="view-body">
            <h2 className="view-title" style={{ marginTop: '10px' }}>¿Qué vehículo conduces?</h2>
            <p className="view-subtitle">Selecciona tu medio de transporte principal en Lima para asignarte los mandados correspondientes.</p>

            <div className="options-list" style={{ marginTop: '24px' }}>
              <div 
                className={`option-card ${vehicle === 'delivery' ? 'active' : ''}`}
                onClick={() => setVehicle('delivery')}
              >
                <div className="option-icon-bg">
                  <Bike size={22} />
                </div>
                <div className="option-text">
                  <span className="option-title">Motorizado</span>
                  <span className="option-desc">Mensajería, delivery y envíos rápidos en motocicleta</span>
                </div>
                <div className="option-checkbox" />
              </div>

              <div 
                className={`option-card ${vehicle === 'taxi' ? 'active' : ''}`}
                onClick={() => setVehicle('taxi')}
              >
                <div className="option-icon-bg">
                  <Car size={22} />
                </div>
                <div className="option-text">
                  <span className="option-title">Auto (4 personas)</span>
                  <span className="option-desc">Viajes y envíos en vehículos estándar de hasta 4 pasajeros</span>
                </div>
                <div className="option-checkbox" />
              </div>

              <div 
                className={`option-card ${vehicle === 'taxi_premium' ? 'active' : ''}`}
                onClick={() => setVehicle('taxi_premium')}
              >
                <div className="option-icon-bg">
                  <Sparkles size={22} />
                </div>
                <div className="option-text">
                  <span className="option-title">Auto Grande (6 personas)</span>
                  <span className="option-desc">Viajes en camionetas, minivans o SUVs de hasta 6 pasajeros</span>
                </div>
                <div className="option-checkbox" />
              </div>

              <div 
                className={`option-card ${vehicle === 'flete' ? 'active' : ''}`}
                onClick={() => setVehicle('flete')}
              >
                <div className="option-icon-bg">
                  <Truck size={22} />
                </div>
                <div className="option-text">
                  <span className="option-title">Mudanza / Carga</span>
                  <span className="option-desc">Mudanzas, envíos pesados y transporte de carga</span>
                </div>
                <div className="option-checkbox" />
              </div>
            </div>
          </div>

          <div className="view-footer">
            <button className="btn btn-primary btn-lg btn-block" onClick={() => selectVehicleType(vehicle)}>
              <span>Continuar a Verificación</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
