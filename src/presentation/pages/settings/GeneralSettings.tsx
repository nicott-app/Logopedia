import { useState, useEffect } from 'react';
import { Building2, Clock, Save, CheckCircle2, Phone, Mail, MapPin, Copy, Check, Image as ImageIcon, Upload, Trash2, AlertCircle } from 'lucide-react';
import type { Clinic, ClinicSchedule, DaySchedule } from '../../../domain/models/types';
import { CLINIC_SECTORS } from '../../../domain/models/types';
import { clinicRepository, DEFAULT_CLINIC_SCHEDULE } from '../../../infrastructure/firebase/ClinicRepository';
import { useAuthStore } from '../../store/useAuthStore';
import { processLogoImage } from '../../utils/imageUtils';

type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

const DAYS_CONFIG: { key: DayKey; label: string }[] = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' }
];

export const GeneralSettings = () => {
  const { user } = useAuthStore();
  const clinicId = user?.clinicId || 'demo-clinic-id';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [clinic, setClinic] = useState<Clinic>({
    id: clinicId,
    name: 'LogoPedia — Centro de Logopedia y Neurodesarrollo',
    createdAt: Date.now(),
    phone: '+34 912 345 678',
    email: 'info@logopedia-clinica.com',
    address: 'Calle Mayor 45, Planta 1ª, Madrid',
    sector: 'logopedia',
    inviteCode: 'DEMO-2026',
    logoUrl: '',
    schedule: DEFAULT_CLINIC_SCHEDULE
  });

  useEffect(() => {
    const fetchClinic = async () => {
      setLoading(true);
      try {
        const data = await clinicRepository.getClinic(clinicId);
        if (data) {
          setClinic({
            ...data,
            sector: data.sector || 'logopedia',
            inviteCode: data.inviteCode || 'DEMO-2026',
            logoUrl: data.logoUrl || '',
            schedule: data.schedule || DEFAULT_CLINIC_SCHEDULE
          });
        }
      } catch (err) {
        console.error("Error loading clinic data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchClinic();
  }, [clinicId]);

  const handleInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setClinic(prev => ({ ...prev, [name]: value }));
  };

  const handleDayChange = (day: DayKey, field: keyof DaySchedule, value: any) => {
    setClinic(prev => {
      const currentSchedule = prev.schedule || DEFAULT_CLINIC_SCHEDULE;
      return {
        ...prev,
        schedule: {
          ...currentSchedule,
          [day]: {
            ...currentSchedule[day],
            [field]: value
          }
        }
      };
    });
  };

  const handleApplyToAllWeekdays = (openTime: string, closeTime: string) => {
    setClinic(prev => {
      const currentSchedule = prev.schedule || DEFAULT_CLINIC_SCHEDULE;
      const updated: ClinicSchedule = { ...currentSchedule };
      (['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as DayKey[]).forEach(d => {
        updated[d] = { isOpen: true, openTime, closeTime };
      });
      return { ...prev, schedule: updated };
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError('');
    setUploadingLogo(true);
    try {
      if (file.size > 3 * 1024 * 1024) {
        throw new Error('La imagen excede los 3MB. Por favor utiliza una imagen más ligera.');
      }
      const dataUrl = await processLogoImage(file);
      setClinic(prev => ({ ...prev, logoUrl: dataUrl }));
    } catch (err: any) {
      setLogoError(err.message || 'Error al procesar el archivo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setClinic(prev => ({ ...prev, logoUrl: '' }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(false);
    try {
      await clinicRepository.saveClinic(clinic);
      window.dispatchEvent(new CustomEvent('clinicUpdated', { detail: clinic }));
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
    } catch (err) {
      console.error("Error saving clinic schedule", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyInviteCode = () => {
    if (clinic.inviteCode) {
      navigator.clipboard.writeText(clinic.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-16">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const schedule = clinic.schedule || DEFAULT_CLINIC_SCHEDULE;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
      
      {/* Header */}
      <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Configuración General y Horarios de la Clínica
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Define la identidad de tu centro, logotipo, sector, código para incorporar empleados y los horarios de apertura y cierre.
          </p>
        </div>

        <button
          form="clinic-form"
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Guardar Cambios
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <form id="clinic-form" onSubmit={handleSave} className="max-w-4xl space-y-8">
          
          {/* Mensaje de confirmación */}
          {successMsg && (
            <div className="flex items-center gap-2 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-sm font-medium animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ¡Configuración, logotipo y horarios guardados correctamente!
            </div>
          )}

          {/* Código de Invitación para Empleados */}
          <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-emerald-50/40 dark:from-gray-900/60 dark:via-blue-950/20 dark:to-gray-900/60 border border-blue-200/60 dark:border-blue-800/50 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-sm">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                  Código de Invitación del Centro
                </span>
              </div>
              <h5 className="text-base font-bold text-slate-800 dark:text-white">
                Vincular nuevos empleados y profesionales
              </h5>
              <p className="text-xs text-gray-600 dark:text-gray-400 max-w-lg leading-relaxed">
                Comparte este código exclusivo con los trabajadores que se incorporen a tu clínica. Al crear su cuenta seleccionando <strong>"Unirme a un negocio ya iniciado"</strong>, se asociarán automáticamente a tu centro.
              </p>
            </div>
            
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="bg-white dark:bg-surface-dark border-2 border-primary/40 px-4 py-2.5 rounded-xl font-mono text-xl font-black tracking-widest text-primary shadow-inner select-all">
                {clinic.inviteCode || 'DEMO-2026'}
              </div>
              <button
                type="button"
                onClick={handleCopyInviteCode}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-primary/20 active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Identidad Visual y Logotipo de la Clínica */}
          <div className="bg-gray-50/50 dark:bg-gray-900/30 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-primary" />
                Identidad Visual y Logotipo
              </h4>
              <span className="text-xs text-gray-400">
                Se mostrará en la cabecera, menú lateral y documentos
              </span>
            </div>

            {logoError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{logoError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl">
              {/* Contenedor de visualización */}
              <div className="w-44 h-24 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/60 flex items-center justify-center p-2 relative overflow-hidden group">
                {clinic.logoUrl ? (
                  <img
                    src={clinic.logoUrl}
                    alt="Logotipo de la clínica"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center">
                    <Building2 className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-1" />
                    <span className="text-[11px] text-gray-400 font-medium">Sin logotipo</span>
                  </div>
                )}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Botones y especificaciones */}
              <div className="flex-1 space-y-2 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <label className="cursor-pointer px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{clinic.logoUrl ? 'Cambiar Logotipo' : 'Subir Logotipo'}</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp, image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>

                  {clinic.logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="px-3.5 py-2 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                  Formatos recomendados: <strong>PNG, SVG o WEBP con fondo transparente</strong>. Tamaño recomendado: hasta 400x180 px. Se optimiza y escala automáticamente.
                </p>
              </div>
            </div>
          </div>

          {/* Datos Identificativos */}
          <div className="bg-gray-50/50 dark:bg-gray-900/30 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4">
            <h4 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Información de la Clínica
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                  Nombre Comercial del Centro
                </label>
                <input
                  required
                  type="text"
                  name="name"
                  value={clinic.name}
                  onChange={handleInfoChange}
                  className="w-full px-4 py-2.5 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                  Sector / Disciplina Principal
                </label>
                <select
                  name="sector"
                  value={clinic.sector || 'logopedia'}
                  onChange={handleInfoChange}
                  className="w-full px-4 py-2.5 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                >
                  {CLINIC_SECTORS.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.icon} {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-primary" />
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  name="phone"
                  value={clinic.phone || ''}
                  onChange={handleInfoChange}
                  placeholder="+34 900 000 000"
                  className="w-full px-4 py-2.5 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-primary" />
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  name="email"
                  value={clinic.email || ''}
                  onChange={handleInfoChange}
                  placeholder="contacto@centro.com"
                  className="w-full px-4 py-2.5 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-primary" />
                  Dirección Física
                </label>
                <input
                  type="text"
                  name="address"
                  value={clinic.address || ''}
                  onChange={handleInfoChange}
                  placeholder="Calle, Número, Planta, Ciudad"
                  className="w-full px-4 py-2.5 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                  NIF / CIF del Responsable del Tratamiento
                </label>
                <input
                  type="text"
                  name="cif"
                  value={clinic.cif || ''}
                  onChange={handleInfoChange}
                  placeholder="B-12345678 o 12345678Z"
                  className="w-full px-4 py-2.5 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Se incluirá automáticamente en los consentimientos informados de pacientes bajo el RGPD.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                  Email de Protección de Datos (RGPD / DPO)
                </label>
                <input
                  type="email"
                  name="dpoEmail"
                  value={clinic.dpoEmail || ''}
                  onChange={handleInfoChange}
                  placeholder="privacidad@clinica.com"
                  className="w-full px-4 py-2.5 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Canal directo para el ejercicio de derechos ARCO (Acceso, Rectificación, Supresión).
                </p>
              </div>
            </div>
          </div>

          {/* Horario de Apertura y Cierre */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Horario de Apertura y Cierre Semanal
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Los tramos horarios activos delimitarán la cuadrícula de la agenda y las horas disponibles para citas.
                </p>
              </div>

              {/* Botón rápido */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyToAllWeekdays('09:00', '21:00')}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  Fijar 09:00 - 21:00 (L-V)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyToAllWeekdays('08:30', '20:30')}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 transition-colors"
                >
                  Fijar 08:30 - 20:30 (L-V)
                </button>
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {DAYS_CONFIG.map(({ key, label }) => {
                  const day = schedule[key] || { isOpen: false, openTime: '09:00', closeTime: '21:00' };
                  return (
                    <div 
                      key={key} 
                      className={`p-4 flex flex-wrap items-center justify-between gap-4 transition-colors ${
                        day.isOpen 
                          ? 'bg-white dark:bg-surface-dark' 
                          : 'bg-gray-50/50 dark:bg-gray-900/30 opacity-70'
                      }`}
                    >
                      {/* Nombre del día y switch abierto/cerrado */}
                      <div className="flex items-center gap-4 w-44">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={day.isOpen}
                            onChange={(e) => handleDayChange(key, 'isOpen', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                        </label>
                        <div>
                          <span className="font-semibold text-sm text-slate-800 dark:text-white">
                            {label}
                          </span>
                          <span className={`block text-[11px] font-medium ${day.isOpen ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                            {day.isOpen ? 'Abierto' : 'Cerrado'}
                          </span>
                        </div>
                      </div>

                      {/* Horas si está abierto */}
                      {day.isOpen ? (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Apertura:</span>
                            <input
                              type="time"
                              value={day.openTime}
                              onChange={(e) => handleDayChange(key, 'openTime', e.target.value)}
                              className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white"
                            />
                          </div>

                          <span className="text-gray-400 font-bold">—</span>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Cierre:</span>
                            <input
                              type="time"
                              value={day.closeTime}
                              onChange={(e) => handleDayChange(key, 'closeTime', e.target.value)}
                              className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs italic text-gray-400">
                          Instalaciones cerradas al público durante esta jornada
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </form>
      </div>

    </div>
  );
};
