import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  ArrowLeft, 
  FileText, 
  AlertCircle, 
  UploadCloud, 
  X, 
  ShieldCheck
} from 'lucide-react';

export const DocumentVerification: React.FC = () => {
  const { driverState, updateDocumentStatus, uploadDocumentEvidence, logout } = useApp();
  const [activeModal, setActiveModal] = useState<any | null>(null);
  
  // Form input
  const [docNumber, setDocNumber] = useState('');

  // File Upload State (Front & Back)
  const [uploadedFileFront, setUploadedFileFront] = useState<File | null>(null);
  const [uploadedFileUrlFront, setUploadedFileUrlFront] = useState<string>('');
  const [isUploadingFileFront, setIsUploadingFileFront] = useState<boolean>(false);

  const [uploadedFileBack, setUploadedFileBack] = useState<File | null>(null);
  const [uploadedFileUrlBack, setUploadedFileUrlBack] = useState<string>('');
  const [isUploadingFileBack, setIsUploadingFileBack] = useState<boolean>(false);

  const needsTwoSides = activeModal === 'license' || activeModal === 'property';

  const handleFileChangeFront = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileFront(file);
    setIsUploadingFileFront(true);
    try {
      const url = await uploadDocumentEvidence(`${activeModal}_front`, file);
      setUploadedFileUrlFront(url);
    } catch (err: any) {
      alert('Error al subir foto frontal: ' + err.message);
    } finally {
      setIsUploadingFileFront(false);
    }
  };

  const handleFileChangeBack = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileBack(file);
    setIsUploadingFileBack(true);
    try {
      const url = await uploadDocumentEvidence(`${activeModal}_back`, file);
      setUploadedFileUrlBack(url);
    } catch (err: any) {
      alert('Error al subir foto posterior: ' + err.message);
    } finally {
      setIsUploadingFileBack(false);
    }
  };

  const documentConfig = {
    license: {
      title: 'Licencia de conducir',
      desc: 'Clase B-IIC obligatorio para conducir motocicletas en Lima.',
      label: 'NÚMERO DE LICENCIA (DNI)',
      placeholder: 'Ingresa tu DNI',
      maxLength: 8
    },
    soat: {
      title: 'SOAT vigente',
      desc: 'Seguro Obligatorio de Accidentes de Tránsito (Validado con APESEG).',
      label: 'PLACA DE LA MOTO',
      placeholder: 'Ej: 1234-5A o 12345A',
      maxLength: 7
    },
    revision: {
      title: 'Revisión técnica',
      desc: 'Certificado de Inspección Técnica Vehicular de la municipalidad.',
      label: 'CÓDIGO DE CERTIFICADO',
      placeholder: 'Ej: ITV-998877',
      maxLength: 10
    },
    property: {
      title: 'Tarjeta de propiedad',
      desc: 'Tarjeta de Identificación Vehicular (Validada con SUNARP).',
      label: 'PLACA DE LA MOTO',
      placeholder: 'Ej: 1234-5A',
      maxLength: 7
    }
  };

  const getStatusBadge = (status: any) => {
    switch (status) {
      case 'verified':
        return <span className="badge badge-green">✓ VERIFICADO</span>;
      case 'uploaded':
        return <span className="badge badge-orange">⏳ EN REVISIÓN</span>;
      case 'expired':
        return <span className="badge badge-red">EXPIRADO</span>;
      default:
        return <span className="badge badge-secondary">FALTA SUBIR</span>;
    }
  };

  const handleOpenDocModal = (docType: any) => {
    setActiveModal(docType);
    setDocNumber('');
    setUploadedFileFront(null);
    setUploadedFileUrlFront('');
    setUploadedFileBack(null);
    setUploadedFileUrlBack('');
  };

  const handleSaveDocument = () => {
    if (activeModal) {
      const combinedUrl = needsTwoSides 
        ? `${uploadedFileUrlFront},${uploadedFileUrlBack}` 
        : uploadedFileUrlFront;
      
      updateDocumentStatus(activeModal, 'uploaded', docNumber, combinedUrl);
      setActiveModal(null);
    }
  };

  return (
    <div className="mobile-container dark-theme">
      <div className="peru-bg-watermark quipu-huaco-bg"></div>
      <div className="view-layout">
        <div className="view-header">
          <button className="back-btn" onClick={logout}>
            <ArrowLeft size={20} />
            <span style={{ fontSize: '12.5px', marginLeft: '6px', fontWeight: '600' }}>Salir</span>
          </button>
          <span className="step-indicator" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-lime)' }}>
            <ShieldCheck size={14} />
            Filtro de Seguridad
          </span>
        </div>

        <div className="view-body">
          <div style={{ textAlign: 'center', margin: '10px 0 20px 0' }}>
            <div style={{ width: '54px', height: '54px', borderRadius: '50%', backgroundColor: 'rgba(212, 175, 55, 0.1)', color: 'var(--accent-lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
              <ShieldCheck size={30} />
            </div>
            <h2 className="view-title">Verificación Legal</h2>
            <p className="view-subtitle" style={{ maxWidth: '280px', margin: '4px auto 0 auto' }}>
              Para garantizar la seguridad y legalidad del servicio en Lima, necesitamos verificar tus credenciales.
            </p>
          </div>

          <div className="doc-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(documentConfig).map(([key, config]) => {
              const status = driverState.documents[key as keyof typeof driverState.documents];
              const isVerified = status === 'verified';
              
              return (
                <div 
                  key={key} 
                  className={`doc-row-card ${isVerified ? 'verified' : ''}`}
                  onClick={() => handleOpenDocModal(key)}
                >
                  <div className="doc-icon-container">
                    <FileText size={20} style={{ color: isVerified ? 'var(--accent-lime)' : 'var(--text-secondary)' }} />
                  </div>
                  <div className="doc-info-col">
                    <span className="doc-row-title">{config.title}</span>
                    <span className="doc-row-desc">{config.desc}</span>
                  </div>
                  <div className="doc-status-col">
                    {getStatusBadge(status)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="info-banner" style={{ marginTop: '24px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <AlertCircle size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Tu información será validada en tiempo real con las bases del MTC, SUNARP y APESEG. Al completarlo, tu cuenta de motorizado quedará activada automáticamente.
            </p>
          </div>
        </div>

        {/* MODAL DE SUBIDA / CONSULTA */}
        {activeModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ width: '92%', maxWidth: '360px', padding: '20px' }}>
              <div className="modal-header" style={{ border: 'none', padding: 0, marginBottom: '16px' }}>
                <span className="modal-title" style={{ fontSize: '16px', fontWeight: '800' }}>
                  {documentConfig[activeModal as keyof typeof documentConfig].title}
                </span>
                <button className="modal-close-btn" onClick={() => setActiveModal(null)}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {documentConfig[activeModal as keyof typeof documentConfig].desc}
                </p>

                <div className="input-field-group">
                  <label className="input-label">
                    {documentConfig[activeModal as keyof typeof documentConfig].label}
                  </label>
                  <input 
                    type="text" 
                    className="input-control" 
                    placeholder={documentConfig[activeModal as keyof typeof documentConfig].placeholder}
                    maxLength={documentConfig[activeModal as keyof typeof documentConfig].maxLength}
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value.toUpperCase())}
                  />
                </div>

                {!needsTwoSides ? (
                  <label className="upload-box-simulator" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)' }}>
                    <input 
                      type="file" 
                      accept="image/*,application/pdf" 
                      style={{ display: 'none' }}
                      onChange={handleFileChangeFront}
                      disabled={isUploadingFileFront}
                    />
                    <UploadCloud size={28} style={{ color: isUploadingFileFront ? 'var(--accent-lime)' : 'var(--text-secondary)' }} />
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '4px', textAlign: 'center' }}>
                      {isUploadingFileFront ? 'Subiendo a Supabase...' : uploadedFileFront ? `Archivo: ${uploadedFileFront.name} (Listo)` : 'Cargar foto de evidencia'}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px' }}>DNI, SOAT o certificado</span>
                  </label>
                ) : (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <label className="upload-box-simulator" style={{ flex: 1, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)' }}>
                      <input 
                        type="file" 
                        accept="image/*,application/pdf" 
                        style={{ display: 'none' }}
                        onChange={handleFileChangeFront}
                        disabled={isUploadingFileFront}
                      />
                      <UploadCloud size={20} style={{ color: isUploadingFileFront ? 'var(--accent-lime)' : 'var(--text-secondary)' }} />
                      <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '4px', textAlign: 'center' }}>
                        {isUploadingFileFront ? 'Subiendo...' : uploadedFileFront ? 'Frente (Listo)' : 'Foto Frente'}
                      </span>
                    </label>

                    <label className="upload-box-simulator" style={{ flex: 1, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)' }}>
                      <input 
                        type="file" 
                        accept="image/*,application/pdf" 
                        style={{ display: 'none' }}
                        onChange={handleFileChangeBack}
                        disabled={isUploadingFileBack}
                      />
                      <UploadCloud size={20} style={{ color: isUploadingFileBack ? 'var(--accent-lime)' : 'var(--text-secondary)' }} />
                      <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '4px', textAlign: 'center' }}>
                        {isUploadingFileBack ? 'Subiendo...' : uploadedFileBack ? 'Reverso (Listo)' : 'Foto Reverso'}
                      </span>
                    </label>
                  </div>
                )}

                <button 
                  className="btn btn-primary btn-md btn-block"
                  onClick={handleSaveDocument}
                  disabled={!docNumber.trim() || (needsTwoSides ? (!uploadedFileUrlFront || !uploadedFileUrlBack) : !uploadedFileUrlFront)}
                  style={{ height: '42px', marginTop: '14px' }}
                >
                  <span>Enviar a revisión</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
