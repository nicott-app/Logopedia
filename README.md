# 🗣️ LogoPedia — Gestión Integral y Optimización Inteligente de Clínicas de Logopedia

Plataforma integral en la nube diseñada específicamente para centros y clínicas de **Logopedia, Neurodesarrollo y Terapia Miofuncional**. Incorpora un motor matemático de optimización de agendas (estilo Tetris), directorio clínico con anamnesis y consentimiento informado digital conforme al **RGPD / LOPDGDD**, y gestión multi-gabinete y de equipo multidisciplinar.

---

## ✨ Características Principales

### 📅 1. Motor de Agenda y Optimización Inteligente
- **Algoritmo de Asignación y Puntuación**: Ponderación de disponibilidad horaria con máxima prioridad (+150 pts) para restricciones horarias estrictas y penalización por desvíos.
- **Protección de Descansos Laborales**: Blindaje automático de pausas de almuerzo y descansos de los profesionales sin posibilidad de solapamiento.
- **Radar Semanal de Huecos y Asistente Inteligente**:
  - Detección proactiva de huecos libres y emparejamiento automático con pacientes en lista de espera.
  - Cobertura ágil de cancelaciones y bajas de última hora.
  - Generación instantánea de mensajes de WhatsApp pre-redactados para confirmación familiar.

### 📋 2. Directorio Clínico y Expedientes de Pacientes
- Fichas completas de pacientes con datos de contacto, tutores legales y DNI/Pasaporte.
- Registro detallado de anamnesis, diagnóstico funcional, evolución y notas de sesión.
- Firma digital manuscrita en pantalla para el **Consentimiento Informado Sanitario (RGPD UE 2016/679 y LOPDGDD 3/2018)**.
- Enlace legal informativo con bases jurídicas, responsable del tratamiento y derechos ARCO.

### 🏥 3. Infraestructura y Gestión del Centro
- **Salas Físicas y Gabinetes**: Control de inventario clínico especializado (baterías de evaluación WISC-V, PROLEC-R, material ARASAAC, espejos Glatzel, etc.) y aforos.
- **Equipo Médico**: Gestión de especialistas, colores identificativos en la agenda, asignación de salas habituales y configuración de turnos semanales.
- **Catálogo de Servicios**: Tarifas y duraciones parametrizables (30m, 45m, 60m) con ajuste automático de escala en la cuadrícula del calendario.
- **Vistas por Rol**: Selector de vista para Administrador (visión global coloreada) y vista personal de Empleado.

---

## 🛠️ Stack Tecnológico

- **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- **Estilos**: [Tailwind CSS](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/)
- **Gestión de Estado**: [Zustand](https://github.com/pmndrs/zustand)
- **Fechas**: [date-fns](https://date-fns.org/)
- **Backend & Autenticación**: [Firebase 12](https://firebase.google.com/) (Firestore, Auth, Hosting)
- **Testing y Automatización**: [Playwright](https://playwright.dev/) para pruebas E2E e interacciones en navegador visible.

---

## 🚀 Puesta en Marcha en Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/<tu-usuario>/LogoPedia.git
cd LogoPedia
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env` o `.env.local` basado en `.env.example`:
```bash
cp .env.example .env.local
```

Rellena las credenciales de tu proyecto de Firebase:
```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_proyecto
VITE_FIREBASE_DATABASE_ID=timecareapp
VITE_FIREBASE_STORAGE_BUCKET=tu_proyecto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
VITE_OFFLINE_DEMO=false
VITE_ENABLE_DEMO_LOGIN=true
```

### 4. Iniciar el servidor de desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:5173`.

---

## 📦 Scripts Disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo local con Vite (HMR). |
| `npm run build` | Compila TypeScript y genera el bundle optimizado para producción en `/dist`. |
| `npm run preview` | Previsualiza en local el bundle compilado de producción. |
| `npm run audit` | Ejecuta la auditoría matemática del motor de optimización de agendas. |
| `npm run simulate` | Ejecuta la simulación completa del ciclo de vida de la clínica. |
| `npm run deploy` | Compila y despliega el proyecto completo en Firebase Hosting. |

---

## 📄 Licencia

Este proyecto es propiedad privada para la gestión de centros clínicos. Todos los derechos reservados.
