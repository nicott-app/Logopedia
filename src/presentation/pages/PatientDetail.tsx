import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, User as UserIcon, FileText, CheckCircle, ShieldCheck, History, CalendarDays, Phone, Clock, UserMinus, Scale } from 'lucide-react';
import type { Patient, User, LegalConsent, Clinic } from '../../domain/models/types';
import { PatientRepository } from '../../infrastructure/firebase/PatientRepository';
import { UserRepository } from '../../infrastructure/firebase/UserRepository';
import { ConsentRepository } from '../../infrastructure/firebase/ConsentRepository';
import { clinicRepository } from '../../infrastructure/firebase/ClinicRepository';
import { useAuthStore } from '../store/useAuthStore';
import { SignaturePad } from '../components/legal/SignaturePad';
import { PatientDischargeModal } from '../components/modals/PatientDischargeModal';
import { PrivacyPolicyModal } from '../components/modals/PrivacyPolicyModal';

const patientRepo = new PatientRepository();
const userRepo = new UserRepository();
const consentRepo = new ConsentRepository();

export const PatientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const { user: currentUser } = useAuthStore();
  const clinicId = currentUser?.clinicId || "";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'legal'>('info');
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [consents, setConsents] = useState<LegalConsent[]>([]);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const [patient, setPatient] = useState<Partial<Patient>>({
    clinicId,
    name: '',
    surname: '',
    contacts: [],
    tutors: [],
    status: 'waiting',
    assignedProfessionalId: null,
    notes: '',
    medicalHistory: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    consentSigned: false,
    isActive: true
  });

  useEffect(() => {
    const init = async () => {
      if (!clinicId) return;
      try {
        const [profs, clinicData] = await Promise.all([
          userRepo.getUsersByClinic(clinicId, true),
          clinicRepository.getClinic(clinicId)
        ]);
        setProfessionals(profs);
        setClinic(clinicData);

        if (!isNew && id) {
          const [data, patientConsents] = await Promise.all([
            patientRepo.getPatientById(clinicId, id),
            consentRepo.getPatientConsents(clinicId, id)
          ]);
          
          if (data) {
            setPatient(data);
            setConsents(patientConsents);
          } else if (!patient.id) {
            // Only kick out if we don't already have the patient in memory
            navigate('/dashboard/patients');
          }
        }
      } catch (error) {
        console.error("Error loading patient:", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, isNew, navigate, clinicId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'status' && value === 'archived' && !isNew) {
      setShowDischargeModal(true);
      return;
    }
    setPatient(prev => ({ ...prev, [name]: value }));
  };

  const handleContactChange = (type: 'phone' | 'email', value: string) => {
    setPatient(prev => {
      const existing = prev.contacts ? [...prev.contacts] : [];
      const idx = existing.findIndex(c => c.type === type);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], value };
      } else {
        existing.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `con-${Date.now()}`,
          type,
          value,
          belongsTo: prev.tutors && prev.tutors.length > 0 ? 'tutor' : 'patient'
        });
      }
      return { ...prev, contacts: existing };
    });
  };

  const handleTutorChange = (field: 'name' | 'relationship', value: string) => {
    setPatient(prev => {
      const tutors = prev.tutors ? [...prev.tutors] : [];
      if (tutors.length > 0) {
        tutors[0] = { ...tutors[0], [field]: value };
      } else {
        tutors.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `tut-${Date.now()}`,
          name: field === 'name' ? value : '',
          relationship: field === 'relationship' ? value : 'Madre',
          dni: ''
        });
      }
      return { ...prev, tutors };
    });
  };

  const handleDayToggle = (day: number) => {
    setPatient(prev => {
      const currentDays = prev.availability?.preferredDays ? [...prev.availability.preferredDays] : [];
      const exists = currentDays.includes(day);
      const newDays = exists ? currentDays.filter(d => d !== day) : [...currentDays, day].sort();
      return {
        ...prev,
        availability: {
          ...(prev.availability || {}),
          preferredDays: newDays
        }
      };
    });
  };

  const handleTimePreferenceChange = (timePreference: 'morning' | 'midday' | 'afternoon' | 'any') => {
    setPatient(prev => ({
      ...prev,
      availability: {
        ...(prev.availability || {}),
        timePreference
      }
    }));
  };

  const handleSpecificNotesChange = (specificNotes: string) => {
    setPatient(prev => ({
      ...prev,
      availability: {
        ...(prev.availability || {}),
        specificNotes
      }
    }));
  };

  const handleSave = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!patient.name?.trim()) {
      setActiveTab('info');
      setTimeout(() => {
        const form = document.getElementById('patient-form') as HTMLFormElement | null;
        form?.reportValidity();
      }, 50);
      return;
    }
    setSaving(true);
    try {
      const patientIdToSave = isNew ? crypto.randomUUID() : (patient.id as string);
      const patientToSave: Patient = {
        ...patient,
        id: patientIdToSave,
        clinicId,
        updatedAt: Date.now(),
      } as Patient;

      await patientRepo.savePatient(patientToSave);
      
      setPatient(patientToSave);
      setShowSuccessModal(true);
      
      if (isNew) {
        // Use replace to avoid adding the new route to history unnecessarily, 
        // and we already updated the local state so the effect will fetch silently.
        navigate(`/dashboard/patients/${patientIdToSave}`, { replace: true });
      }
    } catch (error) {
      console.error("Error saving patient:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSignConsent = async (signatureDataUrl: string) => {
    let currentPatientId = patient.id;
    
    // Auto-guardar si aún no tiene ID (es un paciente nuevo que no se guardó bien)
    if (!currentPatientId || currentPatientId === 'new') {
      currentPatientId = id !== 'new' ? id : crypto.randomUUID();
      const patientToSave = { ...patient, id: currentPatientId, clinicId, updatedAt: Date.now() } as Patient;
      
      await patientRepo.savePatient(patientToSave);
      setPatient(patientToSave);
      
      if (id === 'new') {
        window.history.replaceState(null, '', `/dashboard/patients/${currentPatientId}`);
      }
    }
    
    setSaving(true);
    try {
      const newConsent: LegalConsent = {
        id: crypto.randomUUID(),
        patientId: patient.id || id || '',
        clinicId,
        documentVersion: 'v1.0-RGPD-LOPDGDD',
        signedAt: Date.now(),
        signatureDataUrl,
        type: 'data_processing_and_health'
      };
      
      await consentRepo.saveConsent(newConsent);
      
      // Update patient status
      const updatedPatient = { ...patient, consentSigned: true };
      await patientRepo.savePatient(updatedPatient as Patient);
      
      setPatient(updatedPatient);
      setConsents([newConsent, ...consents]);
      setShowSignaturePad(false);
      
    } catch (error) {
      console.error("Error signing:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="flex flex-col h-full bg-transparent max-w-6xl mx-auto w-full pb-28 relative">
      {/* Cabecera Principal del Paciente (Flujo natural de la página) */}
      <div className="mb-6 space-y-4">
        {/* Fila 1: Navegación y Datos del Paciente */}
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => navigate('/dashboard/patients')}
            className="p-2 hover:bg-white dark:hover:bg-surface-dark rounded-xl transition-colors shadow-2xs bg-white/70 dark:bg-surface-dark/70 border border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 shrink-0"
            title="Volver al directorio de pacientes"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white truncate">
                {isNew ? 'Nuevo Paciente' : `${patient.name} ${patient.surname || ''}`}
              </h2>
              {!isNew && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  patient.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' :
                  patient.status === 'waiting' ? 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' :
                  'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}>
                  {patient.status === 'active' ? 'En Tratamiento' : patient.status === 'waiting' ? 'Lista de Espera' : 'Archivado'}
                </span>
              )}
            </div>
            {!isNew && (
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">
                ID de Ficha: <span className="font-mono text-xs">{patient.id?.split('-')[0]}</span>
              </p>
            )}
          </div>
        </div>

        {/* Fila 2: Pestañas de Navegación Segmentadas (Píldora moderna, sin recortes) */}
        <div className="flex items-center overflow-x-auto no-scrollbar">
          <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs font-medium shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all font-semibold ${
                activeTab === 'info'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Datos Generales</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all font-semibold ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Historial Clínico</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('legal')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all font-semibold ${
                activeTab === 'legal'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${patient.consentSigned ? 'text-emerald-500' : 'text-amber-500'}`} />
              <span>Cumplimiento Legal</span>
              {patient.consentSigned ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse ml-0.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-center text-slate-800 dark:text-white mb-2">¡Guardado con éxito!</h3>
            <p className="text-gray-500 text-center mb-6">La ficha del paciente se ha actualizado correctamente.</p>
            <button 
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-3 rounded-xl transition-colors"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 md:p-8">
        
        {activeTab === 'info' && (
          <form id="patient-form" className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Datos Personales */}
            <section>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
                <UserIcon className="w-5 h-5 text-primary" /> Datos del Paciente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Nombre *</label>
                  <input required type="text" name="name" value={patient.name} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Apellidos</label>
                  <input type="text" name="surname" value={patient.surname} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">DNI / Pasaporte</label>
                  <input type="text" name="dni" value={patient.dni || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none" placeholder="12345678Z" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Fecha de Nacimiento</label>
                  <input type="date" name="dateOfBirth" value={patient.dateOfBirth || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                </div>
              </div>
            </section>

            {/* Contacto y Tutores */}
            <section>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
                <Phone className="w-5 h-5 text-primary" /> Datos de Contacto y Familia
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Teléfono Móvil (WhatsApp)
                  </label>
                  <input
                    type="tel"
                    value={patient.contacts?.find(c => c.type === 'phone')?.value || ''}
                    onChange={(e) => handleContactChange('phone', e.target.value)}
                    placeholder="+34 600 000 000"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={patient.contacts?.find(c => c.type === 'email')?.value || ''}
                    onChange={(e) => handleContactChange('email', e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Nombre del Tutor / Familiar de Contacto
                  </label>
                  <input
                    type="text"
                    value={patient.tutors?.[0]?.name || ''}
                    onChange={(e) => handleTutorChange('name', e.target.value)}
                    placeholder="Nombre y apellidos del padre/madre/tutor"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Relación / Parentesco
                  </label>
                  <select
                    value={patient.tutors?.[0]?.relationship || 'Madre'}
                    onChange={(e) => handleTutorChange('relationship', e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm"
                  >
                    <option value="Madre">Madre</option>
                    <option value="Padre">Padre</option>
                    <option value="Tutor Legal">Tutor Legal</option>
                    <option value="Propio Paciente">Propio Paciente (Adulto)</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Disponibilidad y Preferencias Horarias */}
            <section>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
                <Clock className="w-5 h-5 text-primary" /> Disponibilidad y Preferencias Horarias (Asistente de Huecos)
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Días de la semana disponibles
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { day: 1, label: 'Lunes' },
                      { day: 2, label: 'Martes' },
                      { day: 3, label: 'Miércoles' },
                      { day: 4, label: 'Jueves' },
                      { day: 5, label: 'Viernes' },
                    ].map(({ day, label }) => {
                      const isSelected = patient.availability?.preferredDays?.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleDayToggle(day)}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                            isSelected
                              ? 'bg-primary text-white border-primary shadow-sm'
                              : 'bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Selecciona los días en los que el paciente puede acudir a la clínica.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Franja horaria preferente
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { key: 'morning', label: 'Mañanas', sub: '09:00 - 12:00' },
                      { key: 'midday', label: 'Mediodía', sub: '12:00 - 15:00' },
                      { key: 'afternoon', label: 'Tardes', sub: '15:00 - 20:00' },
                      { key: 'any', label: 'Cualquier franja', sub: 'Alta flexibilidad' },
                    ].map(({ key, label, sub }) => {
                      const isSelected = (patient.availability?.timePreference || 'any') === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleTimePreferenceChange(key as any)}
                          className={`p-3 rounded-xl text-left border transition-all ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-primary text-primary dark:text-white shadow-xs'
                              : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                          }`}
                        >
                          <div className="font-semibold text-xs">{label}</div>
                          <div className="text-[11px] opacity-75">{sub}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Detalle de disponibilidad específica
                  </label>
                  <input
                    type="text"
                    value={patient.availability?.specificNotes || ''}
                    onChange={(e) => handleSpecificNotesChange(e.target.value)}
                    placeholder="Ej: Jueves a las 13:00 al salir del colegio, o tardes a partir de las 17:00..."
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Esta regla se utiliza automáticamente en el calendario para recomendar al paciente ante cancelaciones y huecos libres.
                  </p>
                </div>
              </div>
            </section>

            {/* Estado y Asignación */}
            <section>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
                <CheckCircle className="w-5 h-5 text-primary" /> Organización
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Estado Actual</label>
                  <select name="status" value={patient.status} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none">
                    <option value="waiting">En lista de espera</option>
                    <option value="active">Activo (En tratamiento)</option>
                    <option value="archived">Archivado / Alta médica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Profesional Principal Asignado</label>
                  <select name="assignedProfessionalId" value={patient.assignedProfessionalId || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none">
                    <option value="">Sin asignar</option>
                    {professionals.map(prof => (
                      <option key={prof.id} value={prof.id}>{prof.name} {prof.surname}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* Observaciones y Comentarios Internos */}
            <section>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
                <FileText className="w-5 h-5 text-primary" /> Observaciones y Comentarios Internos
              </h3>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                  Notas de gestión, disponibilidad y avisos para recepción / terapeutas
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  value={patient.notes || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none resize-none text-sm leading-relaxed"
                  placeholder="Recordatorios organizativos, avisos de disponibilidad o casuística particular (ej: ⭐ ALTA DISPONIBILIDAD: Vive a 5 minutos de la clínica. La madre puede venir con 20 minutos de aviso)..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Comentarios y avisos de carácter interno y logístico. No forman parte del historial clínico de tratamiento.
                </p>
              </div>
            </section>
          </form>
        )}

        {activeTab === 'history' && (
          <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {isNew ? (
              <div className="text-center py-12">
                <History className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-800 dark:text-white">Ficha en creación</h3>
                <p className="text-gray-500 mt-2">Guarda primero los Datos Generales del paciente para habilitar el historial clínico.</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" /> Historial Clínico, Diagnóstico y Tratamiento
                  </label>
                  <textarea
                    name="medicalHistory"
                    rows={8}
                    value={patient.medicalHistory || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none resize-none text-sm leading-relaxed"
                    placeholder="Añade observaciones médicas relevantes, diagnósticos previos, antecedentes familiares, objetivos del tratamiento logopédico y evolución..."
                  />
                  <p className="text-xs text-gray-500 mt-1.5">
                    Información médica confidencial sujeta a secreto profesional y protección reforzada RGPD.
                  </p>
                </div>

                {patient.notes && (
                  <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 rounded-xl">
                    <h5 className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      📌 Nota u observación interna registrada (Datos Generales):
                    </h5>
                    <p className="text-xs text-amber-900 dark:text-amber-200 italic">
                      "{patient.notes}"
                    </p>
                  </div>
                )}
                
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-6 text-center">
                  <CalendarDays className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                  <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">Registro de Sesiones</h4>
                  <p className="text-sm text-blue-700/80 dark:text-blue-400/80">
                    Las notas clínicas de cada sesión específica se registrarán directamente desde el Calendario una vez finalizada la cita.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'legal' && (
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {isNew ? (
              <div className="text-center py-12">
                <ShieldCheck className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-800 dark:text-white">Firma no disponible aún</h3>
                <p className="text-gray-500 mt-2">Registra primero al paciente pulsando en "Registrar Paciente" para poder generar y firmar su documento de protección de datos.</p>
              </div>
            ) : (
            <>
              <div className="text-center">
                <ShieldCheck className={`w-16 h-16 mx-auto mb-4 ${patient.consentSigned ? 'text-green-500' : 'text-amber-500'}`} />
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                  {patient.consentSigned ? 'Consentimiento Firmado' : 'Pendiente de Firma Legal'}
                </h3>
                <p className="text-gray-500 text-sm max-w-xl mx-auto">
                  Reglamento General de Protección de Datos (RGPD UE 2016/679), LOPDGDD 3/2018 y Ley 41/2002 Básica Reguladora de la Autonomía del Paciente.
                </p>
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline mt-2.5 transition-colors"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Ver información completa: Responsable del tratamiento, bases jurídicas y derechos ARCO</span>
                </button>
              </div>

            {!patient.consentSigned && !showSignaturePad && (
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 rounded-xl p-6 text-center">
                <p className="text-amber-800 dark:text-amber-400 font-medium mb-4">Es obligatorio recabar el consentimiento explícito para el tratamiento de datos de salud.</p>
                <button onClick={() => setShowSignaturePad(true)} className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-amber-500/20">
                  Iniciar Proceso de Firma
                </button>
              </div>
            )}

            {showSignaturePad && (
              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 md:p-8">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Documento de Consentimiento Informado (Datos de Salud)
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowPrivacyModal(true)}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>Bases Jurídicas</span>
                  </button>
                </div>

                {/* Contrato de Consentimiento Dinámico */}
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/90 text-xs text-gray-600 dark:text-gray-300 space-y-3 max-h-56 overflow-y-auto mb-6 shadow-inner">
                  <div className="border-b border-gray-100 dark:border-gray-700 pb-2">
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      Autorización Expresa para Tratamiento de Datos de Salud
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Tratamiento de categoría especial conforme al Art. 9.2.a) y 9.2.h) del RGPD
                    </p>
                  </div>

                  <p>
                    <strong className="text-slate-800 dark:text-white">1. Responsable del Tratamiento:</strong> {clinic?.name || 'Centro Sanitario Titular'}
                    {clinic?.cif ? ` · CIF/NIF: ${clinic.cif}` : ''}
                    {clinic?.address ? ` · Domicilio: ${clinic.address}` : ''}
                    {clinic?.dpoEmail || clinic?.email ? ` · Contacto: ${clinic?.dpoEmail || clinic?.email}` : ''}.
                  </p>

                  <p>
                    <strong className="text-slate-800 dark:text-white">2. Paciente / Interesado:</strong> {patient.name} {patient.surname || ''}
                    {patient.dni ? ` (DNI: ${patient.dni})` : ''}
                    {patient.tutors?.[0]?.name ? ` a través de su representante/tutor legal ${patient.tutors[0].name} (${patient.tutors[0].relationship || 'Tutor'})` : ''}.
                  </p>

                  <p>
                    <strong className="text-slate-800 dark:text-white">3. Finalidad y Base Jurídica:</strong> Prestar asistencia sanitaria, diagnóstico y seguimiento terapéutico, confección y custodia de la Historia Clínica (Ley 41/2002), y gestión organizativa de citas y facturación. Legitimado por la ejecución de la relación asistencial (Art. 6.1.b RGPD), fines de asistencia sanitaria (Art. 9.2.h RGPD) y el presente consentimiento explícito.
                  </p>

                  <p>
                    <strong className="text-slate-800 dark:text-white">4. Conservación:</strong> La documentación médica se conservará durante un mínimo de 5 años desde el alta médica (Art. 17 Ley 41/2002).
                  </p>

                  <p>
                    <strong className="text-slate-800 dark:text-white">5. Derechos:</strong> Puede ejercer los derechos de Acceso, Rectificación, Supresión, Limitación, Portabilidad y Oposición ante el responsable o ante la Agencia Española de Protección de Datos (www.aepd.es).
                  </p>
                </div>
                
                <SignaturePad 
                  onSave={handleSignConsent} 
                  onCancel={() => setShowSignaturePad(false)} 
                />
              </div>
            )}

            {patient.consentSigned && consents.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-2xl p-6">
                <h4 className="font-bold text-green-800 dark:text-green-400 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" /> Documentos Legales Registrados
                </h4>
                
                <div className="space-y-4">
                  {consents.map(consent => (
                    <div key={consent.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-800 dark:text-gray-200">Consentimiento RGPD/LOPDGDD</p>
                        <p className="text-sm text-gray-500 flex gap-4 mt-1">
                          <span>Fecha: {new Date(consent.signedAt).toLocaleDateString()}</span>
                          <span>Versión: {consent.documentVersion}</span>
                        </p>
                      </div>
                      {consent.signatureDataUrl && (
                        <div className="border border-gray-200 dark:border-gray-700 rounded bg-white p-1">
                          <img src={consent.signatureDataUrl} alt="Firma del paciente" className="h-12 w-auto object-contain" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            </>
            )}
          </div>
        )}
      </div>

      {/* Dock Flotante Fijo: Solo los botones de acción */}
      <div className="fixed bottom-6 right-6 sm:right-8 z-30 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-900/10 dark:shadow-black/40 rounded-2xl p-2 sm:px-3 sm:py-2 flex items-center gap-2 sm:gap-2.5">
          {!isNew && (
            <div className="hidden sm:flex items-center gap-2 pr-2.5 border-r border-slate-200 dark:border-slate-800 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">
                {patient.name} {patient.surname || ''}
              </span>
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  patient.status === 'active'
                    ? 'bg-emerald-500'
                    : patient.status === 'waiting'
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
                title={
                  patient.status === 'active'
                    ? 'En Tratamiento'
                    : patient.status === 'waiting'
                    ? 'Lista de Espera'
                    : 'Archivado'
                }
              />
            </div>
          )}

          {!isNew && patient.status !== 'archived' && (
            <button
              type="button"
              onClick={() => setShowDischargeModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 transition-colors shadow-2xs cursor-pointer"
              title="Tramitar baja y cubrir citas con lista de espera"
            >
              <UserMinus className="w-3.5 h-3.5 shrink-0" />
              <span>Dar de Baja</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/dashboard/patients')}
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>Guardar Ficha</span>
          </button>
        </div>
      </div>

      {/* Modal Radar de Reemplazo en Bajas */}
      {showDischargeModal && patient.id && (
        <PatientDischargeModal
          clinicId={clinicId}
          patientId={patient.id}
          onClose={() => setShowDischargeModal(false)}
          onDischarged={() => {
            setShowDischargeModal(false);
            setPatient(prev => ({ ...prev, status: 'archived' }));
          }}
        />
      )}

      {/* Modal Informativo RGPD y Bases Jurídicas */}
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        clinic={clinic}
      />

    </div>
  );
};

