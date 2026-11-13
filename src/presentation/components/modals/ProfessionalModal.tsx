import React, { useState, useEffect } from 'react';
import { X, Save, UserCog, Mail, Clock, Coffee, Plus, Trash2, Calendar } from 'lucide-react';
import type { User, Specialty, Room, ProfessionalSchedule, ProfessionalDaySchedule, WorkBreak } from '../../../domain/models/types';
import { UserRepository } from '../../../infrastructure/firebase/UserRepository';
import { SpecialtyRepository } from '../../../infrastructure/firebase/SpecialtyRepository';
import { RoomRepository } from '../../../infrastructure/firebase/RoomRepository';
import { ColorPickerPalette } from '../common/ColorPickerPalette';

interface ProfessionalModalProps {
  clinicId: string;
  professional?: User | null;
  onClose: () => void;
  onSaved: () => void;
}

const userRepo = new UserRepository();
const specialtyRepo = new SpecialtyRepository();
const roomRepo = new RoomRepository();

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

const DEFAULT_PROF_SCHEDULE: ProfessionalSchedule = {
  monday: { isWorking: true, start: '09:00', end: '19:00', breaks: [{ id: 'b-1', name: 'Comida', start: '14:00', end: '15:00' }] },
  tuesday: { isWorking: true, start: '09:00', end: '19:00', breaks: [{ id: 'b-1', name: 'Comida', start: '14:00', end: '15:00' }] },
  wednesday: { isWorking: true, start: '09:00', end: '19:00', breaks: [{ id: 'b-1', name: 'Comida', start: '14:00', end: '15:00' }] },
  thursday: { isWorking: true, start: '09:00', end: '19:00', breaks: [{ id: 'b-1', name: 'Comida', start: '14:00', end: '15:00' }] },
  friday: { isWorking: true, start: '09:00', end: '19:00', breaks: [{ id: 'b-1', name: 'Comida', start: '14:00', end: '15:00' }] },
  saturday: { isWorking: false, start: '09:00', end: '14:00', breaks: [] },
  sunday: { isWorking: false, start: '09:00', end: '14:00', breaks: [] }
};

