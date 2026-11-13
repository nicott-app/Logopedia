import { useState, useEffect, useRef, useMemo } from 'react';
import { format, addDays, startOfWeek, addWeeks, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Brain, Sparkles, Shield, User, Coffee, Lock, Wand2, UserMinus, TrendingUp, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { AppointmentRepository } from '../../infrastructure/firebase/AppointmentRepository';
import type { Appointment, ClinicalService, Clinic, User as AppUser } from '../../domain/models/types';
import { PatientRepository } from '../../infrastructure/firebase/PatientRepository';
import { UserRepository } from '../../infrastructure/firebase/UserRepository';
import { RoomRepository } from '../../infrastructure/firebase/RoomRepository';
import { serviceRepository } from '../../infrastructure/firebase/ServiceRepository';
import { clinicRepository, DEFAULT_CLINIC_SCHEDULE } from '../../infrastructure/firebase/ClinicRepository';
import { OptimizationService, type ScheduleEfficiencyMetrics } from '../../application/services/OptimizationService';
import { useAuthStore } from '../store/useAuthStore';
import { AppointmentForm } from '../components/AppointmentForm';
import { AppointmentDetailModal } from '../components/modals/AppointmentDetailModal';
import { GapFillerModal } from '../components/modals/GapFillerModal';
import { EmptySlotModal } from '../components/modals/EmptySlotModal';
import { WeeklyGapRadarModal } from '../components/modals/WeeklyGapRadarModal';
import { AutoAssignModal } from '../components/modals/AutoAssignModal';
import { DischargedVacanciesRadarModal } from '../components/modals/DischargedVacanciesRadarModal';
import { ScheduleEfficiencyBar } from '../components/calendar/ScheduleEfficiencyBar';
import { ScheduleEfficiencyModal } from '../components/modals/ScheduleEfficiencyModal';

const appointmentRepo = new AppointmentRepository();
const patientRepo = new PatientRepository();
const userRepo = new UserRepository();
const roomRepo = new RoomRepository();
const optimizationService = new OptimizationService(appointmentRepo);

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export const CalendarView = () => {
  const { user } = useAuthStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [professionalsList, setProfessionalsList] = useState<AppUser[]>([]);
  const [patientsMap, setPatientsMap] = useState<Record<string, string>>({});
  const [professionalsMap, setProfessionalsMap] = useState<Record<string, { name: string; color: string }>>({});
  const [roomsMap, setRoomsMap] = useState<Record<string, string>>({});
  const [servicesMap, setServicesMap] = useState<Record<string, ClinicalService>>({});
  const [loading, setLoading] = useState(true);
  
  // Determinamos si el usuario autenticado es realmente el Administrador
  const isRealAdmin = user?.role === 'admin';

  // Selector de previsualización (exclusivo para el Administrador)
  const [rolePreview, setRolePreview] = useState<'admin' | 'employee'>(
    isRealAdmin ? 'admin' : 'employee'
  );

  // Filtro de profesional para cuando el admin previsualiza la vista de empleado
  const [selectedProfFilter, setSelectedProfFilter] = useState<string>('all');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isRadarOpen, setIsRadarOpen] = useState(false);
  const [isAutoAssignOpen, setIsAutoAssignOpen] = useState(false);
  const [isVacanciesRadarOpen, setIsVacanciesRadarOpen] = useState(false);
  const [isEfficiencyModalOpen, setIsEfficiencyModalOpen] = useState(false);
  const [efficiencyMetrics, setEfficiencyMetrics] = useState<ScheduleEfficiencyMetrics | null>(null);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [gapFillerAppt, setGapFillerAppt] = useState<Appointment | null>(null);
  const [emptySlotInfo, setEmptySlotInfo] = useState<{ start: Date; end: Date } | null>(null);

  // Menú desplegable unificado y navegación fluida por franjas horarias
  const [assistantMenuOpen, setAssistantMenuOpen] = useState(false);
  const assistantMenuRef = useRef<HTMLDivElement>(null);
  const calendarScrollRef = useRef<HTMLDivElement>(null);
  const [currentTurno, setCurrentTurno] = useState<'morning' | 'midday' | 'afternoon'>('morning');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (assistantMenuRef.current && !assistantMenuRef.current.contains(e.target as Node)) {
        setAssistantMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAppointments = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = addDays(start, 6);
      const clinicId = user.clinicId; 

      const [clinicData, data, pats, profs, rms, servs, effMetrics] = await Promise.all([
        clinicRepository.getClinic(clinicId),
        appointmentRepo.getAppointmentsByDateRange(clinicId, start.toISOString(), end.toISOString()),
        patientRepo.getPatientsByClinic(clinicId),
        userRepo.getUsersByClinic(clinicId),
        roomRepo.getRoomsByClinic(clinicId),
        serviceRepository.getServicesByClinic(clinicId),
        optimizationService.calculateScheduleEfficiency(clinicId, start).catch(err => {
          console.error("Error calculating efficiency metrics:", err);
          return null;
        })
      ]);
      
      setClinic(clinicData);
      setProfessionalsList(profs);

      const pMap: Record<string, string> = {};
      pats.forEach(p => pMap[p.id] = `${p.name} ${p.surname || ''}`.trim());
      setPatientsMap(pMap);

      const prMap: Record<string, { name: string; color: string }> = {};
      profs.forEach(pr => prMap[pr.id] = { name: `${pr.name} ${pr.surname || ''}`.trim(), color: pr.color || '#3B82F6' });
      setProfessionalsMap(prMap);

      const rMap: Record<string, string> = {};
      rms.forEach(r => rMap[r.id] = r.name);
      setRoomsMap(rMap);

      const sMap: Record<string, ClinicalService> = {};
      servs.forEach(s => sMap[s.id] = s);
      setServicesMap(sMap);

      setAppointments(data);
      setEfficiencyMetrics(effMetrics);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [currentDate, user]);

  const nextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const prevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const today = new Date();

  // El modo administrador con colores solo aplica si el usuario es admin y tiene seleccionada la vista admin
  const isAdminView = isRealAdmin && rolePreview === 'admin';

  // Profesional activo cuando se visualiza la vista personal de empleado
  const activeProf: AppUser | null = !isRealAdmin
    ? (professionalsList.find(p => p.id === user?.id) || user)
    : (!isAdminView && selectedProfFilter !== 'all'
        ? (professionalsList.find(p => p.id === selectedProfFilter) || null)
        : null);

  // Si el usuario es empleado, solo ve su propia agenda.
  // Si es admin:
  // - En vista admin: ve todas las citas con el color característico de cada profesional.
  // - En vista empleado (previsualización): ve las citas con el color de cada profesional y puede filtrar por profesional individual.
  const visibleAppointments = useMemo(() => {
    return appointments.filter(a => {
      if (!isRealAdmin) {
        return a.professionalId === user?.id;
      }
      if (!isAdminView && selectedProfFilter !== 'all') {
        return a.professionalId === selectedProfFilter;
      }
      return true;
    });
  }, [appointments, isRealAdmin, user?.id, isAdminView, selectedProfFilter]);

  // Indexación O(1) de citas agrupadas por fecha ('yyyy-MM-dd')
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of visibleAppointments) {
      const dateKey = a.start.substring(0, 10);
      const list = map.get(dateKey);
      if (list) {
        list.push(a);
      } else {
        map.set(dateKey, [a]);
      }
    }
    return map;
  }, [visibleAppointments]);

  // Cálculo dinámico de horas de apertura y cierre según el horario configurado de la clínica
  let openHour = 9;
  let closeHour = 21;

  if (clinic?.schedule) {
    const openDays = Object.values(clinic.schedule).filter(d => d.isOpen);
    if (openDays.length > 0) {
      const minOpen = Math.min(...openDays.map(d => parseInt(d.openTime.split(':')[0], 10)));
      const maxClose = Math.max(...openDays.map(d => {
        const [h, m] = d.closeTime.split(':').map(Number);
        return m > 0 ? h + 1 : h;
      }));
      if (!isNaN(minOpen) && minOpen >= 6 && minOpen <= 12) openHour = minOpen;
      if (!isNaN(maxClose) && maxClose >= 18 && maxClose <= 24) closeHour = maxClose;
    }
  }

  const scrollToHour = (targetHour: number) => {
    if (!calendarScrollRef.current) return;
    const hourOffset = Math.max(0, targetHour - openHour);
    const targetScrollTop = hourOffset * 80;
    calendarScrollRef.current.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth'
    });
    if (targetHour < 13) setCurrentTurno('morning');
    else if (targetHour < 16) setCurrentTurno('midday');
    else setCurrentTurno('afternoon');
  };

  const totalHours = Math.max(10, closeHour - openHour);
  const gridHeightPx = totalHours * 80;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
      
      {/* Header del Calendario */}
      <div className="flex items-center justify-between p-4 sm:px-5 sm:py-3.5 border-b border-gray-100 dark:border-gray-800 gap-3 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <h2 className="text-lg font-bold capitalize text-slate-800 dark:text-white shrink-0">
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </h2>

          {/* Navegación Semanal */}
          <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-lg p-1 shrink-0">
            <button onClick={prevWeek} className="p-1 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors" title="Semana anterior"><ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
            <button onClick={() => setCurrentDate(today)} className="px-2.5 py-1 text-xs font-semibold hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors text-slate-700 dark:text-slate-200">Hoy</button>
            <button onClick={nextWeek} className="p-1 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors" title="Semana siguiente"><ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" /></button>
          </div>

          {/* Selector de Navegación Rápida por Turno */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-medium border border-slate-200/60 dark:border-slate-700/60 shrink-0">
            <span className="text-[11px] text-slate-400 px-1 font-semibold uppercase tracking-wider hidden xl:inline">Turno:</span>
            <button
              type="button"
              onClick={() => scrollToHour(openHour)}
              className={`px-2 py-1 rounded-lg transition-all font-medium text-xs ${
                currentTurno === 'morning'
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={`Ir a horario de apertura / mañana (${String(openHour).padStart(2, '0')}:00)`}
            >
              ☀️ Mañana
            </button>
            <button
              type="button"
              onClick={() => scrollToHour(13)}
              className={`px-2 py-1 rounded-lg transition-all font-medium text-xs ${
                currentTurno === 'midday'
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Ir a horario de mediodía (13:00)"
            >
              🥪 Mediodía
            </button>
            <button
              type="button"
              onClick={() => scrollToHour(16)}
              className={`px-2 py-1 rounded-lg transition-all font-medium text-xs ${
                currentTurno === 'afternoon'
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Ir a horario de tarde (16:00 a 21:00)"
            >
              🌙 Tarde
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Selector de Modo de Vista (Exclusivo para Administrador) */}
          {isRealAdmin && (
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setRolePreview('admin');
                    setSelectedProfFilter('all');
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all ${
                    isAdminView
                      ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Vista Administrador: Cada cita muestra el color característico de su profesional"
                >
                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                  <span>Admin</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRolePreview('employee')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all ${
                    !isAdminView
                      ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Vista Empleado: Agenda individual o filtrada con el color característico de cada profesional"
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Empleado</span>
                </button>
              </div>

              {!isAdminView && (
                <select
                  value={selectedProfFilter}
                  onChange={(e) => setSelectedProfFilter(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-gray-200 outline-none font-medium max-w-[135px] truncate shadow-2xs"
                  title="Filtrar por agenda del profesional"
                >
                  <option value="all">Agenda Global</option>
                  {Object.entries(professionalsMap).map(([id, pr]) => (
                    <option key={id} value={id}>{pr.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Píldora de Ocupación Concisa (abre auditoría de eficiencia) */}
          {efficiencyMetrics && (
            <button
              type="button"
              onClick={() => setIsEfficiencyModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition-all shadow-xs shrink-0"
              title="Abrir auditoría de eficiencia y métricas de ocupación"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-slate-500 hidden xl:inline">Ocupación:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">{efficiencyMetrics.occupancyRate}%</span>
            </button>
          )}

          {/* Menú Desplegable Unificado: Asistente Inteligente */}
          <div className="relative shrink-0" ref={assistantMenuRef}>
            <button
              type="button"
              onClick={() => setAssistantMenuOpen(!assistantMenuOpen)}
              className="flex items-center gap-1.5 bg-indigo-50/80 hover:bg-indigo-100/90 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs"
              title="Herramientas inteligentes de optimización y cobertura de agenda"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Asistente Inteligente</span>
              <ChevronDown className={`w-3.5 h-3.5 text-indigo-400 transition-transform duration-200 ${assistantMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {assistantMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Herramientas de Optimización
                </div>

                {isRealAdmin && (
                  <button
                    type="button"
                    onClick={() => { setIsAutoAssignOpen(true); setAssistantMenuOpen(false); }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 flex items-start gap-3 text-xs transition-colors group"
                  >
                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/60 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                      <Wand2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white group-hover:text-indigo-600">Llenar semana automáticamente</div>
                      <div className="text-[11px] text-slate-500">Asigna pacientes en espera a huecos vacíos</div>
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => { setIsVacanciesRadarOpen(true); setAssistantMenuOpen(false); }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-amber-50/60 dark:hover:bg-amber-950/40 flex items-start gap-3 text-xs transition-colors group"
                >
                  <div className="p-1.5 bg-amber-100 dark:bg-amber-900/60 rounded-lg text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                    <UserMinus className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-white group-hover:text-amber-600">Cubrir cancelaciones y bajas</div>
                    <div className="text-[11px] text-slate-500">Detecta citas liberadas y encuentra sustitutos</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setIsRadarOpen(true); setAssistantMenuOpen(false); }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-purple-50/60 dark:hover:bg-purple-950/40 flex items-start gap-3 text-xs transition-colors group"
                >
                  <div className="p-1.5 bg-purple-100 dark:bg-purple-900/60 rounded-lg text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                    <Brain className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-white group-hover:text-purple-600">Radar semanal de huecos</div>
                    <div className="text-[11px] text-slate-500">Explora las mejores oportunidades libres</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Botón Principal: Nueva Cita */}
          <button 
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Cita</span>
          </button>
        </div>
      </div>

      {/* Barra Indicadora de Ocupación y Eficiencia de la Agenda */}
      <div className="pt-3">
        <ScheduleEfficiencyBar
          metrics={efficiencyMetrics}
          loading={loading}
          onOpenAudit={() => setIsEfficiencyModalOpen(true)}
        />
      </div>

      {/* Grid del Calendario con escala de 30 minutos y horarios delimitados */}
      <div 
        ref={calendarScrollRef}
        className="flex-1 overflow-auto p-6 pt-2 relative scroll-smooth scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700"
      >
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-surface-dark/50 z-10 backdrop-blur-sm">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : null}
        
        <div className="min-w-[850px] flex border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm bg-white dark:bg-surface-dark">
          {/* Regla de Horas con marca horaria y marca de media hora (:00 y :30) */}
          <div className="w-24 border-r border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 shrink-0">
             <div className="h-12 border-b border-gray-200 dark:border-gray-800 flex items-center justify-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-30 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-xs">
               Hora
             </div>
             {Array.from({ length: totalHours }).map((_, i) => {
                const hourNum = openHour + i;
                const formattedHour = String(hourNum).padStart(2, '0');
                return (
                  <div key={i} className="h-20 border-b border-gray-200 dark:border-gray-800 flex flex-col">
                    {/* Hora en punto :00 (40px) */}
                    <div className="h-10 border-b border-gray-100 dark:border-gray-800/40 border-dotted flex items-center justify-end pr-3">
                       <span className="text-xs font-bold text-slate-700 dark:text-gray-200">
                         {formattedHour}:00
                       </span>
                    </div>
                    {/* Media hora :30 (40px) */}
                    <div className="h-10 flex items-center justify-end pr-3">
                       <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
                         {formattedHour}:30
                       </span>
                    </div>
                  </div>
                );
             })}
          </div>
          
          {/* Columnas de Días (Lunes a Viernes) */}
          {Array.from({ length: 5 }).map((_, dayIndex) => {
             const colDate = addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), dayIndex);
             const isToday = format(colDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
             const dayKey = DAY_KEYS[colDate.getDay()];
             
             // Comprobar apertura de la clínica para este día
             const clinicSchedule = clinic?.schedule || DEFAULT_CLINIC_SCHEDULE;
             const clinicDay = clinicSchedule[dayKey];
             const isClinicOpenToday = clinicDay ? clinicDay.isOpen : true;

             // Comprobar horario y descansos del profesional activo si se visualiza individualmente
             const profDay = activeProf?.schedule ? activeProf.schedule[dayKey] : null;
             const isProfWorkingToday = profDay ? profDay.isWorking : true;

             return (
              <div key={dayIndex} className="flex-1 border-r border-gray-200 dark:border-gray-800 last:border-r-0 min-w-[140px]">
                <div className={`h-12 flex flex-col items-center justify-center border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30 backdrop-blur-xs ${isToday ? 'bg-primary/10 text-primary' : 'bg-gray-50/95 dark:bg-gray-900/95 text-gray-500'}`}>
                  <span className="text-xs font-semibold uppercase">{format(colDate, 'EEE', { locale: es })}</span>
                  <span className={`text-base font-bold ${isToday ? 'text-primary' : 'text-slate-800 dark:text-gray-200'}`}>{format(colDate, 'dd')}</span>
                </div>
                
                {/* Cuadrícula horaria dinámica según apertura */}
                <div 
                  style={{ height: `${gridHeightPx}px` }} 
                  className="relative bg-white dark:bg-surface-dark"
                >
                   {/* Si la clínica está cerrada en este día */}
                   {!isClinicOpenToday ? (
                     <div className="absolute inset-0 bg-gray-100/70 dark:bg-gray-900/70 flex flex-col items-center justify-center p-4 z-20 text-gray-400 backdrop-blur-[0.5px]">
                       <Lock className="w-6 h-6 mb-1 text-gray-400 dark:text-gray-600" />
                       <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Clínica Cerrada</span>
                       <span className="text-[10px] text-gray-400">Instalaciones sin actividad</span>
                     </div>
                   ) : activeProf && !isProfWorkingToday ? (
                     /* Si el profesional no trabaja en este día */
                     <div className="absolute inset-0 bg-gray-50/70 dark:bg-gray-900/50 flex flex-col items-center justify-center p-4 z-20 text-gray-400">
                       <User className="w-6 h-6 mb-1 text-gray-400 dark:text-gray-600" />
                       <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Día No Laborable</span>
                       <span className="text-[10px] text-gray-400">El profesional libra hoy</span>
                     </div>
                   ) : (
                     <>
                       {/* Franjas horarias interactivas (:00 y :30) */}
                       {Array.from({ length: totalHours }).map((_, h) => {
                          const slotHour = openHour + h;
                          return (
                            <div key={h} className="h-20 border-b border-gray-200 dark:border-gray-800 flex flex-col">
                              {/* Franja 1: :00 a :30 (40px) */}
                              <div 
                                onClick={() => {
                                  const start = new Date(colDate);
                                  start.setHours(slotHour, 0, 0, 0);
                                  const end = new Date(start.getTime() + 30 * 60000);
                                  setEmptySlotInfo({ start, end });
                                }}
                                className="h-10 border-b border-gray-100 dark:border-gray-800/40 border-dashed hover:bg-primary/5 cursor-pointer transition-colors group flex items-center justify-end pr-2"
                                title={`Hueco libre ${String(slotHour).padStart(2, '0')}:00 - Clic para asignar`}
                              >
                                <span className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded transition-opacity flex items-center gap-0.5">
                                  <Plus className="w-2.5 h-2.5" /> :00
                                </span>
                              </div>

                              {/* Franja 2: :30 a :00 (40px) */}
                              <div 
                                onClick={() => {
                                  const start = new Date(colDate);
                                  start.setHours(slotHour, 30, 0, 0);
                                  const end = new Date(start.getTime() + 30 * 60000);
                                  setEmptySlotInfo({ start, end });
                                }}
                                className="h-10 hover:bg-primary/5 cursor-pointer transition-colors group flex items-center justify-end pr-2"
                                title={`Hueco libre ${String(slotHour).padStart(2, '0')}:30 - Clic para asignar`}
                              >
                                <span className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded transition-opacity flex items-center gap-0.5">
                                  <Plus className="w-2.5 h-2.5" /> :30
                                </span>
                              </div>
                            </div>
                          );
                       })}

                       {/* Renderizar Bloques de Descanso (Breaks) */}
                       {/* Caso 1: Vista individual de empleado (Descansos del terapeuta activo) */}
                       {activeProf && profDay?.breaks && profDay.breaks.map((b) => {
                          const [bStartH, bStartM] = b.start.split(':').map(Number);
                          const [bEndH, bEndM] = b.end.split(':').map(Number);
                          const startMins = (bStartH - openHour) * 60 + bStartM;
                          const endMins = (bEndH - openHour) * 60 + bEndM;
                          const bTop = (startMins / 60) * 80;
                          const bHeight = Math.max(34, ((endMins - startMins) / 60) * 80 - 2);

                          return (
                            <div
                              key={b.id}
                              style={{ top: `${bTop}px`, height: `${bHeight}px` }}
                              className="absolute left-1 right-1 rounded-r-lg px-2.5 py-1 text-xs border border-amber-200/90 dark:border-amber-900/60 bg-amber-50/85 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border-l-4 border-l-amber-400 dark:border-l-amber-500 shadow-xs flex items-center justify-between z-10 pointer-events-auto"
                              title={`Descanso programado: ${b.name} (${b.start} - ${b.end})`}
                            >
                              <div className="flex items-center gap-1.5 font-medium truncate">
                                <Coffee className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span className="truncate">{b.name}</span>
                              </div>
                              <span className="text-[10px] font-medium text-amber-700/80 dark:text-amber-300/80 tabular-nums shrink-0">
                                {b.start} - {b.end}
                              </span>
                            </div>
                          );
                       })}

                       {/* Caso 2: Vista global de Administrador (Descansos de todo el equipo médico) */}
                       {isAdminView && !activeProf && professionalsList.flatMap(prof => {
                          const pDay = prof.schedule?.[dayKey];
                          if (!pDay || !pDay.isWorking || !pDay.breaks) return [];
                          return pDay.breaks.map(b => ({
                            ...b,
                            profId: prof.id,
                            profName: prof.name,
                            profColor: prof.color || '#64748B'
                          }));
                       }).map(b => {
                          const [bStartH, bStartM] = b.start.split(':').map(Number);
                          const [bEndH, bEndM] = b.end.split(':').map(Number);
                          const startMins = (bStartH - openHour) * 60 + bStartM;
                          const endMins = (bEndH - openHour) * 60 + bEndM;
                          const bTop = (startMins / 60) * 80;
                          const bHeight = Math.max(34, ((endMins - startMins) / 60) * 80 - 2);

                          return (
                            <div
                              key={`${b.profId}-${b.id}`}
                              style={{ 
                                top: `${bTop}px`, 
                                height: `${bHeight}px`,
                                borderLeftColor: b.profColor 
                              }}
                              className="absolute left-1 right-1 rounded-r-lg px-2 py-0.5 text-[11px] border border-dashed border-amber-200/80 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 border-l-4 shadow-xs flex items-center justify-between z-10 pointer-events-auto"
                              title={`Descanso de ${b.profName}: ${b.name} (${b.start} - ${b.end})`}
                            >
                              <div className="flex items-center gap-1 font-medium truncate min-w-0">
                                <Coffee className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span className="truncate">{b.name} ({b.profName})</span>
                              </div>
                              <span className="text-[10px] font-medium text-amber-700/80 dark:text-amber-300/80 tabular-nums shrink-0 ml-1">
                                {b.start} - {b.end}
                              </span>
                            </div>
                          );
                       })}

                       {/* Renderizar citas */}
                       {(appointmentsByDate.get(format(colDate, 'yyyy-MM-dd')) || [])
                          .map(appt => {
                            const s = new Date(appt.start);
                            const e = new Date(appt.end);
                            
                            // Minutos relativos a la hora de apertura dinámica
                            const startMinutesFromOpen = ((s.getHours() - openHour) * 60) + s.getMinutes();
                            const top = (startMinutesFromOpen / 60) * 80;
                            
                            const durationMinutes = Math.max(15, Math.round((e.getTime() - s.getTime()) / 60000));
                            const height = Math.max(34, Math.round((durationMinutes / 60) * 80) - 2);

                            const isCancelled = appt.status === 'cancelled';
                            const prof = professionalsMap[appt.professionalId];
                            const profColor = prof?.color || '#4A7C9B';
                            const service = appt.serviceId ? servicesMap[appt.serviceId] : null;
                            const treatmentName = service?.name || appt.notes || 'Tratamiento';

                            const cardBorderLeftColor = isCancelled 
                              ? '#94A3B8' 
                              : profColor;

                            const cardCustomStyle = isCancelled
                              ? {}
                              : {
                                  backgroundColor: `${profColor}14`,
                                  borderColor: `${profColor}35`,
                                  borderLeftColor: profColor,
                                };

                            return (
                              <div 
                                key={appt.id} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAppt(appt);
                                }}
                                style={{ 
                                  top: `${top}px`, 
                                  height: `${height}px`,
                                  borderLeftWidth: '3px',
                                  borderLeftColor: cardBorderLeftColor,
                                  ...cardCustomStyle
                                }}
                                className={`absolute left-1 right-1 rounded-r-lg px-2 py-0.5 text-xs overflow-hidden shadow-xs hover:shadow-sm transition-all cursor-pointer border flex flex-col justify-center z-15 ${
                                  isCancelled 
                                    ? 'bg-slate-100/90 dark:bg-slate-800/60 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400' 
                                    : 'text-slate-900 dark:text-slate-100 hover:opacity-95'
                                }`}
                                title={`${patientsMap[appt.patientId] || 'Paciente'} — ${treatmentName}`}
                              >
                                {/* 1. Nombre del paciente y horario en la esquina superior derecha */}
                                <div className="flex items-center justify-between gap-1.5 leading-tight min-w-0">
                                  <p className={`font-bold text-xs truncate leading-tight ${isCancelled ? 'line-through text-red-600 dark:text-red-400' : ''}`}>
                                    {patientsMap[appt.patientId] || 'Paciente'}
                                  </p>
                                  
                                  <div className="flex items-center gap-1 shrink-0">
                                    {isCancelled && (
                                      <span className="flex items-center gap-0.5 text-[8px] bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 font-bold px-1 rounded shrink-0">
                                        <Sparkles className="w-2 h-2" /> Hueco
                                      </span>
                                    )}
                                    <span className={`text-[10px] font-semibold tabular-nums shrink-0 ${
                                      isCancelled ? 'text-red-500/80 dark:text-red-400/80' : 'text-gray-500 dark:text-gray-400'
                                    }`}>
                                      {format(s, 'HH:mm')} - {format(e, 'HH:mm')}
                                    </span>
                                  </div>
                                </div>

                                {/* 2. Tratamiento que le realizan */}
                                <p className={`text-[11px] font-medium truncate leading-tight mt-0.5 ${
                                  isCancelled 
                                    ? 'text-red-700/80 dark:text-red-400/80' 
                                    : 'text-slate-600 dark:text-slate-300 opacity-90'
                                }`}>
                                  {treatmentName}
                                </p>
                              </div>
                            );
                          })
                       }
                     </>
                   )}
                </div>
              </div>
             );
          })}
        </div>

        {/* Acceso flotante rápido para saltar a horas de tarde o volver a mañana */}
        <div className="sticky bottom-4 right-4 ml-auto w-fit z-40 flex items-center gap-2 pointer-events-auto pt-2">
          <button
            type="button"
            onClick={() => scrollToHour(16)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-900 text-white dark:bg-slate-100/90 dark:hover:bg-slate-100 dark:text-slate-900 text-xs font-semibold shadow-xl backdrop-blur-sm transition-all hover:scale-105 active:scale-95 border border-white/20 dark:border-black/20"
            title="Desplazarse a la franja de tarde (16:00 a 21:00)"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600" />
            <span>Ver tarde (16h-21h) ⬇</span>
          </button>
          <button
            type="button"
            onClick={() => scrollToHour(openHour)}
            className="p-1.5 rounded-xl bg-white/95 hover:bg-white text-slate-700 dark:bg-slate-800/95 dark:hover:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-lg backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
            title="Volver a inicio de jornada (09:00)"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Modal Nuevo Formulario de Cita */}
      {isFormOpen && (
        <AppointmentForm 
          onClose={() => setIsFormOpen(false)} 
          onSaved={() => {
            setIsFormOpen(false);
            fetchAppointments();
          }} 
        />
      )}

      {/* Modal Detalle de Cita */}
      {selectedAppt && (
        <AppointmentDetailModal
          appointment={selectedAppt}
          patientName={patientsMap[selectedAppt.patientId] || 'Paciente'}
          professionalName={professionalsMap[selectedAppt.professionalId]?.name}
          roomName={selectedAppt.roomId ? roomsMap[selectedAppt.roomId] : undefined}
          onClose={() => setSelectedAppt(null)}
          onUpdated={() => {
            fetchAppointments();
          }}
          onOpenGapFiller={(appt) => {
            setSelectedAppt(null);
            setGapFillerAppt(appt);
          }}
        />
      )}

      {/* Modal Asistente de Huecos de Última Hora */}
      {gapFillerAppt && user && (
        <GapFillerModal
          appointment={gapFillerAppt}
          clinicId={user.clinicId}
          onClose={() => setGapFillerAppt(null)}
          onAssigned={() => {
            setGapFillerAppt(null);
            fetchAppointments();
          }}
        />
      )}

      {/* Modal Asignación de Hueco Libre */}
      {emptySlotInfo && user && (
        <EmptySlotModal
          slotStart={emptySlotInfo.start}
          slotEnd={emptySlotInfo.end}
          clinicId={user.clinicId}
          onClose={() => setEmptySlotInfo(null)}
          onCreated={() => {
            setEmptySlotInfo(null);
            fetchAppointments();
          }}
        />
      )}

      {/* Modal Radar Semanal de Huecos y Optimización */}
      {isRadarOpen && user && (
        <WeeklyGapRadarModal
          weekStart={startOfWeek(currentDate, { weekStartsOn: 1 })}
          clinicId={user.clinicId}
          onClose={() => setIsRadarOpen(false)}
          onAssigned={() => {
            setIsRadarOpen(false);
            fetchAppointments();
          }}
        />
      )}

      {/* Modal Asistente Inteligente (Llenar semana automáticamente) */}
      {isAutoAssignOpen && user && (
        <AutoAssignModal
          initialWeekStart={startOfWeek(currentDate, { weekStartsOn: 1 })}
          clinicId={user.clinicId}
          onClose={() => setIsAutoAssignOpen(false)}
          onAssigned={() => {
            setIsAutoAssignOpen(false);
            fetchAppointments();
          }}
        />
      )}

      {/* Modal Radar de Reemplazo en Bajas y Vacantes */}
      {isVacanciesRadarOpen && user && (
        <DischargedVacanciesRadarModal
          clinicId={user.clinicId}
          onClose={() => setIsVacanciesRadarOpen(false)}
          onAssigned={() => {
            fetchAppointments();
          }}
        />
      )}

      {/* Modal Auditoría de Ocupación y Eficiencia de Agenda */}
      {isEfficiencyModalOpen && user && (
        <ScheduleEfficiencyModal
          initialWeekStart={startOfWeek(currentDate, { weekStartsOn: 1 })}
          clinicId={user.clinicId}
          onClose={() => setIsEfficiencyModalOpen(false)}
          onOpenAutoAgenda={() => {
            setIsEfficiencyModalOpen(false);
            setIsAutoAssignOpen(true);
          }}
          onOpenVacanciesRadar={() => {
            setIsEfficiencyModalOpen(false);
            setIsVacanciesRadarOpen(true);
          }}
          onOpenWeeklyRadar={() => {
            setIsEfficiencyModalOpen(false);
            setIsRadarOpen(true);
          }}
          onOpenRadar={() => {
            setIsEfficiencyModalOpen(false);
            setIsVacanciesRadarOpen(true);
          }}
        />
      )}

    </div>
  );
};
