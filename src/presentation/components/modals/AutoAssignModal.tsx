import { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  CheckCircle2, 
  TrendingUp, 
  Calendar, 
  AlertCircle, 
  Wand2, 
  CheckSquare, 
  Square, 
  Clock, 
  BookOpen, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { format, addWeeks, subWeeks, startOfWeek, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  OptimizationService, 
  type AutoAssignResult, 
  type AutoAssignOptions
} from '../../../application/services/OptimizationService';

interface AutoAssignModalProps {
  initialWeekStart: Date;
  clinicId: string;
  onClose: () => void;
  onAssigned: () => void;
}

const optimizationService = new OptimizationService();

/**
 * Extrae el motivo humano principal más relevante, eliminando ruido técnico del algoritmo
 */
function getPrimaryReason(reasons: string[]) {
  const exact = reasons.find(r => r.toLowerCase().includes('exacto') || r.toLowerCase().includes('solicitado'));
  if (exact) return exact;

  const threshold = reasons.find(r => r.toLowerCase().includes('a partir de'));
  if (threshold) return threshold;

  const day = reasons.find(r => r.toLowerCase().includes('día preferido'));
  const shift = reasons.find(r => r.toLowerCase().includes('turno preferido'));
  if (day && shift) return `${day} · ${shift}`;
  if (day) return day;
  if (shift) return shift;

  const therapist = reasons.find(r => r.toLowerCase().includes('terapeuta habitual'));
  if (therapist) return therapist;

  const contig = reasons.find(r => r.toLowerCase().includes('contiguo') || r.toLowerCase().includes('apertura'));
  if (contig) return 'Sesión continua (sin hueco muerto)';

  return reasons[0] || 'Horario óptimo disponible';
}

export const AutoAssignModal = ({
  initialWeekStart,
  clinicId,
  onClose,
  onAssigned
}: AutoAssignModalProps) => {
  const [targetWeek, setTargetWeek] = useState<Date>(
    startOfWeek(initialWeekStart, { weekStartsOn: 1 })
  );

  // Opciones de configuración del algoritmo
  const [patientPool, setPatientPool] = useState<'all' | 'waiting_only' | 'unassigned_active'>('all');
  const [strategy, setStrategy] = useState<'tetris' | 'balanced'>('tetris');
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [strictTherapistMatch, setStrictTherapistMatch] = useState<boolean>(false);

  // Estados del asistente
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AutoAssignResult | null>(null);
  const [activeTab, setActiveTab] = useState<'proposals' | 'unplaced'>('proposals');
  const [groupBy, setGroupBy] = useState<'day' | 'professional'>('day');
  const [committing, setCommitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Ejecuta la simulación inteligente de asignación
  const runSimulation = async (weekDate: Date = targetWeek) => {
    setLoading(true);
    setSuccessMessage(null);
    try {
      const options: AutoAssignOptions = {
        weekStart: weekDate,
        patientPool,
        strategy,
        defaultDurationMinutes: durationMinutes,
        preserveExisting: true,
        strictTherapistMatch
      };

      const res = await optimizationService.generateInitialScheduleProposal(clinicId, options);
      setResult(res);
      if (res.proposals.length === 0 && res.unplaced.length > 0) {
        setActiveTab('unplaced');
      } else {
        setActiveTab('proposals');
      }
    } catch (err) {
      console.error("Error running auto-assign proposal:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSimulation(targetWeek);
  }, [targetWeek]);

  // Manejo de selección individual y masiva de propuestas
  const handleToggleProposal = (id: string) => {
    if (!result) return;
    const updatedProposals = result.proposals.map(p => 
      p.id === id ? { ...p, selected: !p.selected } : p
    );
    setResult({
      ...result,
      proposals: updatedProposals
    });
  };

  const handleSelectAll = (select: boolean) => {
    if (!result) return;
    const updatedProposals = result.proposals.map(p => ({ ...p, selected: select }));
    setResult({
      ...result,
      proposals: updatedProposals
    });
  };

  const selectedCount = result?.proposals.filter(p => p.selected).length || 0;

  // Confirmar y aplicar en el calendario real
  const handleCommit = async () => {
    if (!result || selectedCount === 0) return;
    setCommitting(true);
    try {
      const count = await optimizationService.commitAutoAssignProposal(clinicId, result.proposals);
      setSuccessMessage(`¡Se han programado ${count} citas con éxito en la agenda maestra!`);
      setTimeout(() => {
        onAssigned();
      }, 1400);
    } catch (err) {
      console.error("Error committing proposals:", err);
    } finally {
      setCommitting(false);
    }
  };

  const weekLabel = `${format(targetWeek, "d 'de' MMMM", { locale: es })} - ${format(addDays(targetWeek, 6), "d 'de' MMMM yyyy", { locale: es })}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white dark:bg-surface-dark rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Header Principal */}
        <div className="px-6 py-4 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100/80 dark:border-indigo-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100/80 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 rounded-xl shadow-xs shrink-0">
              <Wand2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 bg-indigo-100/80 dark:bg-indigo-900/60 px-2 py-0.5 rounded">
                  Asistente Inteligente
                </span>
                <span className="flex items-center gap-1 text-[11px] text-indigo-700 dark:text-indigo-300 bg-white/90 dark:bg-slate-800/80 px-2 py-0.5 rounded font-medium border border-indigo-200/60 dark:border-indigo-800/60">
                  <ShieldCheck className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> Citas existentes protegidas
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white mt-1">
                Llenar semana automáticamente
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Optimiza y cruza pacientes pendientes, terapeutas y salas sin solapamientos.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-indigo-100/60 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Panel de Controles y Filtros de Optimización */}
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Navegación de semana objetivo */}
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

            {/* Selector de Bolsa de Pacientes */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Candidatos:</span>
              <select
                value={patientPool}
                onChange={(e) => setPatientPool(e.target.value as any)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-700 dark:text-gray-200 font-medium outline-none focus:ring-1 focus:ring-slate-400 shadow-xs"
              >
                <option value="all">Todos los pendientes (Espera + Activos)</option>
                <option value="waiting_only">Solo Lista de Espera</option>
                <option value="unassigned_active">Solo Pacientes Activos sin cita</option>
              </select>
            </div>

            {/* Estrategia de Asignación */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Estrategia:</span>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as any)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-700 dark:text-gray-200 font-medium outline-none focus:ring-1 focus:ring-slate-400 shadow-xs"
              >
                <option value="tetris">Agenda Continua (Sin huecos)</option>
                <option value="balanced">Reparto Equitativo del Equipo</option>
              </select>
            </div>

            {/* Duración predeterminada */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Duración:</span>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-700 dark:text-gray-200 font-medium outline-none focus:ring-1 focus:ring-slate-400 shadow-xs"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min (Estándar)</option>
                <option value={60}>60 min</option>
              </select>
            </div>

            {/* Botón Recalcular */}
            <button
              onClick={() => runSimulation(targetWeek)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{loading ? 'Calculando...' : 'Recalcular'}</span>
            </button>
          </div>

          {/* Opciones avanzadas */}
          <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-300 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={strictTherapistMatch} 
                onChange={(e) => setStrictTherapistMatch(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
              />
              <span>Exigir terapeuta asignado estrictamente (sin fallback a misma especialidad)</span>
            </label>
          </div>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {successMessage ? (
            <div className="py-16 text-center space-y-3">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
              <h4 className="text-xl font-bold text-slate-800 dark:text-white">{successMessage}</h4>
              <p className="text-sm text-gray-500">Actualizando el calendario clínico en tiempo real...</p>
            </div>
          ) : loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <h4 className="text-base font-bold text-slate-700 dark:text-gray-200">
                Calculando propuesta óptima con restricciones...
              </h4>
              <p className="text-xs text-gray-500 max-w-md text-center">
                Analizando disponibilidades de pacientes (días y turnos), turnos de terapeutas, descansos y salas libres sin modificar las citas ya existentes.
              </p>
            </div>
          ) : !result ? (
            <div className="py-16 text-center text-gray-400">
              No se han obtenido resultados de la simulación.
            </div>
          ) : (
            <>
              {/* Tarjetas de Métricas de la Simulación */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 1. Asignaciones Conseguidas */}
                <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/40 rounded-xl">
                  <div className="flex items-center justify-between text-indigo-800 dark:text-indigo-300 text-xs font-semibold mb-1">
                    <span>Citas Asignadas</span>
                    <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-white">
                    {result.stats.placedCount} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ {result.stats.totalCandidates}</span>
                  </div>
                  <div className="w-full bg-indigo-100/80 dark:bg-indigo-950/50 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="bg-indigo-600 dark:bg-indigo-400 h-full rounded-full transition-all" 
                      style={{ 
                        width: `${result.stats.totalCandidates > 0 ? (result.stats.placedCount / result.stats.totalCandidates) * 100 : 0}%` 
                      }} 
                    />
                  </div>
                </div>

                {/* 2. Afinidad Media */}
                <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 rounded-xl">
                  <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-xs font-semibold mb-1">
                    <span>Afinidad Media</span>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-white">
                    {result.stats.averageScore}%
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Coincidencia horaria y terapeuta</p>
                </div>

                {/* 3. Horas Ganadas y Ocupación */}
                <div className="p-4 bg-sky-50/40 dark:bg-sky-950/20 border border-sky-200/70 dark:border-sky-900/40 rounded-xl">
                  <div className="flex items-center justify-between text-sky-800 dark:text-sky-300 text-xs font-semibold mb-1">
                    <span>Ocupación Semanal</span>
                    <TrendingUp className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-white flex items-baseline gap-1.5">
                    <span>{result.stats.newOccupancyRate}%</span>
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                      (+{result.stats.occupancyGainHours}h)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Previo: {result.stats.previousOccupancyRate}% ({result.stats.previousOccupiedHours}h)
                  </p>
                </div>

                {/* 4. Pacientes no asignados */}
                <div className="p-4 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 rounded-xl">
                  <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 text-xs font-semibold mb-1">
                    <span>Sin Hueco Óptimo</span>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-white">
                    {result.stats.unplacedCount}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {result.stats.unplacedCount === 0 ? '100% de pacientes ubicados' : 'Requieren ampliar franjas'}
                  </p>
                </div>
              </div>

              {/* Pestañas: Citas Propuestas vs Sin Hueco */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('proposals')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'proposals'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Propuestas Generadas ({result.proposals.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('unplaced')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'unplaced'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>No Asignables ({result.unplaced.length})</span>
                  </button>
                </div>

                {/* Acciones de la pestaña de propuestas */}
                {activeTab === 'proposals' && result.proposals.length > 0 && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleSelectAll(selectedCount !== result.proposals.length)}
                      className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline flex items-center gap-1"
                    >
                      {selectedCount === result.proposals.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <span>Agrupar por:</span>
                      <button
                        onClick={() => setGroupBy('day')}
                        className={`px-2 py-0.5 rounded font-medium ${groupBy === 'day' ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      >
                        Día
                      </button>
                      <button
                        onClick={() => setGroupBy('professional')}
                        className={`px-2 py-0.5 rounded font-medium ${groupBy === 'professional' ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      >
                        Terapeuta
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Contenido Pestaña 1: Citas Propuestas */}
              {activeTab === 'proposals' && (
                <div className="space-y-4">
                  {result.proposals.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <Calendar className="w-12 h-12 text-gray-300 mx-auto" />
                      <h4 className="text-base font-bold text-slate-700 dark:text-gray-200">
                        No se han generado propuestas para esta semana
                      </h4>
                      <p className="text-xs text-gray-500 max-w-sm mx-auto">
                        Los pacientes seleccionados ya tienen citas asignadas o sus restricciones no coinciden con los horarios de los terapeutas.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {Object.entries(
                        result.proposals.reduce((groups, item) => {
                          const key = groupBy === 'day'
                            ? format(new Date(item.start), "EEEE d 'de' MMMM", { locale: es })
                            : `${item.professional.name} ${item.professional.surname || ''}`.trim();
                          if (!groups[key]) groups[key] = [];
                          groups[key].push(item);
                          return groups;
                        }, {} as Record<string, typeof result.proposals>)
                      ).map(([groupTitle, items]) => (
                        <div key={groupTitle} className="space-y-2.5">
                          <div className="flex items-center justify-between px-1">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 capitalize flex items-center gap-1.5">
                              {groupBy === 'day' ? <Calendar className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                              <span>{groupTitle}</span>
                              <span className="text-[11px] font-normal text-gray-400">({items.length} {items.length === 1 ? 'cita' : 'citas'})</span>
                            </h4>
                          </div>

                          <div className="space-y-2.5">
                            {items.map((item) => {
                              const start = new Date(item.start);
                              const end = new Date(item.end);
                              const timeStr = `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;

                              const primaryReason = getPrimaryReason(item.reasons);
                              const extraReasonsCount = item.reasons.length - 1;

                              return (
                                <div 
                                  key={item.id}
                                  className={`p-3 sm:p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 ${
                                    item.selected
                                      ? 'bg-white dark:bg-surface-dark border-indigo-200 dark:border-indigo-900/60 shadow-xs'
                                      : 'bg-gray-50/60 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 opacity-60'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {/* Checkbox de selección individual */}
                                    <button
                                      type="button"
                                      onClick={() => handleToggleProposal(item.id)}
                                      className="text-indigo-600 hover:text-indigo-700 transition-colors shrink-0"
                                    >
                                      {item.selected ? (
                                        <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                      ) : (
                                        <Square className="w-5 h-5 text-gray-400" />
                                      )}
                                    </button>

                                    <div className="space-y-1 flex-1 min-w-0">
                                      {/* Línea 1: Paciente + Terapeuta y Sala */}
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                          {item.patient.name} {item.patient.surname || ''}
                                        </h4>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                          item.patient.status === 'waiting'
                                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/60'
                                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60'
                                        }`}>
                                          {item.patient.status === 'waiting' ? 'Lista de Espera' : 'Activo'}
                                        </span>
                                        <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                                        <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5 truncate">
                                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.professional.color || '#3B82F6' }} />
                                          <span className="font-medium truncate">{item.professional.name}</span>
                                          {item.room && <span className="text-slate-400 text-[11px] truncate">({item.room.name.split(' — ')[0]})</span>}
                                        </span>
                                      </div>

                                      {/* Línea 2: Horario + 1 Motivo Humano Conciso */}
                                      <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800/60">
                                          <Clock className="w-3 h-3 text-indigo-500" />
                                          {groupBy !== 'day' && <span className="capitalize">{format(start, 'EEE d', { locale: es })} · </span>}
                                          {timeStr} ({item.durationMinutes}m)
                                        </span>

                                        {/* Motivo conciso sin ruido técnico */}
                                        <span 
                                          className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40 truncate"
                                          title={item.reasons.join(' · ')}
                                        >
                                          <Sparkles className="w-3 h-3 text-emerald-500 shrink-0" />
                                          {primaryReason}
                                        </span>

                                        {extraReasonsCount > 0 && (
                                          <span 
                                            className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 cursor-help hidden sm:inline"
                                            title={item.reasons.join('\n')}
                                          >
                                            +{extraReasonsCount} {extraReasonsCount === 1 ? 'factor' : 'factores'}
                                          </span>
                                        )}

                                        <span className="text-[10px] text-slate-400 ml-auto hidden md:inline">
                                          Afinidad: {item.score}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Contenido Pestaña 2: Pacientes no asignables */}
              {activeTab === 'unplaced' && (
                <div className="space-y-4">
                  {result.unplaced.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                      <h4 className="text-base font-bold text-slate-800 dark:text-white">
                        ¡Excelente encaje! No hay pacientes pendientes sin ubicar
                      </h4>
                      <p className="text-xs text-gray-500 max-w-sm mx-auto">
                        Todos los pacientes de la selección disponen de un hueco asignado en la propuesta.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                        <div>
                          <strong>¿Por qué no se han podido ubicar estos pacientes?</strong>
                          <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                            El algoritmo evalúa estrictamente las restricciones para no generar solapamientos. Puedes abrir la ficha de cualquiera de ellos para flexibilizar sus días u horarios preferidos.
                          </p>
                        </div>
                      </div>

                      {result.unplaced.map((un, idx) => (
                        <div 
                          key={idx}
                          className="p-4 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                                {un.patient.name} {un.patient.surname || ''}
                              </h4>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                {un.patient.status === 'waiting' ? 'Lista de Espera' : 'Activo'}
                              </span>
                              <a
                                href={`/dashboard/patients/${un.patient.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:underline text-xs flex items-center gap-1 font-semibold ml-1"
                              >
                                <BookOpen className="w-3.5 h-3.5" /> Abrir ficha
                              </a>
                            </div>

                            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                              {un.reason}
                            </p>

                            {un.patient.availability && (
                              <p className="text-[11px] text-gray-500">
                                Disponibilidad indicada: {un.patient.availability.preferredDays?.length ? `Días ${un.patient.availability.preferredDays.join(', ')}` : 'Cualquier día'} · Franja: {un.patient.availability.timePreference || 'Cualquiera'}
                              </p>
                            )}
                          </div>

                          <div className="shrink-0">
                            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              {un.missingRequirement === 'therapist_schedule' ? 'Agenda Terapeuta Llena' :
                               un.missingRequirement === 'patient_preference' ? 'Restricción de Días/Turno' :
                               un.missingRequirement === 'room_capacity' ? 'Capacidad de Salas' : 'Sin Hueco Compatible'}
                            </span>
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

        {/* Footer y Acciones de Confirmación */}
        <div className="p-4 sm:px-6 bg-gray-50/80 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            {result && result.proposals.length > 0 && (
              <span>
                <strong className="text-slate-800 dark:text-white font-bold">{selectedCount}</strong> de {result.proposals.length} citas seleccionadas para agendar
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={selectedCount === 0 || committing}
              onClick={handleCommit}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {committing 
                  ? 'Confirmando citas...' 
                  : `Confirmar y Asignar (${selectedCount})`}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
