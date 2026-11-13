import { useState } from 'react';
import { 
  TrendingUp, 
  Zap, 
  Clock, 
  SlidersHorizontal, 
  ChevronDown, 
  ChevronUp,
  Sparkles
} from 'lucide-react';
import type { ScheduleEfficiencyMetrics } from '../../../application/services/OptimizationService';

interface ScheduleEfficiencyBarProps {
  metrics: ScheduleEfficiencyMetrics | null;
  loading: boolean;
  onOpenAudit: () => void;
}

export const ScheduleEfficiencyBar = ({
  metrics,
  loading,
  onOpenAudit
}: ScheduleEfficiencyBarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  if (loading && !metrics) {
    return (
      <div className="mx-6 mb-4 p-3 bg-gray-50/80 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-800 rounded-xl flex items-center justify-between text-xs text-gray-400 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-gray-300 dark:bg-gray-700 animate-spin" />
          <span>Calculando métricas de ocupación y compactación de la agenda...</span>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="mx-6 mb-3 bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 shadow-xs transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3">
        
        {/* Lado Izquierdo: Métricas Compactas */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
          {/* 1. Ocupación Semanal */}
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-white">
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{metrics.occupancyRate}%</span>
                <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">Ocupación</span>
              </div>
              <div className="w-20 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400 transition-all"
                  style={{ width: `${Math.min(metrics.occupancyRate, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <span className="hidden sm:inline text-slate-200 dark:text-slate-700">|</span>

          {/* 2. Continuidad de Agenda */}
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-white">
                <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{metrics.compactnessScore}%</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
                  {metrics.compactnessLabel}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Continuidad de agenda</span>
            </div>
          </div>

          <span className="hidden md:inline text-slate-200 dark:text-slate-700">|</span>

          {/* 3. Diagnóstico de Huecos Muertos */}
          <div className="hidden md:flex items-center gap-2">
            {metrics.fragmentedGapsCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60">
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                {metrics.fragmentedGapsCount} hueco(s) muerto(s) ({metrics.fragmentedHours}h)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/50">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Citas continuas sin huecos muertos
              </span>
            )}
          </div>
        </div>

        {/* Lado Derecho: Acciones y Detalle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenAudit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium transition-all shadow-xs"
            title="Abrir diagnóstico completo de ocupación y eficiencia de la agenda"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span>Ocupación y Eficiencia</span>
          </button>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
            title={collapsed ? 'Expandir desglose' : 'Ocultar desglose'}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

      </div>

      {/* Desglose Expandible por Profesional */}
      {!collapsed && metrics.professionalMetrics.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {metrics.professionalMetrics.map((prof) => (
            <div 
              key={prof.professionalId}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span 
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: prof.color }}
                />
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                  {prof.name.split(' ')[0]}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 ml-2">
                {prof.occupancyRate}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
