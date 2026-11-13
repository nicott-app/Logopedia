import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  MapPin, 
  UserPlus, 
  Plus, 
  Sparkles, 
  Coffee, 
  ArrowRight, 
  DoorOpen, 
  CheckCircle2, 
  Briefcase
} from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

import type { 
  Appointment, 
  Patient, 
  User as AppUser, 
  Room, 
  ClinicalService, 
  Specialty 
} from '../../domain/models/types';
import { AppointmentRepository } from '../../infrastructure/firebase/AppointmentRepository';
import { PatientRepository } from '../../infrastructure/firebase/PatientRepository';
import { UserRepository } from '../../infrastructure/firebase/UserRepository';
import { RoomRepository } from '../../infrastructure/firebase/RoomRepository';
import { serviceRepository } from '../../infrastructure/firebase/ServiceRepository';
import { SpecialtyRepository } from '../../infrastructure/firebase/SpecialtyRepository';
import { OptimizationService, type WeeklyAgendaAnalysis } from '../../application/services/OptimizationService';
import { useAuthStore } from '../store/useAuthStore';

import { AppointmentForm } from '../components/AppointmentForm';
import { EmptySlotModal } from '../components/modals/EmptySlotModal';
import { WeeklyGapRadarModal } from '../components/modals/WeeklyGapRadarModal';

const appointmentRepo = new AppointmentRepository();
const patientRepo = new PatientRepository();
const userRepo = new UserRepository();
const roomRepo = new RoomRepository();
const specialtyRepo = new SpecialtyRepository();
const optimizationService = new OptimizationService();

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

interface FreeSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
  label: string;
}

/**
 * Calcula los intervalos libres reales de un profesional para una fecha concreta
 * teniendo en cuenta su turno laboral, descansos y citas programadas.
 */
function getProfessionalFreeSlots(
  prof: AppUser,
  date: Date,
  dayAppointments: Appointment[]
): FreeSlot[] {
  const dayKey = DAY_KEYS[date.getDay()];
  const profDay = prof.schedule?.[dayKey];

  if (!profDay || !profDay.isWorking) return [];

  const [startH, startM] = profDay.start.split(':').map(Number);
  const [endH, endM] = profDay.end.split(':').map(Number);

  const dayStartTime = new Date(date);
  dayStartTime.setHours(startH, startM, 0, 0);

  const dayEndTime = new Date(date);
  dayEndTime.setHours(endH, endM, 0, 0);

  interface BusyInterval {
    start: number;
    end: number;
  }

  const busy: BusyInterval[] = [];

  // 1. Citas del profesional este día
  const profAppts = dayAppointments.filter(a => 
    a.status !== 'cancelled' && a.professionalId === prof.id
  );

  profAppts.forEach(a => {
    busy.push({
      start: new Date(a.start).getTime(),
      end: new Date(a.end).getTime()
    });
  });

  // 2. Descansos / Pausas programadas
  if (profDay.breaks && profDay.breaks.length > 0) {
    profDay.breaks.forEach(b => {
      const [bStartH, bStartM] = b.start.split(':').map(Number);
      const [bEndH, bEndM] = b.end.split(':').map(Number);
      const bStart = new Date(date); bStart.setHours(bStartH, bStartM, 0, 0);
      const bEnd = new Date(date); bEnd.setHours(bEndH, bEndM, 0, 0);
      busy.push({
        start: bStart.getTime(),
        end: bEnd.getTime()
      });
    });
  }

  // Ordenar y fusionar intervalos ocupados
  busy.sort((a, b) => a.start - b.start);
  const mergedBusy: BusyInterval[] = [];
  for (const interval of busy) {
    if (mergedBusy.length === 0) {
      mergedBusy.push({ ...interval });
    } else {
      const last = mergedBusy[mergedBusy.length - 1];
      if (interval.start <= last.end) {
        last.end = Math.max(last.end, interval.end);
      } else {
        mergedBusy.push({ ...interval });
      }
    }
  }

  // Detectar huecos libres >= 30 minutos
  const freeSlots: FreeSlot[] = [];
  let cursor = dayStartTime.getTime();

  for (const b of mergedBusy) {
    if (b.start > cursor) {
      const slotStart = new Date(Math.max(cursor, dayStartTime.getTime()));
      const slotEnd = new Date(Math.min(b.start, dayEndTime.getTime()));
      const durationMins = Math.round((slotEnd.getTime() - slotStart.getTime()) / 60000);
      if (durationMins >= 30) {
        freeSlots.push({
          start: slotStart,
          end: slotEnd,
          durationMinutes: durationMins,
          label: `${format(slotStart, 'HH:mm')} - ${format(slotEnd, 'HH:mm')}`
        });
      }
    }
    cursor = Math.max(cursor, b.end);
  }

  if (cursor < dayEndTime.getTime()) {
    const slotStart = new Date(cursor);
    const slotEnd = new Date(dayEndTime.getTime());
    const durationMins = Math.round((slotEnd.getTime() - slotStart.getTime()) / 60000);
    if (durationMins >= 30) {
      freeSlots.push({
        start: slotStart,
        end: slotEnd,
        durationMinutes: durationMins,
        label: `${format(slotStart, 'HH:mm')} - ${format(slotEnd, 'HH:mm')}`
      });
    }
  }

  return freeSlots;
}

