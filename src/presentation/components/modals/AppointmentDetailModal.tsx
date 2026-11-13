import { useState } from 'react';
import { X, Calendar, Clock, MapPin, User, AlertCircle, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Appointment } from '../../../domain/models/types';
import { AppointmentRepository } from '../../../infrastructure/firebase/AppointmentRepository';

interface AppointmentDetailModalProps {
  appointment: Appointment;
  patientName: string;
  professionalName?: string;
  roomName?: string;
  onClose: () => void;
  onUpdated: () => void;
  onOpenGapFiller: (appt: Appointment) => void;
}

const appointmentRepo = new AppointmentRepository();

export const AppointmentDetailModal = ({
  appointment,
  patientName,
  professionalName = 'Profesional Asignado',
  roomName = 'Sala General',
  onClose,
  onUpdated,
  onOpenGapFiller
}: AppointmentDetailModalProps) => {
  const [cancelling, setCancelling] = useState(false);

  const start = new Date(appointment.start);
  const end = new Date(appointment.end);

  const handleCancelAppointment = async () => {
    if (!confirm(`¿Estás seguro de cancelar la cita de ${patientName}?`)) return;

    setCancelling(true);
    try {
      const updatedAppt: Appointment = {
        ...appointment,
        status: 'cancelled',
        notes: (appointment.notes ? appointment.notes + ' | ' : '') + 'Cancelada por el paciente'
      };

      await appointmentRepo.updateAppointment(appointment.clinicId, appointment.id, {
        status: 'cancelled',
        notes: updatedAppt.notes
      });

      onUpdated();
      // Inmediatamente sugerimos buscar candidatos para cubrir este hueco
      onOpenGapFiller(updatedAppt);
    } catch (err) {
      console.error("Error cancelling appointment:", err);
    } finally {
      setCancelling(false);
    }
  };

  const isCancelled = appointment.status === 'cancelled';
  const isCompleted = appointment.status === 'completed';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-surface-dark rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-slate-800 dark:text-white">Detalle de la Cita</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          
          {/* Estado banner */}
          <div className={`p-3 rounded-xl flex items-center gap-3 text-xs font-semibold ${
            isCancelled 
              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900' 
              : isCompleted 
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200' 
                : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200'
          }`}>
            {isCancelled ? <XCircle className="w-4 h-4" /> : isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            <span>Estado: {isCancelled ? 'Cancelada (Hueco Libre)' : isCompleted ? 'Completada' : 'Programada'}</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-400">Paciente</p>
                <p className="text-base font-bold text-slate-800 dark:text-white">{patientName}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-400">Fecha y Hora</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">
                  {format(start, "EEEE d 'de' MMMM", { locale: es })}
                </p>
                <p className="text-xs text-gray-500">
                  {format(start, "HH:mm")} - {format(end, "HH:mm")}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-400">Ubicación y Especialista</p>
                <p className="text-sm font-medium text-slate-700 dark:text-gray-300">{roomName}</p>
                <p className="text-xs text-gray-500">{professionalName}</p>
              </div>
            </div>

            {appointment.notes && (
              <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-xs text-gray-600 dark:text-gray-400">
                <strong>Notas:</strong> {appointment.notes}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-2">
          
          {isCancelled ? (
            <button
              onClick={() => onOpenGapFiller(appointment)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-indigo-600 to-primary text-white rounded-xl text-sm font-semibold shadow-md hover:opacity-95 transition-opacity"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Encontrar Paciente para Cubrir Hueco</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelAppointment}
                disabled={cancelling}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-900/50 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <AlertCircle className="w-4 h-4" />
                <span>{cancelling ? 'Cancelando...' : 'Cancelar Cita'}</span>
              </button>

              <button
                onClick={onClose}
                className="px-4 py-2.5 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
