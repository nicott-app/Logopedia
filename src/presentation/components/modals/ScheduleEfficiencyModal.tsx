import { useState, useEffect } from 'react';
import { 
  X, 
  TrendingUp, 
  Zap, 
  CheckCircle2, 
  Clock, 
  Users, 
  Building2, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Layers,
  CalendarPlus,
  UserCheck
} from 'lucide-react';
import { format, addWeeks, subWeeks, startOfWeek, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  OptimizationService, 
  type ScheduleEfficiencyMetrics 
} from '../../../application/services/OptimizationService';

export type KpiCardFilter = 'all' | 'occupancy' | 'continuity' | 'dead_gaps' | 'sessions';

interface ScheduleEfficiencyModalProps {
  initialWeekStart: Date;
  clinicId: string;
  onClose: () => void;
  onOpenAutoAgenda?: () => void;
  onOpenVacanciesRadar?: () => void;
  onOpenWeeklyRadar?: () => void;
  /** @deprecated use onOpenVacanciesRadar or onOpenWeeklyRadar */
  onOpenRadar?: () => void;
}

const optimizationService = new OptimizationService();

export const ScheduleEfficiencyModal = ({
  initialWeekStart,
  clinicId,
  onClose,
  onOpenAutoAgenda,
  onOpenVacanciesRadar,
  onOpenWeeklyRadar,
  onOpenRadar
}: ScheduleEfficiencyModalProps) => {
  const [targetWeek, setTargetWeek] = useState<Date>(
    startOfWeek(initialWeekStart, { weekStartsOn: 1 })
  );
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ScheduleEfficiencyMetrics | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'professionals' | 'rooms'>('overview');
  const [selectedKpi, setSelectedKpi] = useState<KpiCardFilter>('all');

  const handleOpenVacancies = onOpenVacanciesRadar || onOpenRadar;
  const handleOpenWeekly = onOpenWeeklyRadar || onOpenRadar;

  const fetchMetrics = async (weekDate: Date = targetWeek) => {
    setLoading(true);
    try {
      const data = await optimizationService.calculateScheduleEfficiency(clinicId, weekDate);
      setMetrics(data);
    } catch (err) {
      console.error("Error calculating schedule efficiency:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics(targetWeek);
  }, [targetWeek, clinicId]);

  const weekLabel = `${format(targetWeek, "d 'de' MMMM", { locale: es })} - ${format(addDays(targetWeek, 6), "d 'de' MMMM yyyy", { locale: es })}`;

  // Filtrar sugerencias según el KPI seleccionado
  const filteredSuggestions = (metrics?.suggestions || []).filter((sug) => {
    if (selectedKpi === 'all') return true;
    if (selectedKpi === 'occupancy') return sug.type === 'fill_gap' || sug.type === 'balance_load';
    if (selectedKpi === 'continuity') return sug.type === 'compact';
    if (selectedKpi === 'dead_gaps') return sug.type === 'compact';
    if (selectedKpi === 'sessions') return true;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white dark:bg-surface-dark rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Principal */}
        <div className="px-6 py-4 bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-emerald-100/80 dark:border-emerald-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100/80 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 rounded-xl shadow-xs shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/60 px-2 py-0.5 rounded">
                  Control Clínico de Rendimiento
                </span>
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-white/90 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/60">
                  <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Auditoría Continua
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white mt-1">
                Monitor de Ocupación y Eficiencia de la Agenda
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Haz clic en cualquier tarjeta para ver su diagnóstico específico y recomendaciones de optimización.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-emerald-100/60 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Navegación de Semana */}
        <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <Calendar className="w-4 h-4 text-slate-400" />
            <button 
              onClick={() => setTargetWeek(prev => subWeeks(prev, 1))}
              className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors"
              title="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <span className="text-xs font-semibold text-slate-800 dark:text-white capitalize px-1">
              {weekLabel}
            </span>
            <button 
              onClick={() => setTargetWeek(prev => addWeeks(prev, 1))}
              className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors"
              title="Semana siguiente"
            >
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* Pestañas del Modal */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'overview'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Visión General
            </button>
            <button
              onClick={() => setActiveTab('professionals')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'professionals'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>Por Terapeuta ({metrics?.professionalMetrics.length || 0})</span>
            </button>
            <button
              onClick={() => setActiveTab('rooms')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'rooms'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Por Sala ({metrics?.roomMetrics.length || 0})</span>
            </button>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-3 border-slate-400 border-t-transparent rounded-full animate-spin" />
              <h4 className="text-sm font-semibold text-slate-700 dark:text-gray-200">
                Calculando ocupación y métricas de eficiencia...
              </h4>
              <p className="text-xs text-slate-400 max-w-sm text-center">
                Analizando adyacencia de citas, huecos muertos y distribución de carga en el centro.
              </p>
            </div>
          ) : !metrics ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No se han podido calcular los indicadores de la agenda.
            </div>
          ) : (
            <>
              {/* Tarjetas KPI Interactivas de Ocupación y Eficiencia */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  
                  {/* 1. Tasa de Ocupación Global */}
                  <div 
                    onClick={() => setSelectedKpi(prev => prev === 'occupancy' ? 'all' : 'occupancy')}
                    className={`p-4 rounded-xl cursor-pointer transition-all border text-left group relative ${
                      selectedKpi === 'occupancy'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30 shadow-sm'
                        : 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-900/40 hover:border-emerald-400 hover:bg-emerald-50/70'
                    }`}
                    title="Haz clic para ver el diagnóstico de Tasa de Ocupación"
                  >
                    <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-xs font-semibold mb-1">
                      <span>Tasa de Ocupación</span>
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white flex items-baseline gap-1.5">
                      <span>{metrics.occupancyRate}%</span>
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                        ({metrics.occupiedHours}h / {metrics.totalCapacityHours}h)
                      </span>
                    </div>
                    <div className="w-full bg-emerald-100/80 dark:bg-emerald-950/50 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400 transition-all"
                        style={{ width: `${Math.min(metrics.occupancyRate, 100)}%` }} 
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                      <span>{selectedKpi === 'occupancy' ? '● Seleccionado' : 'Ver diagnóstico'}</span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">↓</span>
                    </div>
                  </div>

                  {/* 2. Continuidad de Agenda */}
                  <div 
                    onClick={() => setSelectedKpi(prev => prev === 'continuity' ? 'all' : 'continuity')}
                    className={`p-4 rounded-xl cursor-pointer transition-all border text-left group relative ${
                      selectedKpi === 'continuity'
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/30 shadow-sm'
                        : 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200/70 dark:border-indigo-900/40 hover:border-indigo-400 hover:bg-indigo-50/70'
                    }`}
                    title="Haz clic para ver el diagnóstico de Continuidad de Agenda"
                  >
                    <div className="flex items-center justify-between text-indigo-800 dark:text-indigo-300 text-xs font-semibold mb-1">
                      <span>Continuidad de Agenda</span>
                      <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white flex items-baseline gap-1.5">
                      <span>{metrics.compactnessScore}%</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                        {metrics.compactnessLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">Sesiones contiguas sin cortes</p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-indigo-700 dark:text-indigo-400 font-medium">
                      <span>{selectedKpi === 'continuity' ? '● Seleccionado' : 'Ver diagnóstico'}</span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">↓</span>
                    </div>
                  </div>

                  {/* 3. Huecos Muertos (< 45 min) */}
                  <div 
                    onClick={() => setSelectedKpi(prev => prev === 'dead_gaps' ? 'all' : 'dead_gaps')}
                    className={`p-4 rounded-xl cursor-pointer transition-all border text-left group relative ${
                      selectedKpi === 'dead_gaps'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30 shadow-sm'
                        : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-900/40 hover:border-amber-400 hover:bg-amber-50/70'
                    }`}
                    title="Haz clic para ver el diagnóstico de Huecos Muertos (< 45 min)"
                  >
                    <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 text-xs font-semibold mb-1">
                      <span>Huecos Muertos (&lt;45m)</span>
                      <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white">
                      {metrics.fragmentedGapsCount} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({metrics.fragmentedHours}h)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                      {metrics.fragmentedGapsCount === 0 ? 'Sin tiempo muerto' : 'Intervalos no aprovechables'}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                      <span>{selectedKpi === 'dead_gaps' ? '● Seleccionado' : 'Ver diagnóstico'}</span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">↓</span>
                    </div>
                  </div>

                  {/* 4. Total de Citas Agendadas */}
                  <div 
                    onClick={() => setSelectedKpi(prev => prev === 'sessions' ? 'all' : 'sessions')}
                    className={`p-4 rounded-xl cursor-pointer transition-all border text-left group relative ${
                      selectedKpi === 'sessions'
                        ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 ring-2 ring-sky-500/30 shadow-sm'
                        : 'bg-sky-50/40 dark:bg-sky-950/20 border-sky-200/70 dark:border-sky-900/40 hover:border-sky-400 hover:bg-sky-50/70'
                    }`}
                    title="Haz clic para ver el diagnóstico de Sesiones Activas"
                  >
                    <div className="flex items-center justify-between text-sky-800 dark:text-sky-300 text-xs font-semibold mb-1">
                      <span>Sesiones Activas</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white">
                      {metrics.totalAppointments} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">citas</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                      {metrics.usableGapsCount} bloques libres útiles ({metrics.usableGapHours}h)
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-sky-700 dark:text-sky-400 font-medium">
                      <span>{selectedKpi === 'sessions' ? '● Seleccionado' : 'Ver diagnóstico'}</span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">↓</span>
                    </div>
                  </div>

                </div>

                {/* Barra de Filtro de Indicador Rápido */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span>Filtrando diagnóstico:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {selectedKpi === 'all' && 'Vista Global (Todos los indicadores)'}
                      {selectedKpi === 'occupancy' && 'Tasa de Ocupación'}
                      {selectedKpi === 'continuity' && 'Continuidad de Agenda'}
                      {selectedKpi === 'dead_gaps' && 'Huecos Muertos (< 45 min)'}
                      {selectedKpi === 'sessions' && 'Sesiones Activas y Capacidad'}
                    </span>
                  </div>
                  {selectedKpi !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setSelectedKpi('all')}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      Restablecer y ver todo
                    </button>
                  )}
                </div>
              </div>

              {/* Pestaña 1: Visión General, Diagnóstico Específico y Sugerencias */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  
                  {/* DIAGNÓSTICO ESPECÍFICO DINÁMICO */}
                  
                  {/* 1. Diagnóstico para TASA DE OCUPACIÓN */}
                  {(selectedKpi === 'occupancy' || selectedKpi === 'all') && (
                    <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          Diagnóstico de Tasa de Ocupación y Capacidad Semanal
                        </h4>
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/60 px-2 py-0.5 rounded">
                          {metrics.occupancyRate}% Ocupación
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {metrics.occupancyRate >= 85 ? (
                          <span>
                            La clínica se encuentra en un <strong>nivel de ocupación óptimo ({metrics.occupancyRate}%)</strong>. Hay <strong>{metrics.occupiedHours} horas de terapia</strong> programadas de un aforo total de {metrics.totalCapacityHours} horas. Para seguir admitiendo nuevos pacientes se sugiere priorizar casos preferentes o ampliar turnos.
                          </span>
                        ) : metrics.occupancyRate >= 60 ? (
                          <span>
                            La ocupación de la semana es <strong>saludable ({metrics.occupancyRate}%)</strong> con margen de ampliación. Tienes <strong>{metrics.usableGapHours} horas libres en bloques útiles (&gt;45 min)</strong> listas para asignar a pacientes en lista de espera sin saturar al equipo.
                          </span>
                        ) : (
                          <span>
                            La ocupación se sitúa en <strong>{metrics.occupancyRate}%</strong>, con <strong>{metrics.usableGapHours} horas libres aprovechables</strong> distribuidas entre los profesionales. Utiliza el asistente para <em>Llenar semana automáticamente</em> y completar la agenda de manera balanceada.
                          </span>
                        )}
                      </p>
                      <div className="pt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400 border-t border-emerald-200/50 dark:border-emerald-900/30">
                        <span>Horas ocupadas: <strong className="text-slate-800 dark:text-slate-200">{metrics.occupiedHours}h</strong></span>
                        <span>•</span>
                        <span>Horas libres útiles: <strong className="text-slate-800 dark:text-slate-200">{metrics.usableGapHours}h</strong></span>
                        <span>•</span>
                        <span>Capacidad total del centro: <strong className="text-slate-800 dark:text-slate-200">{metrics.totalCapacityHours}h</strong></span>
                      </div>
                    </div>
                  )}

                  {/* 2. Diagnóstico para CONTINUIDAD DE AGENDA */}
                  {(selectedKpi === 'continuity' || (selectedKpi === 'all' && metrics.compactnessScore < 85)) && (
                    <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          Diagnóstico de Continuidad de Agenda
                        </h4>
                        <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/80 dark:bg-indigo-900/60 px-2 py-0.5 rounded">
                          {metrics.compactnessScore}% · {metrics.compactnessLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {metrics.compactnessScore >= 85 ? (
                          <span>
                            La agenda presenta una <strong>continuidad excelente ({metrics.compactnessScore}%)</strong>. Las citas de los terapeutas están agrupadas en bloques contiguos al inicio o cierre de sus turnos, lo que evita esperas intermedias y garantiza un flujo de trabajo cómodo.
                          </span>
                        ) : metrics.compactnessScore >= 70 ? (
                          <span>
                            La continuidad general es <strong>buena ({metrics.compactnessScore}%)</strong>, aunque existen algunas sesiones dispersas que generan pequeñas pausas intermedias. Agrupar las citas al principio de cada turno consolidará la disponibilidad para nuevas terapias.
                          </span>
                        ) : (
                          <span>
                            La continuidad es <strong>mejorable ({metrics.compactnessScore}%)</strong>. Las citas se encuentran dispersas a lo largo de las jornadas laborales. Reorganizar las citas para situarlas contiguas liberará bloques enteros de mañana o tarde.
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* 3. Diagnóstico para HUECOS MUERTOS (< 45 min) */}
                  {(selectedKpi === 'dead_gaps' || (selectedKpi === 'all' && metrics.fragmentedGapsCount > 0)) && (
                    <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200/80 dark:border-amber-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          Diagnóstico de Huecos Muertos (&lt; 45 min)
                        </h4>
                        <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/60 px-2 py-0.5 rounded">
                          {metrics.fragmentedGapsCount} detectados ({metrics.fragmentedHours}h)
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {metrics.fragmentedGapsCount > 0 ? (
                          <span>
                            Se han detectado <strong>{metrics.fragmentedGapsCount} huecos muertos de 15 a 30 minutos</strong> ({metrics.fragmentedHours} horas acumuladas). Al ser inferiores a la duración clínica mínima de una sesión (45-60 min), ningún paciente puede ser agendado en ellos, provocando tiempos de espera vacíos para los terapeutas. Se recomienda reordenar las sesiones para fusionar estos huecos en franjas completas.
                          </span>
                        ) : (
                          <span>
                            <strong>¡Agenda limpia de huecos muertos!</strong> No se ha encontrado ningún intervalo fragmentado de 15 o 30 minutos esta semana. Toda la capacidad no reservada está disponible en bloques enteros de 45 minutos o más.
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* 4. Diagnóstico para SESIONES ACTIVAS */}
                  {selectedKpi === 'sessions' && (
                    <div className="p-4 bg-sky-50/60 dark:bg-sky-950/20 rounded-xl border border-sky-200/80 dark:border-sky-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-sky-800 dark:text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                          Diagnóstico de Sesiones Activas y Capacidad de Admisión
                        </h4>
                        <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300 bg-sky-100/80 dark:bg-sky-900/60 px-2 py-0.5 rounded">
                          {metrics.totalAppointments} Sesiones
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        El centro tiene <strong>{metrics.totalAppointments} citas agendadas</strong> para esta semana. Además, dispone de <strong>{metrics.usableGapsCount} bloques útiles ({metrics.usableGapHours}h)</strong> de 45 minutos o más disponibles para admitir nuevos tratamientos o evaluaciones de lista de espera sin generar solapamientos.
                      </p>
                    </div>
                  )}

                  {/* RECOMENDACIONES INTELIGENTES FILTRADAS */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          Recomendaciones {selectedKpi === 'all' ? 'de Optimización' : `para ${selectedKpi === 'occupancy' ? 'Tasa de Ocupación' : selectedKpi === 'continuity' ? 'Continuidad de Agenda' : selectedKpi === 'dead_gaps' ? 'Huecos Muertos' : 'Sesiones Activas'}`}:
                        </span>
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        {filteredSuggestions.length} sugerencia(s)
                      </span>
                    </div>

                    {filteredSuggestions.length === 0 ? (
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span>
                            {selectedKpi === 'continuity' && 'La continuidad de sesiones es óptima, no hay recomendaciones de reagrupación.'}
                            {selectedKpi === 'dead_gaps' && 'No hay huecos muertos que requieran compactación en la agenda.'}
                            {selectedKpi === 'occupancy' && 'La ocupación y distribución de trabajo entre los terapeutas es equilibrada.'}
                            {selectedKpi === 'sessions' && 'La agenda semanal se encuentra perfectamente nivelada y sin puntos críticos.'}
                            {selectedKpi === 'all' && 'La agenda semanal se encuentra nivelada y sin puntos críticos detectados.'}
                          </span>
                        </div>
                        {onOpenAutoAgenda && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenAutoAgenda();
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shrink-0 shadow-xs"
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                            <span>Llenar semana</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredSuggestions.map((sug) => (
                          <div
                            key={sug.id}
                            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark flex flex-col gap-3 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                          >
                            {/* Información de la recomendación a lo largo de toda la ventana */}
                            <div className="space-y-1.5 w-full">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                                  sug.type === 'compact'
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                                    : sug.type === 'fill_gap'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                }`}>
                                  {sug.type === 'compact' ? 'Continuidad' : sug.type === 'fill_gap' ? 'Ocupación' : 'Equilibrio'}
                                </span>
                                <h5 className="text-sm font-bold text-slate-800 dark:text-white">
                                  {sug.title}
                                </h5>
                              </div>

                              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                {sug.description}
                              </p>

                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                <strong className="font-semibold text-slate-700 dark:text-slate-300">Impacto estimado:</strong> {sug.impact}
                              </p>
                            </div>

                            {/* Botones de acción debajo */}
                            <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                              {onOpenAutoAgenda && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onOpenAutoAgenda();
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors shadow-2xs"
                                  title="Abrir asistente para llenar la semana automáticamente"
                                >
                                  <CalendarPlus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                  <span>Llenar semana automáticamente</span>
                                  <ArrowRight className="w-3 h-3 text-indigo-400" />
                                </button>
                              )}
                              {handleOpenVacancies && sug.type === 'fill_gap' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    handleOpenVacancies();
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors shadow-2xs"
                                  title="Cubrir cancelaciones y bajas con lista de espera"
                                >
                                  <UserCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                  <span>Cubrir cancelaciones y bajas</span>
                                  <ArrowRight className="w-3 h-3 text-amber-500" />
                                </button>
                              )}
                              {handleOpenWeekly && (sug.type === 'fill_gap' || sug.type === 'balance_load') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    handleOpenWeekly();
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs"
                                  title="Abrir radar semanal de huecos disponibles"
                                >
                                  <span>Radar semanal de huecos</span>
                                  <ArrowRight className="w-3 h-3 text-slate-400" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pestaña 2: Rendimiento por Terapeuta */}
              {activeTab === 'professionals' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {metrics.professionalMetrics.map((prof) => (
                      <div
                        key={prof.professionalId}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark shadow-xs space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span 
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: prof.color }}
                            />
                            <h5 className="text-sm font-semibold text-slate-800 dark:text-white">
                              {prof.name}
                            </h5>
                          </div>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {prof.occupancyRate}% Ocupación
                          </span>
                        </div>

                        {/* Barra de progreso de ocupación */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>Horas trabajadas:</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {prof.occupiedHours}h de {prof.totalHours}h
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-slate-700 dark:bg-slate-300 transition-all"
                              style={{ 
                                width: `${Math.min(prof.occupancyRate, 100)}%`
                              }}
                            />
                          </div>
                        </div>

                        {/* Métricas secundarias */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Continuidad de agenda:</span>
                            <span className="font-semibold text-slate-800 dark:text-white">
                              {prof.compactnessScore}%
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Citas esta semana:</span>
                            <span className="font-semibold text-slate-800 dark:text-white">
                              {prof.appointmentsCount} citas
                            </span>
                          </div>
                        </div>

                        {prof.fragmentedGapsCount > 0 ? (
                          <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>{prof.fragmentedGapsCount} hueco(s) muerto(s) (&lt;45m) detectados</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Sin huecos muertos en su jornada</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pestaña 3: Aprovechamiento de Salas */}
              {activeTab === 'rooms' && (
                <div className="space-y-3">
                  {metrics.roomMetrics.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      No hay salas físicas configuradas en la clínica.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {metrics.roomMetrics.map((room) => (
                        <div
                          key={room.roomId}
                          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark shadow-xs space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              <h5 className="text-sm font-semibold text-slate-800 dark:text-white">
                                {room.name}
                              </h5>
                            </div>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {room.occupancyRate}% Uso
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-slate-500">
                              <span>Horas ocupada:</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {room.occupiedHours}h / {room.totalHours}h
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-slate-700 dark:bg-slate-300 h-full rounded-full transition-all"
                                style={{ width: `${Math.min(room.occupancyRate, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 bg-gray-50/80 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Los indicadores se actualizan en tiempo real conforme se agendan o liberan citas.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