export const HomeDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const clinicId = user?.clinicId || 'demo-clinic-id';

  const [viewMode, setViewMode] = useState<'today' | 'week'>('today');
  const [loading, setLoading] = useState(true);

  // Fecha base (hoy)
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);

  // Datos principales
  const [professionals, setProfessionals] = useState<AppUser[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [services, setServices] = useState<ClinicalService[]>([]);
  const [specialties, setSpecialties] = useState<Record<string, Specialty>>({});
  const [weekAppointments, setWeekAppointments] = useState<Appointment[]>([]);
  const [radarAnalysis, setRadarAnalysis] = useState<WeeklyAgendaAnalysis | null>(null);

  // Estados de Modales
  const [isAppointmentFormOpen, setIsAppointmentFormOpen] = useState(false);
  const [isRadarModalOpen, setIsRadarModalOpen] = useState(false);
  const [emptySlotModalData, setEmptySlotModalData] = useState<{
    start: Date;
    end: Date;
    professionalId?: string;
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profs, pats, rms, servs, specs, appts, analysis] = await Promise.all([
        userRepo.getUsersByClinic(clinicId),
        patientRepo.getPatientsByClinic(clinicId),
        roomRepo.getRoomsByClinic(clinicId),
        serviceRepository.getServicesByClinic(clinicId),
        specialtyRepo.getSpecialtiesByClinic(clinicId),
        appointmentRepo.getAppointmentsByDateRange(clinicId, weekStart.toISOString(), weekEnd.toISOString()),
        optimizationService.analyzeWeeklyAgenda(weekStart, clinicId)
      ]);

      setProfessionals(profs);
      setPatients(pats);
      setRooms(rms);
      setServices(servs);

      const specMap: Record<string, Specialty> = {};
      specs.forEach(s => { specMap[s.id] = s; });
      setSpecialties(specMap);

      setWeekAppointments(appts);
      setRadarAnalysis(analysis);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clinicId]);

  // Citas de hoy ordenadas cronológicamente
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayAppointments = weekAppointments
    .filter(a => format(new Date(a.start), 'yyyy-MM-dd') === todayStr)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Mapa rápido de pacientes, salas y servicios
  const patientsMap = new Map(patients.map(p => [p.id, p]));
  const roomsMap = new Map(rooms.map(r => [r.id, r]));
  const servicesMap = new Map(services.map(s => [s.id, s]));
  const profsMap = new Map(professionals.map(p => [p.id, p]));

  // Determinar estado en tiempo real de una cita para la Sala de Espera
  const getAppointmentStatusBadge = (appt: Appointment) => {
    if (appt.status === 'cancelled') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          Cancelada
        </span>
      );
    }

    const now = new Date();
    const start = new Date(appt.start);
    const end = new Date(appt.end);

    if (now >= start && now <= end) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          En consulta
        </span>
      );
    }

    const diffMins = Math.round((start.getTime() - now.getTime()) / 60000);
    if (diffMins > 0 && diffMins <= 30) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          En espera ({diffMins} min)
        </span>
      );
    }

    if (now > end) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          Realizada
        </span>
      );
    }

    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
        Programada
      </span>
    );
  };

  // Días de la semana para desglose semanal
  const weekDays = Array.from({ length: 5 }).map((_, i) => addDays(weekStart, i));

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* 1. CABECERA: TÍTULO, SELECTOR HOY/SEMANA Y ACCIONES RÁPIDAS (PUNTO 6) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-surface-dark p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white">
              Panel Principal
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary uppercase tracking-wide">
              {viewMode === 'today' ? 'Vista Hoy' : 'Vista Semanal'}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {viewMode === 'today' ? (() => {
              const formatted = format(today, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
              return formatted.charAt(0).toUpperCase() + formatted.slice(1);
            })() : (
              `Semana del ${format(weekStart, "d 'de' MMMM", { locale: es })} al ${format(addDays(weekStart, 4), "d 'de' MMMM 'de' yyyy", { locale: es })}`
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de periodo: Hoy / Esta Semana */}
          <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700 text-xs font-bold">
            <button
              onClick={() => setViewMode('today')}
              className={`px-3.5 py-2 rounded-lg transition-all ${
                viewMode === 'today'
                  ? 'bg-white dark:bg-surface-dark text-slate-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3.5 py-2 rounded-lg transition-all ${
                viewMode === 'week'
                  ? 'bg-white dark:bg-surface-dark text-slate-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Esta Semana
            </button>
          </div>

          {/* Barra de Acciones Rápidas */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRadarModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-50/70 hover:bg-amber-100/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 transition-colors shadow-xs"
              title="Analizar huecos libres con lista de espera"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Radar de Huecos</span>
            </button>

            <button
              onClick={() => navigate('/dashboard/patients/new')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5 text-slate-500" />
              <span>Nuevo Paciente</span>
            </button>

            <button
              onClick={() => setIsAppointmentFormOpen(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Agendar Cita</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. RADAR DE OPORTUNIDADES (HUECOS LIBRES VS LISTA DE ESPERA) */}
      {radarAnalysis && radarAnalysis.opportunities.length > 0 && (
        <div className="relative overflow-hidden bg-amber-50/40 dark:bg-amber-950/15 border border-amber-200/70 dark:border-amber-900/40 p-5 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-amber-100/80 dark:bg-amber-900/50 rounded-xl text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 shadow-xs shrink-0">
              <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/60 px-2 py-0.5 rounded">
                  Radar Inteligente de Huecos
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-white/90 dark:bg-slate-800/80 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                  {radarAnalysis.opportunities.length} detectados
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white mt-1">
                Hay {radarAnalysis.opportunities.length} hueco(s) libre(s) compatibles con pacientes en Lista de Espera
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                Nuestro optimizador ha analizado las disponibilidades horarias de los pacientes esperando plaza y coinciden con huecos de tu equipo médico esta semana.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsRadarModalOpen(true)}
            className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm transition-colors"
          >
            <span>Revisar y Asignar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. SECCIÓN PRINCIPAL EN 2 COLUMNAS: PROFESIONALES (CITAS Y HUECOS) + SALA DE ESPERA (TIMELINE) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* COLUMNA IZQUIERDA: DESGLOSE POR PROFESIONAL (CITAS Y HUECOS LIBRES) (7 cols) */}
        <div className="xl:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                Equipo Médico: Citas y Huecos Disponibles
              </h2>
            </div>
            <span className="text-xs text-gray-400 font-medium">
              {viewMode === 'today' ? 'Horarios de hoy' : 'Resumen semanal'}
            </span>
          </div>

          <div className="space-y-4">
            {professionals.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No hay profesionales registrados todavía</p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                  Añade a tu equipo de profesionales desde Configuración &gt; Equipo Médico para ver sus citas y radar de huecos disponibles.
                </p>
              </div>
            ) : (
              professionals.map(prof => {
              const profColor = prof.color || '#3B82F6';
              const specialty = prof.specialtyId ? specialties[prof.specialtyId] : null;

              if (viewMode === 'today') {
                const dayKey = DAY_KEYS[today.getDay()];
                const profDay = prof.schedule?.[dayKey];
                const isWorkingToday = profDay ? profDay.isWorking : true;

                // Citas de hoy del profesional
                const profTodayAppts = todayAppointments.filter(a => 
                  a.professionalId === prof.id && a.status !== 'cancelled'
                );

                // Huecos libres de hoy para este profesional
                const freeSlots = getProfessionalFreeSlots(prof, today, todayAppointments);

                return (
                  <div 
                    key={prof.id} 
                    className="p-5 rounded-2xl bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 shadow-sm transition-all hover:border-gray-200 dark:hover:border-gray-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0"
                          style={{ backgroundColor: profColor }}
                        >
                          {prof.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-800 dark:text-white">
                              {prof.name} {prof.surname || ''}
                            </h4>
                            {prof.role === 'admin' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {specialty ? specialty.name : 'Especialista clínico'}
                          </p>
                        </div>
                      </div>

                      {/* Contador de citas de hoy */}
                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-primary/10 text-primary">
                          <CalendarIcon className="w-3 h-3" />
                          {profTodayAppts.length} {profTodayAppts.length === 1 ? 'cita hoy' : 'citas hoy'}
                        </span>
                        {profDay && profDay.isWorking && (
                          <p className="text-[11px] text-gray-400 mt-1">
                            Turno: {profDay.start} - {profDay.end}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Descanso programado si lo tiene hoy */}
                    {profDay?.breaks && profDay.breaks.length > 0 && (
                      <div className="mt-3 py-1.5 px-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                        <Coffee className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="font-medium">
                          Descanso: {profDay.breaks[0].name} ({profDay.breaks[0].start} - {profDay.breaks[0].end})
                        </span>
                      </div>
                    )}

                    {/* Detalle de Huecos Libres de Hoy */}
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-emerald-500" />
                          Huecos Libres Hoy ({freeSlots.length})
                        </span>
                        {freeSlots.length > 0 && (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            Clic en un hueco para asignar paciente
                          </span>
                        )}
                      </div>

                      {!isWorkingToday ? (
                        <div className="py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 text-xs text-gray-500 text-center">
                          El profesional no tiene turno laboral activo este día.
                        </div>
                      ) : freeSlots.length === 0 ? (
                        <div className="py-2.5 px-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-blue-500" />
                          <span>Agenda completa para hoy sin huecos libres restantes.</span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {freeSlots.map((slot, sIdx) => (
                            <button
                              key={sIdx}
                              onClick={() => {
                                setEmptySlotModalData({
                                  start: slot.start,
                                  end: slot.end,
                                  professionalId: prof.id
                                });
                              }}
                              className="group flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-all hover:scale-[1.02] shadow-sm"
                              title={`Hueco de ${slot.durationMinutes} minutos. Clic para agendar cita.`}
                            >
                              <span>{slot.label}</span>
                              <span className="text-[10px] opacity-75 font-normal">
                                ({slot.durationMinutes}m)
                              </span>
                              <Plus className="w-3 h-3 text-emerald-600 dark:text-emerald-400 opacity-60 group-hover:opacity-100" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // VISTA SEMANAL (viewMode === 'week')
              const profWeekAppts = weekAppointments.filter(a => 
                a.professionalId === prof.id && a.status !== 'cancelled'
              );

              return (
                <div 
                  key={prof.id} 
                  className="p-5 rounded-2xl bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0"
                        style={{ backgroundColor: profColor }}
                      >
                        {prof.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-white">
                          {prof.name} {prof.surname || ''}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {specialty ? specialty.name : 'Especialista clínico'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-primary/10 text-primary">
                        <CalendarIcon className="w-3 h-3" />
                        {profWeekAppts.length} citas esta semana
                      </span>
                    </div>
                  </div>

                  {/* Resumen diario de la semana con huecos libres */}
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">
                      Desglose Semanal (Citas y Disponibilidad)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {weekDays.map(day => {
                        const dayStr = format(day, 'yyyy-MM-dd');
                        const dayKey = DAY_KEYS[day.getDay()];
                        const profDay = prof.schedule?.[dayKey];
                        const isWorking = profDay ? profDay.isWorking : true;

                        const dayAppts = weekAppointments.filter(a => 
                          a.professionalId === prof.id &&
                          a.status !== 'cancelled' &&
                          format(new Date(a.start), 'yyyy-MM-dd') === dayStr
                        );

                        const freeSlotsDay = getProfessionalFreeSlots(prof, day, weekAppointments);

                        return (
                          <div 
                            key={dayStr}
                            className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                              !isWorking
                                ? 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-800 text-gray-400'
                                : 'bg-gray-50/80 dark:bg-surface-dark border-gray-100 dark:border-gray-800 text-slate-700 dark:text-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-bold mb-1">
                              <span className="uppercase">{format(day, 'EEE', { locale: es })}</span>
                              <span className="text-gray-400">{format(day, 'dd')}</span>
                            </div>

                            {!isWorking ? (
                              <span className="text-[10px] text-gray-400">Libre</span>
                            ) : (
                              <div className="space-y-1 mt-1 text-[11px]">
                                <div className="font-semibold text-slate-800 dark:text-white">
                                  {dayAppts.length} {dayAppts.length === 1 ? 'cita' : 'citas'}
                                </div>
                                {freeSlotsDay.length > 0 ? (
                                  <button
                                    onClick={() => {
                                      setEmptySlotModalData({
                                        start: freeSlotsDay[0].start,
                                        end: freeSlotsDay[0].end,
                                        professionalId: prof.id
                                      });
                                    }}
                                    className="w-full text-left text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center justify-between"
                                    title="Ver primer hueco libre para asignar"
                                  >
                                    <span>{freeSlotsDay.length} hueco(s)</span>
                                    <Plus className="w-2.5 h-2.5" />
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-blue-500 font-medium">Completo</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>

        {/* COLUMNA DERECHA: SALA DE ESPERA / TIMELINE EN TIEMPO REAL (OPCIÓN 2) (5 cols) */}
        <div className="xl:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                Sala de Espera (En Directo)
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              {todayAppointments.length} citas hoy
            </span>
          </div>

          <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            {todayAppointments.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <DoorOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-semibold text-slate-600 dark:text-gray-300">
                  Sin citas para hoy
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Las citas programadas para el día de hoy aparecerán aquí en orden cronológico.
                </p>
                <button
                  onClick={() => setIsAppointmentFormOpen(true)}
                  className="mt-4 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition-colors"
                >
                  + Agendar Cita
                </button>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[580px] overflow-y-auto pr-1">
                {todayAppointments.map((appt) => {
                  const patient = patientsMap.get(appt.patientId);
                  const prof = profsMap.get(appt.professionalId);
                  const room = appt.roomId ? roomsMap.get(appt.roomId) : null;
                  const service = appt.serviceId ? servicesMap.get(appt.serviceId) : null;

                  const start = new Date(appt.start);
                  const end = new Date(appt.end);
                  const duration = Math.round((end.getTime() - start.getTime()) / 60000);

                  return (
                    <div
                      key={appt.id}
                      className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-all flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-800 dark:text-white tabular-nums">
                            {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                          </span>
                          <span className="text-[11px] text-gray-400 font-medium">
                            ({duration}m)
                          </span>
                        </div>
                        {getAppointmentStatusBadge(appt)}
                      </div>

                      {/* Paciente y enlace */}
                      <div className="flex items-baseline justify-between">
                        <button
                          onClick={() => {
                            if (patient) navigate(`/dashboard/patients/${patient.id}`);
                          }}
                          className="font-bold text-slate-800 dark:text-white hover:text-primary transition-colors text-left truncate text-sm"
                        >
                          {patient ? `${patient.name} ${patient.surname || ''}` : 'Paciente sin asignar'}
                        </button>
                      </div>

                      {/* Tratamiento / Servicio */}
                      {service && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-gray-300">
                          <Briefcase className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate font-medium">{service.name}</span>
                        </div>
                      )}

                      {/* Terapeuta y Sala */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800/80 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span 
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: prof?.color || '#3B82F6' }}
                          />
                          <span className="text-gray-600 dark:text-gray-400 font-medium">
                            {prof?.name || 'Profesional'}
                          </span>
                        </div>

                        {room && (
                          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-[11px]">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <span className="truncate max-w-[140px]">{room.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. MONITOR DE OCUPACIÓN DE SALAS / GABINETES (OPCIÓN 4) */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DoorOpen className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
              Monitor de Ocupación de Salas y Gabinetes
            </h2>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            Estado de instalaciones en tiempo real
          </span>
        </div>

        {rooms.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <DoorOpen className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No hay salas físicas configuradas todavía</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              Crea tus salas, despachos o gabinetes en Configuración &gt; Salas Físicas para monitorizar su ocupación en tiempo real.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {rooms.map(room => {
            const now = new Date();

            // Buscar si hay cita activa en esta sala en este momento
            const currentAppt = todayAppointments.find(a => {
              if (a.roomId !== room.id || a.status === 'cancelled') return false;
              const s = new Date(a.start);
              const e = new Date(a.end);
              return now >= s && now <= e;
            });

            // Buscar la próxima cita en esta sala hoy
            const nextAppt = todayAppointments.find(a => {
              if (a.roomId !== room.id || a.status === 'cancelled') return false;
              const s = new Date(a.start);
              return s > now;
            });

            // Total de citas hoy en esta sala
            const roomTodayAppts = todayAppointments.filter(a => 
              a.roomId === room.id && a.status !== 'cancelled'
            );

            const isOccupiedNow = !!currentAppt;

            return (
              <div
                key={room.id}
                className="p-5 rounded-2xl bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-sm">
                        {room.name}
                      </h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {room.type} • Capacidad: {room.capacity}
                      </p>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${
                      isOccupiedNow
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}>
                      {isOccupiedNow ? 'En uso ahora' : 'Disponible'}
                    </span>
                  </div>

                  {/* Detalle de estado */}
                  <div className="py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 text-xs">
                    {isOccupiedNow && currentAppt ? (
                      <div className="space-y-1">
                        <span className="text-rose-600 dark:text-rose-400 font-bold block">
                          Sesión en curso hasta {format(new Date(currentAppt.end), 'HH:mm')}
                        </span>
                        <p className="text-slate-700 dark:text-gray-300 font-medium truncate">
                          {patientsMap.get(currentAppt.patientId)?.name || 'Paciente'}
                        </p>
                        <p className="text-gray-400 text-[11px] truncate">
                          con {profsMap.get(currentAppt.professionalId)?.name || 'Terapeuta'}
                        </p>
                      </div>
                    ) : nextAppt ? (
                      <div>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold block">
                          Próxima sesión a las {format(new Date(nextAppt.start), 'HH:mm')}
                        </span>
                        <p className="text-gray-500 text-[11px] truncate mt-0.5">
                          {patientsMap.get(nextAppt.patientId)?.name || 'Paciente'}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-400 block font-medium">
                        Sin más sesiones programadas hoy
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
                  <span>Citas hoy:</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    {roomTodayAppts.length}
                  </span>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* MODALES CONECTADOS */}
      {isAppointmentFormOpen && (
        <AppointmentForm
          onClose={() => setIsAppointmentFormOpen(false)}
          onSaved={() => {
            setIsAppointmentFormOpen(false);
            fetchData();
          }}
        />
      )}

      {isRadarModalOpen && (
        <WeeklyGapRadarModal
          weekStart={weekStart}
          clinicId={clinicId}
          onClose={() => setIsRadarModalOpen(false)}
          onAssigned={() => {
            setIsRadarModalOpen(false);
            fetchData();
          }}
        />
      )}

      {emptySlotModalData && (
        <EmptySlotModal
          slotStart={emptySlotModalData.start}
          slotEnd={emptySlotModalData.end}
          clinicId={clinicId}
          initialProfessionalId={emptySlotModalData.professionalId}
          onClose={() => setEmptySlotModalData(null)}
          onCreated={() => {
            setEmptySlotModalData(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
};
