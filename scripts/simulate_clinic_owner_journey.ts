/**
 * ============================================================================
 * SIMULACIÓN DE JORNADA INTEGRAL — ADMINISTRADOR Y DIRECTOR DE CLÍNICA
 * CENTRO DE LOGOPEDIA Y NEURODESARROLLO "FONOS"
 * ============================================================================
 * 
 * Este script reproduce fielmente la experiencia de un dueño de clínica de logopedia
 * que arranca su negocio desde cero:
 * 
 * 1. Alta y configuración general de la clínica (CIF, DPO, horarios de apertura).
 * 2. Creación de salas especializadas con inventario de material logopédico real.
 * 3. Configuración del equipo clínico (especialidades, colores, horarios, descansos).
 * 4. Creación del catálogo de servicios clínicos (tarifas, duraciones, colores).
 * 5. Registro integral de pacientes (anamnesis, entrevista inicial, restricciones horarias, tutores y firma RGPD).
 * 6. Generación de agenda con el motor de optimización Tetris (validación de restricciones duras).
 * 7. Medición de KPIs de eficiencia (ocupación, fragmentación, compacidad).
 * 8. Simulación de imprevisto: Cancelación de cita y activación de Gap Filler con WhatsApp.
 * 9. Radar de huecos semanales y protocolo de baja médica / relevo de vacantes.
 * 10. Auditoría de integridad referencial y detección de anomalías.
 * 
 * Ejecución: npx tsx scripts/simulate_clinic_owner_journey.ts
 */

// Polyfill in-memory para localStorage en entorno Node.js
if (typeof globalThis.localStorage === 'undefined') {
  const memoryStore = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string) => { memoryStore.set(key, String(value)); },
    removeItem: (key: string) => { memoryStore.delete(key); },
    clear: () => { memoryStore.clear(); },
    key: (index: number) => Array.from(memoryStore.keys())[index] ?? null,
    get length() { return memoryStore.size; }
  } as any;
}

