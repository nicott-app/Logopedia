import { startOfWeek, addDays, setHours, setMinutes } from 'date-fns';
import type { Specialty, Room, User, Patient, Appointment, ClinicalService, Clinic, ProfessionalSchedule, LegalConsent } from '../../domain/models/types';
import { localStore } from '../../infrastructure/storage/localStore';
import { SpecialtyRepository } from '../../infrastructure/firebase/SpecialtyRepository';
import { RoomRepository } from '../../infrastructure/firebase/RoomRepository';
import { UserRepository } from '../../infrastructure/firebase/UserRepository';
import { PatientRepository } from '../../infrastructure/firebase/PatientRepository';
import { AppointmentRepository } from '../../infrastructure/firebase/AppointmentRepository';
import { ServiceRepository } from '../../infrastructure/firebase/ServiceRepository';
import { ConsentRepository } from '../../infrastructure/firebase/ConsentRepository';
import { clinicRepository, DEFAULT_CLINIC_SCHEDULE } from '../../infrastructure/firebase/ClinicRepository';

export class SeedService {
  private specialtyRepo = new SpecialtyRepository();
  private roomRepo = new RoomRepository();
  private userRepo = new UserRepository();
  private patientRepo = new PatientRepository();
  private appointmentRepo = new AppointmentRepository();
  private serviceRepo = new ServiceRepository();
  private consentRepo = new ConsentRepository();

