import { useState, useEffect } from 'react';
import { X, Sparkles, Clock, MessageSquare, UserCheck, Plus, CheckCircle2, User, MapPin, BookOpen, Info, Briefcase } from 'lucide-react';
import { format, addMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Patient, User as AppUser, Room, Appointment, ClinicalService } from '../../../domain/models/types';
import { OptimizationService, type EmptySlotCandidate } from '../../../application/services/OptimizationService';
import { AppointmentRepository } from '../../../infrastructure/firebase/AppointmentRepository';
import { PatientRepository } from '../../../infrastructure/firebase/PatientRepository';
import { UserRepository } from '../../../infrastructure/firebase/UserRepository';
import { RoomRepository } from '../../../infrastructure/firebase/RoomRepository';
import { serviceRepository } from '../../../infrastructure/firebase/ServiceRepository';

interface EmptySlotModalProps {
  slotStart: Date;
  slotEnd: Date;
  clinicId: string;
  initialProfessionalId?: string;
  onClose: () => void;
  onCreated: () => void;
}

interface SubSlotOption {
  start: Date;
  end: Date;
  label: string;
}

interface AssignmentModalState {
  candidate: EmptySlotCandidate;
  caseType: 'specific' | 'wide';
  targetSlot: SubSlotOption;
  availableSubSlots: SubSlotOption[];
  selectedServiceId: string;
  notes: string;
  specificNote?: string;
}

/**
 * Genera franjas horarias válidas de duración específica dentro del hueco total disponible.
 */
function generateSubSlots(
  slotStart: Date,
  slotEnd: Date,
  durationMinutes: number
): SubSlotOption[] {
  const subSlots: SubSlotOption[] = [];
  const totalMinutes = Math.round((slotEnd.getTime() - slotStart.getTime()) / 60000);

  if (totalMinutes <= durationMinutes) {
    subSlots.push({
      start: new Date(slotStart),
      end: new Date(slotEnd),
      label: `${format(slotStart, 'HH:mm')} a ${format(slotEnd, 'HH:mm')}`
    });
    return subSlots;
  }

  // Paso entre franjas (30m si sesión corta o inicio a las y media, 60m si sesiones largas)
  const startMins = slotStart.getMinutes();
  const stepMinutes = (durationMinutes <= 30 || startMins === 30) ? 30 : 60;

  let current = new Date(slotStart);
  while (current.getTime() + durationMinutes * 60000 <= slotEnd.getTime()) {
    const s = new Date(current);
    const e = addMinutes(s, durationMinutes);
    subSlots.push({
      start: s,
      end: e,
      label: `${format(s, 'HH:mm')} a ${format(e, 'HH:mm')}`
    });
    current = addMinutes(current, stepMinutes);
  }

  if (subSlots.length === 0) {
    subSlots.push({
      start: new Date(slotStart),
      end: new Date(slotEnd),
      label: `${format(slotStart, 'HH:mm')} a ${format(slotEnd, 'HH:mm')}`
    });
  }

  return subSlots;
}

/**
 * Analiza si el paciente tiene una disponibilidad horaria específica y concreta
 * o si cuenta con disponibilidad horaria más amplia dentro de este hueco.
 */
