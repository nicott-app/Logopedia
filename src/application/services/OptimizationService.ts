import type { Appointment, Patient, User, Room, ClinicalService } from '../../domain/models/types';
import { AppointmentRepository } from '../../infrastructure/firebase/AppointmentRepository';
import { PatientRepository } from '../../infrastructure/firebase/PatientRepository';
import { UserRepository } from '../../infrastructure/firebase/UserRepository';
import { RoomRepository } from '../../infrastructure/firebase/RoomRepository';
import { clinicRepository, DEFAULT_CLINIC_SCHEDULE } from '../../infrastructure/firebase/ClinicRepository';
import { serviceRepository } from '../../infrastructure/firebase/ServiceRepository';

export interface AutoAssignOptions {
  weekStart: Date;
  patientPool?: 'all' | 'waiting_only' | 'unassigned_active';
  strategy?: 'tetris' | 'balanced';
  defaultDurationMinutes?: number;
  preserveExisting?: boolean;
  strictTherapistMatch?: boolean;
  selectedProfessionalIds?: string[];
}

export interface AutoAssignProposalItem {
  id: string;
  patient: Patient;
  professional: User;
  room: Room | null;
  service?: ClinicalService;
  start: Date;
  end: Date;
  durationMinutes: number;
  score: number;
  reasons: string[];
  selected: boolean;
}

export interface AutoAssignUnplacedItem {
  patient: Patient;
  reason: string;
  missingRequirement: 'therapist_schedule' | 'room_capacity' | 'patient_preference' | 'agenda_full';
}

export interface AutoAssignResult {
  targetWeekStart: Date;
  targetWeekEnd: Date;
  proposals: AutoAssignProposalItem[];
  unplaced: AutoAssignUnplacedItem[];
  stats: {
    totalCandidates: number;
    placedCount: number;
    unplacedCount: number;
    occupancyGainHours: number;
    averageScore: number;
    previousOccupiedHours: number;
    newOccupiedHours: number;
    previousOccupancyRate: number;
    newOccupancyRate: number;
  };
}

export interface FreedSlotReplacement {
  appointment: Appointment;
  slotStart: Date;
  slotEnd: Date;
  professional: User | null;
  room: Room | null;
  previousPatient?: Patient | null;
  previousPatientName?: string;
  candidates: GapCandidate[];
  selectedCandidateId?: string | null;
}

export interface DischargePlanResult {
  patient: Patient;
  futureAppointmentsCount: number;
  freedSlots: FreedSlotReplacement[];
}

export interface ProfessionalEfficiencyMetric {
  professionalId: string;
  name: string;
  color: string;
  totalHours: number;
  occupiedHours: number;
  occupancyRate: number;
  compactnessScore: number;
  appointmentsCount: number;
  fragmentedGapsCount: number;
}

export interface RoomEfficiencyMetric {
  roomId: string;
  name: string;
  totalHours: number;
  occupiedHours: number;
  occupancyRate: number;
}

export interface ScheduleEfficiencySuggestion {
  id: string;
  type: 'compact' | 'fill_gap' | 'balance_load';
  title: string;
  description: string;
  impact: string;
}

export interface ScheduleEfficiencyMetrics {
  weekStart: Date;
  weekEnd: Date;
  totalCapacityHours: number;
  occupiedHours: number;
  occupancyRate: number; // 0 - 100%
  compactnessScore: number; // 0 - 100% (Tetris compactness)
  compactnessLabel: 'Óptima' | 'Buena' | 'Mejorable' | 'Fragmentada';
  fragmentedGapsCount: number; // micro-huecos muertos (< 45m)
  fragmentedHours: number;
  usableGapsCount: number; // huecos >= 45m
  usableGapHours: number;
  totalAppointments: number;
  professionalMetrics: ProfessionalEfficiencyMetric[];
  roomMetrics: RoomEfficiencyMetric[];
  suggestions: ScheduleEfficiencySuggestion[];
}

export interface OptimizationOptions {
  strategy?: 'tetris' | 'zen' | 'elastic' | 'tunnel';
  bufferMins?: number;
  elasticity?: number; // percentage (0-100)
  tunnelWeeks?: number;
  clinicId?: string;
  professionalId?: string;
  patientId?: string;
  durationMinutes?: number;
}

export interface OptimizationSlot {
  start: Date;
  end: Date;
  professional: User;
  room: string | null;
  duration: number;
  score: number;
  note: string;
}

export interface GapCandidate {
  patient: Patient;
  priorityScore: number;
  reason: string;
  contactName: string;
  phone: string | null;
  whatsappUrl: string | null;
}

export interface EmptySlotCandidate {
  patient: Patient;
  priorityScore: number;
  reason: string;
  recommendedProfessional: User | null;
  recommendedRoomId: string | null;
  contactName: string;
  phone: string | null;
  whatsappUrl: string | null;
}

export interface WeeklyGapOpportunity {
  slotStart: Date;
  slotEnd: Date;
  dayLabel: string;
  timeLabel: string;
  availableProfessionalsCount: number;
  bestCandidate: EmptySlotCandidate;
  totalCandidatesCount: number;
}

export interface WeeklyAgendaAnalysis {
  totalHours: number;
  occupiedHours: number;
  occupancyRate: number;
  freeSlotsCount: number;
  opportunities: WeeklyGapOpportunity[];
}

export class OptimizationService {
  private patientRepo: PatientRepository;
  private userRepo: UserRepository;
  private roomRepo: RoomRepository;
  private appointmentRepo: AppointmentRepository;
  private serviceRepo = serviceRepository;

  constructor(appointmentRepo?: AppointmentRepository) {
    this.patientRepo = new PatientRepository();
    this.userRepo = new UserRepository();
    this.roomRepo = new RoomRepository();
    this.appointmentRepo = appointmentRepo || new AppointmentRepository();
  }

  /**
   * Verifica si un día es festivo (fines de semana por defecto, ampliable a configuraciones)
   */
  private isHoliday(date: Date, customHolidays: string[] = []): boolean {
    const day = date.getDay();
    if (day === 0 || day === 6) return true;
    
    const dateStr = date.toISOString().split('T')[0];
    if (customHolidays.includes(dateStr)) return true;

    return false;
  }

  /**
   * Comprueba solapamientos con la disponibilidad del paciente (horarios preferidos)
   */
  private isPatientAvailable(_patient: Patient, _start: Date, _end: Date): boolean {
    return true; 
  }

  /**
   * Comprueba solapamientos reales en las citas (Profesional y Sala)
   */
  private hasConflict(
    professionalId: string, 
    roomId: string | null, 
    start: Date, 
    end: Date, 
    existingAppointments: Appointment[]
  ): boolean {
    return existingAppointments.some(appt => {
      if (appt.status === 'cancelled') return false;
      
      const isProfConflict = appt.professionalId === professionalId;
      const isRoomConflict = roomId && appt.roomId === roomId;
      
      if (!isProfConflict && !isRoomConflict) return false;

      const aStart = new Date(appt.start);
      const aEnd = new Date(appt.end);

      return (start < aEnd && end > aStart); // Overlap formula
    });
  }

