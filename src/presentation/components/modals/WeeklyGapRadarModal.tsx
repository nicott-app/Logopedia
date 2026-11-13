import { useState, useEffect } from 'react';
import { X, Sparkles, MessageSquare, UserCheck, BookOpen, Info, CheckCircle2, TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import type { Appointment } from '../../../domain/models/types';
import { 
  OptimizationService, 
  type WeeklyAgendaAnalysis, 
  type WeeklyGapOpportunity 
} from '../../../application/services/OptimizationService';
import { AppointmentRepository } from '../../../infrastructure/firebase/AppointmentRepository';

interface WeeklyGapRadarModalProps {
  weekStart: Date;
  clinicId: string;
  onClose: () => void;
  onAssigned: () => void;
}

const optimizationService = new OptimizationService();
const appointmentRepo = new AppointmentRepository();

export const WeeklyGapRadarModal = ({ weekStart, clinicId, onClose, onAssigned }: WeeklyGapRadarModalProps) => {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<WeeklyAgendaAnalysis | null>(null);
  const [expandedInfoIds, setExpandedInfoIds] = useState<Record<string, boolean>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await optimizationService.analyzeWeeklyAgenda(weekStart, clinicId);
        setAnalysis(res);
      } catch (err) {
        console.error("Error analyzing weekly agenda:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [weekStart, clinicId]);

  const toggleInfo = (id: string) => {
    setExpandedInfoIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleAssignOpportunity = async (opp: WeeklyGapOpportunity) => {
    const cand = opp.bestCandidate;
    setAssigningId(`${cand.patient.id}-${opp.slotStart.getTime()}`);
    try {
      const newAppt: Appointment = {
        id: crypto.randomUUID ? crypto.randomUUID() : `appt-${Date.now()}`,
        clinicId,
        patientId: cand.patient.id,
        professionalId: cand.recommendedProfessional?.id || '',
        roomId: cand.recommendedRoomId || null,
        start: opp.slotStart.toISOString(),
        end: opp.slotEnd.toISOString(),
        status: 'scheduled',
        notes: `Cita asignada desde el Radar Semanal (${cand.reason})`
      };

      await appointmentRepo.saveAppointment(newAppt);

      setSuccessMsg(`¡Cita confirmada para ${cand.patient.name} el ${opp.dayLabel} a las ${opp.timeLabel}!`);
      setTimeout(() => {
        onAssigned();
      }, 1200);
    } catch (err) {
      console.error("Error assigning weekly opportunity:", err);
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white dark:bg-surface-dark rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50/90 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs shrink-0">
              <Sparkles className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800 px-2 py-0.5 rounded">
                  Optimización Inteligente
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white mt-1">
                Radar Semanal de Huecos y Optimización
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detección inteligente de huecos de agenda y asignación de lista de espera
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {successMsg ? (
            <div className="py-12 text-center space-y-3">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
              <h4 className="text-xl font-bold text-slate-800 dark:text-white">{successMsg}</h4>
              <p className="text-sm text-gray-500">Actualizando el calendario clínico en tiempo real...</p>
            </div>
          ) : loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <div className="w-9 h-9 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500 font-medium">Analizando huecos semanales y casuísticas de pacientes...</p>
            </div>
          ) : !analysis || analysis.opportunities.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto" />
              <h4 className="text-base font-bold text-slate-700 dark:text-gray-200">No se detectaron huecos pendientes con afinidad directa</h4>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                La agenda de esta semana tiene una excelente ocupación o los pacientes en lista de espera ya tienen sus citas asignadas.
              </p>
            </div>
          ) : (
            <>
              {/* Tarjetas de Métricas de Ocupación */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl">
                  <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-1">
                    <span>Ocupación de Agenda</span>
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-black text-slate-800 dark:text-white">
                    {analysis.occupancyRate}%
                  </div>
                  <div className="w-full bg-indigo-200 dark:bg-indigo-900 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full transition-all" style={{ width: `${Math.min(analysis.occupancyRate, 100)}%` }} />
                  </div>
                </div>

                <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-xl">
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 text-xs font-semibold mb-1">
                    <span>Citas Agendadas</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-black text-slate-800 dark:text-white">
                    {analysis.occupiedHours} sesiones
                  </div>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">Activas esta semana</p>
                </div>

                <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 rounded-xl">
                  <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 text-xs font-semibold mb-1">
                    <span>Oportunidades de Cubrir</span>
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-black text-slate-800 dark:text-white">
                    {analysis.opportunities.length} huecos
                  </div>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Con pacientes en lista de espera</p>
                </div>
              </div>

              {/* Lista de Huecos y Recomendaciones */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Mejores Oportunidades de Asignación Inmediata:
                  </span>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                    Ordenadas por afinidad
                  </span>
                </div>

                <div className="space-y-3">
                  {analysis.opportunities.map((opp, idx) => {
                    const cand = opp.bestCandidate;
                    const p = cand.patient;
                    const uniqueKey = `${p.id}-${opp.slotStart.getTime()}`;
                    const isInfoOpen = !!expandedInfoIds[uniqueKey];
                    const isAssigning = assigningId === uniqueKey;

                    return (
                      <div 
                        key={uniqueKey}
                        className={`relative p-4 rounded-xl border transition-all ${
                          idx === 0
                            ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-sm'
                            : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-dark hover:border-gray-300'
                        }`}
                      >
                        {/* Esquina superior derecha: Icono de Historial/Ficha y botón + info */}
                        <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 z-10">
                          {/* Botón Ver Ficha / Historial */}
                          <a
                            href={`/dashboard/patients/${p.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-surface-dark/95 text-gray-600 dark:text-gray-300 hover:text-primary hover:border-primary transition-all shadow-xs"
                            title="Abrir historial clínico y ficha del paciente"
                          >
                            <BookOpen className="w-4 h-4" />
                          </a>

                          {/* Botón + info */}
                          <button
                            type="button"
                            onClick={() => toggleInfo(uniqueKey)}
                            className={`h-8 px-2.5 flex items-center gap-1.5 rounded-lg border text-xs font-semibold transition-all ${
                              isInfoOpen
                                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-700 dark:text-indigo-300 shadow-xs'
                                : 'border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-surface-dark/95 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                            title={isInfoOpen ? "Ocultar información detallada" : "Ver información detallada del paciente"}
                          >
                            <Info className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{isInfoOpen ? '- info' : '+ info'}</span>
                          </button>
                        </div>

                        {/* Etiqueta del Hueco Horario */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-xs uppercase tracking-wide">
                            {opp.dayLabel} • {opp.timeLabel}
                          </span>
                          {opp.availableProfessionalsCount > 1 && (
                            <span className="text-[11px] text-gray-500">
                              ({opp.availableProfessionalsCount} especialistas libres)
                            </span>
                          )}
                        </div>

                        {/* Contenido principal: Información del paciente */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1.5 flex-1 min-w-0 pr-24 sm:pr-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-800 dark:text-white text-base">
                                {p.name} {p.surname || ''}
                              </span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                                {cand.priorityScore} pts afinidad
                              </span>
                              {p.status === 'waiting' ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                                  Lista de Espera
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                                  Activo
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                              {cand.reason}
                            </p>

                            <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
                              {cand.recommendedProfessional && (
                                <span>Terapeuta libre: <strong className="text-gray-700 dark:text-gray-300">{cand.recommendedProfessional.name}</strong></span>
                              )}
                              <span>Contacto: <strong className="text-gray-700 dark:text-gray-300">{cand.contactName}</strong></span>
                              {cand.phone && <span>Tel: <strong className="text-gray-700 dark:text-gray-300">{cand.phone}</strong></span>}
                            </div>
                          </div>

                          {/* Botones de acción unificados */}
                          <div className="flex items-center gap-2 flex-shrink-0 pt-2 sm:pt-4">
                            {/* Botón WhatsApp */}
                            {cand.whatsappUrl ? (
                              <a
                                href={cand.whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-9 w-32 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors text-center flex-shrink-0"
                                title="Avisar a la familia por WhatsApp Web"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>WhatsApp</span>
                              </a>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="h-9 w-32 flex items-center justify-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 rounded-xl text-xs font-semibold cursor-not-allowed text-center flex-shrink-0"
                                title="Sin teléfono para WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>WhatsApp</span>
                              </button>
                            )}

                            {/* Botón Asignar Cita */}
                            <button
                              type="button"
                              onClick={() => handleAssignOpportunity(opp)}
                              disabled={isAssigning}
                              className="h-9 w-32 flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 text-center flex-shrink-0"
                              title="Asignar este hueco al paciente con 1 clic"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>{isAssigning ? 'Asignando...' : 'Asignar Cita'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Panel expandible "+ info" */}
                        {isInfoOpen && (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs space-y-2.5 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 rounded-xl animate-in fade-in duration-150">
                            {p.notes && (
                              <div>
                                <span className="font-semibold text-amber-800 dark:text-amber-300 block mb-1 flex items-center gap-1.5">
                                  📌 Observaciones y Comentarios de Gestión:
                                </span>
                                <p className="text-gray-700 dark:text-gray-200 italic bg-amber-50/70 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-200/70 dark:border-amber-800/50 whitespace-pre-line leading-relaxed">
                                  {p.notes}
                                </p>
                              </div>
                            )}

                            {p.medicalHistory && (
                              <div>
                                <span className="font-semibold text-blue-800 dark:text-blue-300 block mb-1 flex items-center gap-1.5">
                                  📋 Historial Clínico y Tratamiento:
                                </span>
                                <p className="text-gray-700 dark:text-gray-200 bg-white dark:bg-surface-dark p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 whitespace-pre-line leading-relaxed">
                                  {p.medicalHistory}
                                </p>
                              </div>
                            )}

                            {(p.availability?.specificNotes || p.availability?.preferredDays || p.availability?.timePreference) && (
                              <div className="space-y-1">
                                <span className="font-semibold text-gray-700 dark:text-gray-300 block">
                                  Disponibilidad horaria configurada:
                                </span>
                                <div className="flex flex-wrap gap-2 text-[11px]">
                                  {p.availability?.timePreference && (
                                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md border border-blue-100 dark:border-blue-800">
                                      Franja: {
                                        p.availability.timePreference === 'morning' ? 'Mañanas (9:00 - 12:00)' :
                                        p.availability.timePreference === 'midday' ? 'Mediodía (12:00 - 15:00)' :
                                        p.availability.timePreference === 'afternoon' ? 'Tardes (15:00 - 20:00)' : 'Cualquier franja'
                                      }
                                    </span>
                                  )}
                                  {p.availability?.preferredDays && p.availability.preferredDays.length > 0 && (
                                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-100 dark:border-indigo-800">
                                      Días: {p.availability.preferredDays.map(d => ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'][d - 1] || `Día ${d}`).join(', ')}
                                    </span>
                                  )}
                                </div>
                                {p.availability?.specificNotes && (
                                  <p className="text-gray-600 dark:text-gray-400 text-[11px] pt-1">
                                    Detalle: {p.availability.specificNotes}
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-500 text-[11px]">
                              {p.contacts && p.contacts.map((c, i) => (
                                <span key={i}>
                                  {c.type === 'phone' ? '📞' : '✉️'} {c.value} ({c.belongsTo === 'tutor' ? 'Tutor' : 'Paciente'})
                                </span>
                              ))}
                              {p.dateOfBirth && (
                                <span>🎂 F. Nacimiento: {p.dateOfBirth}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