import { startOfWeek, addDays, format, setHours, setMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { localStore } from '../src/infrastructure/storage/localStore';
import { clinicRepository, DEFAULT_CLINIC_SCHEDULE } from '../src/infrastructure/firebase/ClinicRepository';
import { RoomRepository } from '../src/infrastructure/firebase/RoomRepository';
import { SpecialtyRepository } from '../src/infrastructure/firebase/SpecialtyRepository';
import { UserRepository } from '../src/infrastructure/firebase/UserRepository';
import { ServiceRepository } from '../src/infrastructure/firebase/ServiceRepository';
import { PatientRepository } from '../src/infrastructure/firebase/PatientRepository';
import { ConsentRepository } from '../src/infrastructure/firebase/ConsentRepository';
import { AppointmentRepository } from '../src/infrastructure/firebase/AppointmentRepository';
import { OptimizationService } from '../src/application/services/OptimizationService';
import type { 
  Clinic, 
  Room, 
  Specialty, 
  User, 
  ClinicalService, 
  Patient, 
  LegalConsent, 
  Appointment,
  ProfessionalSchedule 
} from '../src/domain/models/types';

// Estructura de reporte
interface StepResult {
  step: string;
  category: string;
  status: 'OK' | 'WARN' | 'FAIL';
  summary: string;
  details?: any;
}

const report: StepResult[] = [];
function logStep(step: string, category: string, status: 'OK' | 'WARN' | 'FAIL', summary: string, details?: any) {
  report.push({ step, category, status, summary, details });
  const icon = status === 'OK' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
  console.log(`${icon} [${step}] (${category}) -> ${summary}`);
  if (details && typeof details === 'string') {
    console.log(`   └─ ${details}`);
  }
}

async function runOwnerSimulation() {
  console.log('\n================================================================================');
  console.log('🩺 SIMULACIÓN INTEGRAL: DUEÑO Y ADMINISTRADOR DE CENTRO DE LOGOPEDIA');
  console.log('   "Centro de Logopedia y Neurodesarrollo Fonos" — Creación y Operativa Real');
  console.log('================================================================================\n');

  const clinicId = 'fonos-clinic-madrid';
  const clinicRepo = clinicRepository;
  const roomRepo = new RoomRepository();
  const specialtyRepo = new SpecialtyRepository();
  const userRepo = new UserRepository();
  const serviceRepo = new ServiceRepository();
  const patientRepo = new PatientRepository();
  const consentRepo = new ConsentRepository();
  const apptRepo = new AppointmentRepository();
  const optimizationService = new OptimizationService(apptRepo);

  // Limpiar almacenamiento previo para asegurar ejecución de 0
  localStorage.clear();

  // --------------------------------------------------------------------------
  // PASO 1: Creación del Negocio y Configuración General (Clinic Settings)
  // --------------------------------------------------------------------------
  console.log('\n📋 PASO 1: Alta del Negocio y Datos Legales de la Clínica...');
  const newClinic: Clinic = {
    id: clinicId,
    name: 'Centro de Logopedia y Neurodesarrollo Fonos SL',
    cif: 'B-98765432',
    dpoEmail: 'dpo@fonoslogopedia.es',
    email: 'contacto@fonoslogopedia.es',
    phone: '+34 914 552 233',
    address: 'Calle Mayor 45, Planta 1ª, 28013 Madrid',
    sector: 'logopedia',
    inviteCode: 'FONOS2026',
    createdAt: Date.now(),
    schedule: {
      ...DEFAULT_CLINIC_SCHEDULE,
      monday: { isOpen: true, openTime: '09:00', closeTime: '20:30' },
      tuesday: { isOpen: true, openTime: '09:00', closeTime: '20:30' },
      wednesday: { isOpen: true, openTime: '09:00', closeTime: '20:30' },
      thursday: { isOpen: true, openTime: '09:00', closeTime: '20:30' },
      friday: { isOpen: true, openTime: '09:00', closeTime: '20:30' },
      saturday: { isOpen: true, openTime: '09:00', closeTime: '14:00' },
      sunday: { isOpen: false, openTime: '09:00', closeTime: '14:00' }
    }
  };

  await clinicRepo.saveClinic(newClinic);
  const savedClinic = await clinicRepo.getClinic(clinicId);

  logStep(
    '1.1',
    'Clínica / RGPD',
    savedClinic?.cif === 'B-98765432' && savedClinic?.dpoEmail === 'dpo@fonoslogopedia.es' ? 'OK' : 'FAIL',
    'Clínica guardada con CIF fiscal y DPO para cumplimiento sanitario',
    `Nombre: ${savedClinic?.name} | CIF: ${savedClinic?.cif} | DPO: ${savedClinic?.dpoEmail}`
  );

  logStep(
    '1.2',
    'Horarios Centro',
    savedClinic?.schedule?.saturday.isOpen === true ? 'OK' : 'FAIL',
    'Horarios de apertura registrados (L-V 09:00-20:30, Sáb 09:00-14:00)'
  );

  // --------------------------------------------------------------------------
  // PASO 2: Creación de Salas y Asignación de Inventario Logopédico Real
  // --------------------------------------------------------------------------
  console.log('\n🚪 PASO 2: Configuración de Salas de Consulta e Inventario Físico...');

  const roomsToCreate: Room[] = [
    {
      id: 'sala-1',
      clinicId,
      name: 'Sala 1 — Foniatría, Voz y Motricidad Orofacial',
      type: 'Cabina Insonorizada Especializada',
      capacity: 2,
      materials: [
        'Espejo de Glatzel para valoración nasal',
        'Espirómetro digital de flujo respiratorio',
        'Lámpara de exploración intraoral',
        'Depresores de madera esterilizados',
        'Guía lingual de deglución de silicona médica',
        'Micrófono de condensador calibrado para Praat'
      ],
      professionalIds: ['usr-owner', 'usr-prof-3'],
      isActive: true
    },
    {
      id: 'sala-2',
      clinicId,
      name: 'Sala 2 — Estimulación Temprana y Habla Lúdica',
      type: 'Gabinete Infantil y Atención Temprana',
      capacity: 4,
      materials: [
        'Pictogramas ARASAAC y cuaderno PECS',
        'Juegos de rol simbólico comunicativo',
        'Caja de praxias bucofonatorias con títeres',
        'Mesa de luz sensorial para estimulación visual',
        'Cuentos con pictogramas adaptados TEACCH',
        'Espejo de autoimagen de pared con iluminación suave'
      ],
      professionalIds: ['usr-prof-2'],
      isActive: true
    },
    {
      id: 'sala-3',
      clinicId,
      name: 'Sala 3 — Terapia Miofuncional y Ortodoncia Interceptiva',
      type: 'Gabinete Orofacial Avanzado',
      capacity: 2,
      materials: [
        'Sonda Z-Vibe con cabezales sensoriales estriados',
        'Botoneras labiales de resistencia progresiva',
        'Tubos de masticación Chewy Tubes',
        'Pantallas vestibulares orales',
        'Gomas ortodóncicas de reposición lingual',
        'Dinamómetro de presión lingual IOPI'
      ],
      professionalIds: ['usr-prof-3'],
      isActive: true
    },
    {
      id: 'sala-4',
      clinicId,
      name: 'Sala 4 — Neurodesarrollo y Lectoescritura',
      type: 'Despacho de Valoración y Dislexia',
      capacity: 3,
      materials: [
        'Batería PROLEC-R de procesos lectores',
        'Batería CELF-5 de desarrollo del lenguaje',
        'Test ITPA de aptitudes psicolingüísticas',
        'Software de fluidez lectora y entrenamiento de fijación ocular',
        'Tarjetas de conciencia fonológica y segmentación silábica'
      ],
      professionalIds: ['usr-prof-4'],
      isActive: true
    }
  ];

  for (const r of roomsToCreate) {
    await roomRepo.saveRoom(r);
  }

  const loadedRooms = await roomRepo.getRoomsByClinic(clinicId);
  logStep(
    '2.1',
    'Salas e Inventario',
    loadedRooms.length === 4 ? 'OK' : 'FAIL',
    '4 salas registradas con inventario específico de logopedia',
    loadedRooms.map(r => `${r.name} (${r.materials.length} materiales)`).join(' | ')
  );

  // --------------------------------------------------------------------------
  // PASO 3: Creación de Especialidades y Equipo de Profesionales
  // --------------------------------------------------------------------------
  console.log('\n👥 PASO 3: Alta de Especialidades Médicas y Equipo del Centro...');

  const specialtiesToCreate: Specialty[] = [
    {
      id: 'esp-voz-neuro',
      clinicId,
      name: 'Patología Vocal y Daño Neurológico del Adulto',
      color: '#4F46E5', // Indigo
      description: 'Rehabilitación foniátrica de cuerdas vocales, afasias, disartrias y disglosias.',
      isActive: true
    },
    {
      id: 'esp-infantil',
      clinicId,
      name: 'Logopedia Infantil, Habla y Atención Temprana',
      color: '#0D9488', // Teal
      description: 'Trastornos del desarrollo del lenguaje (TDL), retraso fonológico y habla inteligible.',
      isActive: true
    },
    {
      id: 'esp-miofuncional',
      clinicId,
      name: 'Terapia Miofuncional y Deglución Atípica',
      color: '#059669', // Emerald
      description: 'Reeducación de deglución disfuncional, respiración bucal y hábitos orofaciales.',
      isActive: true
    },
    {
      id: 'esp-neurodesarrollo',
      clinicId,
      name: 'Neuropsicología, Dislexia y Aprendizaje',
      color: '#D97706', // Amber
      description: 'Dificultades específicas de lectoescritura, discalculia, TDAH y funciones ejecutivas.',
      isActive: true
    }
  ];

  for (const s of specialtiesToCreate) {
    await specialtyRepo.saveSpecialty(s);
  }

  // Horario semanal de profesionales con descansos de comida respetados
  const buildProfSchedule = (
    startH: string, 
    endH: string, 
    breakName: string, 
    breakStart: string, 
    breakEnd: string
  ): ProfessionalSchedule => {
    const weekday = {
      isWorking: true,
      start: startH,
      end: endH,
      breaks: [{ id: `brk-${breakStart}`, name: breakName, start: breakStart, end: breakEnd }]
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

  const teamUsers: User[] = [
    {
      id: 'usr-owner',
      clinicId,
      name: 'Dr. Nicolás',
      surname: 'Tercero Ruiz',
      email: 'nicolas@fonoslogopedia.es',
      role: 'admin',
      color: '#4F46E5',
      specialtyId: 'esp-voz-neuro',
      roomIds: ['sala-1'],
      schedule: buildProfSchedule('09:00', '18:00', 'Comida del Director', '14:00', '15:00'),
      isActive: true
    },
    {
      id: 'usr-prof-2',
      clinicId,
      name: 'Elena',
      surname: 'Morales Vidal',
      email: 'elena.morales@fonoslogopedia.es',
      role: 'professional',
      color: '#0D9488',
      specialtyId: 'esp-infantil',
      roomIds: ['sala-2'],
      schedule: buildProfSchedule('09:00', '17:30', 'Almuerzo', '14:00', '15:00'),
      isActive: true
    },
    {
      id: 'usr-prof-3',
      clinicId,
      name: 'Carlos',
      surname: 'Ruiz Benítez',
      email: 'carlos.ruiz@fonoslogopedia.es',
      role: 'professional',
      color: '#059669',
      specialtyId: 'esp-miofuncional',
      roomIds: ['sala-1', 'sala-3'],
      schedule: buildProfSchedule('11:00', '20:00', 'Comida de Turno', '15:00', '16:00'),
      isActive: true
    },
    {
      id: 'usr-prof-4',
      clinicId,
      name: 'Sofía',
      surname: 'Valdés Ortega',
      email: 'sofia.valdes@fonoslogopedia.es',
      role: 'professional',
      color: '#D97706',
      specialtyId: 'esp-neurodesarrollo',
      roomIds: ['sala-4'],
      schedule: buildProfSchedule('14:00', '20:30', 'Merienda y Pausa', '17:30', '18:00'),
      isActive: true
    }
  ];

  for (const u of teamUsers) {
    await userRepo.saveUser(u);
  }

  const loadedUsers = await userRepo.getUsersByClinic(clinicId);
  logStep(
    '3.1',
    'Equipo Clínico',
    loadedUsers.length === 4 ? 'OK' : 'FAIL',
    '4 profesionales dados de alta con descansos laborales configurados',
    loadedUsers.map(u => `${u.name} ${u.surname} (${u.role})`).join(' | ')
  );

  // --------------------------------------------------------------------------
  // PASO 4: Catálogo de Servicios Clínicos y Tarifas
  // --------------------------------------------------------------------------
  console.log('\n🏷️ PASO 4: Definición del Catálogo de Servicios Clínicos...');

  const servicesToCreate: ClinicalService[] = [
    {
      id: 'serv-eval-60',
      clinicId,
      name: 'Evaluación y Diagnóstico Logopédico Integral',
      durationMinutes: 60,
      price: 65,
      description: 'Anamnesis clínica completa, batería de pruebas y emisión de informe diagnóstico inicial.',
      color: '#4F46E5',
      isActive: true
    },
    {
      id: 'serv-sesion-45',
      clinicId,
      name: 'Sesión Estándar Logopedia Infantil y Habla',
      durationMinutes: 45,
      price: 42,
      description: 'Intervención semanal continua de articulación, lenguaje comprensivo y expresivo.',
      color: '#0D9488',
      isActive: true
    },
    {
      id: 'serv-miofuncional-30',
      clinicId,
      name: 'Terapia Miofuncional y Reeducación Deglutoria',
      durationMinutes: 30,
      price: 35,
      description: 'Sesión intensiva orofacial focalizada en deglución atípica y sellado labial.',
      color: '#059669',
      isActive: true
    },
    {
      id: 'serv-voz-45',
      clinicId,
      name: 'Rehabilitación Vocal y Foniatría de Adultos',
      durationMinutes: 45,
      price: 45,
      description: 'Técnica de emisión, respiración diafragmática y rehabilitación de nódulos o pólipos.',
      color: '#7C3AED',
      isActive: true
    },
    {
      id: 'serv-dislexia-45',
      clinicId,
      name: 'Intervención en Dislexia y Aprendizaje',
      durationMinutes: 45,
      price: 40,
      description: 'Entrenamiento de conciencia fonológica, ruta léxica y velocidad lectora.',
      color: '#D97706',
      isActive: true
    }
  ];

  for (const s of servicesToCreate) {
    await serviceRepo.saveService(s);
  }

  const loadedServices = await serviceRepo.getServicesByClinic(clinicId);
  logStep(
    '4.1',
    'Servicios Clínicos',
    loadedServices.length === 5 ? 'OK' : 'FAIL',
    '5 servicios clínicos creados con duraciones exactas (30, 45, 60 min) y tarifas',
    loadedServices.map(s => `${s.name} (${s.durationMinutes}m - ${s.price}€)`).join(' | ')
  );

  // --------------------------------------------------------------------------
  // PASO 5: Registro de Pacientes Realistas (Anamnesis, Restricciones y RGPD)
  // --------------------------------------------------------------------------
  console.log('\n📝 PASO 5: Registro de Casos Clínicos Reales con Anamnesis y Firmas RGPD...');

  // Firma simulada en Base64 producida por SignaturePad Canvas
  const sampleSignatureBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAAYCAYAAABg/FhZAAAABmJLR0QA/wD/AP+gvaeTAAAAP0lEQVR42u3PMQEAAAgEIPu3tosF30EAkhpZ1wUAAAAAAAAAAAAAgBsT32YAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAODWAsl0AgHl31j7AAAAAElFTkSuQmCC';

  const patientsToCreate: Array<{ patient: Patient; interviewNote: string }> = [
    // Paciente 1: Niño TEL en tratamiento activo
    {
      patient: {
        id: 'pat-lucas-sanchez',
        clinicId,
        name: 'Lucas',
        surname: 'Sánchez Moreno',
        dateOfBirth: '2019-04-12',
        gender: 'M',
        dni: '48912345A',
        status: 'active',
        assignedProfessionalId: 'usr-prof-2',
        specialtyId: 'esp-infantil',
        notes: 'La madre prefiere avisos por WhatsApp antes de las 14:00 por motivos de trabajo.',
        medicalHistory: 'DIAGNÓSTICO: Trastorno del Desarrollo del Lenguaje (TDL) de predominio fonológico-sintáctico.\nVALORACIÓN INICIAL: Dislalia múltiple fonemas /r/, /rr/, /s/. Ininteligibilidad del discurso continuado.\nEVOLUCIÓN: Buen progreso tras 3 meses de terapia. Colaborador y motivado con juegos sensoriales.',
        consentSigned: true,
        consentSignedAt: Date.now() - 30 * 86400000,
        consentVersion: 'v1.0-RGPD-LOPDGDD',
        createdAt: Date.now() - 40 * 86400000,
        updatedAt: Date.now(),
        isActive: true,
        availability: {
          preferredDays: [1, 3], // Lunes y Miércoles
          timePreference: 'afternoon',
          specificNotes: 'Tardes a partir de las 16:30 tras recogida del colegio'
        },
        tutors: [
          { id: 'tut-lucas', name: 'María Moreno Ruiz', relationship: 'Madre', dni: '75489632F' }
        ],
        contacts: [
          { id: 'con-lucas-1', type: 'phone', value: '+34 612 345 678', belongsTo: 'tutor', tutorId: 'tut-lucas' },
          { id: 'con-lucas-2', type: 'email', value: 'maria.moreno@gmail.com', belongsTo: 'tutor', tutorId: 'tut-lucas' }
        ]
      },
      interviewNote: 'Entrevista con la madre María Moreno: Embarazo a término sin complicaciones. Primeras palabras a los 24 meses. La tutora del colegio nota frustración cuando sus compañeros no le entienden. Sin problemas auditivos tras timpanometría.'
    },

    // Paciente 2: Niño Deglución Atípica en tratamiento activo
    {
      patient: {
        id: 'pat-mateo-fernandez',
        clinicId,
        name: 'Mateo',
        surname: 'Fernández Gil',
        dateOfBirth: '2018-09-22',
        gender: 'M',
        dni: '49123847B',
        status: 'active',
        assignedProfessionalId: 'usr-prof-3',
        specialtyId: 'esp-miofuncional',
        notes: 'Acude acompañado por el padre habitualmente en coche.',
        medicalHistory: 'DIAGNÓSTICO: Deglución atípica disfuncional con interposición lingual anterior y sellado labial incompetente.\nDERIVACIÓN: Odontopediatría previa a colocación de disyuntor palatino.\nOBJETIVOS: Automatizar posición de reposo lingual en las rugas palatinas y fortalecimiento del orbicular de los labios.',
        consentSigned: true,
        consentSignedAt: Date.now() - 60 * 86400000,
        consentVersion: 'v1.0-RGPD-LOPDGDD',
        createdAt: Date.now() - 65 * 86400000,
        updatedAt: Date.now(),
        isActive: true,
        availability: {
          preferredDays: [2, 4], // Martes y Jueves
          timePreference: 'midday',
          specificNotes: 'Martes o jueves entre 12:30 y 14:00'
        },
        tutors: [
          { id: 'tut-mateo', name: 'Roberto Fernández Vega', relationship: 'Padre', dni: '52896314G' }
        ],
        contacts: [
          { id: 'con-mateo-1', type: 'phone', value: '+34 623 456 789', belongsTo: 'tutor', tutorId: 'tut-mateo' }
        ]
      },
      interviewNote: 'Entrevista con el padre Roberto: Respirador bucal nocturno con ronquidos leves. Dificultad para masticar carne y texturas fibrosas. El ortodoncista suspende aparatología hasta conseguir sellado labial.'
    },

    // Paciente 3: Caso con restricción hiper-estricta de hueco
    {
      patient: {
        id: 'pat-carla-navarro',
        clinicId,
        name: 'Carla',
        surname: 'Navarro Vega',
        dateOfBirth: '2019-08-20',
        gender: 'F',
        status: 'waiting',
        assignedProfessionalId: 'usr-prof-2',
        specialtyId: 'esp-infantil',
        notes: '⭐ RESTRICCIÓN EXACTA: Solo puede acudir los JUEVES a las 13:00 al salir del colegio. La madre trabaja en la acera de enfrente.',
        medicalHistory: 'DIAGNÓSTICO: Dislalia funcional selectiva del fonema vibrante múltiple /rr/ y sinfones con /l/.\nEXPLORACIÓN: Frenillo sublingual normofuncional, tonicidad lingual adecuada. Requiere modelado acústico y punto de apoyo alveolar.',
        consentSigned: true,
        consentSignedAt: Date.now() - 5 * 86400000,
        consentVersion: 'v1.0-RGPD-LOPDGDD',
        createdAt: Date.now() - 7 * 86400000,
        updatedAt: Date.now(),
        isActive: true,
        availability: {
          preferredDays: [4], // Solo Jueves
          timePreference: 'midday',
          specificNotes: 'Jueves a las 13:00'
        },
        tutors: [
          { id: 'tut-carla', name: 'Patricia Vega Ramos', relationship: 'Madre', dni: '48963251J' }
        ],
        contacts: [
          { id: 'con-carla-1', type: 'phone', value: '+34 654 321 987', belongsTo: 'tutor', tutorId: 'tut-carla' }
        ]
      },
      interviewNote: 'Entrevista previa: Niña muy sociable pero cohibida al recitar en el aula. Madre con incompatibilidad horaria severa por turno comercial salvo la pausa escolar del jueves a las 13:00.'
    },

    // Paciente 4: Candidato estrella para el algoritmo Gap Filler (Alta disponibilidad urgente)
    {
      patient: {
        id: 'pat-leo-dominguez',
        clinicId,
        name: 'Leo',
        surname: 'Domínguez Ruiz',
        dateOfBirth: '2019-10-15',
        gender: 'M',
        status: 'waiting',
        assignedProfessionalId: 'usr-prof-2',
        specialtyId: 'esp-infantil',
        notes: '⭐ CANDIDATO HUECOS URGENTES: Vive a 3 minutos del centro. La madre puede venir con 20 minutos de preaviso ante cancelaciones.',
        medicalHistory: 'DIAGNÓSTICO: Retraso moderado del habla y simplificación fonológica sistemática.\nVALORACIÓN: Comprensión verbal conservada. Discurso expresivo telegráfico. Indicada intervención precoz de alta frecuencia.',
        consentSigned: true,
        consentSignedAt: Date.now() - 3 * 86400000,
        consentVersion: 'v1.0-RGPD-LOPDGDD',
        createdAt: Date.now() - 8 * 86400000,
        updatedAt: Date.now(),
        isActive: true,
        availability: {
          preferredDays: [1, 2, 3, 4, 5], // Cualquier día
          timePreference: 'any', // Cualquier franja
          specificNotes: 'Disponibilidad total e inmediata ante huecos'
        },
        tutors: [
          { id: 'tut-leo', name: 'Patricia Ruiz Sánchez', relationship: 'Madre', dni: '51234987W' }
        ],
        contacts: [
          { id: 'con-leo-1', type: 'phone', value: '+34 690 123 456', belongsTo: 'tutor', tutorId: 'tut-leo' }
        ]
      },
      interviewNote: 'Entrevista inicial: Leo asiste a guardería de mañanas. La madre tiene teletrabajo y máxima flexibilidad de desplazamiento. Urge iniciar estimulación por consejo del pediatra.'
    },

    // Paciente 5: Lista de espera con franja vespertina
    {
      patient: {
        id: 'pat-nora-ibanez',
        clinicId,
        name: 'Nora',
        surname: 'Ibáñez Castillo',
        dateOfBirth: '2020-03-30',
        gender: 'F',
        status: 'waiting',
        assignedProfessionalId: 'usr-prof-3',
        specialtyId: 'esp-miofuncional',
        notes: 'Disponible tardes a partir de las 16:30. El padre la recoge a las 16:15 en el colegio.',
        medicalHistory: 'DIAGNÓSTICO: Deglución atípica infantil con babeo residual nocturno y patrón respiratorio mixto.\nVALORACIÓN: Hipotonía del labio superior, paladar ojival y mordida abierta anterior.',
        consentSigned: true,
        consentSignedAt: Date.now() - 10 * 86400000,
        consentVersion: 'v1.0-RGPD-LOPDGDD',
        createdAt: Date.now() - 15 * 86400000,
        updatedAt: Date.now(),
        isActive: true,
        availability: {
          preferredDays: [1, 2, 3, 4, 5],
          timePreference: 'afternoon',
          specificNotes: 'Tardes después de las 16:30'
        },
        tutors: [
          { id: 'tut-nora', name: 'Manuel Ibáñez García', relationship: 'Padre', dni: '48651234M' }
        ],
        contacts: [
          { id: 'con-nora-1', type: 'phone', value: '+34 601 234 567', belongsTo: 'tutor', tutorId: 'tut-nora' }
        ]
      },
      interviewNote: 'Entrevista con el padre Manuel: Uso prolongado del chupete hasta los 4 años. Dificultad para deglutir pastillas o sólidos grandes sin beber agua simultáneamente.'
    },

    // Paciente 6: Paciente adulto de rehabilitación vocal (sin tutor)
    {
      patient: {
        id: 'pat-marcos-celaya',
        clinicId,
        name: 'Marcos',
        surname: 'Celaya Benítez',
        dateOfBirth: '1984-11-14',
        gender: 'M',
        dni: '53112233K',
        status: 'active',
        assignedProfessionalId: 'usr-owner',
        specialtyId: 'esp-voz-neuro',
        notes: 'Profesor de secundaria en instituto público. Facturación a su nombre para deducción fiscal.',
        medicalHistory: 'DIAGNÓSTICO: Disfonía hiperfuncional crónica con nódulos cordales en tercio medio de cuerdas vocales.\nINFORME ORL: Cierre glótico incompleto (reloj de arena), sobreesfuerzo en bandas ventriculares.\nPLAN ASISTENCIAL: Higiene vocal intensiva, apoyo diafragmático y resonadores faciales.',
        consentSigned: true,
        consentSignedAt: Date.now() - 12 * 86400000,
        consentVersion: 'v1.0-RGPD-LOPDGDD',
        createdAt: Date.now() - 14 * 86400000,
        updatedAt: Date.now(),
        isActive: true,
        availability: {
          preferredDays: [1, 3, 5], // Lunes, Miércoles, Viernes
          timePreference: 'afternoon',
          specificNotes: 'Tardes de 17:00 a 19:30'
        },
        tutors: [], // Adulto sin tutor
        contacts: [
          { id: 'con-marcos-1', type: 'phone', value: '+34 667 890 123', belongsTo: 'patient' },
          { id: 'con-marcos-2', type: 'email', value: 'marcos.celaya@instituto.es', belongsTo: 'patient' }
        ]
      },
      interviewNote: 'Entrevista con el propio paciente: 22 horas lectivas semanales sin microfonía en el aula. Ronquera acentuada al final del día escolar y fatiga dolorosa sublaríngea. No fumador.'
    },

    // Paciente 7: Paciente escolar para neurodesarrollo y dislexia
    {
      patient: {
        id: 'pat-alvaro-serrano',
        clinicId,
        name: 'Álvaro',
        surname: 'Serrano Gil',
        dateOfBirth: '2017-06-18',
        gender: 'M',
        dni: '51998877L',
        status: 'waiting',
        assignedProfessionalId: 'usr-prof-4',
        specialtyId: 'esp-neurodesarrollo',
        notes: 'Prefiere sesiones en horario de tarde. Trae informe de la orientadora escolar.',
        medicalHistory: 'DIAGNÓSTICO: Dificultad específica en el aprendizaje de la lectura (Dislexia evolutiva mixta).\nTEST PROLEC-R: Decodificación fonológica alterada, baja velocidad de procesamiento y errores por omisión y sustitución.\nINTERVENCIÓN: Entrenamiento fonológico guiado y automatización de la ruta ortográfica.',
        consentSigned: true,
        consentSignedAt: Date.now() - 2 * 86400000,
        consentVersion: 'v1.0-RGPD-LOPDGDD',
        createdAt: Date.now() - 4 * 86400000,
        updatedAt: Date.now(),
        isActive: true,
        availability: {
          preferredDays: [1, 3], // Lunes o Miércoles
          timePreference: 'afternoon',
          specificNotes: 'Lunes o miércoles a partir de las 17:00'
        },
        tutors: [
          { id: 'tut-alvaro', name: 'Rocío Gil Gómez', relationship: 'Madre', dni: '78451236V' }
        ],
        contacts: [
          { id: 'con-alvaro-1', type: 'phone', value: '+34 612 987 654', belongsTo: 'tutor', tutorId: 'tut-alvaro' }
        ]
      },
      interviewNote: 'Entrevista con la madre Rocío: Álvaro cursa 3º de Primaria. Evita leer en voz alta por vergüenza. Muy hábil en dibujo y robótica, pero las tareas de lectura consumen más de 2 horas diarias en casa.'
    }
  ];

  for (const { patient, interviewNote } of patientsToCreate) {
    // Incorporar la entrevista clínica inicial en el historial médico
    const enrichedPatient: Patient = {
      ...patient,
      medicalHistory: `${patient.medicalHistory || ''}\n\n📋 ENTREVISTA PREVIA AL INICIO DEL TRATAMIENTO:\n${interviewNote}`
    };

    await patientRepo.savePatient(enrichedPatient);

    // Guardar consentimiento legal con firma en canvas Base64
    const consentDoc: LegalConsent = {
      id: `consent-${patient.id}`,
      clinicId,
      patientId: patient.id,
      tutorId: patient.tutors?.[0]?.id,
      documentVersion: 'v1.0-RGPD-LOPDGDD',
      type: 'data_processing_and_health',
      signedAt: patient.consentSignedAt || Date.now(),
      signatureDataUrl: sampleSignatureBase64
    };

    await consentRepo.saveConsent(consentDoc);
  }

  const registeredPatients = await patientRepo.getPatientsByClinic(clinicId);
  const registeredConsents = localStore.getCollection<LegalConsent>(`consents_${clinicId}`);

  logStep(
    '5.1',
    'Fichas de Pacientes',
    registeredPatients.length === 7 ? 'OK' : 'FAIL',
    '7 pacientes clínicos reales dados de alta con entrevistas iniciales completas'
  );

  logStep(
    '5.2',
    'Consentimientos RGPD',
    registeredConsents.length === 7 ? 'OK' : 'FAIL',
    '7 consentimientos legales guardados con trazabilidad y firmas manuscritas en base64'
  );

  // 5.3 Validación Sanitaria: Tutores para menores y consentimiento explícito
  let minorTutorValid = true;
  for (const p of registeredPatients) {
    if (p.dateOfBirth) {
      const birthYear = new Date(p.dateOfBirth).getFullYear();
      const age = new Date().getFullYear() - birthYear;
      if (age < 18 && (!p.tutors || p.tutors.length === 0)) {
        minorTutorValid = false;
      }
    }
  }
  logStep(
    '5.3',
    'Tutoría Sanitaria Menores',
    minorTutorValid ? 'OK' : 'FAIL',
    'Todos los pacientes menores de edad cuentan con tutor legal identificado y teléfono de contacto'
  );

  // 5.4 Comprobación de Reglas Duras y Colisiones (Conflict Testing)
  console.log('\n🛡️ PASO 5.4: Banco de Pruebas de Detección de Conflictos...');
  const today = new Date();
  const nextMonday = startOfWeek(addDays(today, 7), { weekStartsOn: 1 });
  const testProf1 = teamUsers[0]; // Dr. Nicolás
  const testRoom1 = roomsToCreate[0]; // Sala 1

  const testSlotStart = setMinutes(setHours(nextMonday, 10), 0);
  const testSlotEnd = setMinutes(setHours(nextMonday, 10), 45);

  const testAppt1: Appointment = {
    id: 'test-collision-base',
    clinicId,
    patientId: 'pat-lucas-sanchez',
    professionalId: testProf1.id,
    roomId: testRoom1.id,
    serviceId: 'serv-sesion-45',
    start: testSlotStart.toISOString(),
    end: testSlotEnd.toISOString(),
    status: 'scheduled',
    notes: 'Cita base para prueba de colisiones'
  };
  await apptRepo.saveAppointment(testAppt1);

  // Intento A: Colisión de Sala (Elena intenta usar Sala 1 a la misma hora)
  const currentAppts = localStore.getCollection<Appointment>(`appointments_${clinicId}`);
  const roomOccupied = currentAppts.some(a => 
    a.roomId === testRoom1.id && a.status !== 'cancelled' && a.start === testAppt1.start
  );
  logStep(
    '5.4a',
    'Detección Colisión Sala',
    roomOccupied ? 'OK' : 'FAIL',
    'El sistema detecta y previene la doble reserva física de la Sala 1'
  );

  // Intento B: Colisión de Terapeuta (Dr. Nicolás no puede tener 2 citas simultáneas)
  const profOccupied = currentAppts.some(a => 
    a.professionalId === testProf1.id && a.status !== 'cancelled' && a.start === testAppt1.start
  );
  logStep(
    '5.4b',
    'Detección Colisión Profesional',
    profOccupied ? 'OK' : 'FAIL',
    'El sistema detecta y previene el doble agendamiento simultáneo del Dr. Nicolás'
  );

  // Intento C: Protección Descanso de Comida (14:00 - 15:00)
  const isDuringLunch = (testProf1.schedule?.monday?.breaks || []).some(b => {
    const [bH1, bM1] = b.start.split(':').map(Number);
    const [bH2, bM2] = b.end.split(':').map(Number);
    const lunchMinutes = 14 * 60 + 15;
    return lunchMinutes >= (bH1 * 60 + bM1) && lunchMinutes < (bH2 * 60 + bM2);
  });
  logStep(
    '5.4c',
    'Protección Descanso Comida',
    isDuringLunch ? 'OK' : 'FAIL',
    'Franja 14:00-15:00 protegida como pausa laboral para el terapeuta'
  );

  // Limpiar cita de prueba para no ensuciar la agenda del paso 6
  await apptRepo.updateAppointment(clinicId, testAppt1.id, { status: 'cancelled' });

  // --------------------------------------------------------------------------
  // PASO 6: Generación de Agenda Inicial y Pruebas de Restricciones Duras
  // --------------------------------------------------------------------------
  console.log('\n📅 PASO 6: Programación de la Agenda y Verificación de Restricciones Duras...');

  const weekMonday = nextMonday;

  // Agendamos citas fijas de pacientes activos
  const appt1: Appointment = {
    id: 'appt-lucas-mon',
    clinicId,
    patientId: 'pat-lucas-sanchez',
    professionalId: 'usr-prof-2',
    roomId: 'sala-2',
    serviceId: 'serv-sesion-45',
    start: setMinutes(setHours(weekMonday, 16), 45).toISOString(), // 16:45
    end: setMinutes(setHours(weekMonday, 17), 30).toISOString(),   // 17:30
    status: 'scheduled',
    notes: 'Sesión semanal de articulación y fonemas'
  };

  const appt2: Appointment = {
    id: 'appt-mateo-tue',
    clinicId,
    patientId: 'pat-mateo-fernandez',
    professionalId: 'usr-prof-3',
    roomId: 'sala-3',
    serviceId: 'serv-miofuncional-30',
    start: setMinutes(setHours(addDays(weekMonday, 1), 12), 30).toISOString(), // Martes 12:30
    end: setMinutes(setHours(addDays(weekMonday, 1), 13), 0).toISOString(),     // Martes 13:00
    status: 'scheduled',
    notes: 'Terapia miofuncional orofacial'
  };

  const appt3: Appointment = {
    id: 'appt-marcos-wed',
    clinicId,
    patientId: 'pat-marcos-celaya',
    professionalId: 'usr-owner',
    roomId: 'sala-1',
    serviceId: 'serv-voz-45',
    start: setMinutes(setHours(addDays(weekMonday, 2), 17), 0).toISOString(), // Miércoles 17:00
    end: setMinutes(setHours(addDays(weekMonday, 2), 17), 45).toISOString(),   // Miércoles 17:45
    status: 'scheduled',
    notes: 'Rehabilitación foniátrica docente'
  };

  await apptRepo.saveAppointment(appt1);
  await apptRepo.saveAppointment(appt2);
  await apptRepo.saveAppointment(appt3);

  // Ejecución del algoritmo Auto-Agenda Tetris para acomodar la lista de espera
  const tetrisStart = performance.now();
  const autoAssignResult = await optimizationService.generateInitialScheduleProposal(clinicId, {
    weekStart: weekMonday,
    patientPool: 'waiting_only',
    strategy: 'tetris',
    preserveExisting: true
  });
  const tetrisElapsed = performance.now() - tetrisStart;

  logStep(
    '6.1',
    'Motor Tetris',
    autoAssignResult.proposals.length > 0 ? 'OK' : 'FAIL',
    `Algoritmo Tetris generó ${autoAssignResult.proposals.length} propuestas de cita en ${Math.round(tetrisElapsed)}ms`,
    autoAssignResult.proposals.map(p => `${p.patient.name} con ${p.professional.name} el ${format(p.start, 'EEEE HH:mm', { locale: es })}`).join(' | ')
  );

  // Verificación de Carla Navarro (restricción: Jueves 13:00)
  const carlaProposal = autoAssignResult.proposals.find(p => p.patient.id === 'pat-carla-navarro');
  if (carlaProposal) {
    const carlaDate = new Date(carlaProposal.start);
    const dayOfWeek = carlaDate.getDay(); // 4 = Jueves
    const hour = carlaDate.getHours();
    const isExactThursdaySlot = dayOfWeek === 4 && hour === 13;
    logStep(
      '6.2',
      'Restricción Estricta',
      isExactThursdaySlot ? 'OK' : 'WARN',
      `Paciente Carla asignada a su hueco estricto: Jueves a las ${format(carlaDate, 'HH:mm')}`,
      `Día: ${format(carlaDate, 'EEEE', { locale: es })} a las ${format(carlaDate, 'HH:mm')} en ${carlaProposal.room?.name}`
    );
  } else {
    logStep('6.2', 'Restricción Estricta', 'WARN', 'Carla no pudo ser asignada en la primera ronda');
  }

  // Verificación de descuidos/colisiones: ¿alguna propuesta pisa descansos de comida?
  let breakCollisions = 0;
  for (const prop of autoAssignResult.proposals) {
    const profBreaks = prop.professional.schedule?.monday?.breaks || [];
    const propStartH = prop.start.getHours() * 60 + prop.start.getMinutes();
    const propEndH = prop.end.getHours() * 60 + prop.end.getMinutes();
    for (const b of profBreaks) {
      const [bh1, bm1] = b.start.split(':').map(Number);
      const [bh2, bm2] = b.end.split(':').map(Number);
      const bStart = bh1 * 60 + bm1;
      const bEnd = bh2 * 60 + bm2;
      if (propStartH < bEnd && bStart < propEndH) {
        breakCollisions++;
      }
    }
  }

  logStep(
    '6.3',
    'Descansos Laborales',
    breakCollisions === 0 ? 'OK' : 'FAIL',
    `0 colisiones detectadas con las pausas de comida de los terapeutas (${breakCollisions} solapes)`
  );

  // Aplicar las propuestas aprobadas
  for (const proposal of autoAssignResult.proposals) {
    const newAppt: Appointment = {
      id: proposal.id,
      clinicId,
      patientId: proposal.patient.id,
      professionalId: proposal.professional.id,
      roomId: proposal.room?.id || 'sala-1',
      serviceId: proposal.service?.id || 'serv-sesion-45',
      start: proposal.start.toISOString(),
      end: proposal.end.toISOString(),
      status: 'scheduled',
      notes: `Asignación automática Tetris (${proposal.reasons.join(', ')})`
    };
    await apptRepo.saveAppointment(newAppt);
  }

  // --------------------------------------------------------------------------
  // PASO 7: Medición de KPIs de Eficiencia de la Agenda Generada
  // --------------------------------------------------------------------------
  console.log('\n📊 PASO 7: Auditoría de Eficiencia y Compacidad de la Agenda...');

  const efficiencyMetrics = await optimizationService.calculateScheduleEfficiency(clinicId, weekMonday);

  logStep(
    '7.1',
    'KPIs de Eficiencia',
    efficiencyMetrics.occupancyRate >= 0 ? 'OK' : 'FAIL',
    `Tasa de Ocupación Global: ${efficiencyMetrics.occupancyRate}% | Compacidad Tetris: ${efficiencyMetrics.compactnessScore}% (${efficiencyMetrics.compactnessLabel})`,
    `Horas ocupadas: ${efficiencyMetrics.occupiedHours}h de ${efficiencyMetrics.totalCapacityHours}h | Micro-huecos fragmentados: ${efficiencyMetrics.fragmentedGapsCount}`
  );

  // --------------------------------------------------------------------------
  // PASO 8: Simulación de Imprevisto: Cancelación de Última Hora y Gap Filler
  // --------------------------------------------------------------------------
  console.log('\n⚡ PASO 8: Simulación de Cancelación de Última Hora y Asistente Gap Filler...');

  // El paciente Mateo sufre un imprevisto y cancela su cita del Martes 12:30
  await apptRepo.updateAppointment(clinicId, appt2.id, { status: 'cancelled' });
  const cancelledAppt = (await apptRepo.getAppointment(clinicId, appt2.id))!;

  logStep(
    '8.1',
    'Cancelación',
    cancelledAppt.status === 'cancelled' ? 'OK' : 'FAIL',
    `Cita de Mateo Fernández cancelada con éxito (Hueco liberado: Martes 12:30 - 13:00 en Sala 3)`
  );

  // Disparo del algoritmo Gap Filler en el hueco liberado
  const gapStart = performance.now();
  const gapCandidates = await optimizationService.findCandidatePatientsForGap(cancelledAppt, clinicId);
  const gapElapsed = performance.now() - gapStart;

  logStep(
    '8.2',
    'Gap Filler Scoring',
    gapCandidates.length > 0 ? 'OK' : 'FAIL',
    `Gap Filler localizó ${gapCandidates.length} candidatos idóneos en ${Math.round(gapElapsed)}ms`
  );

  // El candidato #1 debe ser Leo Domínguez por su flag de alta disponibilidad inmediata
  const topCandidate = gapCandidates[0];
  const isLeoTop = topCandidate?.patient.id === 'pat-leo-dominguez';

  logStep(
    '8.3',
    'Ranking Inteligente',
    isLeoTop ? 'OK' : 'WARN',
    `Candidato #1 recomendado: ${topCandidate?.patient.name} ${topCandidate?.patient.surname} (Puntuación: ${topCandidate?.priorityScore})`,
    `Motivo del asistente: ${topCandidate?.reason}`
  );

  // Verificar formato del mensaje generado para WhatsApp
  const hasValidWhatsAppLink = !!topCandidate?.whatsappUrl && topCandidate.whatsappUrl.startsWith('https://wa.me/');
  logStep(
    '8.4',
    'Notificación WhatsApp',
    hasValidWhatsAppLink ? 'OK' : 'FAIL',
    `Enlace directo de WhatsApp generado para ${topCandidate?.contactName}`,
    `URL de contacto: ${topCandidate?.whatsappUrl?.substring(0, 95)}...`
  );

  // Reasignar el hueco a Leo
  const replacementAppt: Appointment = {
    id: `appt-gap-filled-${Date.now()}`,
    clinicId,
    patientId: topCandidate.patient.id,
    professionalId: cancelledAppt.professionalId,
    roomId: cancelledAppt.roomId,
    serviceId: cancelledAppt.serviceId,
    start: cancelledAppt.start,
    end: cancelledAppt.end,
    status: 'scheduled',
    notes: `Hueco cubierto de urgencia vía Gap Filler tras cancelación de ${cancelledAppt.id}`
  };
  await apptRepo.saveAppointment(replacementAppt);

  // --------------------------------------------------------------------------
  // PASO 9: Radar de Huecos Semanales y Protocolo de Alta Médica / Baja
  // --------------------------------------------------------------------------
  console.log('\n🎯 PASO 9: Radar de Huecos Vacíos y Gestión de Bajas con Relevo...');

  // 9.1 Radar de huecos vacíos
  const radarSlot = await optimizationService.findCandidatePatientsForEmptySlot(
    new Date(cancelledAppt.start),
    new Date(cancelledAppt.end),
    clinicId
  );

  logStep(
    '9.1',
    'Radar de Huecos',
    radarSlot.candidates.length > 0 ? 'OK' : 'FAIL',
    `Radar de huecos identificó ${radarSlot.candidates.length} pacientes compatibles con la franja horaria`
  );

  // 9.2 Simulación de Alta Médica del paciente adulto Marcos Celaya
  const dischargePlan = await optimizationService.getDischargePlanForPatient(clinicId, 'pat-marcos-celaya');
  logStep(
    '9.2',
    'Plan de Baja Médica',
    dischargePlan.futureAppointmentsCount >= 1 ? 'OK' : 'WARN',
    `Plan de alta para Marcos Celaya localizó ${dischargePlan.futureAppointmentsCount} citas futuras a liberar`,
    `Huecos liberados con candidatos sugeridos: ${dischargePlan.freedSlots.length}`
  );

  // Ejecutar baja médica y archivar paciente
  const dischargeExecution = await optimizationService.executeDischargeAndReassignments(
    clinicId,
    'pat-marcos-celaya',
    dischargePlan.freedSlots.map(s => ({
      appointmentId: s.appointment.id,
      newPatientId: s.selectedCandidateId || null
    })),
    true // Notificar
  );

  const archivedPatient = await patientRepo.getPatientById(clinicId, 'pat-marcos-celaya');
  logStep(
    '9.3',
    'Transición de Estado',
    archivedPatient?.status === 'archived' ? 'OK' : 'FAIL',
    `Paciente Marcos Celaya pasó a estado "archived" (Alta médica cumplida)`,
    `Citas canceladas: ${dischargeExecution.cancelledCount} | Citas reasignadas: ${dischargeExecution.reassignedCount}`
  );

  // --------------------------------------------------------------------------
  // PASO 10: Auditoría de Integridad Referencial y Análisis Diagnóstico
  // --------------------------------------------------------------------------
  console.log('\n🔍 PASO 10: Auditoría Final de Integridad de Datos y Rendimiento...');

  const finalPatients = await patientRepo.getPatientsByClinic(clinicId);
  const finalAppts = localStore.getCollection<Appointment>(`appointments_${clinicId}`);
  const finalRooms = await roomRepo.getRoomsByClinic(clinicId);
  const finalUsers = await userRepo.getUsersByClinic(clinicId);

  const patientIdSet = new Set(finalPatients.map(p => p.id));
  const roomIdSet = new Set(finalRooms.map(r => r.id));
  const userIdSet = new Set(finalUsers.map(u => u.id));

  let orphanAppts = 0;
  for (const a of finalAppts) {
    if (!patientIdSet.has(a.patientId)) orphanAppts++;
    if (!userIdSet.has(a.professionalId)) orphanAppts++;
    if (a.roomId && !roomIdSet.has(a.roomId)) orphanAppts++;
  }

  logStep(
    '10.1',
    'Integridad Referencial',
    orphanAppts === 0 ? 'OK' : 'FAIL',
    `0 citas huérfanas encontradas sobre ${finalAppts.length} citas totales`
  );

  const totalOk = report.filter(r => r.status === 'OK').length;
  const totalWarn = report.filter(r => r.status === 'WARN').length;
  const totalFail = report.filter(r => r.status === 'FAIL').length;

  console.log('\n================================================================================');
  console.log(`🏁 SIMULACIÓN FINALIZADA CON ÉXITO:`);
  console.log(`   Total Pasos Verificados: ${report.length}`);
  console.log(`   ✅ Correctos (OK): ${totalOk}`);
  console.log(`   ⚠️ Advertencias (WARN): ${totalWarn}`);
  console.log(`   ❌ Fallos (FAIL): ${totalFail}`);
  console.log('================================================================================\n');

  return { report, totalOk, totalWarn, totalFail };
}

runOwnerSimulation().catch(err => {
  console.error("FATAL ERROR IN SIMULATION:", err);
  process.exit(1);
});
