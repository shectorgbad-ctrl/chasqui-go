import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
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
  Truck
} from 'lucide-react';

export const Welcome: React.FC = () => {
  const { step, setStep, registerUser, selectVehicleType } = useApp();
  const [slide, setSlide] = useState(0);

  // States para Registro
  const [role, setRole] = useState<'client' | 'driver'>('client');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState<'moto' | 'taxi' | 'camion'>('moto');
  
  // States para SMS
  const [smsCode, setSmsCode] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(45);

  // Slides de Onboarding
  const slides = [
    {
      title: 'Llega a donde quieres',
      subtitle: 'Mototaxi, taxi, delivery y más. Todo en una sola app diseñada para el Perú.',
      icon: <MapPin size={48} className="slide-icon-main" style={{ color: '#C8FF29' }} />,
      btnText: 'Siguiente'
    },
    {
      title: 'Envíos al instante',
      subtitle: 'Envía paquetes express a cualquier punto de Lima y provincias con seguimiento en tiempo real.',
      icon: <Box size={48} className="slide-icon-main" style={{ color: '#C8FF29' }} />,
      btnText: 'Siguiente'
    },
    {
      title: 'Gana más conduciendo',
      subtitle: 'Únete como conductor o repartidor. Recibe pedidos cerca de ti y retira tus ganancias al instante.',
      icon: <TrendingUp size={48} className="slide-icon-main" style={{ color: '#C8FF29' }} />,
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

            <div className="form-group" style={{ marginTop: '24px' }}>
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
                className={`option-card ${vehicle === 'moto' ? 'active' : ''}`}
                onClick={() => setVehicle('moto')}
              >
                <div className="option-icon-bg">
                  <Bike size={22} />
                </div>
                <div className="option-text">
                  <span className="option-title">Moto lineal / Motorizado</span>
                  <span className="option-desc">Mensajería express, delivery y mandados rápidos</span>
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
                  <span className="option-title">Taxi / Auto Particular</span>
                  <span className="option-desc">Transporte de personas y paquetes medianos/grandes</span>
                </div>
                <div className="option-checkbox" />
              </div>

              <div 
                className={`option-card ${vehicle === 'camion' ? 'active' : ''}`}
                onClick={() => setVehicle('camion')}
              >
                <div className="option-icon-bg">
                  <Truck size={22} />
                </div>
                <div className="option-text">
                  <span className="option-title">Flete / Camioneta / Camión</span>
                  <span className="option-desc">Mudanzas, carga pesada y distribución comercial</span>
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
