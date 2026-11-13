import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, User as UserIcon, Brain, Check, Briefcase, AlertTriangle, Coffee } from 'lucide-react';
import { format, addMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Patient, User, Room, Appointment, ClinicalService } from '../../domain/models/types';
import { PatientRepository } from '../../infrastructure/firebase/PatientRepository';
import { UserRepository } from '../../infrastructure/firebase/UserRepository';
import { RoomRepository } from '../../infrastructure/firebase/RoomRepository';
import { AppointmentRepository } from '../../infrastructure/firebase/AppointmentRepository';
import { serviceRepository } from '../../infrastructure/firebase/ServiceRepository';
import { OptimizationService, type OptimizationOptions } from '../../application/services/OptimizationService';
import { useAuthStore } from '../store/useAuthStore';

interface AppointmentFormProps {
  onClose: () => void;
  onSaved: () => void;
}

const patientRepo = new PatientRepository();
const userRepo = new UserRepository();
const roomRepo = new RoomRepository();
const appointmentRepo = new AppointmentRepository();
const optimizationService = new OptimizationService();

export const AppointmentForm: React.FC<AppointmentFormProps> = ({ onClose, onSaved }) => {
  const { user } = useAuthStore();
  const clinicId = user?.clinicId || ""; 

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [services, setServices] = useState<ClinicalService[]>([]);
  
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const [formData, setFormData] = useState<Partial<Appointment>>({
    clinicId,
    patientId: '',
    professionalId: '',
    roomId: '',
    serviceId: '',
    start: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    end: format(addMinutes(new Date(), 45), "yyyy-MM-dd'T'HH:mm"),
    status: 'scheduled',
    notes: ''
  });

  useEffect(() => {
    const init = async () => {
      try {
        const [pats, profs, rms, servs] = await Promise.all([
          patientRepo.getPatientsByClinic(clinicId),
          userRepo.getUsersByClinic(clinicId),
          roomRepo.getRoomsByClinic(clinicId),
          serviceRepository.getServicesByClinic(clinicId)
        ]);
        setPatients(pats);
        setProfessionals(profs);
        setRooms(rms);
        setServices(servs);

        if (servs.length > 0) {
          const defaultService = servs[0];
          setFormData(prev => ({
            ...prev,
            serviceId: defaultService.id,
            end: format(addMinutes(new Date(prev.start || new Date()), defaultService.durationMinutes), "yyyy-MM-dd'T'HH:mm")
          }));
        }
      } catch (error) {
        console.error("Error loading form data", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const selectedService = services.find(s => s.id === formData.serviceId);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'serviceId') {
      const serv = services.find(s => s.id === value);
      const duration = serv?.durationMinutes || 45;
      const currentStart = formData.start ? new Date(formData.start) : new Date();
      setFormData(prev => ({
        ...prev,
        serviceId: value,
        end: format(addMinutes(currentStart, duration), "yyyy-MM-dd'T'HH:mm")
      }));
      return;
    }

    if (name === 'start') {
      const serv = services.find(s => s.id === formData.serviceId);
      const duration = serv?.durationMinutes || 45;
      try {
        const newStart = new Date(value);
        setFormData(prev => ({
          ...prev,
          start: value,
          end: format(addMinutes(newStart, duration), "yyyy-MM-dd'T'HH:mm")
        }));
      } catch {
        setFormData(prev => ({ ...prev, start: value }));
      }
      return;
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleOptimize = async () => {
    if (!formData.patientId || !formData.professionalId) {
      alert("Selecciona un paciente y un profesional primero para buscar huecos.");
      return;
    }
    
    setOptimizing(true);
    try {
      const duration = selectedService?.durationMinutes || 45;
      const options: OptimizationOptions = {
        clinicId,
        professionalId: formData.professionalId,
        patientId: formData.patientId,
        durationMinutes: duration,
        strategy: 'tetris' // Default smart strategy
      };
      
      const results = await optimizationService.findOptimalSlots(options);
      setSuggestions(results);
    } catch (error) {
      console.error("Optimization failed", error);
    } finally {
      setOptimizing(false);
    }
  };

  const selectSuggestion = (slot: any) => {
    setFormData(prev => ({
      ...prev,
      start: format(new Date(slot.start), "yyyy-MM-dd'T'HH:mm"),
      end: format(new Date(slot.end), "yyyy-MM-dd'T'HH:mm"),
      roomId: slot.roomId
    }));
    setSuggestions([]);
  };

  const selectedProf = professionals.find(p => p.id === formData.professionalId);
  const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

  let scheduleWarning: string | null = null;
  let isBreakConflict = false;

  if (selectedProf?.schedule && formData.start && formData.end) {
    try {
      const sDate = new Date(formData.start);
      const eDate = new Date(formData.end);
      const dayKey = DAY_KEYS[sDate.getDay()];
      const profDay = selectedProf.schedule[dayKey];

      if (profDay) {
        if (!profDay.isWorking) {
          scheduleWarning = `${selectedProf.name} no pasa consulta los ${format(sDate, 'EEEE', { locale: es })}s.`;
        } else {
          const sTime = format(sDate, 'HH:mm');
          const eTime = format(eDate, 'HH:mm');
          if (sTime < profDay.start || eTime > profDay.end) {
            scheduleWarning = `Horario fuera del turno de ${selectedProf.name} (${profDay.start} - ${profDay.end}).`;
          } else if (profDay.breaks && profDay.breaks.length > 0) {
            const overlap = profDay.breaks.find(b => sTime < b.end && eTime > b.start);
            if (overlap) {
              isBreakConflict = true;
              scheduleWarning = `¡Atención! La cita coincide con el descanso de ${selectedProf.name} (${overlap.name}: ${overlap.start} - ${overlap.end}).`;
            }
          }
        }
      }
    } catch {
      // Ignorar errores de fecha
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const newAppt: Appointment = {
        ...(formData as Appointment),
        id: crypto.randomUUID(),
        start: new Date(formData.start!).toISOString(),
        end: new Date(formData.end!).toISOString(),
      };
      await appointmentRepo.saveAppointment(newAppt);
      onSaved();
    } catch (error) {
      console.error("Error saving appointment", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Agendar Nueva Cita</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form id="appt-form" onSubmit={handleSave} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Paciente */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-primary" /> Paciente *
                </label>
                <select required name="patientId" value={formData.patientId} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none">
                  <option value="">Selecciona paciente...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Profesional */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-primary" /> Profesional *
                </label>
                <select required name="professionalId" value={formData.professionalId} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none">
                  <option value="">Selecciona profesional...</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            {/* Servicio Clínico y Duración */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" /> Tipo de Servicio / Tratamiento
                </span>
                {selectedService && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                    Duración asignada: {selectedService.durationMinutes} min
                  </span>
                )}
              </label>
              <select 
                name="serviceId" 
                value={formData.serviceId || ''} 
                onChange={handleChange} 
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="">Seleccionar servicio...</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} — ({s.durationMinutes} min{s.price ? ` • ${s.price}€` : ''})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Al seleccionar el servicio, el fin de la cita se ajusta automáticamente a su duración y se reflejará en la escala horaria.
              </p>
            </div>

            {/* Panel de Optimización Inteligente */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                    <Brain className="w-5 h-5" /> Smart Scheduler
                  </h4>
                  <p className="text-sm text-indigo-700/70 dark:text-indigo-400/70 mt-0.5">Encuentra el hueco perfecto automáticamente</p>
                </div>
                <button 
                  type="button" 
                  onClick={handleOptimize}
                  disabled={optimizing}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {optimizing ? 'Buscando...' : 'Auto-Completar Hueco'}
                </button>
              </div>

              {suggestions.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  {suggestions.map((slot, idx) => (
                    <div key={idx} onClick={() => selectSuggestion(slot)} className="flex flex-col p-3 bg-white dark:bg-surface-dark border border-indigo-200 dark:border-indigo-800 rounded-lg cursor-pointer hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 transition-all">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">Opción {idx + 1} • {Math.round(slot.score)} pts</span>
                      <span className="text-sm text-slate-800 dark:text-gray-200">{format(new Date(slot.start), "EEEE dd MMM", { locale: es })}</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-white">{format(new Date(slot.start), "HH:mm")} - {format(new Date(slot.end), "HH:mm")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fecha, Hora y Sala Manual */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" /> Inicio
                </label>
                <input required type="datetime-local" name="start" value={formData.start} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" /> Fin
                </label>
                <input required type="datetime-local" name="end" value={formData.end} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" /> Sala
                </label>
                <select required name="roomId" value={formData.roomId || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none">
                  <option value="">Sala...</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>

            {/* Aviso de Conflicto de Turno o Descanso */}
            {scheduleWarning && (
              <div className={`p-3.5 rounded-xl border flex items-center gap-3 text-sm ${
                isBreakConflict 
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200' 
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}>
                {isBreakConflict ? (
                  <Coffee className="w-5 h-5 text-amber-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <div>
                  <span className="font-semibold block">Aviso de Horario</span>
                  <span>{scheduleWarning}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Notas Adicionales</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none resize-none" placeholder="Motivo de la sesión..." />
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/30">
          <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
            Cancelar
          </button>
          <button form="appt-form" type="submit" disabled={saving} className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-primary/20 disabled:opacity-50">
            {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-5 h-5" />}
            Confirmar Cita
          </button>
        </div>
      </div>
    </div>
  );
};