function detectPatientSpecificTime(
  patient: Patient,
  slotStart: Date,
  slotEnd: Date,
  durationMinutes: number,
  reason?: string
): { isSpecific: boolean; targetSlot?: SubSlotOption; note?: string } {
  const totalMinutes = Math.round((slotEnd.getTime() - slotStart.getTime()) / 60000);

  // Si el hueco en total ya es corto (<= 60 minutos), de forma natural es un único hueco concreto
  if (totalMinutes <= Math.max(60, durationMinutes)) {
    const e = addMinutes(slotStart, durationMinutes);
    const finalEnd = e.getTime() <= slotEnd.getTime() ? e : slotEnd;
    return {
      isSpecific: true,
      targetSlot: {
        start: new Date(slotStart),
        end: new Date(finalEnd),
        label: `${format(slotStart, 'HH:mm')} a ${format(finalEnd, 'HH:mm')}`
      },
      note: patient.availability?.specificNotes || patient.notes || undefined
    };
  }

  // Comprobar si el paciente indica explícitamente "any" o "cualquier"
  const isAnyPreference = 
    patient.availability?.timePreference === 'any' || 
    patient.availability?.specificNotes?.toLowerCase().includes('cualquier') ||
    patient.notes?.toLowerCase().includes('cualquier');

  if (isAnyPreference) {
    return { isSpecific: false, note: patient.availability?.specificNotes || patient.notes || undefined };
  }

  // Buscar horas específicas indicadas en notas o disponibilidad (ej. "a las 13:00", "13:00", "10:30")
  const allTexts = [
    patient.availability?.specificNotes || '',
    patient.notes || '',
    reason || ''
  ].join(' ');

  const timeRegex = /(?:a\s+las\s+|las\s+)?(\d{1,2})[:.](\d{2})/i;
  const match = timeRegex.exec(allTexts);

  if (match) {
    const hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);

    const targetStart = new Date(slotStart);
    targetStart.setHours(hour, minute, 0, 0);
    const targetEnd = addMinutes(targetStart, durationMinutes);

    // Comprobar que caiga dentro de [slotStart, slotEnd]
    if (targetStart >= slotStart && targetEnd <= slotEnd) {
      return {
        isSpecific: true,
        targetSlot: {
          start: targetStart,
          end: targetEnd,
          label: `${format(targetStart, 'HH:mm')} a ${format(targetEnd, 'HH:mm')}`
        },
        note: patient.availability?.specificNotes || patient.notes || `Horario preferente: ${match[0]}`
      };
    }
  }

  return { isSpecific: false, note: patient.availability?.specificNotes || patient.notes || undefined };
}

const optimizationService = new OptimizationService();
const appointmentRepo = new AppointmentRepository();
const patientRepo = new PatientRepository();
const userRepo = new UserRepository();
const roomRepo = new RoomRepository();

