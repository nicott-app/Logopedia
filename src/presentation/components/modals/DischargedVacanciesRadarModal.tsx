import { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  MessageSquare, 
  UserMinus, 
  TrendingUp, 
  Building2,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  OptimizationService, 
  type FreedSlotReplacement,
  type GapCandidate 
} from '../../../application/services/OptimizationService';
import { AppointmentRepository } from '../../../infrastructure/firebase/AppointmentRepository';
import { PatientRepository } from '../../../infrastructure/firebase/PatientRepository';

interface DischargedVacanciesRadarModalProps {
  clinicId: string;
  onClose: () => void;
  onAssigned: () => void;
}

const optimizationService = new OptimizationService();
const appointmentRepo = new AppointmentRepository();
const patientRepo = new PatientRepository();

export const DischargedVacanciesRadarModal = ({
  clinicId,
  onClose,
  onAssigned
}: DischargedVacanciesRadarModalProps) => {
  const [loading, setLoading] = useState(true);
  const [vacancies, setVacancies] = useState<FreedSlotReplacement[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedProfFilter, setSelectedProfFilter] = useState<string>('all');

  const fetchVacancies = async () => {
    setLoading(true);
    try {
      const data = await optimizationService.getPendingDischargedGaps(clinicId, 4);
      setVacancies(data);
    } catch (err) {
      console.error("Error fetching vacancies:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVacancies();
  }, [clinicId]);

  const handleAssignCandidate = async (vacancy: FreedSlotReplacement, candidate: GapCandidate) => {
    const key = `${vacancy.appointment.id}-${candidate.patient.id}`;
    setAssigningId(key);
    try {
      const prevName = vacancy.previousPatientName || 'Paciente anterior';
      const newName = `${candidate.patient.name} ${candidate.patient.surname || ''}`.trim();

      await appointmentRepo.updateAppointment(clinicId, vacancy.appointment.id, {
        patientId: candidate.patient.id,
        status: 'scheduled',
        notes: `Reasignado desde Radar de Bajas (reemplazo de ${prevName} por ${newName} · ${candidate.reason})`
      });

      // Si el paciente estaba en lista de espera, activarlo
      if (candidate.patient.status === 'waiting') {
        await patientRepo.savePatient({
          ...candidate.patient,
          status: 'active',
          updatedAt: Date.now()
        });
      }

      setSuccessMsg(
        `¡Cita confirmada con éxito para ${candidate.patient.name} (${format(new Date(vacancy.slotStart), "EEEE d 'a las' HH:mm", { locale: es })})!`
      );

      setTimeout(() => {
        setSuccessMsg(null);
        fetchVacancies();
        onAssigned();
      }, 1300);
    } catch (err) {
      console.error("Error assigning candidate to vacancy:", err);
    } finally {
      setAssigningId(null);
    }
  };

  const filteredVacancies = vacancies.filter(v => {
    if (selectedProfFilter === 'all') return true;
    return v.professional?.id === selectedProfFilter;
  });

  const uniqueProfessionals = Array.from(
    new Map(vacancies.filter(v => v.professional).map(v => [v.professional!.id, v.professional!])).values()
  );

  const totalRecoverableHours = Math.round(
    vacancies.reduce((acc, v) => {
      const h = (new Date(v.slotEnd).getTime() - new Date(v.slotStart).getTime()) / (1000 * 60 * 60);
      return acc + (isNaN(h) ? 0.75 : h);
    }, 0) * 10
  ) / 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white dark:bg-surface-dark rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-amber-50/50 dark:bg-amber-950/20 border-b border-amber-100/80 dark:border-amber-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100/80 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 rounded-xl shadow-xs shrink-0">
              <UserMinus className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/60 px-2 py-0.5 rounded">
                  Asistente Inteligente
                </span>
                <span className="flex items-center gap-1 text-[11px] text-amber-800 dark:text-amber-300 bg-white/90 dark:bg-slate-800/80 px-2 py-0.5 rounded font-medium border border-amber-200/60 dark:border-amber-800/60">
                  <ShieldCheck className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Agenda Optimizada
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white mt-1">
                Cubrir cancelaciones y bajas
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detecta huecos liberados en las próximas 4 semanas y propone candidatos afines de lista de espera.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-amber-100/60 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Panel de Filtros y Métricas */}
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Filtrar por terapeuta:</span>
              <select
                value={selectedProfFilter}
                onChange={(e) => setSelectedProfFilter(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-700 dark:text-gray-200 font-medium outline-none focus:ring-1 focus:ring-slate-400 shadow-xs"
              >
                <option value="all">Todos los profesionales ({vacancies.length} vacantes)</option>
                {uniqueProfessionals.map(pr => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name} {pr.surname || ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200/80 dark:border-amber-800/60">
                {vacancies.length} {vacancies.length === 1 ? 'vacante detectada' : 'vacantes detectadas'}
              </span>
              <span className="text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200/80 dark:border-emerald-800/60 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> +{totalRecoverableHours}h recuperables
              </span>
            </div>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {successMsg ? (
            <div className="py-16 text-center space-y-3">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
              <h4 className="text-xl font-bold text-slate-800 dark:text-white">{successMsg}</h4>
              <p className="text-sm text-gray-500">Actualizando huecos de agenda en tiempo real...</p>
            </div>
          ) : loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
              <h4 className="text-base font-bold text-slate-700 dark:text-gray-200">
                Rastreando vacantes y calculando afinidades...
              </h4>
              <p className="text-xs text-gray-500 max-w-sm text-center">
                Analizando cancelaciones y bajas no cubiertas en las próximas 4 semanas.
              </p>
            </div>
          ) : filteredVacancies.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="text-base font-bold text-slate-800 dark:text-white">
                ¡Agenda al 100%! No hay vacantes por baja sin cubrir
              </h4>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                No se han detectado citas canceladas o liberadas pendientes de sustituto para las próximas semanas.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredVacancies.map((vacancy) => {
                const start = new Date(vacancy.slotStart);
                const end = new Date(vacancy.slotEnd);
                const dayStr = format(start, "EEEE d 'de' MMMM", { locale: es });
                const timeStr = `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
                const topCandidate = vacancy.candidates.length > 0 ? vacancy.candidates[0] : null;

                return (
                  <div 
                    key={vacancy.appointment.id}
                    className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark shadow-xs space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                  >
                    {/* Header de la vacante */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-white capitalize">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span>{dayStr}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>{timeStr}</span>
                        </div>
                        {vacancy.professional && (
                          <div className="flex items-center gap-1.5">
                            <span 
                              className="w-2.5 h-2.5 rounded-full inline-block" 
                              style={{ backgroundColor: vacancy.professional.color || '#64748B' }} 
                            />
                            <span className="font-medium text-slate-700 dark:text-gray-300">
                              {vacancy.professional.name} {vacancy.professional.surname || ''}
                            </span>
                          </div>
                        )}
                        {vacancy.room && (
                          <div className="flex items-center gap-1 text-slate-500">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{vacancy.room.name}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          Baja: {vacancy.previousPatientName || 'Paciente anterior'}
                        </span>
                      </div>
                    </div>

                    {/* Candidato recomendado de la lista de espera */}
                    {topCandidate ? (
                      <div className="p-4 bg-amber-50/30 dark:bg-amber-950/15 border border-amber-200/60 dark:border-amber-900/40 rounded-xl space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs shadow-xs">
                              {topCandidate.patient.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-slate-800 dark:text-white">
                                  {topCandidate.patient.name} {topCandidate.patient.surname || ''}
                                </h4>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                                  {topCandidate.patient.status === 'waiting' ? 'Lista de Espera' : 'Activo'}
                                </span>
                                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200/70 dark:border-emerald-800/60">
                                  {topCandidate.priorityScore} pts afinidad
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {topCandidate.reason}
                              </p>
                            </div>
                          </div>

                          {/* Acciones para el candidato */}
                          <div className="flex items-center gap-2">
                            {/* WhatsApp Directo */}
                            {topCandidate.whatsappUrl && (
                              <a
                                href={topCandidate.whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50/80 hover:bg-emerald-100/90 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl text-xs font-semibold transition-colors shadow-xs"
                                title="Contactar por WhatsApp con plantilla predefinida"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>WhatsApp</span>
                              </a>
                            )}

                            {/* Botón Asignar Vacante */}
                            <button
                              type="button"
                              disabled={assigningId === `${vacancy.appointment.id}-${topCandidate.patient.id}`}
                              onClick={() => handleAssignCandidate(vacancy, topCandidate)}
                              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>
                                {assigningId === `${vacancy.appointment.id}-${topCandidate.patient.id}`
                                  ? 'Asignando...'
                                  : 'Asignar Cita'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Otros candidatos disponibles en lista de espera si los hay */}
                        {vacancy.candidates.length > 1 && (
                          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-medium text-[11px]">Otros candidatos compatibles ({vacancy.candidates.length - 1}):</span>
                            {vacancy.candidates.slice(1, 3).map((alt) => (
                              <button
                                key={alt.patient.id}
                                type="button"
                                onClick={() => handleAssignCandidate(vacancy, alt)}
                                className="text-[11px] font-semibold text-slate-700 dark:text-gray-300 bg-white dark:bg-surface-dark px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-400 transition-colors flex items-center gap-1"
                              >
                                <span>{alt.patient.name} ({alt.priorityScore} pts)</span>
                                <ChevronRight className="w-3 h-3 text-gray-400" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl text-center text-xs text-gray-400">
                        No hay candidatos en lista de espera compatibles para este día y horario.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 bg-gray-50/80 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Los reemplazos confirmados activan automáticamente a los pacientes en lista de espera.
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
