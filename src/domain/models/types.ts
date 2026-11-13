export type Role = 'admin' | 'professional' | 'employee';

export interface User {
  id: string; // Firebase Auth UID
  clinicId: string;
  name: string;
  surname?: string;
  email: string;
  role: Role;
  isActive: boolean;
  color: string;
  specialtyId?: string; // N:1 - Professional has one main specialty
  roomIds: string[]; // M:N - Assigned rooms
  schedule?: ProfessionalSchedule; // Horario laboral y descansos
}

export interface Specialty {
  id: string;
  clinicId: string;
  name: string;
  color: string;
  description: string;
  isActive: boolean;
}

export interface Room {
  id: string;
  clinicId: string;
  name: string;
  type: string;
  capacity: number;
  materials: string[];
  professionalIds: string[]; 
  isActive: boolean;
}

export interface Tutor {
  id: string;
  name: string;
  relationship: string;
  dni: string; // Cifrado en cliente
}

export interface Contact {
  id: string;
  type: 'phone' | 'email';
  value: string;
  belongsTo: 'patient' | 'tutor';
  tutorId?: string; // If belongs to a tutor
}

export interface Patient {
  id: string;
  clinicId: string;
  name: string;
  surname: string;
  dateOfBirth?: string; // ISO Date (YYYY-MM-DD)
  gender?: 'M' | 'F' | 'Other';
  dni?: string; // Cifrado en cliente
  
  tutors: Tutor[];
  contacts: Contact[];
  
  status: 'active' | 'waiting' | 'archived' | 'deleted';
  assignedProfessionalId: string | null; 
  specialtyId?: string; // Especialidad principal del tratamiento
  
  notes: string; // Observaciones internas, avisos y comentarios de gestión
  medicalHistory?: string; // Historial clínico, motivo de consulta, diagnóstico y evolución del tratamiento
  availability?: PatientAvailability;
  
  consentSigned: boolean;
  consentSignedAt?: number;
  consentVersion?: string;
  
  createdAt: number;
  updatedAt: number;
  isActive: boolean; // Soft delete for RGPD
}

export interface PatientAvailability {
  preferredDays?: number[]; // 1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes
  timePreference?: 'morning' | 'midday' | 'afternoon' | 'any'; // morning: 9-12, midday: 12-15, afternoon: 15-20
  specificNotes?: string;
}

export interface Appointment {
  id: string;
  clinicId: string;
  patientId: string;
  professionalId: string;
  roomId: string | null;
  serviceId?: string | null;
  start: string; // ISO string
  end: string; // ISO string
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string;
}

export interface ClinicalService {
  id: string;
  clinicId: string;
  name: string;
  durationMinutes: number; // 30, 45, 60...
  price?: number;
  description?: string;
  color?: string;
  isActive: boolean;
}

export interface WorkBreak {
  id: string;
  name: string; // "Comida", "Descanso"
  start: string; // "14:00"
  end: string; // "15:00"
}

export interface DaySchedule {
  isOpen: boolean;
  openTime: string; // "09:00"
  closeTime: string; // "21:00"
}

export interface ClinicSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface ProfessionalDaySchedule {
  isWorking: boolean;
  start: string; // "09:00"
  end: string; // "19:00"
  breaks: WorkBreak[]; // Descansos
}

export interface ProfessionalSchedule {
  monday: ProfessionalDaySchedule;
  tuesday: ProfessionalDaySchedule;
  wednesday: ProfessionalDaySchedule;
  thursday: ProfessionalDaySchedule;
  friday: ProfessionalDaySchedule;
  saturday: ProfessionalDaySchedule;
  sunday: ProfessionalDaySchedule;
}

export interface Clinic {
  id: string;
  name: string;
  createdAt: number;
  phone?: string;
  email?: string;
  address?: string;
  sector?: string;
  inviteCode?: string;
  logoUrl?: string;
  schedule?: ClinicSchedule;
  cif?: string; // NIF / CIF del Responsable del Tratamiento
  dpoEmail?: string; // Email de contacto para protección de datos y ejercicio de derechos ARCO
}

export interface SectorDefinition {
  id: string;
  name: string;
  prefix: string;
  description: string;
  icon: string;
}

export const CLINIC_SECTORS: SectorDefinition[] = [
  { id: 'logopedia', name: 'Logopedia y Neurodesarrollo', prefix: 'LOGO', description: 'Trastornos del habla, lenguaje, deglución y comunicación.', icon: '🗣️' },
  { id: 'psicologia', name: 'Psicología y Salud Mental', prefix: 'PSIC', description: 'Psicoterapia adultos, infantil, parejas y bienestar emocional.', icon: '🧠' },
  { id: 'fisioterapia', name: 'Fisioterapia y Rehabilitación', prefix: 'FISO', description: 'Terapia manual, traumatología, deportiva y reeducación postural.', icon: '⚡' },
  { id: 'odontologia', name: 'Odontología y Clínica Dental', prefix: 'DENT', description: 'Ortodoncia, implantología, estética dental y odontopediatría.', icon: '🦷' },
  { id: 'podologia', name: 'Podología y Biomecánica', prefix: 'PODO', description: 'Estudio de la pisada, quiropodia, plantillas y pie diabético.', icon: '👣' },
  { id: 'nutricion', name: 'Nutrición y Dietética', prefix: 'NUTR', description: 'Educación nutricional, nutrición deportiva y clínica.', icon: '🥗' },
  { id: 'terapia_ocupacional', name: 'Terapia Ocupacional y Atención Temprana', prefix: 'TEOC', description: 'Integración sensorial, autonomía y desarrollo psicomotor.', icon: '🧩' },
  { id: 'medicina_estetica', name: 'Medicina Estética y Dermatología', prefix: 'ESTE', description: 'Tratamientos faciales, corporales y cuidado dermatológico.', icon: '✨' },
  { id: 'veterinaria', name: 'Centros y Clínicas Veterinarias', prefix: 'VETE', description: 'Medicina general, vacunación, cirugías y bienestar animal.', icon: '🐾' },
  { id: 'psicopedagogia', name: 'Psicopedagogía y Apoyo al Aprendizaje', prefix: 'PEDG', description: 'Dificultades lectoescritoras, TDAH y refuerzo escolar.', icon: '📚' },
  { id: 'otro', name: 'Policlínica Multidisciplinar / Otro', prefix: 'CLIN', description: 'Centros con múltiples especialidades o disciplinas de salud.', icon: '🏥' }
];

export interface LegalConsent {
  id: string;
  clinicId: string;
  patientId: string;
  type: string;
  version?: string;
  documentVersion?: string;
  signedAt: number;
  tutorId?: string;
  signatureDataUrl?: string;
}