  async generateMockData(clinicId: string = 'demo-clinic-id'): Promise<void> {
    // 0. Servicios Clínicos y Duraciones
    const services: ClinicalService[] = [
      {
        id: 'serv-1',
        clinicId,
        name: 'Terapia de Articulación y Habla (30 min)',
        durationMinutes: 30,
        price: 30,
        description: 'Sesión intensiva de articulación, discriminación auditiva y praxias linguales.',
        color: '#4A7C9B',
        isActive: true
      },
      {
        id: 'serv-2',
        clinicId,
        name: 'Sesión Estándar Logopedia Infantil (45 min)',
        durationMinutes: 45,
        price: 40,
        description: 'Intervención global de lenguaje, comprensión, expresión y lectoescritura.',
        color: '#427A65',
        isActive: true
      },
      {
        id: 'serv-3',
        clinicId,
        name: 'Evaluación y Diagnóstico Inicial (60 min)',
        durationMinutes: 60,
        price: 60,
        description: 'Batería de pruebas clínicas, anamnesis con la familia y valoración funcional.',
        color: '#636688',
        isActive: true
      },
      {
        id: 'serv-4',
        clinicId,
        name: 'Terapia Miofuncional y Deglución (30 min)',
        durationMinutes: 30,
        price: 32,
        description: 'Terapia orofacial y reeducación deglutoria focalizada.',
        color: '#9C6D53',
        isActive: true
      },
      {
        id: 'serv-5',
        clinicId,
        name: 'Rehabilitación Vocal y Foniatría (45 min)',
        durationMinutes: 45,
        price: 42,
        description: 'Higiene vocal, impostación y control de sobreesfuerzo laríngeo.',
        color: '#7D6378',
        isActive: true
      }
    ];

    // 1. Especialidades
    const specialties: Specialty[] = [
      {
        id: 'spec-1',
        clinicId,
        name: 'Logopedia Infantil y Habla',
        color: '#3B82F6',
        description: 'Trastornos del lenguaje (TEL/TDL), habla, articulación y dislalias infantiles.',
        isActive: true
      },
      {
        id: 'spec-2',
        clinicId,
        name: 'Terapia Miofuncional y Deglución',
        color: '#10B981',
        description: 'Rehabilitación de deglución atípica, respiración oral, frenillo lingual y hábitos orofaciales.',
        isActive: true
      },
      {
        id: 'spec-3',
        clinicId,
        name: 'Neuropsicología y Aprendizaje',
        color: '#8B5CF6',
        description: 'Intervención en dislexia, TDAH, discalculia y funciones ejecutivas en edad escolar.',
        isActive: true
      },
      {
        id: 'spec-4',
        clinicId,
        name: 'Patología Vocal y Adultos',
        color: '#F59E0B',
        description: 'Rehabilitación de disfonías profesionales, nódulos de cuerdas vocales y afasias.',
        isActive: true
      }
    ];

    // 2. Salas
    const rooms: Room[] = [
      {
        id: 'room-1',
        clinicId,
        name: 'Sala 1 — Cabina de Foniatría y Voz',
        type: 'Cabina insonorizada',
        capacity: 2,
        materials: ['Espejo Glatzel', 'Grabador calibrado', 'Láminas fonéticas', 'Espirómetro'],
        professionalIds: ['prof-1', 'prof-4'],
        isActive: true
      },
      {
        id: 'room-2',
        clinicId,
        name: 'Sala 2 — Estimulación y Juego Simbólico',
        type: 'Atención Temprana',
        capacity: 4,
        materials: ['Juego simbólico', 'Pictogramas ARASAAC', 'Mesa sensorial', 'Caja de praxias'],
        professionalIds: ['prof-1'],
        isActive: true
      },
      {
        id: 'room-3',
        clinicId,
        name: 'Sala 3 — Terapia Miofuncional',
        type: 'Gabinete orofacial',
        capacity: 2,
        materials: ['Botoneras labiales', 'Depresores', 'Gomas ortodóncicas', 'Espejo odontológico'],
        professionalIds: ['prof-2'],
        isActive: true
      },
      {
        id: 'room-4',
        clinicId,
        name: 'Sala 4 — Neuropsicología y Estudio',
        type: 'Despacho de evaluación',
        capacity: 3,
        materials: ['Batería PROLEC-R', 'Test WISC-V', 'Ordenador de tareas visuales'],
        professionalIds: ['prof-3'],
        isActive: true
      }
    ];

    // Función auxiliar para horarios y descansos de profesionales
    const createProfSchedule = (start: string, end: string, breakName: string, breakStart: string, breakEnd: string): ProfessionalSchedule => {
      const weekday = {
        isWorking: true,
        start,
        end,
        breaks: [{ id: `break-${breakStart}`, name: breakName, start: breakStart, end: breakEnd }]
      };
      const weekend = {
        isWorking: false,
        start: '09:00',
        end: '14:00',
        breaks: []
      };
      return {
        monday: { ...weekday },
        tuesday: { ...weekday },
        wednesday: { ...weekday },
        thursday: { ...weekday },
        friday: { ...weekday },
        saturday: { ...weekend },
        sunday: { ...weekend }
      };
    };

    // 3. Profesionales del equipo con sus horarios y descansos
    const professionals: User[] = [
      {
        id: 'prof-1',
        clinicId,
        name: 'Ana',
        surname: 'Gómez Serrano',
        email: 'ana.gomez@logopedia.com',
        role: 'professional',
        color: '#4A7C9B',
        specialtyId: 'spec-1',
        roomIds: ['room-1', 'room-2'],
        schedule: createProfSchedule('09:00', '19:00', 'Comida', '14:00', '15:00'),
        isActive: true
      },
      {
        id: 'prof-2',
        clinicId,
        name: 'Carlos',
        surname: 'Ruiz Benítez',
        email: 'carlos.ruiz@logopedia.com',
        role: 'professional',
        color: '#427A65',
        specialtyId: 'spec-2',
        roomIds: ['room-3'],
        schedule: createProfSchedule('10:00', '20:00', 'Comida', '14:30', '15:30'),
        isActive: true
      },
      {
        id: 'prof-3',
        clinicId,
        name: 'Elena',
        surname: 'Morales Vidal',
        email: 'elena.morales@logopedia.com',
        role: 'professional',
        color: '#636688',
        specialtyId: 'spec-3',
        roomIds: ['room-4'],
        schedule: createProfSchedule('09:00', '18:00', 'Almuerzo', '13:30', '14:30'),
        isActive: true
      },
      {
        id: 'prof-4',
        clinicId,
        name: 'David',
        surname: 'Navarro Pons',
        email: 'david.navarro@logopedia.com',
        role: 'professional',
        color: '#9C6D53',
        specialtyId: 'spec-4',
        roomIds: ['room-1'],
        schedule: createProfSchedule('15:00', '21:00', 'Pausa', '18:30', '19:00'),
        isActive: true
      }
    ];

    // 4. Pacientes (Activos y en Lista de Espera)
    const patients: Patient[] = [
      // --- ACTIVOS ---
      {
        id: 'pat-1',
        clinicId,
        name: 'Lucas',
        surname: 'Sánchez Moreno',
        dateOfBirth: '2019-04-12',
        gender: 'M',
        dni: '48912345A',
        status: 'active',
        assignedProfessionalId: 'prof-1',
        specialtyId: 'spec-1',
        medicalHistory: 'Dislalia múltiple (rotacismo y ceceo). Sesión semanal de 45m. Ejercicios articulatorios y miofuncionales.',
        notes: 'La madre prefiere que el contacto sea vía WhatsApp antes de las 14:00.',
        consentSigned: true,
        consentSignedAt: Date.now() - 30 * 24 * 3600 * 1000,
        createdAt: Date.now() - 40 * 24 * 3600 * 1000,
        updatedAt: Date.now(),
        isActive: true,
        tutors: [
          { id: 'tut-1', name: 'María Moreno', relationship: 'Madre', dni: '75489632F' }
        ],
        contacts: [
          { id: 'con-1', type: 'phone', value: '+34 612 345 678', belongsTo: 'tutor', tutorId: 'tut-1' },
          { id: 'con-2', type: 'email', value: 'maria.moreno@gmail.com', belongsTo: 'tutor', tutorId: 'tut-1' }
        ]
      },
      {
        id: 'pat-2',
        clinicId,
        name: 'Mateo',
        surname: 'Fernández Gil',
        dateOfBirth: '2018-09-22',
        gender: 'M',
        dni: '49123847B',
        status: 'active',
        assignedProfessionalId: 'prof-2',
        specialtyId: 'spec-2',
        medicalHistory: 'Deglución disfuncional atípica en tratamiento de ortodoncia interceptiva. Ejercicios de reposición lingual.',
        notes: 'Acude acompañado por el padre habitualmente.',
        consentSigned: true,
        consentSignedAt: Date.now() - 60 * 24 * 3600 * 1000,
        createdAt: Date.now() - 65 * 24 * 3600 * 1000,
        updatedAt: Date.now(),
        isActive: true,
        tutors: [
          { id: 'tut-2', name: 'Roberto Fernández', relationship: 'Padre', dni: '52896314G' }
        ],
        contacts: [
          { id: 'con-3', type: 'phone', value: '+34 623 456 789', belongsTo: 'tutor', tutorId: 'tut-2' }
        ]
      },
      {
        id: 'pat-3',
        clinicId,
        name: 'Sofía',
        surname: 'Ramos Cruz',
        dateOfBirth: '2020-02-14',
        gender: 'F',
        dni: '50239485C',
        status: 'active',
        assignedProfessionalId: 'prof-1',
        specialtyId: 'spec-1',
        medicalHistory: 'TEL expresivo con dificultades morfosintácticas. Muy participativa y colaboradora en las actividades lúdicas.',
        notes: 'Avisar siempre con 24h de antelación para cambios.',
        consentSigned: true,
        consentSignedAt: Date.now() - 20 * 24 * 3600 * 1000,
        createdAt: Date.now() - 25 * 24 * 3600 * 1000,
        updatedAt: Date.now(),
        isActive: true,
        tutors: [
          { id: 'tut-3', name: 'Carmen Cruz', relationship: 'Madre', dni: '48756321K' }
        ],
        contacts: [
          { id: 'con-4', type: 'phone', value: '+34 634 567 890', belongsTo: 'tutor', tutorId: 'tut-3' }
        ]
      },
      {
        id: 'pat-4',
        clinicId,
        name: 'Hugo',
        surname: 'López Vega',
        dateOfBirth: '2017-06-05',
        gender: 'M',
        dni: '51982734D',
        status: 'active',
        assignedProfessionalId: 'prof-3',
        specialtyId: 'spec-3',
        medicalHistory: 'Dislexia evolutiva fonológica. Trabajo con software de lectura y conciencia fonológica.',
        notes: 'Trae su propio material de lectura del colegio.',
        consentSigned: true,
        consentSignedAt: Date.now() - 15 * 24 * 3600 * 1000,
        createdAt: Date.now() - 20 * 24 * 3600 * 1000,
        updatedAt: Date.now(),
        isActive: true,
        tutors: [
          { id: 'tut-4', name: 'Francisco López', relationship: 'Padre', dni: '74125896P' }
        ],
        contacts: [
          { id: 'con-5', type: 'phone', value: '+34 645 678 901', belongsTo: 'tutor', tutorId: 'tut-4' }
        ]
      },
      {
        id: 'pat-5',
        clinicId,
        name: 'Valeria',
        surname: 'Díaz Romero',
        dateOfBirth: '2021-11-03',
        gender: 'F',
        status: 'active',
        assignedProfessionalId: 'prof-1',
        specialtyId: 'spec-1',
        medicalHistory: 'Atención temprana. Retraso simple de adquisición léxica. Estimulación del vocabulario y turnos comunicativos.',
        notes: 'Sesiones preferiblemente por las mañanas.',
        consentSigned: true,
        consentSignedAt: Date.now() - 10 * 24 * 3600 * 1000,
        createdAt: Date.now() - 12 * 24 * 3600 * 1000,
        updatedAt: Date.now(),
        isActive: true,
        tutors: [
          { id: 'tut-5', name: 'Laura Romero', relationship: 'Madre', dni: '45698712S' }
        ],
        contacts: [
          { id: 'con-6', type: 'phone', value: '+34 656 789 012', belongsTo: 'tutor', tutorId: 'tut-5' }
        ]
      },
      {
        id: 'pat-6',
        clinicId,
        name: 'Lucía',
        surname: 'Ortiz Benítez',
        dateOfBirth: '1991-08-19',
        gender: 'F',
        status: 'active',
        assignedProfessionalId: 'prof-4',
        specialtyId: 'spec-4',
        medicalHistory: 'Profesora de primaria. Disfonía funcional hipercinética con nódulos incipientes. Higiene vocal y pautas de emisión.',
        notes: 'Facturación a nombre de autónomo trimestral.',
        consentSigned: true,
        consentSignedAt: Date.now() - 45 * 24 * 3600 * 1000,
        createdAt: Date.now() - 50 * 24 * 3600 * 1000,
        updatedAt: Date.now(),
        isActive: true,
        tutors: [],
        contacts: [
          { id: 'con-7', type: 'phone', value: '+34 667 890 123', belongsTo: 'patient' },
          { id: 'con-8', type: 'email', value: 'lucia.ortiz@colegio.es', belongsTo: 'patient' }
        ]
      },

      // --- EN LISTA DE ESPERA (Candidatos para cubrir huecos de última hora) ---
      {
        id: 'pat-7',
        clinicId,
        name: 'Leo',
        surname: 'Domínguez Ruiz',
        dateOfBirth: '2019-10-15',
        gender: 'M',
        status: 'waiting',
        assignedProfessionalId: 'prof-1',
        specialtyId: 'spec-1',
        medicalHistory: 'Retraso fonológico y habla inteligible reducida. Se recomienda estimulación precoz y seguimiento bimensual.',
        notes: '⭐ ALTA DISPONIBILIDAD: Vive a 5 minutos de la clínica. La madre puede venir con 20 minutos de aviso.',
        availability: { preferredDays: [1, 2, 3, 4, 5], timePreference: 'any', specificNotes: 'Cualquier día y hora' },
        consentSigned: true,
        consentSignedAt: Date.now() - 5 * 24 * 3600 * 1000,
        createdAt: Date.now() - 10 * 24 * 3600 * 1000,
        updatedAt: Date.now(),
        isActive: true,
        tutors: [
          { id: 'tut-7', name: 'Patricia Ruiz', relationship: 'Madre', dni: '51234987W' }
        ],
        contacts: [
          { id: 'con-9', type: 'phone', value: '+34 690 123 456', belongsTo: 'tutor', tutorId: 'tut-7' }
        ]
      },
      {
        id: 'pat-8',
        clinicId,
        name: 'Nora',
        surname: 'Ibáñez Castillo',
        dateOfBirth: '2020-03-30',
        gender: 'F',
        status: 'waiting',
        assignedProfessionalId: 'prof-2',
        specialtyId: 'spec-2',
        medicalHistory: 'Derivada de Odontopediatría. Deglución atípica con interposición lingual anterior y sellado labial incompetente.',
        notes: 'Disponible tardes a partir de las 16:30. Padre recoge a las 16:15.',
        availability: { preferredDays: [1, 2, 3, 4, 5], timePreference: 'afternoon', specificNotes: 'Tardes a partir de 16:30' },
        consentSigned: true,
        consentSignedAt: Date.now() - 8 * 24 * 3600 * 1000,
        createdAt: Date.now() - 14 * 24 * 3600 * 1000,
        updatedAt: Date.now(),
        isActive: true,
        tutors: [
          { id: 'tut-8', name: 'Manuel Ibáñez', relationship: 'Padre', dni: '48651234M' }
        ],
        contacts: [
          { id: 'con-10', type: 'phone', value: '+34 601 234 567', belongsTo: 'tutor', tutorId: 'tut-8' }
        ]
      },
      {
        id: 'pat-9',
        clinicId,
        name: 'Álvaro',
        surname: 'Serrano Gil',
        dateOfBirth: '2018-01-18',
        gender: 'M',
        status: 'waiting',
        assignedProfessionalId: 'prof-3',
        specialtyId: 'spec-3',
        medicalHistory: 'Dificultades atencionales, velocidad de procesamiento y comprensión lectora.',
        notes: 'Prefiere sesiones en horario de tarde (lunes o miércoles).',
        availability: { preferredDays: [1, 3], timePreference: 'afternoon', specificNotes: 'Lunes o miércoles tarde' },
        consentSigned: false,
        createdAt: Date.now() - 12 * 24 * 3600 * 1000,
        updatedAt: Date.now(),
        isActive: true,
        tutors: [
          { id: 'tut-9', name: 'Rocío Gil', relationship: 'Madre', dni: '78451236V' }
        ],
        contacts: [
          { id: 'con-11', type: 'phone', value: '+34 612 987 654', belongsTo: 'tutor', tutorId: 'tut-9' }
        ]
      },
      {
        id: 'pat-10',
        clinicId,
        name: 'Claudia',
        surname: 'Marín Soler',
        dateOfBirth: '2021-05-12',
        gender: 'F',
        status: 'waiting',
        assignedProfessionalId: 'prof-1',
        specialtyId: 'spec-1',
        medicalHistory: 'Dislalia fonema /s/ y /ch/. Valoración miofuncional completada.',
        notes: 'Familia disponible cualquier día entre semana a partir de las 17:00.',
        availability: { preferredDays: [1, 2, 3, 4, 5], timePreference: 'afternoon', specificNotes: 'Cualquier día > 17:00' },
        consentSigned: true,
        consentSignedAt: Date.now() - 3 * 24 * 3600 * 1000,
        createdAt: Date.now() - 7 * 24 * 3600 * 1000,
        updatedAt: Date.now(),
        isActive: true,
        tutors: [
          { id: 'tut-10', name: 'Andrés Marín', relationship: 'Padre', dni: '49876543Z' }
        ],
        contacts: [
          { id: 'con-12', type: 'phone', value: '+34 623 876 543', belongsTo: 'tutor', tutorId: 'tut-10' }
        ]
      },
      {
        id: 'pat-11',
        clinicId,
        name: 'Carla',
        surname: 'Navarro Vega',
        dateOfBirth: '2019-08-20',
        gender: 'F',
        status: 'waiting',
        assignedProfessionalId: 'prof-1',
        specialtyId: 'spec-1',
        medicalHistory: 'Dislalia funcional múltiple fonemas /r/ y /s/. Fuerza lingual adecuada, requiere reeducación del punto y modo de articulación.',
        notes: '⭐ DISPONIBILIDAD EXACTA: Busca cita los JUEVES a las 13:00 al salir del colegio. Madre trabaja en la misma calle.',
        availability: { preferredDays: [4], timePreference: 'midday', specificNotes: 'Jueves a las 13:00' },
        consentSigned: true,
        consentSignedAt: Date.now() - 4 * 24 * 3600 * 1000,
        createdAt: Date.now() - 6 * 24 * 3600 * 1000,
        updatedAt: Date.now(),
        isActive: true,
        tutors: [
          { id: 'tut-11', name: 'Patricia Vega', relationship: 'Madre', dni: '48963251J' }
        ],
        contacts: [
          { id: 'con-13', type: 'phone', value: '+34 654 321 987', belongsTo: 'tutor', tutorId: 'tut-11' }
        ]
      },
      {
        id: 'pat-12',
        clinicId,
        name: 'Enzo',
        surname: 'Romero Soler',
        dateOfBirth: '2018-05-14',
        gender: 'M',
        status: 'waiting',
        assignedProfessionalId: 'prof-2',
        specialtyId: 'spec-2',
        medicalHistory: 'Deglución atípica y respirador oral secundario a hipertrofia adenoidea intervenida.',
        notes: 'Disponible martes y jueves mediodía (12:30 a 14:00).',
        availability: { preferredDays: [2, 4], timePreference: 'midday', specificNotes: 'Martes y jueves 12:30 - 14:00' },
        consentSigned: true,
        consentSignedAt: Date.now() - 9 * 24 * 3600 * 1000,
        createdAt: Date.now() - 11 * 24 * 3600 * 1000,
        updatedAt: Date.now(),
        isActive: true,
        tutors: [
          { id: 'tut-12', name: 'Mónica Soler', relationship: 'Madre', dni: '52147896X' }
        ],
        contacts: [
          { id: 'con-14', type: 'phone', value: '+34 665 432 109', belongsTo: 'tutor', tutorId: 'tut-12' }
        ]
      }
    ];

    // 5. Citas para la semana actual
    const today = new Date();
    const monday = startOfWeek(today, { weekStartsOn: 1 });

    const createSlot = (dayOffset: number, hour: number, minute: number, durationMins: number = 45) => {
      const targetDay = addDays(monday, dayOffset);
      const start = setMinutes(setHours(targetDay, hour), minute);
      const end = setMinutes(setHours(targetDay, hour), minute + durationMins);
      return {
        start: start.toISOString(),
        end: end.toISOString()
      };
    };

    const appointments: Appointment[] = [
      // LUNES
      {
        id: 'appt-1',
        clinicId,
        patientId: 'pat-1',
        professionalId: 'prof-1',
        roomId: 'room-2',
        serviceId: 'serv-1',
        ...createSlot(0, 10, 0, 30),
        status: 'completed',
        notes: 'Sesión de articulación /r/ y praxias.'
      },
      {
        id: 'appt-2',
        clinicId,
        patientId: 'pat-2',
        professionalId: 'prof-2',
        roomId: 'room-3',
        serviceId: 'serv-2',
        ...createSlot(0, 16, 30, 45),
        status: 'completed',
        notes: 'Control deglución atípica.'
      },

      // MARTES
      {
        id: 'appt-3',
        clinicId,
        patientId: 'pat-3',
        professionalId: 'prof-1',
        roomId: 'room-2',
        serviceId: 'serv-1',
        ...createSlot(1, 11, 0, 30),
        status: 'completed',
        notes: 'TEL y estimulación morfosintáctica.'
      },
      {
        id: 'appt-4',
        clinicId,
        patientId: 'pat-4',
        professionalId: 'prof-3',
        roomId: 'room-4',
        serviceId: 'serv-2',
        ...createSlot(1, 17, 0, 45),
        status: 'scheduled',
        notes: 'Entrenamiento fonológico.'
      },

      // MIÉRCOLES (Citas para el día central)
      {
        id: 'appt-5',
        clinicId,
        patientId: 'pat-5',
        professionalId: 'prof-1',
        roomId: 'room-2',
        serviceId: 'serv-3',
        ...createSlot(2, 10, 0, 60),
        status: 'scheduled',
        notes: 'Atención temprana en juego interactivo.'
      },
      {
        id: 'appt-6',
        clinicId,
        patientId: 'pat-1', // Cita clave de la tarde para probar cancelaciones
        professionalId: 'prof-1',
        roomId: 'room-2',
        serviceId: 'serv-2',
        ...createSlot(2, 17, 0, 45),
        status: 'scheduled',
        notes: 'Sesión semanal de articulación.'
      },
      {
        id: 'appt-7',
        clinicId,
        patientId: 'pat-6',
        professionalId: 'prof-4',
        roomId: 'room-1',
        serviceId: 'serv-1',
        ...createSlot(2, 18, 0, 30),
        status: 'scheduled',
        notes: 'Higiene vocal y resonadores.'
      },

      // JUEVES
      {
        id: 'appt-8',
        clinicId,
        patientId: 'pat-2',
        professionalId: 'prof-2',
        roomId: 'room-3',
        serviceId: 'serv-4',
        ...createSlot(3, 11, 30, 30),
        status: 'scheduled',
        notes: 'Ejercicios de reposicionamiento lingual.'
      },
      {
        id: 'appt-9',
        clinicId,
        patientId: 'pat-3',
        professionalId: 'prof-1',
        roomId: 'room-2',
        serviceId: 'serv-2',
        ...createSlot(3, 17, 30, 45),
        status: 'scheduled',
        notes: 'Sesión de vocabulario y estructuración.'
      },

      // VIERNES
      {
        id: 'appt-10',
        clinicId,
        patientId: 'pat-4',
        professionalId: 'prof-3',
        roomId: 'room-4',
        serviceId: 'serv-3',
        ...createSlot(4, 12, 0, 60),
        status: 'scheduled',
        notes: 'Evaluación de progreso semanal.'
      },
      {
        id: 'appt-11',
        clinicId,
        patientId: 'pat-5',
        professionalId: 'prof-1',
        roomId: 'room-2',
        serviceId: 'serv-1',
        ...createSlot(4, 16, 0, 30),
        status: 'scheduled',
        notes: 'Atención temprana.'
      }
    ];

    // Guardar en localStore y repositorios
    localStore.setCollection(`services_${clinicId}`, services);
    localStore.setCollection(`specialties_${clinicId}`, specialties);
    localStore.setCollection(`rooms_${clinicId}`, rooms);
    localStore.setCollection(`users_${clinicId}`, professionals);
    localStore.setCollection(`patients_${clinicId}`, patients);
    localStore.setCollection(`appointments_${clinicId}`, appointments);

    // Guardar también en Firestore (en cola offline / online)
    for (const serv of services) {
      await this.serviceRepo.saveService(serv);
    }
    for (const spec of specialties) {
      await this.specialtyRepo.saveSpecialty(spec);
    }
    for (const room of rooms) {
      await this.roomRepo.saveRoom(room);
    }
    for (const prof of professionals) {
      await this.userRepo.saveUser(prof);
    }
    const sampleSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAAYCAYAAABg/FhZAAAABmJLR0QA/wD/AP+gvaeTAAAAP0lEQVR42u3PMQEAAAgEIPu3tosF30EAkhpZ1wUAAAAAAAAAAAAAgBsT32YAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAODWAsl0AgHl31j7AAAAAElFTkSuQmCC';

    for (const pat of patients) {
      await this.patientRepo.savePatient(pat);
      if (pat.consentSigned) {
        const consent: LegalConsent = {
          id: `consent-${pat.id}`,
          clinicId,
          patientId: pat.id,
          tutorId: pat.tutors?.[0]?.id,
          documentVersion: 'v1.0-RGPD-LOPDGDD',
          type: 'data_processing_and_health',
          signedAt: pat.consentSignedAt || (Date.now() - 7 * 86400000),
          signatureDataUrl: sampleSignature
        };
        await this.consentRepo.saveConsent(consent);
      }
    }
    for (const appt of appointments) {
      await this.appointmentRepo.saveAppointment(appt);
    }
    // Guardar Clínica con datos fiscales y su horario de apertura
    const clinic: Clinic = {
      id: clinicId,
      name: 'LogoPedia — Centro de Logopedia y Neurodesarrollo',
      cif: 'B-98765432',
      dpoEmail: 'dpo@logopedia-clinica.com',
      createdAt: Date.now() - 90 * 24 * 3600 * 1000,
      phone: '+34 912 345 678',
      email: 'info@logopedia-clinica.com',
      address: 'Calle Mayor 45, Planta 1ª, Madrid',
      schedule: DEFAULT_CLINIC_SCHEDULE
    };
    await clinicRepository.saveClinic(clinic);

    console.log(`[SeedService] Clínica, profesionales con horario/descanso, pacientes y citas generados con éxito.`);
  }
}