export const ProfessionalModal: React.FC<ProfessionalModalProps> = ({ clinicId, professional, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'schedule'>('profile');
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  
  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    surname: '',
    email: '',
    role: 'professional',
    color: '#3B82F6',
    specialtyId: '',
    roomIds: [],
    isActive: true,
    schedule: DEFAULT_PROF_SCHEDULE
  });

  useEffect(() => {
    if (professional) {
      setFormData({
        ...professional,
        schedule: professional.schedule || DEFAULT_PROF_SCHEDULE
      });
    }
    
    const fetchDependencies = async () => {
      try {
        const [specs, rms] = await Promise.all([
          specialtyRepo.getSpecialtiesByClinic(clinicId),
          roomRepo.getRoomsByClinic(clinicId)
        ]);
        setSpecialties(specs);
        setRooms(rms);
      } catch (err) {
        console.error("Error loading dependencies", err);
      }
    };
    fetchDependencies();
  }, [professional, clinicId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleRoom = (roomId: string) => {
    setFormData(prev => {
      const current = prev.roomIds || [];
      if (current.includes(roomId)) {
        return { ...prev, roomIds: current.filter(id => id !== roomId) };
      } else {
        return { ...prev, roomIds: [...current, roomId] };
      }
    });
  };

  // Gestión de Horario por Día
  const handleDayScheduleChange = (day: DayKey, field: keyof ProfessionalDaySchedule, value: any) => {
    setFormData(prev => {
      const currentSchedule = prev.schedule || DEFAULT_PROF_SCHEDULE;
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

  // Añadir un descanso / pausa a un día
  const handleAddBreak = (day: DayKey) => {
    setFormData(prev => {
      const currentSchedule = prev.schedule || DEFAULT_PROF_SCHEDULE;
      const currentBreaks = currentSchedule[day]?.breaks || [];
      const newBreak: WorkBreak = {
        id: `break-${Date.now()}`,
        name: 'Comida',
        start: '14:00',
        end: '15:00'
      };
      return {
        ...prev,
        schedule: {
          ...currentSchedule,
          [day]: {
            ...currentSchedule[day],
            breaks: [...currentBreaks, newBreak]
          }
        }
      };
    });
  };

  // Modificar un descanso existente
  const handleUpdateBreak = (day: DayKey, breakId: string, field: keyof WorkBreak, value: string) => {
    setFormData(prev => {
      const currentSchedule = prev.schedule || DEFAULT_PROF_SCHEDULE;
      const currentBreaks = currentSchedule[day]?.breaks || [];
      return {
        ...prev,
        schedule: {
          ...currentSchedule,
          [day]: {
            ...currentSchedule[day],
            breaks: currentBreaks.map(b => b.id === breakId ? { ...b, [field]: value } : b)
          }
        }
      };
    });
  };

  // Eliminar descanso
  const handleDeleteBreak = (day: DayKey, breakId: string) => {
    setFormData(prev => {
      const currentSchedule = prev.schedule || DEFAULT_PROF_SCHEDULE;
      const currentBreaks = currentSchedule[day]?.breaks || [];
      return {
        ...prev,
        schedule: {
          ...currentSchedule,
          [day]: {
            ...currentSchedule[day],
            breaks: currentBreaks.filter(b => b.id !== breakId)
          }
        }
      };
    });
  };

  // Copiar horario y descansos a todos los días laborables (Lunes a Viernes)
  const handleCopyMondayToWeekdays = () => {
    setFormData(prev => {
      const currentSchedule = prev.schedule || DEFAULT_PROF_SCHEDULE;
      const mondayConfig = currentSchedule.monday;
      const updated: ProfessionalSchedule = { ...currentSchedule };
      (['tuesday', 'wednesday', 'thursday', 'friday'] as DayKey[]).forEach(d => {
        updated[d] = JSON.parse(JSON.stringify(mondayConfig));
      });
      return { ...prev, schedule: updated };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim() || !formData.email?.trim()) return;

    setLoading(true);
    try {
      const userToSave: User = {
        ...(formData as User),
        id: professional?.id || crypto.randomUUID(),
        clinicId,
        roomIds: formData.roomIds || [],
        schedule: formData.schedule || DEFAULT_PROF_SCHEDULE
      };
      
      await userRepo.saveUser(userToSave);
      onSaved();
    } catch (error) {
      console.error("Error guardando el profesional:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentSchedule = formData.schedule || DEFAULT_PROF_SCHEDULE;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header con Pestañas */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <UserCog className="w-5 h-5 text-primary" />
              {professional ? 'Editar Profesional' : 'Añadir Profesional'}
            </h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'profile'
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <UserCog className="w-4 h-4" />
              Datos y Perfil
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'schedule'
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              Horario Laboral y Descansos
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form id="prof-form" onSubmit={handleSubmit}>
            
            {activeTab === 'profile' ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Nombre *</label>
                    <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Apellidos</label>
                    <input type="text" name="surname" value={formData.surname} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-primary" /> Correo Electrónico (Acceso) *
                    </label>
                    <input required type="email" name="email" value={formData.email} onChange={handleChange} placeholder="correo@clinica.com" disabled={!!professional} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none disabled:opacity-50" />
                    {professional && <p className="text-xs text-gray-500 mt-1">El email no se puede cambiar porque está vinculado a la cuenta de acceso.</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Especialidad Principal</label>
                    <select name="specialtyId" value={formData.specialtyId || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none">
                      <option value="">Sin especialidad / General</option>
                      {specialties.map(spec => (
                        <option key={spec.id} value={spec.id}>{spec.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Permisos (Rol)</label>
                    <select name="role" value={formData.role} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none">
                      <option value="professional">Profesional Médico (Solo su agenda)</option>
                      <option value="admin">Administrador (Acceso total)</option>
                    </select>
                  </div>
                </div>

                <ColorPickerPalette
                  value={formData.color || '#3B82F6'}
                  onChange={(color) => setFormData(prev => ({ ...prev, color }))}
                  label="Color Representativo (Agenda)"
                  description="Identifica visualmente las citas y turnos de este profesional en la agenda."
                  showPreview={true}
                  previewTitle={formData.name ? `Cita con ${formData.name}` : 'Sesión de Logopedia'}
                />

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Salas Habilitadas</label>
                  {rooms.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay salas registradas.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-36 overflow-y-auto pr-2 border border-gray-100 dark:border-gray-800 rounded-xl p-3 bg-gray-50/50 dark:bg-gray-900/20">
                      {rooms.map(room => (
                        <label key={room.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700 shadow-sm">
                          <input 
                            type="checkbox" 
                            checked={formData.roomIds?.includes(room.id) || false}
                            onChange={() => toggleRoom(room.id)}
                            className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-gray-300">{room.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {professional && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 mt-2">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Estado del profesional</h4>
                      <p className="text-xs text-gray-500">Al desactivar, el profesional no podrá acceder ni recibir citas.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData(prev => ({...prev, isActive: e.target.checked}))} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                  </div>
                )}
              </div>
            ) : (
              /* Pestaña: Horario Laboral y Descansos */
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-primary" />
                      Jornada y Pausas de Descanso
                    </h4>
                    <p className="text-xs text-gray-500">
                      Configura el horario de trabajo y las pausas programadas (ej: comida) para bloquear huecos en la agenda.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyMondayToWeekdays}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    title="Copia el turno y descansos del lunes a martes, miércoles, jueves y viernes"
                  >
                    Copiar Lunes a toda la semana (L-V)
                  </button>
                </div>

                <div className="space-y-3">
                  {DAYS_CONFIG.map(({ key, label }) => {
                    const day = currentSchedule[key] || { isWorking: false, start: '09:00', end: '19:00', breaks: [] };
                    return (
                      <div 
                        key={key} 
                        className={`p-4 rounded-xl border transition-all ${
                          day.isWorking 
                            ? 'bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700 shadow-sm' 
                            : 'bg-gray-50/50 dark:bg-gray-900/20 border-dashed border-gray-200 dark:border-gray-800 opacity-60'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={day.isWorking}
                                onChange={(e) => handleDayScheduleChange(key, 'isWorking', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                            </label>
                            <span className="font-bold text-sm text-slate-800 dark:text-white w-20">
                              {label}
                            </span>
                          </div>

                          {day.isWorking ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Turno:</span>
                              <input
                                type="time"
                                value={day.start}
                                onChange={(e) => handleDayScheduleChange(key, 'start', e.target.value)}
                                className="px-2.5 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold outline-none"
                              />
                              <span className="text-gray-400 font-bold text-xs">-</span>
                              <input
                                type="time"
                                value={day.end}
                                onChange={(e) => handleDayScheduleChange(key, 'end', e.target.value)}
                                className="px-2.5 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold outline-none"
                              />
                            </div>
                          ) : (
                            <span className="text-xs italic text-gray-400">Día libre / no laborable</span>
                          )}
                        </div>

                        {/* Bloques de descanso del día */}
                        {day.isWorking && (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/80">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                                <Coffee className="w-3.5 h-3.5 text-amber-500" />
                                Pausas / Descansos programados:
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddBreak(key)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:underline"
                              >
                                <Plus className="w-3 h-3" /> Añadir descanso
                              </button>
                            </div>

                            {(!day.breaks || day.breaks.length === 0) ? (
                              <p className="text-[11px] text-gray-400 italic">Jornada continua sin descansos registrados</p>
                            ) : (
                              <div className="space-y-2">
                                {day.breaks.map((b) => (
                                  <div key={b.id} className="flex items-center gap-2 p-2 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-lg">
                                    <input
                                      type="text"
                                      value={b.name}
                                      onChange={(e) => handleUpdateBreak(key, b.id, 'name', e.target.value)}
                                      placeholder="Ej: Comida"
                                      className="w-28 px-2 py-1 bg-white dark:bg-gray-800 border border-amber-200 dark:border-gray-700 rounded text-xs font-medium outline-none"
                                    />
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="time"
                                        value={b.start}
                                        onChange={(e) => handleUpdateBreak(key, b.id, 'start', e.target.value)}
                                        className="px-2 py-1 bg-white dark:bg-gray-800 border border-amber-200 dark:border-gray-700 rounded text-xs font-medium outline-none"
                                      />
                                      <span className="text-xs text-amber-600 font-bold">-</span>
                                      <input
                                        type="time"
                                        value={b.end}
                                        onChange={(e) => handleUpdateBreak(key, b.id, 'end', e.target.value)}
                                        className="px-2 py-1 bg-white dark:bg-gray-800 border border-amber-200 dark:border-gray-700 rounded text-xs font-medium outline-none"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteBreak(key, b.id)}
                                      className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors ml-auto"
                                      title="Eliminar descanso"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </form>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/30">
          <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
            Cancelar
          </button>
          <button form="prof-form" type="submit" disabled={loading} className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-primary/20 disabled:opacity-50">
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
            {professional ? 'Guardar Cambios' : 'Añadir Profesional'}
          </button>
        </div>
      </div>
    </div>
  );
};