export const EmptySlotModal = ({ slotStart, slotEnd, clinicId, initialProfessionalId, onClose, onCreated }: EmptySlotModalProps) => {
  const [activeTab, setActiveTab] = useState<'suggestions' | 'manual'>('suggestions');
  const [loading, setLoading] = useState(true);
  
  // Data for suggestions
  const [candidates, setCandidates] = useState<EmptySlotCandidate[]>([]);
  const [availableProfs, setAvailableProfs] = useState<AppUser[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  
  // Data for manual booking
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [allProfs, setAllProfs] = useState<AppUser[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [services, setServices] = useState<ClinicalService[]>([]);
  
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedProfId, setSelectedProfId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [notes, setNotes] = useState('');

  const [savingId, setSavingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedInfoIds, setExpandedInfoIds] = useState<Record<string, boolean>>({});

  // Estado para la ventana modal de confirmación / selección de franja (Casos 1 y 2)
  const [assignmentModal, setAssignmentModal] = useState<AssignmentModalState | null>(null);
  const [manualSelectedStart, setManualSelectedStart] = useState<string>(slotStart.toISOString());

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
        const [slotAnalysis, pats, profs, rms, servs] = await Promise.all([
          optimizationService.findCandidatePatientsForEmptySlot(slotStart, slotEnd, clinicId),
          patientRepo.getPatientsByClinic(clinicId),
          userRepo.getUsersByClinic(clinicId),
          roomRepo.getRoomsByClinic(clinicId),
          serviceRepository.getServicesByClinic(clinicId)
        ]);

        setCandidates(slotAnalysis.candidates);
        setAvailableProfs(slotAnalysis.availableProfessionals);
        setAvailableRooms(slotAnalysis.availableRooms);

        setAllPatients(pats);
        setAllProfs(profs);
        setAllRooms(rms);
        setServices(servs);

        if (initialProfessionalId) {
          setSelectedProfId(initialProfessionalId);
        } else if (slotAnalysis.availableProfessionals.length > 0) {
          setSelectedProfId(slotAnalysis.availableProfessionals[0].id);
        }
        if (slotAnalysis.availableRooms.length > 0) {
          setSelectedRoomId(slotAnalysis.availableRooms[0].id);
        }
        if (servs.length > 0) {
          setSelectedServiceId(servs[0].id);
        }
      } catch (err) {
        console.error("Error analyzing empty slot:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slotStart, slotEnd, clinicId]);

  /**
   * Abre la ventana modal interactiva distinguiendo los 2 casos requeridos:
   * 1. Paciente con disponibilidad concreta -> "¿Quieres cubrir el hueco de X a Y con Pepito?"
   * 2. Paciente con disponibilidad amplia -> "¿En qué hueco quieres añadir a Pepito?"
   */
  const handleOpenAssignmentModal = (cand: EmptySlotCandidate) => {
    const chosenService = services.find(s => s.id === selectedServiceId) || services[0];
    const durationMins = chosenService?.durationMinutes || 45;

    const specificCheck = detectPatientSpecificTime(cand.patient, slotStart, slotEnd, durationMins, cand.reason);
    const subSlots = generateSubSlots(slotStart, slotEnd, durationMins);

    if (specificCheck.isSpecific && specificCheck.targetSlot) {
      setAssignmentModal({
        candidate: cand,
        caseType: 'specific',
        targetSlot: specificCheck.targetSlot,
        availableSubSlots: subSlots,
        selectedServiceId: chosenService?.id || '',
        notes: `Cita asignada por afinidad horaria (${cand.reason})`,
        specificNote: specificCheck.note
      });
    } else {
      // Caso 2: Disponibilidad amplia
      setAssignmentModal({
        candidate: cand,
        caseType: 'wide',
        targetSlot: subSlots[0] || {
          start: new Date(slotStart),
          end: addMinutes(slotStart, durationMins),
          label: `${format(slotStart, 'HH:mm')} a ${format(addMinutes(slotStart, durationMins), 'HH:mm')}`
        },
        availableSubSlots: subSlots,
        selectedServiceId: chosenService?.id || '',
        notes: `Cita asignada por afinidad horaria (${cand.reason})`,
        specificNote: specificCheck.note
      });
    }
  };

  /**
   * Permite cambiar el servicio y recalcular las franjas horarias y su duración
   */
  const handleModalServiceChange = (serviceId: string) => {
    if (!assignmentModal) return;
    const serv = services.find(s => s.id === serviceId);
    const newDur = serv?.durationMinutes || 45;
    const newSubSlots = generateSubSlots(slotStart, slotEnd, newDur);

    const specificCheck = detectPatientSpecificTime(
      assignmentModal.candidate.patient, 
      slotStart, 
      slotEnd, 
      newDur, 
      assignmentModal.candidate.reason
    );
    
    setAssignmentModal(prev => {
      if (!prev) return null;
      return {
        ...prev,
        selectedServiceId: serviceId,
        availableSubSlots: newSubSlots,
        targetSlot: (prev.caseType === 'specific' && specificCheck.targetSlot) 
          ? specificCheck.targetSlot 
          : (newSubSlots[0] || prev.targetSlot)
      };
    });
  };

  /**
   * Confirma y guarda la cita en la franja horaria exacta seleccionada (NO en todo el hueco).
   */
  const handleConfirmAssignment = async () => {
    if (!assignmentModal) return;
    const cand = assignmentModal.candidate;
    setSavingId(cand.patient.id);

    try {
      const profId = cand.recommendedProfessional?.id || (availableProfs[0]?.id || allProfs[0]?.id || '');
      const roomId = cand.recommendedRoomId || (availableRooms[0]?.id || allRooms[0]?.id || null);

      const newAppt: Appointment = {
        id: crypto.randomUUID ? crypto.randomUUID() : `appt-${Date.now()}`,
        clinicId,
        patientId: cand.patient.id,
        professionalId: profId,
        roomId: roomId,
        serviceId: assignmentModal.selectedServiceId || null,
        start: assignmentModal.targetSlot.start.toISOString(),
        end: assignmentModal.targetSlot.end.toISOString(),
        status: 'scheduled',
        notes: assignmentModal.notes || `Cita asignada desde hueco libre (${cand.reason})`
      };

      await appointmentRepo.saveAppointment(newAppt);

      setAssignmentModal(null);
      setSuccessMsg(`¡Cita asignada con éxito a ${cand.patient.name} (${assignmentModal.targetSlot.label})!`);
      setTimeout(() => {
        onCreated();
      }, 1000);
    } catch (err) {
      console.error("Error creating appointment:", err);
    } finally {
      setSavingId(null);
    }
  };

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedProfId) {
      alert("Por favor selecciona un paciente y un especialista.");
      return;
    }

    setSavingId('manual');
    try {
      const chosenService = services.find(s => s.id === selectedServiceId);
      const apptStart = manualSelectedStart ? new Date(manualSelectedStart) : slotStart;
      const endCalculated = chosenService ? addMinutes(apptStart, chosenService.durationMinutes) : slotEnd;

      const newAppt: Appointment = {
        id: crypto.randomUUID ? crypto.randomUUID() : `appt-${Date.now()}`,
        clinicId,
        patientId: selectedPatientId,
        professionalId: selectedProfId,
        roomId: selectedRoomId || null,
        serviceId: selectedServiceId || null,
        start: apptStart.toISOString(),
        end: endCalculated.toISOString(),
        status: 'scheduled',
        notes: notes || 'Cita programada manualmente desde hueco libre'
      };

      await appointmentRepo.saveAppointment(newAppt);

      const patientObj = allPatients.find(p => p.id === selectedPatientId);
      setSuccessMsg(`¡Cita creada con éxito para ${patientObj?.name || 'el paciente'}!`);
      setTimeout(() => {
        onCreated();
      }, 1000);
    } catch (err) {
      console.error("Error creating manual appointment:", err);
    } finally {
      setSavingId(null);
    }
  };

  const rawDate = format(slotStart, "EEEE, d 'de' MMMM", { locale: es });
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
  const timeLabel = `${format(slotStart, "HH:mm")} a ${format(slotEnd, "HH:mm")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-surface-dark rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 bg-indigo-50/80 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Hueco Libre en Agenda
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mt-0.5">{dateLabel}</h3>
              <p className="text-xs text-slate-600 dark:text-gray-300 flex items-center gap-2 mt-0.5">
                <span>{timeLabel}</span>
                <span>•</span>
                <span>{availableProfs.length} {availableProfs.length === 1 ? 'terapeuta libre' : 'terapeutas libres'}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 px-6 pt-3 gap-4">
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'suggestions'
                ? 'border-primary text-primary dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Pacientes Disponibles</span>
            {candidates.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold">
                {candidates.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'manual'
                ? 'border-primary text-primary dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Asignación Manual</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {successMsg ? (
            <div className="py-12 text-center space-y-3">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
              <h4 className="text-xl font-bold text-slate-800 dark:text-white">{successMsg}</h4>
              <p className="text-sm text-gray-500">Actualizando cuadrícula de la agenda...</p>
            </div>
          ) : loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Buscando pacientes con disponibilidad en esta franja horaria...</p>
            </div>
          ) : activeTab === 'suggestions' ? (
            /* TAB 1: Sugerencias por disponibilidad */
            <div className="space-y-3">
              {candidates.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <p className="text-sm font-medium text-slate-700 dark:text-gray-300">
                    No hay pacientes con preferencia específica para este horario exacto.
                  </p>
                  <p className="text-xs text-gray-500">
                    Puedes pasar a la pestaña <strong>"Asignación Manual"</strong> para asignar a cualquier paciente de la clínica.
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-xs text-gray-500 px-1 flex items-center justify-between">
                    <span>Pacientes ordenados por afinidad de horario y terapeuta:</span>
                    <span className="text-emerald-600 font-medium">Asignación inmediata con 1 clic</span>
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

                          {/* Contenido principal: Información del paciente con todo el espacio y botones de acción abajo/a la derecha */}
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
                                {cand.recommendedProfessional && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3.5 h-3.5 text-gray-400" />
                                    Terapeuta: <strong className="text-gray-700 dark:text-gray-300">{cand.recommendedProfessional.name}</strong>
                                  </span>
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
                                onClick={() => handleOpenAssignmentModal(cand)}
                                disabled={savingId === p.id}
                                className="h-9 w-32 flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 text-center flex-shrink-0"
                                title="Asignar cita en este hueco"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>{savingId === p.id ? 'Asignando...' : 'Asignar Cita'}</span>
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
          ) : (
            /* TAB 2: Asignación Manual */
            <form onSubmit={handleManualCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" /> Paciente
                </label>
                <select
                  required
                  value={selectedPatientId}
                  onChange={(e) => {
                    const pId = e.target.value;
                    setSelectedPatientId(pId);
                    const chosen = allPatients.find(p => p.id === pId);
                    if (chosen?.assignedProfessionalId) {
                      setSelectedProfId(chosen.assignedProfessionalId);
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="">Selecciona un paciente...</option>
                  <optgroup label="En Lista de Espera">
                    {allPatients.filter(p => p.status === 'waiting').map(p => (
                      <option key={p.id} value={p.id}>{p.name} {p.surname || ''} (Lista de Espera)</option>
                    ))}
                  </optgroup>
                  <optgroup label="Pacientes Activos">
                    {allPatients.filter(p => p.status === 'active').map(p => (
                      <option key={p.id} value={p.id}>{p.name} {p.surname || ''}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Profesional Asignado
                  </label>
                  <select
                    required
                    value={selectedProfId}
                    onChange={(e) => setSelectedProfId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  >
                    <option value="">Selecciona especialista...</option>
                    {allProfs.map(prof => {
                      const isFree = availableProfs.some(p => p.id === prof.id);
                      let statusDesc = isFree ? '(Disponible)' : '(Ocupado)';
                      if (!isFree && prof.schedule) {
                        const dayKey = (['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const)[slotStart.getDay()];
                        const pDay = prof.schedule[dayKey];
                        const slotStartStr = `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')}`;
                        const slotEndStr = `${String(slotEnd.getHours()).padStart(2, '0')}:${String(slotEnd.getMinutes()).padStart(2, '0')}`;
                        if (pDay && !pDay.isWorking) {
                          statusDesc = '(No trabaja hoy)';
                        } else if (pDay && (slotStartStr < pDay.start || slotEndStr > pDay.end)) {
                          statusDesc = `(Fuera de turno: ${pDay.start}-${pDay.end})`;
                        } else if (pDay?.breaks?.some(b => slotStartStr < b.end && slotEndStr > b.start)) {
                          const brk = pDay.breaks.find(b => slotStartStr < b.end && slotEndStr > b.start);
                          statusDesc = `(En descanso: ${brk?.name || 'Pausa'})`;
                        }
                      }
                      return (
                        <option key={prof.id} value={prof.id}>
                          {prof.name} {prof.surname || ''} — {statusDesc}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" /> Sala
                  </label>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  >
                    <option value="">Sala asignada...</option>
                    {allRooms.map(r => {
                      const isFree = availableRooms.some(room => room.id === r.id);
                      return (
                        <option key={r.id} value={r.id}>
                          {r.name} {isFree ? '(Libre)' : '(Ocupada)'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-primary" /> Servicio Clínico / Duración
                  </label>
                  {selectedServiceId && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {services.find(s => s.id === selectedServiceId)?.durationMinutes || 45} min
                    </span>
                  )}
                </div>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="">Duración estándar del hueco ({Math.round((slotEnd.getTime() - slotStart.getTime()) / 60000)} min)</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.durationMinutes} min{s.price ? ` - ${s.price}€` : ''})
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de franja horaria dentro del hueco si es amplio */}
              {(() => {
                const chosenDur = services.find(s => s.id === selectedServiceId)?.durationMinutes || 45;
                const mSubSlots = generateSubSlots(slotStart, slotEnd, chosenDur);
                if (mSubSlots.length <= 1) return null;
                return (
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" /> Franja Horaria dentro del Hueco
                    </label>
                    <select
                      value={manualSelectedStart}
                      onChange={(e) => setManualSelectedStart(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                    >
                      {mSubSlots.map((s, idx) => (
                        <option key={idx} value={s.start.toISOString()}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Notas de la sesión</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Motivo de la sesión o notas internas..."
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingId === 'manual'}
                  className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold shadow-md transition-colors disabled:opacity-50"
                >
                  {savingId === 'manual' ? 'Guardando...' : 'Crear y Confirmar Cita'}
                </button>
              </div>
            </form>
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

      {/* VENTANA MODAL DE CONFIRMACIÓN / ELECCIÓN DE HUECO (CASOS 1 Y 2) */}
      {assignmentModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-surface-dark rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-indigo-50/80 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-800/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    {assignmentModal.caseType === 'specific' 
                      ? 'Confirmar Asignación de Cita' 
                      : 'Seleccionar Franja Horaria'
                    }
                  </h3>
                  <p className="text-xs text-gray-500">
                    {assignmentModal.caseType === 'specific'
                      ? 'Disponibilidad horaria concreta detectada'
                      : 'Elige la franja para este paciente'
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssignmentModal(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              
              {/* CASO 1: DISPONIBILIDAD CONCRETA */}
              {assignmentModal.caseType === 'specific' ? (
                <div className="space-y-4">
                  <div className="text-center py-2">
                    <p className="text-lg font-bold text-slate-800 dark:text-white leading-snug">
                      ¿Quieres cubrir el hueco de{' '}
                      <span className="text-primary underline decoration-2 underline-offset-2">
                        {assignmentModal.targetSlot.label}
                      </span>{' '}
                      con{' '}
                      <span className="text-slate-900 dark:text-white font-extrabold">
                        {assignmentModal.candidate.patient.name} {assignmentModal.candidate.patient.surname || ''}
                      </span>?
                    </p>
                  </div>

                  {/* Ficha de disponibilidad y detalles */}
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 space-y-3 text-xs">
                    {assignmentModal.specificNote && (
                      <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/50">
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">Disponibilidad del paciente:</span>
                          <span>{assignmentModal.specificNote}</span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-1 text-slate-600 dark:text-gray-300">
                      <div>
                        <span className="text-gray-400 block text-[11px]">Especialista:</span>
                        <span className="font-bold text-slate-800 dark:text-white">
                          {assignmentModal.candidate.recommendedProfessional?.name || availableProfs[0]?.name || 'Por asignar'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[11px]">Sala propuesta:</span>
                        <span className="font-bold text-slate-800 dark:text-white">
                          {allRooms.find(r => r.id === (assignmentModal.candidate.recommendedRoomId || availableRooms[0]?.id))?.name || 'Sala libre'}
                        </span>
                      </div>
                    </div>

                    {/* Selector de servicio */}
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <label className="block text-[11px] font-bold text-gray-500 mb-1">
                        Tratamiento / Servicio:
                      </label>
                      <select
                        value={assignmentModal.selectedServiceId}
                        onChange={(e) => handleModalServiceChange(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-primary"
                      >
                        {services.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.durationMinutes} min)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Alternativa para cambiar a hueco amplio */}
                  {assignmentModal.availableSubSlots.length > 1 && (
                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => setAssignmentModal(prev => prev ? ({ ...prev, caseType: 'wide' }) : null)}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        El paciente puede en otros horarios. Elegir otro hueco dentro del intervalo →
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* CASO 2: DISPONIBILIDAD AMPLIA */
                <div className="space-y-4">
                  <div className="text-center py-1">
                    <p className="text-lg font-bold text-slate-800 dark:text-white leading-snug">
                      ¿En qué hueco quieres añadir a{' '}
                      <span className="text-slate-900 dark:text-white font-extrabold">
                        {assignmentModal.candidate.patient.name} {assignmentModal.candidate.patient.surname || ''}
                      </span>?
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      El hueco disponible es de {format(slotStart, 'HH:mm')} a {format(slotEnd, 'HH:mm')}. Selecciona la franja horaria:
                    </p>
                  </div>

                  {/* Selector de servicio para ajustar duración de las opciones */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                      Tipo de Sesión / Duración:
                    </label>
                    <select
                      value={assignmentModal.selectedServiceId}
                      onChange={(e) => handleModalServiceChange(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-primary"
                    >
                      {services.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.durationMinutes} min)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Lista interactiva de huecos disponibles */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block">
                      Franjas Horarias Disponibles ({assignmentModal.availableSubSlots.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-1">
                      {assignmentModal.availableSubSlots.map((sub, sIdx) => {
                        const isSelected = assignmentModal.targetSlot.start.getTime() === sub.start.getTime();
                        return (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => setAssignmentModal(prev => prev ? ({ ...prev, targetSlot: sub }) : null)}
                            className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                              isSelected
                                ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                                : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Clock className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-gray-400'}`} />
                              <span className="text-xs tabular-nums">{sub.label}</span>
                            </div>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {assignmentModal.specificNote && (
                    <div className="text-[11px] text-gray-500 bg-gray-50 dark:bg-gray-900/40 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Nota del paciente: </span>
                      {assignmentModal.specificNote}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAssignmentModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmAssignment}
                disabled={savingId !== null}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-dark text-white transition-all shadow-md shadow-primary/20 disabled:opacity-50"
              >
                {savingId !== null ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>
                  {assignmentModal.caseType === 'specific'
                    ? 'Sí, confirmar cita'
                    : `Confirmar en ${assignmentModal.targetSlot.label}`
                  }
                </span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
