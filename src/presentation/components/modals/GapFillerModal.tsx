import { useState, useEffect } from 'react';
import { X, MessageSquare, UserCheck, Sparkles, Clock, AlertTriangle, CheckCircle2, BookOpen, Info } from 'lucide-react';
import type { Appointment } from '../../../domain/models/types';
import { OptimizationService, type GapCandidate } from '../../../application/services/OptimizationService';
import { AppointmentRepository } from '../../../infrastructure/firebase/AppointmentRepository';

interface GapFillerModalProps {
  appointment: Appointment;
  clinicId: string;
  onClose: () => void;
  onAssigned: () => void;
}

const optimizationService = new OptimizationService();
const appointmentRepo = new AppointmentRepository();

export const GapFillerModal = ({ appointment, clinicId, onClose, onAssigned }: GapFillerModalProps) => {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<GapCandidate[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedInfoIds, setExpandedInfoIds] = useState<Record<string, boolean>>({});

  const toggleInfo = (id: string) => {
    setExpandedInfoIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const list = await optimizationService.findCandidatePatientsForGap(appointment, clinicId);
        setCandidates(list);
      } catch (err) {
        console.error("Error finding gap candidates:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [appointment, clinicId]);

  const handleAssign = async (candidate: GapCandidate) => {
    setAssigningId(candidate.patient.id);
    try {
      await appointmentRepo.updateAppointment(clinicId, appointment.id, {
        patientId: candidate.patient.id,
        status: 'scheduled',
        notes: `Cita reasignada automáticamente a ${candidate.patient.name} ${candidate.patient.surname || ''} (${candidate.reason})`
      });

      setSuccessMsg(`¡Cita asignada con éxito a ${candidate.patient.name}!`);
      setTimeout(() => {
        onAssigned();
      }, 1200);
    } catch (err) {
      console.error("Error reassigning slot:", err);
    } finally {
      setAssigningId(null);
    }
  };

  const slotDate = new Date(appointment.start);
  const timeStr = slotDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const dateStr = slotDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-surface-dark rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-primary text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
              <Sparkles className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Asistente de Huecos de Última Hora</h3>
              <p className="text-xs text-indigo-100">
                Hueco liberado para {dateStr} a las {timeStr}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {successMsg ? (
            <div className="p-8 text-center space-y-3">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
              <h4 className="text-xl font-bold text-slate-800 dark:text-white">{successMsg}</h4>
              <p className="text-sm text-gray-500">Actualizando calendario en tiempo real...</p>
            </div>
          ) : loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Analizando lista de espera y compatibilidad clínica...</p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
              <h4 className="font-semibold text-slate-700 dark:text-gray-300">No se encontraron candidatos directos</h4>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                No hay pacientes en lista de espera o activos que coincidan con la especialidad o profesional de este hueco.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                <span>Candidatos recomendados por afinidad y prioridad ({candidates.length}):</span>
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <Clock className="w-3.5 h-3.5" /> Respuestas inmediatas sugeridas
                </span>
              </div>

              <div className="space-y-3">
                {candidates.map((cand, idx) => {
                  const p = cand.patient;
                  const isTop = idx === 0;
                  const isInfoOpen = !!expandedInfoIds[p.id];

                  return (
                    <div 
                      key={p.id}
                      className={`relative p-4 rounded-xl border transition-all ${
                        isTop 
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
                          onClick={() => toggleInfo(p.id)}
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

                      {/* Contenido principal: Información del paciente con todo el espacio y botones de acción */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0 pr-24 sm:pr-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800 dark:text-white text-base">
                              {p.name} {p.surname || ''}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                              {cand.priorityScore} pts
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
                            onClick={() => handleAssign(cand)}
                            disabled={assigningId === p.id}
                            className="h-9 w-32 flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 text-center flex-shrink-0"
                            title="Asignar este hueco a este paciente con 1 clic"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>{assigningId === p.id ? 'Asignando...' : 'Asignar Cita'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Panel expandible "+ info" */}
                      {isInfoOpen && (
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs space-y-2.5 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 rounded-xl animate-in fade-in duration-150">
                          {/* 1. Observaciones y Comentarios de Gestión */}
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

                          {/* 2. Historial Clínico y Diagnóstico de Tratamiento */}
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

                          {/* 3. Disponibilidad horaria configurada */}
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

                          {/* 4. Contactos y datos ampliados */}
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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