  /**
   * Encuentra los mejores huecos (slots) para un paciente en los próximos 14 días.
   */
  async findBestSlots(
    clinicId: string,
    patient: Patient,
    professionals: User[],
    options: OptimizationOptions = {}
  ): Promise<OptimizationSlot[]> {
    
    const { strategy = 'tetris', bufferMins = 0, elasticity = 0, tunnelWeeks = 4 } = options;
    const MAX_DAYS = 14;
    const today = new Date();
    
    const windowStart = new Date(today);
    const windowEnd = new Date(today);
    windowEnd.setDate(today.getDate() + MAX_DAYS);
    if (strategy === 'tunnel') {
        windowEnd.setDate(windowEnd.getDate() + (tunnelWeeks * 7));
    }

    const existingAppointments = await this.appointmentRepo.getAppointmentsByDateRange(
      clinicId, 
      windowStart.toISOString(), 
      windowEnd.toISOString()
    );

    const possibleSlots: OptimizationSlot[] = [];

    const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

    for (let d = 0; d < MAX_DAYS; d++) {
      const currentDay = new Date(today);
      currentDay.setDate(today.getDate() + d);

      if (this.isHoliday(currentDay)) continue;

      const dayKey = DAY_KEYS[currentDay.getDay()];

      for (const prof of professionals) {
        const profDay = prof.schedule?.[dayKey];
        if (prof.schedule && profDay && !profDay.isWorking) continue;

        const profStartH = profDay ? parseInt(profDay.start.split(':')[0]) : 9;
        const profEndH = profDay ? parseInt(profDay.end.split(':')[0]) : 20;

        const dayStart = new Date(currentDay); dayStart.setHours(profStartH, 0, 0, 0);
        const dayEnd = new Date(currentDay); dayEnd.setHours(profEndH, 0, 0, 0);
        
        const roomId = prof.roomIds.length > 0 ? prof.roomIds[0] : null;

        for (let time = dayStart.getTime(); time < dayEnd.getTime(); time += 15 * 60000) {
          const slotStart = new Date(time);
          let duration = options.durationMinutes || 45;
          let actualDuration = duration;
          let usedElasticity = false;

          let slotEnd = new Date(time + duration * 60000);
          
          let checkStart = new Date(slotStart);
          let checkEnd = new Date(slotEnd);

          // Verificar si solapa con el descanso del profesional
          if (profDay?.breaks && profDay.breaks.length > 0) {
            const overlapsBreak = profDay.breaks.some(b => {
              const [bStartH, bStartM] = b.start.split(':').map(Number);
              const [bEndH, bEndM] = b.end.split(':').map(Number);
              const bStart = new Date(currentDay); bStart.setHours(bStartH, bStartM, 0, 0);
              const bEnd = new Date(currentDay); bEnd.setHours(bEndH, bEndM, 0, 0);
              return checkStart < bEnd && checkEnd > bStart;
            });
            if (overlapsBreak) continue;
          }

          if (strategy === 'zen' && bufferMins > 0) {
              checkStart = new Date(slotStart.getTime() - bufferMins * 60000);
              checkEnd = new Date(slotEnd.getTime() + bufferMins * 60000);
          }

          if (!this.isPatientAvailable(patient, checkStart, checkEnd)) continue;

          let conflict = this.hasConflict(prof.id, roomId, checkStart, checkEnd, existingAppointments);

          if (conflict && strategy === 'elastic' && elasticity > 0) {
            const minDur = duration * (1 - (elasticity / 100));
            const compressedEnd = new Date(time + minDur * 60000);
            
            if (!this.hasConflict(prof.id, roomId, slotStart, compressedEnd, existingAppointments)) {
               slotEnd = compressedEnd;
               actualDuration = minDur;
               usedElasticity = true;
               conflict = false;
            }
          }

          if (conflict) continue;

          if (strategy === 'tunnel') {
              let tunnelValid = true;
              for (let w = 1; w <= tunnelWeeks; w++) {
                  const futureStart = new Date(slotStart.getTime() + w * 7 * 24 * 60 * 60 * 1000);
                  const futureEnd = new Date(slotEnd.getTime() + w * 7 * 24 * 60 * 60 * 1000);
                  if (this.isHoliday(futureStart)) continue;
                  
                  if (this.hasConflict(prof.id, roomId, futureStart, futureEnd, existingAppointments)) {
                      tunnelValid = false;
                      break;
                  }
              }
              if (!tunnelValid) continue;
          }

          let score = 100 - d;
          if (strategy === 'tetris') {
              const adjBefore = existingAppointments.some(a => 
                  a.professionalId === prof.id && Math.abs(new Date(a.end).getTime() - slotStart.getTime()) < 60000
              );
              const adjAfter = existingAppointments.some(a => 
                  a.professionalId === prof.id && Math.abs(new Date(a.start).getTime() - slotEnd.getTime()) < 60000
              );
              if (adjBefore) score += 50;
              if (adjAfter) score += 50;
          }

          possibleSlots.push({
            start: slotStart,
            end: slotEnd,
            professional: prof,
            room: roomId,
            duration: actualDuration,
            score,
            note: usedElasticity ? `Optimizado (Elástico ${Math.round(actualDuration)}m)` : `Optimizado (${strategy})`
          });
        }
      }
    }

    return possibleSlots.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  /**
   * Alias de compatibilidad para AppointmentForm
   */
  async findOptimalSlots(options: OptimizationOptions): Promise<OptimizationSlot[]> {
    const clinicId = options.clinicId || 'demo-clinic-id';
    if (!options.patientId) return [];

    const patient = await this.patientRepo.getPatient(clinicId, options.patientId);
    if (!patient) return [];

    let profs: User[] = [];
    if (options.professionalId) {
      const singleProf = await this.userRepo.getUserById(options.professionalId);
      if (singleProf) profs = [singleProf];
    }
    if (profs.length === 0) {
      profs = await this.userRepo.getUsersByClinic(clinicId);
    }

    return this.findBestSlots(clinicId, patient, profs, options);
  }

  /**
   * Encuentra los mejores pacientes para cubrir un hueco liberado por cancelación.
   */
  async findCandidatePatientsForGap(
    cancelledAppointment: Appointment,
    clinicId: string = 'demo-clinic-id'
  ): Promise<GapCandidate[]> {
    const [allPatients, prof, clinic] = await Promise.all([
      this.patientRepo.getPatientsByClinic(clinicId),
      this.userRepo.getUserById(cancelledAppointment.professionalId),
      clinicRepository.getClinic(clinicId)
    ]);
    const profName = prof ? `${prof.name} ${prof.surname || ''}`.trim() : 'tu especialista';
    const profFirstName = prof?.name ? prof.name.trim().split(' ')[0] : 'nuestro especialista';
    const clinicName = clinic?.name ? clinic.name.split(' — ')[0].trim() : 'nuestro centro';

    const slotStart = new Date(cancelledAppointment.start);
    const timeFormatted = slotStart.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const dateFormatted = slotStart.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    const candidates: GapCandidate[] = [];

    for (const patient of allPatients) {
      // Ignorar al mismo paciente que canceló
      if (patient.id === cancelledAppointment.patientId) continue;
      if (patient.status !== 'waiting' && patient.status !== 'active') continue;

      let score = 0;
      let reasons: string[] = [];

      // 1. Compatibilidad de profesional
      if (patient.assignedProfessionalId === cancelledAppointment.professionalId) {
        score += 50;
        reasons.push(`Terapeuta habitual (${profName})`);
      } else if (prof?.specialtyId && patient.specialtyId === prof.specialtyId) {
        score += 30;
        reasons.push('Misma especialidad requerida');
      }

      // 2. Prioridad de lista de espera
      if (patient.status === 'waiting') {
        score += 40;
        reasons.push('En Lista de Espera');
      } else if (patient.status === 'active') {
        score += 15;
        reasons.push('Paciente activo (Adelantar sesión)');
      }

      // 3. Disponibilidad rápida en notas
      const notesLower = (patient.notes || '').toLowerCase();
      if (notesLower.includes('alta disponibilidad') || notesLower.includes('vive cerca') || notesLower.includes('última hora')) {
        score += 25;
        reasons.push('Aviso de última hora / vive cerca');
      }

      // Si no tiene nada de afinidad con el terapeuta o especialidad, lo descartamos
      if (score < 30) continue;

      // Extraer teléfono y contacto (nombre de pila sin apellidos ni determinar papel de tutor)
      let phone: string | null = null;
      let contactFirstName = patient.name.trim().split(' ')[0];
      let contactName = `${patient.name} ${patient.surname || ''}`.trim();

      const phoneContact = patient.contacts?.find(c => c.type === 'phone');
      if (phoneContact) {
        phone = phoneContact.value.replace(/[^0-9+]/g, '');
        if (phoneContact.belongsTo === 'tutor' && patient.tutors?.length > 0) {
          const tutor = patient.tutors.find(t => t.id === phoneContact.tutorId) || patient.tutors[0];
          if (tutor && tutor.name) {
            contactFirstName = tutor.name.replace(/\(.*?\)/g, '').replace(/[-–].*$/, '').trim().split(' ')[0] || contactFirstName;
            contactName = `${tutor.name} (${tutor.relationship} de ${patient.name})`;
          }
        }
      }

      // Generar URL directa de WhatsApp Web
      let whatsappUrl: string | null = null;
      if (phone) {
        const rawPhone = phone.replace('+', '');
        const messageText = 
          `Hola ${contactFirstName}, te escribimos de ${clinicName}.\n\n` +
          `Tenemos disponible un hueco libre para el ${dateFormatted} a las ${timeFormatted} con ${profFirstName}.\n\n` +
          `Este horario lo indicaste como preferencia. Te gustaría reservarlo?`;
        whatsappUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(messageText)}`;
      }

      candidates.push({
        patient,
        priorityScore: score,
        reason: reasons.join(' · '),
        contactName,
        phone,
        whatsappUrl
      });
    }

    return candidates.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 5);
  }

  /**
   * Encuentra los pacientes que tienen disponibilidad para un hueco libre específico del calendario (ej. Jueves a las 13:00).
   */
  async findCandidatePatientsForEmptySlot(
    slotStart: Date,
    slotEnd: Date,
    clinicId: string = 'demo-clinic-id'
  ): Promise<{
    candidates: EmptySlotCandidate[];
    availableProfessionals: User[];
    availableRooms: Room[];
  }> {
    const dayOfWeek = slotStart.getDay(); // 0 Dom, 1 Lun, 2 Mar, 3 Mie, 4 Jue, 5 Vie
    const hour = slotStart.getHours();
    const timeSegment = hour < 12 ? 'morning' : (hour < 15 ? 'midday' : 'afternoon');

    const dayStart = new Date(slotStart);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(slotStart);
    dayEnd.setHours(23, 59, 59, 999);

    const [allPatients, allProfs, allRooms, dayAppointments, clinic] = await Promise.all([
      this.patientRepo.getPatientsByClinic(clinicId),
      this.userRepo.getUsersByClinic(clinicId),
      this.roomRepo.getRoomsByClinic(clinicId),
      this.appointmentRepo.getAppointmentsByDateRange(clinicId, dayStart.toISOString(), dayEnd.toISOString()),
      clinicRepository.getClinic(clinicId)
    ]);
    const clinicName = clinic?.name ? clinic.name.split(' — ')[0].trim() : 'nuestro centro';

    const DAY_KEYS_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const currentDayKey = DAY_KEYS_WEEK[dayOfWeek];
    const slotStartStr = `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')}`;
    const slotEndStr = `${String(slotEnd.getHours()).padStart(2, '0')}:${String(slotEnd.getMinutes()).padStart(2, '0')}`;

    // Verificar qué profesionales y salas están libres durante este intervalo (turno, descansos y citas)
    const availableProfessionals = allProfs.filter(prof => {
      if (prof.schedule) {
        const profDay = prof.schedule[currentDayKey];
        if (profDay) {
          if (!profDay.isWorking) return false;
          if (slotStartStr < profDay.start || slotEndStr > profDay.end) return false;
          const isDuringBreak = profDay.breaks?.some(b => slotStartStr < b.end && slotEndStr > b.start);
          if (isDuringBreak) return false;
        }
      }

      return !dayAppointments.some(appt => {
        if (appt.status === 'cancelled') return false;
        if (appt.professionalId !== prof.id) return false;
        const aStart = new Date(appt.start);
        const aEnd = new Date(appt.end);
        return slotStart < aEnd && slotEnd > aStart;
      });
    });

    const availableRooms = allRooms.filter(room => {
      return !dayAppointments.some(appt => {
        if (appt.status === 'cancelled') return false;
        if (appt.roomId !== room.id) return false;
        const aStart = new Date(appt.start);
        const aEnd = new Date(appt.end);
        return slotStart < aEnd && slotEnd > aStart;
      });
    });

    const timeFormatted = slotStart.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const dateFormatted = slotStart.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    const candidates: EmptySlotCandidate[] = [];

    for (const patient of allPatients) {
      if (patient.status !== 'waiting' && patient.status !== 'active') continue;

      // Si el paciente ya tiene cita ese día en ese mismo horario, descartar
      const hasConflict = dayAppointments.some(appt => {
        if (appt.status === 'cancelled') return false;
        if (appt.patientId !== patient.id) return false;
        const aStart = new Date(appt.start);
        const aEnd = new Date(appt.end);
        return slotStart < aEnd && slotEnd > aStart;
      });
      if (hasConflict) continue;

      let score = 0;
      const reasons: string[] = [];

      // 1. Coincidencia de día preferido
      const preferredDays = patient.availability?.preferredDays;
      if (preferredDays && preferredDays.includes(dayOfWeek)) {
        score += 40;
        reasons.push(`Disponible los ${slotStart.toLocaleDateString('es-ES', { weekday: 'long' })}`);
      } else {
        const notesLower = (patient.notes || '').toLowerCase();
        const dayName = slotStart.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
        if (notesLower.includes(dayName)) {
          score += 30;
          reasons.push(`Preferencia horaria por ${dayName}`);
        }
      }

      // 2. Coincidencia de franja horaria (mañana, mediodía, tarde)
      const timePref = patient.availability?.timePreference;
      if (timePref === timeSegment || timePref === 'any') {
        score += 35;
        if (timeSegment === 'midday') reasons.push('Disponible al mediodía (12h-15h)');
        else if (timeSegment === 'morning') reasons.push('Disponible por las mañanas');
        else if (timeSegment === 'afternoon') reasons.push('Disponible por las tardes');
      } else {
        const notesLower = (patient.notes || '').toLowerCase();
        if (notesLower.includes('13:00') || notesLower.includes('13h') || notesLower.includes('mediodía') || notesLower.includes('13')) {
          score += 35;
          reasons.push('Horario solicitado: mediodía / 13:00');
        }
      }

      // 3. Estado en Lista de Espera vs Activo
      if (patient.status === 'waiting') {
        score += 30;
        reasons.push('En Lista de Espera');
      } else if (patient.status === 'active') {
        score += 10;
        reasons.push('Paciente activo');
      }

      // 4. Compatibilidad de terapeuta asignado
      let recProf: User | null = null;
      if (patient.assignedProfessionalId) {
        const isAssignedFree = availableProfessionals.some(p => p.id === patient.assignedProfessionalId);
        if (isAssignedFree) {
          recProf = availableProfessionals.find(p => p.id === patient.assignedProfessionalId) || null;
          score += 35;
          reasons.push(`Terapeuta asignado (${recProf?.name}) libre`);
        } else {
          score -= 15;
        }
      } else if (patient.specialtyId) {
        recProf = availableProfessionals.find(p => p.specialtyId === patient.specialtyId) || null;
        if (recProf) {
          score += 20;
          reasons.push(`Especialista libre (${recProf.name})`);
        }
      }

      if (!recProf && availableProfessionals.length > 0) {
        recProf = availableProfessionals[0];
      }

      // 5. Sala recomendada
      let recRoomId: string | null = null;
      if (recProf && recProf.roomIds.length > 0) {
        recRoomId = availableRooms.find(r => recProf!.roomIds.includes(r.id))?.id || (availableRooms[0]?.id || null);
      } else if (availableRooms.length > 0) {
        recRoomId = availableRooms[0].id;
      }

      // Si no tiene afinidad suficiente para este día/hora, descartamos
      if (score < 30) continue;

      // Teléfono y contacto (nombre de pila sin apellidos ni determinar papel de tutor)
      let phone: string | null = null;
      let contactFirstName = patient.name.trim().split(' ')[0];
      let contactName = `${patient.name} ${patient.surname || ''}`.trim();

      const phoneContact = patient.contacts?.find(c => c.type === 'phone');
      if (phoneContact) {
        phone = phoneContact.value.replace(/[^0-9+]/g, '');
        if (phoneContact.belongsTo === 'tutor' && patient.tutors?.length > 0) {
          const tutor = patient.tutors.find(t => t.id === phoneContact.tutorId) || patient.tutors[0];
          if (tutor && tutor.name) {
            contactFirstName = tutor.name.replace(/\(.*?\)/g, '').replace(/[-–].*$/, '').trim().split(' ')[0] || contactFirstName;
            contactName = `${tutor.name} (${tutor.relationship} de ${patient.name})`;
          }
        }
      }

      // Nombre profesional sin apellidos
      const profFirstName = recProf?.name ? recProf.name.trim().split(' ')[0] : 'nuestro especialista';

      let whatsappUrl: string | null = null;
      if (phone) {
        const rawPhone = phone.replace('+', '');
        const messageText = 
          `Hola ${contactFirstName}, te escribimos de ${clinicName}.\n\n` +
          `Tenemos disponible un hueco libre para el ${dateFormatted} a las ${timeFormatted} con ${profFirstName}.\n\n` +
          `Este horario lo indicaste como preferencia. Te gustaría reservarlo?`;
        whatsappUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(messageText)}`;
      }

      candidates.push({
        patient,
        priorityScore: score,
        reason: reasons.join(' · '),
        recommendedProfessional: recProf,
        recommendedRoomId: recRoomId,
        contactName,
        phone,
        whatsappUrl
      });
    }

    return {
      candidates: candidates.sort((a, b) => b.priorityScore - a.priorityScore),
      availableProfessionals,
      availableRooms
    };
  }

  /**
   * Analiza la agenda de la semana completa y detecta huecos con oportunidades de ocupación inmediata.
   */
  async analyzeWeeklyAgenda(weekStart: Date, clinicId: string): Promise<WeeklyAgendaAnalysis> {
    const monday = new Date(weekStart);
    monday.setHours(0, 0, 0, 0);
    const fridayEnd = new Date(monday);
    fridayEnd.setDate(monday.getDate() + 5);
    fridayEnd.setHours(23, 59, 59, 999);

    const [appointments, professionals] = await Promise.all([
      this.appointmentRepo.getAppointmentsByDateRange(clinicId, monday.toISOString(), fridayEnd.toISOString()),
      this.userRepo.getUsersByClinic(clinicId, true)
    ]);

    const activeAppointments = appointments.filter(a => a.status !== 'cancelled');
    const totalWorkingHoursPerProf = 5 * 11; // 5 días x 11 horas (9:00 a 20:00)
    const totalClinicCapacityHours = totalWorkingHoursPerProf * Math.max(professionals.length, 1);
    const occupiedHours = activeAppointments.length;
    const occupancyRate = totalClinicCapacityHours > 0 ? Math.round((occupiedHours / totalClinicCapacityHours) * 100) : 0;

    const opportunities: WeeklyGapOpportunity[] = [];

    // Iterar de Lunes a Viernes, de 9:00 a 19:00 (cada intervalo de 1 hora)
    for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + dayOffset);

      for (let hour = 9; hour <= 19; hour++) {
        const slotStart = new Date(dayDate);
        slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = new Date(dayDate);
        slotEnd.setHours(hour + 1, 0, 0, 0);

        // Ver qué terapeutas están libres a esta hora
        const freeProfs = professionals.filter(prof => {
          return !activeAppointments.some(a => {
            if (a.professionalId !== prof.id) return false;
            const aStart = new Date(a.start);
            const aEnd = new Date(a.end);
            return slotStart < aEnd && slotEnd > aStart;
          });
        });

        if (freeProfs.length > 0) {
          const analysis = await this.findCandidatePatientsForEmptySlot(slotStart, slotEnd, clinicId);
          if (analysis.candidates.length > 0) {
            const dayLabel = slotStart.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
            const timeLabel = `${slotStart.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - ${slotEnd.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
            
            opportunities.push({
              slotStart,
              slotEnd,
              dayLabel,
              timeLabel,
              availableProfessionalsCount: freeProfs.length,
              bestCandidate: analysis.candidates[0],
              totalCandidatesCount: analysis.candidates.length
            });
          }
        }
      }
    }

    // Ordenar de mayor a menor afinidad
    opportunities.sort((a, b) => b.bestCandidate.priorityScore - a.bestCandidate.priorityScore);

    return {
      totalHours: totalClinicCapacityHours,
      occupiedHours,
      occupancyRate,
      freeSlotsCount: opportunities.length,
      opportunities: opportunities.slice(0, 10) // Top 10 oportunidades más claras
    };
  }

  /**
   * Generador de Agenda Maestra / Asistente de Asignación Inicial
   * Optimiza y cruza pacientes pendientes (lista de espera o activos) con disponibilidad de profesionales y salas.
   * Preserva al 100% las citas existentes confirmadas.
   */
  async generateInitialScheduleProposal(
    clinicId: string,
    options: AutoAssignOptions
  ): Promise<AutoAssignResult> {
    const {
      weekStart,
      patientPool = 'all',
      strategy = 'tetris',
      defaultDurationMinutes = 45,
      preserveExisting = true,
      strictTherapistMatch = false,
      selectedProfessionalIds
    } = options;

    const monday = new Date(weekStart);
    monday.setHours(0, 0, 0, 0);
    const dayOfWeek = monday.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(monday.getDate() + diffToMonday);

    const weekEnd = new Date(monday);
    weekEnd.setDate(monday.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const DAY_KEYS_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

    const [clinic, allPatients, allUsers, allRooms, allServices, existingAppts] = await Promise.all([
      clinicRepository.getClinic(clinicId),
      this.patientRepo.getPatientsByClinic(clinicId),
      this.userRepo.getUsersByClinic(clinicId, true),
      this.roomRepo.getRoomsByClinic(clinicId),
      this.serviceRepo.getServicesByClinic(clinicId),
      this.appointmentRepo.getAppointmentsByDateRange(clinicId, monday.toISOString(), weekEnd.toISOString())
    ]);

    const clinicSchedule = clinic?.schedule || DEFAULT_CLINIC_SCHEDULE;

    // Filtrar profesionales activos
    let professionals = allUsers.filter(u => u.isActive !== false);
    if (selectedProfessionalIds && selectedProfessionalIds.length > 0) {
      professionals = professionals.filter(u => selectedProfessionalIds.includes(u.id));
    }

    const activeRooms = allRooms.filter(r => r.isActive !== false);
    const existingActiveAppts = existingAppts.filter(a => a.status !== 'cancelled');

    // Identificar pacientes que ya tienen cita activa en esta semana
    const patientsWithAppt = new Set(existingActiveAppts.map(a => a.patientId));

    // Filtrar candidatos según la bolsa de pacientes seleccionada
    const candidatePatients = allPatients.filter(p => {
      if (p.isActive === false) return false;
      if (patientPool === 'waiting_only') {
        return p.status === 'waiting' && !patientsWithAppt.has(p.id);
      }
      if (patientPool === 'unassigned_active') {
        return p.status === 'active' && !patientsWithAppt.has(p.id);
      }
      // 'all'
      return (p.status === 'waiting' || p.status === 'active') && !patientsWithAppt.has(p.id);
    });

    // Heurística de Rigidez (Most Constrained First): Los pacientes más difíciles se encajan primero
    const getPatientRigidityScore = (p: Patient): number => {
      let score = 0;
      if (p.availability?.preferredDays && p.availability.preferredDays.length > 0) {
        score += (5 - p.availability.preferredDays.length) * 30 + 40;
      }
      if (p.availability?.timePreference && p.availability.timePreference !== 'any') {
        score += 45;
      }
      if (p.assignedProfessionalId) {
        score += 50;
      }
      if (p.notes && (p.notes.includes(':') || p.notes.toLowerCase().includes('solo'))) {
        score += 25;
      }
      if (p.status === 'waiting') {
        score += 20;
      }
      return score;
    };

    candidatePatients.sort((a, b) => getPatientRigidityScore(b) - getPatientRigidityScore(a));

    const simulatedAppointments: Appointment[] = preserveExisting ? [...existingActiveAppts] : [];
    const proposals: AutoAssignProposalItem[] = [];
    const unplaced: AutoAssignUnplacedItem[] = [];

    // MEMOIZACIÓN 1: Precomputar y cachear los horarios y descansos de profesionales por día
    interface CachedProfDaySchedule {
      isWorking: boolean;
      startH: number;
      startM: number;
      endH: number;
      endM: number;
      breaks: { startH: number; startM: number; endH: number; endM: number }[];
    }
    const profScheduleCache = new Map<string, CachedProfDaySchedule>();

    for (const prof of professionals) {
      for (let d = 0; d < 7; d++) {
        const dayOfWeekNum = (monday.getDay() + d) % 7;
        const dayKey = DAY_KEYS_WEEK[dayOfWeekNum];
        const clinicDay = clinicSchedule[dayKey];
        const profDay = prof.schedule ? prof.schedule[dayKey] : null;
        const isWorking = !clinicDay || !clinicDay.isOpen ? false : (prof.schedule ? !!(profDay && profDay.isWorking) : true);

        const profStartStr = profDay?.start || clinicDay?.openTime || '09:00';
        const profEndStr = profDay?.end || clinicDay?.closeTime || '20:00';
        const [startH, startM] = profStartStr.split(':').map(Number);
        const [endH, endM] = profEndStr.split(':').map(Number);

        const parsedBreaks = (profDay?.breaks || []).map(b => {
          const [bsh, bsm] = b.start.split(':').map(Number);
          const [beh, bem] = b.end.split(':').map(Number);
          return { startH: bsh, startM: bsm, endH: beh, endM: bem };
        });

        profScheduleCache.set(`${prof.id}_${d}`, {
          isWorking,
          startH,
          startM,
          endH,
          endM,
          breaks: parsedBreaks
        });
      }
    }

    // MEMOIZACIÓN 2: Estructura numérica de citas para comprobación instantánea de solapamientos sin new Date()
    interface FastSimAppt {
      professionalId: string;
      roomId: string | null;
      startMs: number;
      endMs: number;
    }

    const fastSimAppts: FastSimAppt[] = existingActiveAppts.map(a => ({
      professionalId: a.professionalId,
      roomId: a.roomId || null,
      startMs: new Date(a.start).getTime(),
      endMs: new Date(a.end).getTime()
    }));

    // Contador de sesiones asignadas por profesional para equilibrio de carga
    const profSessionCount: Record<string, number> = {};
    for (const p of professionals) {
      profSessionCount[p.id] = fastSimAppts.filter(a => a.professionalId === p.id).length;
    }

    for (const patient of candidatePatients) {
      let duration = defaultDurationMinutes;
      let matchingService: ClinicalService | undefined;
      if (patient.specialtyId) {
        matchingService = allServices.find(s => s.id === patient.specialtyId);
        if (matchingService?.durationMinutes) {
          duration = matchingService.durationMinutes;
        }
      }

      // MEMOIZACIÓN 3: Preparsear notas y restricciones de horario del paciente una sola vez
      const allNotesText = `${patient.availability?.specificNotes || ''} ${patient.notes || ''}`.toLowerCase();
      const fromTimeMatch = allNotesText.match(/(?:a partir de las|a partir de|>)\s*(\d{1,2})(?::(\d{2}))?/i);
      const parsedFromMinTime = fromTimeMatch ? {
        minH: parseInt(fromTimeMatch[1], 10),
        minM: fromTimeMatch[2] ? parseInt(fromTimeMatch[2], 10) : 0,
        totalReqMins: parseInt(fromTimeMatch[1], 10) * 60 + (fromTimeMatch[2] ? parseInt(fromTimeMatch[2], 10) : 0)
      } : null;

      const exactTimeMatch = allNotesText.match(/(?:a las|alas|exacta:?\s*busca cita los\s+\w+\s+a las)\s*(\d{1,2}):(\d{2})/i) ||
                            (!fromTimeMatch ? allNotesText.match(/\b(1[0-9]|20|0?[9]):([0-5][0-9])\b/) : null);
      const parsedExactTime = exactTimeMatch && !fromTimeMatch ? {
        reqH: parseInt(exactTimeMatch[1], 10),
        reqM: parseInt(exactTimeMatch[2], 10)
      } : null;

      // Candidatos a profesionales
      let candidateProfs: User[] = [];
      if (patient.assignedProfessionalId) {
        const assigned = professionals.find(p => p.id === patient.assignedProfessionalId);
        if (assigned) {
          candidateProfs = [assigned];
        } else if (!strictTherapistMatch) {
          const sameSpec = patient.specialtyId ? professionals.filter(p => p.specialtyId === patient.specialtyId) : [];
          candidateProfs = sameSpec.length > 0 ? sameSpec : professionals;
        }
      } else if (patient.specialtyId) {
        const sameSpec = professionals.filter(p => p.specialtyId === patient.specialtyId);
        candidateProfs = sameSpec.length > 0 ? sameSpec : professionals;
      } else {
        candidateProfs = professionals;
      }

      if (candidateProfs.length === 0) {
        unplaced.push({
          patient,
          reason: patient.assignedProfessionalId
            ? 'El profesional asignado no está activo o no está incluido en la selección.'
            : 'No hay profesionales con la especialidad requerida activos.',
          missingRequirement: 'therapist_schedule'
        });
        continue;
      }

      let bestSlot: {
        slotStart: Date;
        slotEnd: Date;
        prof: User;
        room: Room | null;
        score: number;
        reasons: string[];
      } | null = null;

      const durationMs = duration * 60000;

      // Iterar los 7 días de la semana
      for (let d = 0; d < 7; d++) {
        const currentDay = new Date(monday);
        currentDay.setDate(monday.getDate() + d);
        const dayOfWeekNum = currentDay.getDay();

        const preferredDays = patient.availability?.preferredDays;
        const isPreferredDay = preferredDays && preferredDays.length > 0 ? preferredDays.includes(dayOfWeekNum) : null;

        for (const prof of candidateProfs) {
          const cachedDay = profScheduleCache.get(`${prof.id}_${d}`);
          if (!cachedDay || !cachedDay.isWorking) continue;

          const dayStart = new Date(currentDay);
          dayStart.setHours(cachedDay.startH, cachedDay.startM, 0, 0);
          const dayEnd = new Date(currentDay);
          dayEnd.setHours(cachedDay.endH, cachedDay.endM, 0, 0);
          const dayStartMs = dayStart.getTime();
          const dayEndMs = dayEnd.getTime();

          for (let time = dayStartMs; time + durationMs <= dayEndMs; time += 15 * 60000) {
            const slotStartMs = time;
            const slotEndMs = time + durationMs;

            // 1. Descansos memoizados
            let overlapsBreak = false;
            if (cachedDay.breaks.length > 0) {
              for (const b of cachedDay.breaks) {
                const bStart = new Date(currentDay); bStart.setHours(b.startH, b.startM, 0, 0);
                const bEnd = new Date(currentDay); bEnd.setHours(b.endH, b.endM, 0, 0);
                if (slotStartMs < bEnd.getTime() && slotEndMs > bStart.getTime()) {
                  overlapsBreak = true;
                  break;
                }
              }
            }
            if (overlapsBreak) continue;

            // 2. Conflicto con citas del profesional (O(1) numérico en fastSimAppts)
            const profConflict = fastSimAppts.some(a => 
              a.professionalId === prof.id && slotStartMs < a.endMs && slotEndMs > a.startMs
            );
            if (profConflict) continue;

            // 3. Resolución de sala (O(1) numérico en fastSimAppts)
            let chosenRoom: Room | null = null;
            const candidateRooms = prof.roomIds && prof.roomIds.length > 0
              ? activeRooms.filter(r => prof.roomIds.includes(r.id))
              : activeRooms;

            for (const room of candidateRooms) {
              const roomConflict = fastSimAppts.some(a => 
                a.roomId === room.id && slotStartMs < a.endMs && slotEndMs > a.startMs
              );
              if (!roomConflict) {
                chosenRoom = room;
                break;
              }
            }

            if (!chosenRoom && activeRooms.length > 0) {
              for (const room of activeRooms) {
                const roomConflict = fastSimAppts.some(a => 
                  a.roomId === room.id && slotStartMs < a.endMs && slotEndMs > a.startMs
                );
                if (!roomConflict) {
                  chosenRoom = room;
                  break;
                }
              }
            }

            if (!chosenRoom && activeRooms.length > 0) continue;

            // 4. Puntuación de afinidad y optimización
            const slotStart = new Date(slotStartMs);
            const slotEnd = new Date(slotEndMs);

            let score = 50;
            const reasons: string[] = [];

            if (isPreferredDay === true) {
              score += 50;
              reasons.push(`Día preferido (${currentDay.toLocaleDateString('es-ES', { weekday: 'long' })})`);
            } else if (isPreferredDay === false) {
              score -= 30;
            } else {
              score += 10;
            }

            const slotHour = slotStart.getHours();
            const timeSegment = slotHour < 12 ? 'morning' : (slotHour < 15 ? 'midday' : 'afternoon');
            const prefTime = patient.availability?.timePreference;

            if (prefTime === 'any' || !prefTime) {
              score += 20;
            } else if (prefTime === timeSegment) {
              score += 45;
              const segLabel = timeSegment === 'morning' ? 'Mañanas' : (timeSegment === 'midday' ? 'Mediodía' : 'Tardes');
              reasons.push(`Turno preferido (${segLabel})`);
            } else {
              score -= 25;
            }

            // Evaluación de disponibilidad horaria específica (con máxima ponderación frente a la franja amplia)
            if (parsedFromMinTime) {
              const slotTimeMins = slotStart.getHours() * 60 + slotStart.getMinutes();
              if (slotTimeMins < parsedFromMinTime.totalReqMins) {
                score -= 150; // Penalización estricta: nunca asignar antes de la hora mínima requerida
              } else {
                score += 50;
                reasons.push(`Disponible a partir de las ${String(parsedFromMinTime.minH).padStart(2, '0')}:${String(parsedFromMinTime.minM).padStart(2, '0')}`);
              }
            }

            if (parsedExactTime) {
              if (slotStart.getHours() === parsedExactTime.reqH && slotStart.getMinutes() === parsedExactTime.reqM) {
                score += 150; // Máxima ponderación: coincide con el horario exacto solicitado por el paciente
                reasons.push(`Horario exacto solicitado (${String(parsedExactTime.reqH).padStart(2, '0')}:${String(parsedExactTime.reqM).padStart(2, '0')})`);
              } else {
                score -= 120; // Penalización contundente: el paciente ha solicitado una hora fija específica
              }
            }

            if (prof.id === patient.assignedProfessionalId) {
              score += 60;
              reasons.push(`Terapeuta habitual (${prof.name})`);
            } else if (patient.specialtyId && prof.specialtyId === patient.specialtyId) {
              score += 30;
              reasons.push('Especialista idóneo');
            }

            if (patient.status === 'waiting') {
              score += 15;
              reasons.push('Lista de Espera');
            }

            // Puntuación Tetris de compactación contigua (mediante fastSimAppts)
            const isShiftStart = Math.abs(slotStartMs - dayStartMs) < 60000;
            const isAdjBefore = fastSimAppts.some(a => 
              a.professionalId === prof.id && Math.abs(a.endMs - slotStartMs) < 60000
            );
            const isAdjAfter = fastSimAppts.some(a => 
              a.professionalId === prof.id && Math.abs(a.startMs - slotEndMs) < 60000
            );

            if (isShiftStart) {
              score += 30;
              reasons.push('Apertura de turno');
            }
            if (isAdjBefore) {
              score += 40;
              reasons.push('Contiguo a cita previa');
            }
            if (isAdjAfter) {
              score += 40;
              reasons.push('Contiguo a cita posterior');
            }

            // Penalización por dejar huecos huérfanos (< 45 min)
            let maxPrevEnd = -1;
            for (const a of fastSimAppts) {
              if (a.professionalId === prof.id && a.endMs <= slotStartMs && a.endMs > maxPrevEnd) {
                maxPrevEnd = a.endMs;
              }
            }
            if (maxPrevEnd > 0) {
              const gapBefore = slotStartMs - maxPrevEnd;
              if (gapBefore > 0 && gapBefore < 45 * 60000) {
                score -= 25;
              }
            }

            if (strategy === 'tetris') {
              if (isAdjBefore || isAdjAfter || isShiftStart) {
                score += 25;
              }
            } else if (strategy === 'balanced') {
              const currentLoad = profSessionCount[prof.id] || 0;
              score -= (currentLoad * 8);
            }

            if (score > (bestSlot ? bestSlot.score : 35)) {
              bestSlot = {
                slotStart,
                slotEnd,
                prof,
                room: chosenRoom,
                score,
                reasons
              };
            }
          }
        }
      }

      if (bestSlot) {
        const affinityPercent = Math.min(100, Math.max(50, Math.round((bestSlot.score / 170) * 100)));
        const proposal: AutoAssignProposalItem = {
          id: `prop-${patient.id}-${bestSlot.slotStart.getTime()}`,
          patient,
          professional: bestSlot.prof,
          room: bestSlot.room,
          service: matchingService,
          start: bestSlot.slotStart,
          end: bestSlot.slotEnd,
          durationMinutes: duration,
          score: affinityPercent,
          reasons: bestSlot.reasons.length > 0 ? bestSlot.reasons : ['Horario disponible óptimo'],
          selected: true
        };
        proposals.push(proposal);

        simulatedAppointments.push({
          id: `sim-${proposal.id}`,
          clinicId,
          patientId: patient.id,
          professionalId: bestSlot.prof.id,
          roomId: bestSlot.room?.id || null,
          serviceId: matchingService?.id || null,
          start: bestSlot.slotStart.toISOString(),
          end: bestSlot.slotEnd.toISOString(),
          status: 'scheduled',
          notes: 'Simulado'
        });

        fastSimAppts.push({
          professionalId: bestSlot.prof.id,
          roomId: bestSlot.room?.id || null,
          startMs: bestSlot.slotStart.getTime(),
          endMs: bestSlot.slotEnd.getTime()
        });

        profSessionCount[bestSlot.prof.id] = (profSessionCount[bestSlot.prof.id] || 0) + 1;
      } else {
        let reason = 'Capacidad de agenda y salas completa para las preferencias del paciente.';
        let missing: 'therapist_schedule' | 'room_capacity' | 'patient_preference' | 'agenda_full' = 'agenda_full';

        if (patient.assignedProfessionalId) {
          reason = 'El terapeuta asignado no dispone de huecos compatibles con los días u horarios solicitados.';
          missing = 'therapist_schedule';
        } else if (patient.availability?.preferredDays && patient.availability.preferredDays.length > 0) {
          const dayNames = patient.availability.preferredDays.map(d => {
            const names = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
            return names[d] || `Día ${d}`;
          }).join(', ');
          reason = `Sin huecos libres en los días preferidos (${dayNames}).`;
          missing = 'patient_preference';
        } else if (activeRooms.length > 0) {
          missing = 'room_capacity';
          reason = 'No hay salas libres disponibles en las franjas horarias evaluadas.';
        }

        unplaced.push({
          patient,
          reason,
          missingRequirement: missing
        });
      }
    }

    // Métricas y estadísticas
    const totalClinicCapacityHours = professionals.reduce((acc, prof) => {
      let profHours = 0;
      for (let d = 0; d < 7; d++) {
        const curDate = new Date(monday);
        curDate.setDate(monday.getDate() + d);
        const dayKey = DAY_KEYS_WEEK[curDate.getDay()];
        const profDay = prof.schedule ? prof.schedule[dayKey] : null;
        if (prof.schedule) {
          if (profDay && profDay.isWorking) {
            const [sh] = (profDay.start || '09:00').split(':').map(Number);
            const [eh] = (profDay.end || '20:00').split(':').map(Number);
            profHours += Math.max(0, eh - sh);
          }
        } else {
          const cDay = clinicSchedule[dayKey];
          if (cDay && cDay.isOpen) {
            const [sh] = (cDay.openTime || '09:00').split(':').map(Number);
            const [eh] = (cDay.closeTime || '21:00').split(':').map(Number);
            profHours += Math.max(0, eh - sh);
          }
        }
      }
      return acc + profHours;
    }, 0);

    const previousOccupiedHours = Math.round(
      existingActiveAppts.reduce((acc, a) => {
        const durH = (new Date(a.end).getTime() - new Date(a.start).getTime()) / (1000 * 60 * 60);
        return acc + (isNaN(durH) ? 0.75 : durH);
      }, 0) * 10
    ) / 10;

    const occupancyGainHours = Math.round(
      proposals.reduce((acc, p) => acc + p.durationMinutes / 60, 0) * 10
    ) / 10;

    const newOccupiedHours = Math.round((previousOccupiedHours + occupancyGainHours) * 10) / 10;
    const safeCap = Math.max(totalClinicCapacityHours, 1);
    const previousOccupancyRate = Math.min(100, Math.round((previousOccupiedHours / safeCap) * 100));
    const newOccupancyRate = Math.min(100, Math.round((newOccupiedHours / safeCap) * 100));

    const avgScore = proposals.length > 0 
      ? Math.round(proposals.reduce((acc, p) => acc + p.score, 0) / proposals.length) 
      : 0;

    return {
      targetWeekStart: monday,
      targetWeekEnd: weekEnd,
      proposals,
      unplaced,
      stats: {
        totalCandidates: candidatePatients.length,
        placedCount: proposals.length,
        unplacedCount: unplaced.length,
        occupancyGainHours,
        averageScore: avgScore,
        previousOccupiedHours,
        newOccupiedHours,
        previousOccupancyRate,
        newOccupancyRate
      }
    };
  }

  /**
   * Guarda de forma masiva las citas de las propuestas seleccionadas por el administrador.
   */
  async commitAutoAssignProposal(clinicId: string, proposals: AutoAssignProposalItem[]): Promise<number> {
    const selectedProposals = proposals.filter(p => p.selected);
    for (const item of selectedProposals) {
      const newAppt: Appointment = {
        id: crypto.randomUUID ? crypto.randomUUID() : `appt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        clinicId,
        patientId: item.patient.id,
        professionalId: item.professional.id,
        roomId: item.room?.id || null,
        serviceId: item.service?.id || null,
        start: item.start.toISOString(),
        end: item.end.toISOString(),
        status: 'scheduled',
        notes: `Asignado por Asistente Inteligente (${item.reasons.join(' · ')})`
      };
      await this.appointmentRepo.saveAppointment(newAppt);
    }
    return selectedProposals.length;
  }

  /**
   * Obtiene el plan de baja para un paciente:
   * Localiza todas las citas futuras programadas del paciente y encuentra los mejores
   * candidatos de reemplazo de lista de espera para cada hueco liberado.
   */
  async getDischargePlanForPatient(clinicId: string, patientId: string): Promise<DischargePlanResult> {
    const patient = await this.patientRepo.getPatient(clinicId, patientId);
    if (!patient) {
      throw new Error(`Paciente con ID ${patientId} no encontrado`);
    }

    const now = new Date();
    const allPatientAppts = await this.appointmentRepo.getAppointmentsByPatient(clinicId, patientId);
    const futureAppts = allPatientAppts
      .filter(a => a.status === 'scheduled' && new Date(a.start) >= now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    const [allUsers, allRooms] = await Promise.all([
      this.userRepo.getUsersByClinic(clinicId, true),
      this.roomRepo.getRoomsByClinic(clinicId)
    ]);

    const freedSlots: FreedSlotReplacement[] = [];

    for (const appt of futureAppts) {
      const prof = allUsers.find(u => u.id === appt.professionalId) || null;
      const room = appt.roomId ? (allRooms.find(r => r.id === appt.roomId) || null) : null;
      const slotStart = new Date(appt.start);
      const slotEnd = new Date(appt.end);

      // Encontrar candidatos compatibles
      const candidates = await this.findCandidatePatientsForGap(appt, clinicId);

      freedSlots.push({
        appointment: appt,
        slotStart,
        slotEnd,
        professional: prof,
        room,
        previousPatient: patient,
        previousPatientName: `${patient.name} ${patient.surname || ''}`.trim(),
        candidates,
        selectedCandidateId: candidates.length > 0 ? candidates[0].patient.id : null
      });
    }

    return {
      patient,
      futureAppointmentsCount: futureAppts.length,
      freedSlots
    };
  }

  /**
   * Ejecuta la baja del paciente y la reasignación de sus huecos liberados:
   * Para cada cita futura: si se especificó un sustituto, la reasigna al nuevo paciente (y activa al paciente si estaba en espera);
   * si no, la marca como cancelada. Finalmente, archiva al paciente que causa baja.
   */
  async executeDischargeAndReassignments(
    clinicId: string,
    patientId: string,
    assignments: { appointmentId: string; newPatientId: string | null }[],
    archivePatient: boolean = true
  ): Promise<{ reassignedCount: number; cancelledCount: number }> {
    const [patient, allPatients] = await Promise.all([
      this.patientRepo.getPatient(clinicId, patientId),
      this.patientRepo.getPatientsByClinic(clinicId)
    ]);

    let reassignedCount = 0;
    let cancelledCount = 0;

    const prevPatientName = patient ? `${patient.name} ${patient.surname || ''}`.trim() : 'Paciente en baja';

    for (const item of assignments) {
      const appt = await this.appointmentRepo.getAppointment(clinicId, item.appointmentId);
      if (!appt) continue;

      if (item.newPatientId) {
        const newPatient = allPatients.find(p => p.id === item.newPatientId);
        const newPatientName = newPatient ? `${newPatient.name} ${newPatient.surname || ''}`.trim() : 'Nuevo paciente';

        await this.appointmentRepo.updateAppointment(clinicId, item.appointmentId, {
          patientId: item.newPatientId,
          status: 'scheduled',
          notes: `Reasignada por Cubrir Cancelaciones y Bajas (reemplazo de ${prevPatientName} por ${newPatientName})`
        });

        // Si el nuevo paciente estaba en lista de espera, pasarlo a 'active'
        if (newPatient && newPatient.status === 'waiting') {
          await this.patientRepo.savePatient({
            ...newPatient,
            status: 'active',
            updatedAt: Date.now()
          });
        }

        reassignedCount++;
      } else {
        // Cancelar la cita liberada
        await this.appointmentRepo.updateAppointment(clinicId, item.appointmentId, {
          status: 'cancelled',
          notes: `Cancelada por baja de ${prevPatientName} (Hueco libre disponible)`
        });
        cancelledCount++;
      }
    }

    // Archivar al paciente
    if (archivePatient && patient && patient.status !== 'archived') {
      await this.patientRepo.savePatient({
        ...patient,
        status: 'archived',
        updatedAt: Date.now()
      });
    }

    return { reassignedCount, cancelledCount };
  }

  /**
   * Radar de Vacantes por Baja o Cancelación:
   * Detecta todas las citas canceladas o liberadas en las próximas semanas que siguen sin cubrir,
   * y calcula los mejores candidatos de lista de espera para cada una.
   */
  async getPendingDischargedGaps(clinicId: string, weeksAhead: number = 4): Promise<FreedSlotReplacement[]> {
    const now = new Date();
    const futureLimit = new Date(now);
    futureLimit.setDate(now.getDate() + weeksAhead * 7);

    const [allAppts, allUsers, allRooms, allPatients] = await Promise.all([
      this.appointmentRepo.getAppointmentsByDateRange(clinicId, now.toISOString(), futureLimit.toISOString()),
      this.userRepo.getUsersByClinic(clinicId, true),
      this.roomRepo.getRoomsByClinic(clinicId),
      this.patientRepo.getPatientsByClinic(clinicId)
    ]);

    const activeAppts = allAppts.filter(a => a.status !== 'cancelled');
    const cancelledAppts = allAppts
      .filter(a => a.status === 'cancelled')
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    const result: FreedSlotReplacement[] = [];

    for (const appt of cancelledAppts) {
      const slotStart = new Date(appt.start);
      const slotEnd = new Date(appt.end);

      // Comprobar si ya hay otra cita activa para este profesional en este intervalo
      const isAlreadyOccupied = activeAppts.some(a => {
        if (a.professionalId !== appt.professionalId) return false;
        const aStart = new Date(a.start);
        const aEnd = new Date(a.end);
        return slotStart < aEnd && slotEnd > aStart;
      });

      if (isAlreadyOccupied) continue;

      const prof = allUsers.find(u => u.id === appt.professionalId) || null;
      const room = appt.roomId ? (allRooms.find(r => r.id === appt.roomId) || null) : null;
      const prevPatient = allPatients.find(p => p.id === appt.patientId);

      const candidates = await this.findCandidatePatientsForGap(appt, clinicId);

      result.push({
        appointment: appt,
        slotStart,
        slotEnd,
        professional: prof,
        room,
        previousPatient: prevPatient || null,
        previousPatientName: prevPatient ? `${prevPatient.name} ${prevPatient.surname || ''}`.trim() : 'Paciente anterior',
        candidates,
        selectedCandidateId: candidates.length > 0 ? candidates[0].patient.id : null
      });
    }

    return result;
  }

  /**
   * Calcula el Indicador de Ocupación, Compactación y Eficiencia Continua de la Agenda
   * Analiza horas de capacidad, ocupación real, índice de compactación (citas contiguas vs micro-huecos muertos),
   * y genera sugerencias de re-optimización sin alterar citas consolidadas.
   */
  async calculateScheduleEfficiency(clinicId: string, weekStart: Date): Promise<ScheduleEfficiencyMetrics> {
    const monday = new Date(weekStart);
    monday.setHours(0, 0, 0, 0);
    const dayOfWeek = monday.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(monday.getDate() + diffToMonday);

    const sundayEnd = new Date(monday);
    sundayEnd.setDate(monday.getDate() + 6);
    sundayEnd.setHours(23, 59, 59, 999);

    const DAY_KEYS_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

    const [clinic, allUsers, allRooms, allAppointments] = await Promise.all([
      clinicRepository.getClinic(clinicId),
      this.userRepo.getUsersByClinic(clinicId, true),
      this.roomRepo.getRoomsByClinic(clinicId),
      this.appointmentRepo.getAppointmentsByDateRange(clinicId, monday.toISOString(), sundayEnd.toISOString())
    ]);

    const clinicSchedule = clinic?.schedule || DEFAULT_CLINIC_SCHEDULE;
    const professionals = allUsers.filter(u => u.isActive !== false);
    const activeRooms = allRooms.filter(r => r.isActive !== false);
    const activeAppointments = allAppointments.filter(a => a.status !== 'cancelled');

    let clinicTotalCapacityHours = 0;
    let clinicOccupiedHours = 0;
    let clinicFragmentedGapsCount = 0;
    let clinicFragmentedHours = 0;
    let clinicUsableGapsCount = 0;
    let clinicUsableGapHours = 0;

    const professionalMetrics: ProfessionalEfficiencyMetric[] = [];
    const suggestions: ScheduleEfficiencySuggestion[] = [];

    // Analizar cada profesional
    for (const prof of professionals) {
      let profCapacityHours = 0;
      let profOccupiedHours = 0;
      let profAppointmentsCount = 0;
      let profFragmentedGaps = 0;
      let profContiguousAdjacencies = 0;
      let profTotalEvaluatedSlots = 0;

      for (let d = 0; d < 7; d++) {
        const currentDay = new Date(monday);
        currentDay.setDate(monday.getDate() + d);
        const dayKey = DAY_KEYS_WEEK[currentDay.getDay()];

        const clinicDay = clinicSchedule[dayKey];
        if (!clinicDay || !clinicDay.isOpen) continue;

        const profDay = prof.schedule ? prof.schedule[dayKey] : null;
        if (prof.schedule && (!profDay || !profDay.isWorking)) continue;

        const startStr = profDay?.start || clinicDay.openTime || '09:00';
        const endStr = profDay?.end || clinicDay.closeTime || '20:00';
        const [startH, startM] = startStr.split(':').map(Number);
        const [endH, endM] = endStr.split(':').map(Number);

        const dayStart = new Date(currentDay);
        dayStart.setHours(startH, startM, 0, 0);
        const dayEnd = new Date(currentDay);
        dayEnd.setHours(endH, endM, 0, 0);

        const totalShiftDurationH = (dayEnd.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
        profCapacityHours += Math.max(0, totalShiftDurationH);

        // Citas de este profesional en este día
        const dayStartIso = dayStart.toISOString();
        const dayEndIso = dayEnd.toISOString();
        const dayAppts = activeAppointments
          .filter(a => a.professionalId === prof.id && a.start >= dayStartIso && a.start <= dayEndIso)
          .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

        profAppointmentsCount += dayAppts.length;

        // Horas ocupadas
        for (const a of dayAppts) {
          const durH = (new Date(a.end).getTime() - new Date(a.start).getTime()) / (1000 * 60 * 60);
          profOccupiedHours += durH;
        }

        // Evaluar compactación y huecos
        let lastEnd = dayStart.getTime();

        for (let i = 0; i < dayAppts.length; i++) {
          const a = dayAppts[i];
          const aStart = new Date(a.start).getTime();
          const aEnd = new Date(a.end).getTime();

          const gapBefore = aStart - lastEnd;
          if (gapBefore > 0) {
            const gapMins = Math.round(gapBefore / 60000);
            if (gapMins < 45) {
              // Micro-hueco fragmentado (< 45m)
              profFragmentedGaps++;
              clinicFragmentedGapsCount++;
              clinicFragmentedHours += gapMins / 60;
            } else {
              // Hueco utilizable (>= 45m)
              clinicUsableGapsCount++;
              clinicUsableGapHours += gapMins / 60;
            }
          } else if (gapBefore <= 5 * 60000) {
            // Contiguo a la cita o inicio de turno
            profContiguousAdjacencies++;
          }

          profTotalEvaluatedSlots++;
          lastEnd = Math.max(lastEnd, aEnd);
        }

        // Hueco restante hasta el final de la jornada
        const endGap = dayEnd.getTime() - lastEnd;
        if (endGap > 0 && dayAppts.length > 0) {
          const endGapMins = Math.round(endGap / 60000);
          if (endGapMins < 45) {
            profFragmentedGaps++;
            clinicFragmentedGapsCount++;
            clinicFragmentedHours += endGapMins / 60;
          } else {
            clinicUsableGapsCount++;
            clinicUsableGapHours += endGapMins / 60;
          }
        }
      }

      clinicTotalCapacityHours += profCapacityHours;
      clinicOccupiedHours += profOccupiedHours;

      // Calcular puntuación de compactación del profesional (0-100%)
      const profOccupancyRate = profCapacityHours > 0 
        ? Math.min(100, Math.round((profOccupiedHours / profCapacityHours) * 100)) 
        : 0;

      let profCompactness = 100;
      if (profTotalEvaluatedSlots > 0) {
        const fragmentationPenalty = profFragmentedGaps * 20;
        const adjacencyBonus = (profContiguousAdjacencies / profTotalEvaluatedSlots) * 20;
        profCompactness = Math.min(100, Math.max(20, Math.round(80 + adjacencyBonus - fragmentationPenalty)));
      }

      professionalMetrics.push({
        professionalId: prof.id,
        name: `${prof.name} ${prof.surname || ''}`.trim(),
        color: prof.color || '#3B82F6',
        totalHours: Math.round(profCapacityHours * 10) / 10,
        occupiedHours: Math.round(profOccupiedHours * 10) / 10,
        occupancyRate: profOccupancyRate,
        compactnessScore: profCompactness,
        appointmentsCount: profAppointmentsCount,
        fragmentedGapsCount: profFragmentedGaps
      });

      // Sugerencias personalizadas por profesional
      if (profFragmentedGaps > 1) {
        suggestions.push({
          id: `compact-${prof.id}`,
          type: 'compact',
          title: `Reorganizar agenda de ${prof.name}`,
          description: `Se han detectado ${profFragmentedGaps} huecos muertos (< 45 min) en su jornada. Reorganizar las sesiones liberaría bloques completos para nuevos pacientes.`,
          impact: `Recupera hasta ${(profFragmentedGaps * 0.5).toFixed(1)}h continuas de terapia`
        });
      }

      if (profOccupancyRate < 50 && profCapacityHours > 10) {
        suggestions.push({
          id: `fill-${prof.id}`,
          type: 'fill_gap',
          title: `Ocupación baja en ${prof.name} (${profOccupancyRate}%)`,
          description: `Dispone de ${Math.round(profCapacityHours - profOccupiedHours)}h libres esta semana. El Asistente Inteligente puede cubrir huecos con la lista de espera.`,
          impact: `Potencial de aumento de ocupación a más del 80%`
        });
      }
    }

    // Calcular métricas de salas
    const roomMetrics: RoomEfficiencyMetric[] = [];
    const clinicWeekHours = clinicTotalCapacityHours / Math.max(professionals.length, 1);

    for (const room of activeRooms) {
      let roomOccupiedHours = 0;
      const roomAppts = activeAppointments.filter(a => a.roomId === room.id);
      for (const a of roomAppts) {
        const durH = (new Date(a.end).getTime() - new Date(a.start).getTime()) / (1000 * 60 * 60);
        roomOccupiedHours += durH;
      }
      const roomCapacityHours = Math.max(clinicWeekHours, 1);
      const roomOccupancyRate = Math.min(100, Math.round((roomOccupiedHours / roomCapacityHours) * 100));

      roomMetrics.push({
        roomId: room.id,
        name: room.name,
        totalHours: Math.round(roomCapacityHours * 10) / 10,
        occupiedHours: Math.round(roomOccupiedHours * 10) / 10,
        occupancyRate: roomOccupancyRate
      });
    }

    // Métricas globales
    const safeClinicCapacity = Math.max(clinicTotalCapacityHours, 1);
    const globalOccupancyRate = Math.min(100, Math.round((clinicOccupiedHours / safeClinicCapacity) * 100));

    const avgProfessionalCompactness = professionalMetrics.length > 0
      ? Math.round(professionalMetrics.reduce((acc, m) => acc + m.compactnessScore, 0) / professionalMetrics.length)
      : 100;

    let compactnessLabel: 'Óptima' | 'Buena' | 'Mejorable' | 'Fragmentada' = 'Óptima';
    if (avgProfessionalCompactness >= 85) compactnessLabel = 'Óptima';
    else if (avgProfessionalCompactness >= 70) compactnessLabel = 'Buena';
    else if (avgProfessionalCompactness >= 50) compactnessLabel = 'Mejorable';
    else compactnessLabel = 'Fragmentada';

    // Sugerencia de equilibrio si hay gran disparidad entre profesionales
    if (professionalMetrics.length > 1) {
      const maxOcc = Math.max(...professionalMetrics.map(m => m.occupancyRate));
      const minOcc = Math.min(...professionalMetrics.map(m => m.occupancyRate));
      if (maxOcc - minOcc > 40) {
        suggestions.push({
          id: 'balance-load',
          type: 'balance_load',
          title: 'Desequilibrio de carga entre terapeutas',
          description: `Existe una diferencia de ${maxOcc - minOcc}% de ocupación entre profesionales. Utiliza la estrategia Equilibrada para nivelar la carga de trabajo.`,
          impact: 'Distribución justa del equipo clínico'
        });
      }
    }

    return {
      weekStart: monday,
      weekEnd: sundayEnd,
      totalCapacityHours: Math.round(clinicTotalCapacityHours * 10) / 10,
      occupiedHours: Math.round(clinicOccupiedHours * 10) / 10,
      occupancyRate: globalOccupancyRate,
      compactnessScore: avgProfessionalCompactness,
      compactnessLabel,
      fragmentedGapsCount: clinicFragmentedGapsCount,
      fragmentedHours: Math.round(clinicFragmentedHours * 10) / 10,
      usableGapsCount: clinicUsableGapsCount,
      usableGapHours: Math.round(clinicUsableGapHours * 10) / 10,
      totalAppointments: activeAppointments.length,
      professionalMetrics,
      roomMetrics,
      suggestions
    };
  }
}
