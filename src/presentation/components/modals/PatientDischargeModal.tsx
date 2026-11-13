import { useState, useEffect } from 'react';
import { 
  X, 
  UserMinus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  MessageSquare, 
  BookOpen, 
  Building2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  OptimizationService, 
  type DischargePlanResult 
} from '../../../application/services/OptimizationService';

interface PatientDischargeModalProps {
  clinicId: string;
  patientId: string;
  onClose: () => void;
  onDischarged: (reassignedCount: number, cancelledCount: number) => void;
}

const optimizationService = new OptimizationService();

export const PatientDischargeModal = ({
  clinicId,
  patientId,
  onClose,
  onDischarged
}: PatientDischargeModalProps) => {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<DischargePlanResult | null>(null);
  const [selectedReplacements, setSelectedReplacements] = useState<Record<string, string | null>>({});
  const [committing, setCommitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadPlan = async () => {
      setLoading(true);
      try {
        const result = await optimizationService.getDischargePlanForPatient(clinicId, patientId);
        setPlan(result);

        // Preseleccionar por defecto el candidato #1 para cada cita
        const initialSelections: Record<string, string | null> = {};
        for (const slot of result.freedSlots) {
          if (slot.candidates.length > 0) {
            initialSelections[slot.appointment.id] = slot.candidates[0].patient.id;
          } else {
            initialSelections[slot.appointment.id] = null;
          }
        }
        setSelectedReplacements(initialSelections);
      } catch (err) {
        console.error("Error loading discharge plan:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, [clinicId, patientId]);

  const handleSelectCandidate = (appointmentId: string, candidatePatientId: string | null) => {
    setSelectedReplacements(prev => ({
      ...prev,
      [appointmentId]: candidatePatientId
    }));
  };

  const handleConfirmDischarge = async () => {
    if (!plan) return;
    setCommitting(true);
    try {
      const assignments = plan.freedSlots.map(slot => ({
        appointmentId: slot.appointment.id,
        newPatientId: selectedReplacements[slot.appointment.id] || null
      }));

      const res = await optimizationService.executeDischargeAndReassignments(
        clinicId,
        patientId,
        assignments,
        true // Archiva al paciente
      );

      setSuccessMsg(
        `Baja tramitada con éxito: ${res.reassignedCount} citas cubiertas con lista de espera y ${res.cancelledCount} citas liberadas.`
      );

      setTimeout(() => {
        onDischarged(res.reassignedCount, res.cancelledCount);
      }, 1500);
    } catch (err) {
      console.error("Error confirming patient discharge:", err);
    } finally {
      setCommitting(false);
    }
  };

  const totalAssigned = Object.values(selectedReplacements).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white dark:bg-surface-dark rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50/90 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs shrink-0">
              <UserMinus className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800 px-2 py-0.5 rounded">
                  Radar de Reemplazo en Bajas
                </span>
                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-800/60 px-2 py-0.5 rounded">
                  Protección de Agenda
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white mt-1">
                Tramitar Baja y Reasignar Huecos de Citas
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {plan?.patient ? `${plan.patient.name} ${plan.patient.surname || ''}` : 'Cargando paciente...'}
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
            <div className="py-16 text-center space-y-3">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
              <h4 className="text-xl font-bold text-slate-800 dark:text-white">{successMsg}</h4>
              <p className="text-sm text-gray-500">Actualizando expedientes y calendario...</p>
            </div>
          ) : loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
              <h4 className="text-base font-bold text-slate-700 dark:text-gray-200">
                Analizando citas futuras y buscando candidatos afines...
              </h4>
              <p className="text-xs text-gray-500 max-w-sm text-center">
                Buscando pacientes en lista de espera y activos compatibles con los turnos de cada sesión liberada.
              </p>
            </div>
          ) : !plan ? (
            <div className="py-12 text-center text-gray-400">
              No se ha podido cargar el plan de baja.
            </div>
          ) : plan.futureAppointmentsCount === 0 ? (
            <div className="py-12 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="text-base font-bold text-slate-800 dark:text-white">
                El paciente no tiene citas futuras programadas
              </h4>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                No hay sesiones futuras pendientes en la agenda. Puedes archivar al paciente de forma segura con un solo clic.
              </p>
            </div>
          ) : (
            <>
              {/* Resumen del impacto de la baja */}
              <div className="p-4 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-bold">
                    Se han detectado {plan.futureAppointmentsCount} {plan.futureAppointmentsCount === 1 ? 'cita futura' : 'citas futuras'} programadas
                  </p>
                  <p className="text-amber-700 dark:text-amber-400">
                    Al confirmar la baja de <strong>{plan.patient.name}</strong>, el radar te permite cubrir inmediatamente cada sesión con pacientes de la lista de espera afines a este horario y terapeuta, evitando que queden huecos muertos.
                  </p>
                </div>
              </div>

              {/* Lista de Citas Futuras Liberadas */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Citas que quedan libres y candidatos recomendados:
                  </span>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    {totalAssigned} de {plan.freedSlots.length} asignadas
                  </span>
                </div>

                <div className="space-y-4">
                  {plan.freedSlots.map((slot, idx) => {
                    const start = new Date(slot.slotStart);
                    const end = new Date(slot.slotEnd);
                    const dayStr = format(start, "EEEE d 'de' MMMM", { locale: es });
                    const timeStr = `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
                    const currentSelectedId = selectedReplacements[slot.appointment.id];
                    const selectedCand = slot.candidates.find(c => c.patient.id === currentSelectedId);

                    return (
                      <div 
                        key={slot.appointment.id}
                        className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-dark shadow-xs space-y-3"
                      >
                        {/* Cabecera del hueco */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800/60 pb-2.5">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center justify-center text-xs font-bold">
                              {idx + 1}
                            </span>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                              <span className="font-bold text-slate-800 dark:text-white capitalize flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                {dayStr}
                              </span>
                              <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {timeStr}
                              </span>
                              {slot.professional && (
                                <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                                  <span 
                                    className="w-2.5 h-2.5 rounded-full inline-block" 
                                    style={{ backgroundColor: slot.professional.color || '#3B82F6' }} 
                                  />
                                  <span>{slot.professional.name} {slot.professional.surname || ''}</span>
                                </span>
                              )}
                              {slot.room && (
                                <span className="flex items-center gap-1 text-gray-500">
                                  <Building2 className="w-3.5 h-3.5" />
                                  <span>{slot.room.name}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-md">
                            Hueco a Reemplazar
                          </span>
                        </div>

                        {/* Selector de Candidato de Reemplazo */}
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                            Paciente sustituto para esta sesión:
                          </label>

                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={currentSelectedId || ''}
                              onChange={(e) => handleSelectCandidate(slot.appointment.id, e.target.value || null)}
                              className="flex-1 min-w-[240px] text-xs bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 shadow-xs"
                            >
                              <option value="">Dejar hueco libre (Cancelar sesión sin asignar sustituto)</option>
                              {slot.candidates.map(c => (
                                <option key={c.patient.id} value={c.patient.id}>
                                  ⭐ {c.patient.name} {c.patient.surname || ''} ({c.priorityScore} pts - {c.reason})
                                </option>
                              ))}
                            </select>

                            {/* Botón WhatsApp si hay candidato seleccionado y tiene enlace */}
                            {selectedCand?.whatsappUrl && (
                              <a
                                href={selectedCand.whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                                title="Enviar plantilla de WhatsApp al nuevo paciente"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">WhatsApp</span>
                              </a>
                            )}
                          </div>

                          {/* Detalle del candidato seleccionado */}
                          {selectedCand && (
                            <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-indigo-900 dark:text-indigo-200">
                                    {selectedCand.patient.name} {selectedCand.patient.surname || ''}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    selectedCand.patient.status === 'waiting'
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                                  }`}>
                                    {selectedCand.patient.status === 'waiting' ? 'Lista de Espera' : 'Activo'}
                                  </span>
                                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                    {selectedCand.priorityScore} pts afinidad
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                  {selectedCand.reason}
                                </p>
                              </div>

                              <a
                                href={`/dashboard/patients/${selectedCand.patient.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-primary transition-colors flex items-center gap-1 font-medium text-[11px]"
                              >
                                <BookOpen className="w-3 h-3" /> Ficha
                              </a>
                            </div>
                          )}

                          {!selectedCand && (
                            <p className="text-[11px] text-gray-400 italic">
                              Esta cita quedará cancelada y libre en la agenda para asignación manual o a través del radar de huecos.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 bg-gray-50/80 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            {plan && plan.futureAppointmentsCount > 0 && (
              <span>
                Se reasignarán <strong className="text-slate-800 dark:text-white font-bold">{totalAssigned}</strong> citas y se cancelarán <strong className="text-slate-800 dark:text-white font-bold">{plan.futureAppointmentsCount - totalAssigned}</strong>
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
              disabled={committing || loading}
              onClick={handleConfirmDischarge}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {committing 
                  ? 'Tramitando baja...' 
                  : plan && plan.futureAppointmentsCount > 0
                    ? `Confirmar Baja y Reasignar (${totalAssigned})`
                    : 'Confirmar y Archivar Paciente'}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
