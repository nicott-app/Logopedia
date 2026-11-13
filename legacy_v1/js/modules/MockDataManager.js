import { ToastManager } from './ToastManager.js';
import { DateUtils, generateId } from './DateUtils.js';

export class MockDataManager {
    static async generateMockData(clinicStore, app) {
        if (!app || !await app.showConfirm("⚠️ Generar Ecosistema Completo v3.0", "Esto creará 100 pacientes y 5 profesionales, pero BORRARÁ TODOS LOS DATOS ACTUALES. ¿Continuar?", "danger")) return;

        const loadingToast = document.createElement('div');
        loadingToast.className = 'fixed bottom-4 right-4 bg-slate-800 text-white px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center gap-4';
        loadingToast.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div><div><strong>Generando Datos...</strong><br><span id="mock-progress" class="text-xs text-gray-400">Iniciando...</span></div>`;
        document.body.appendChild(loadingToast);
        const updateProgress = (msg) => document.getElementById('mock-progress').innerText = msg;

        await new Promise(r => setTimeout(r, 100)); // Allow UI to render

        try {


            // 0. RESET STORE
            clinicStore.state.appointments = [];
            clinicStore.state.patients = [];
            clinicStore.state.rooms = [];
            clinicStore.state.professionals = [];
            clinicStore.state.services = [];

            // 1. SERVICES
            const servicesData = [
                { name: 'Logopedia', duration: 45, color: 'blue' }, // Default, though variable
                { name: 'Fisioterapia', duration: 60, color: 'green' },
                { name: 'Psicología', duration: 60, color: 'purple' },
                { name: 'Neuropsicología', duration: 45, color: 'teal' }
            ];
            clinicStore.state.services = servicesData.map(s => ({
                id: s.name.toLowerCase(),
                name: s.name,
                duration: s.duration,
                color: s.color
            }));

            // 2. ROOMS (5 Specific Rooms)
            const roomsData = [
                { id: 2001, name: 'Sala Fisioterapia', type: 'gym' },
                { id: 2002, name: 'Sala Psicología', type: 'office' },
                { id: 2003, name: 'Sala Logopedia 1', type: 'standard' },
                { id: 2004, name: 'Sala Logopedia 2', type: 'standard' },
                { id: 2005, name: 'Sala Logopedia 3', type: 'standard' }
            ];
            clinicStore.state.rooms = roomsData;

            // 3. PROFESSIONALS (1 Fisio, 1 Psico, 3 Logos)
            const profsData = [
                { id: 1, name: 'Laura Fisio', color: 'green', services: ['Fisioterapia'], rooms: [2001], status: 'active' },
                { id: 2, name: 'Carlos Psico', color: 'purple', services: ['Psicología', 'Neuropsicología'], rooms: [2002], status: 'active' },
                { id: 3, name: 'Ana Logo', color: 'blue', services: ['Logopedia'], rooms: [2003, 2004], status: 'active' },
                { id: 4, name: 'David Logo', color: 'teal', services: ['Logopedia'], rooms: [2004, 2005], status: 'active' },
                { id: 5, name: 'Elena Logo', color: 'pink', services: ['Logopedia'], rooms: [2005, 2003], status: 'active' }
            ];
            clinicStore.state.professionals = profsData;

            // 4. GENERATE 250-300 PATIENTS
            updateProgress("Creando lista de espera (250-300 pacientes)...");
            const namesSource = ["Sofía", "Mateo", "Valentina", "Santiago", "Isabella", "Lucas", "Camila", "Diego", "Martín", "Lucía", "Elena", "Javier", "Adrián", "Paula", "Alejandro", "Daniela", "Manuel", "Valeria", "Gabriel", "Sara", "Álvaro", "Julia", "Leo", "Claudia", "David", "Marta", "Pablo", "Irene", "Marcos", "Nora", "Hugo", "Alice", "Bruno", "Lara", "Enzo"];
            const surnamesSource = ["García", "Rodríguez", "López", "Martínez", "Sánchez", "Pérez", "Gómez", "Martín", "Jiménez", "Ruiz", "Hernández", "Díaz", "Moreno", "Muñoz", "Álvarez", "Romero", "Navarro", "Torres"];

            const newPatients = [];
            const targetCount = Math.floor(Math.random() * 51) + 250; // Random 250-300

            for (let i = 0; i < targetCount; i++) {
                const fn = namesSource[Math.floor(Math.random() * namesSource.length)];
                const ln1 = surnamesSource[Math.floor(Math.random() * surnamesSource.length)];
                const ln2 = surnamesSource[Math.floor(Math.random() * surnamesSource.length)];

                // Service Distribution
                const randS = Math.random();
                let service = 'Logopedia';
                if (randS > 0.85) service = 'Psicología';
                else if (randS > 0.70) service = 'Fisioterapia';

                // Treatment Plan & Type
                let treatmentType = (Math.random() > 0.4) ? 'chronic' : 'temporary';
                let totalSessions = 0;
                if (treatmentType === 'temporary') {
                    totalSessions = 5 + Math.floor(Math.random() * 15);
                }

                // Duration & Sessions
                let duration = 45;
                let sessionsPerWeek = 1;
                let planLabel = "1x45";

                if (service === 'Logopedia') {
                    const randLogo = Math.random();
                    if (randLogo < 0.33) { duration = 30; sessionsPerWeek = 1; planLabel = "1x30"; }
                    else if (randLogo < 0.66) { duration = 30; sessionsPerWeek = 2; planLabel = "2x30"; }
                    else { duration = 45; sessionsPerWeek = 1; planLabel = "1x45"; }
                } else if (service === 'Fisioterapia' || service === 'Psicología') {
                    duration = 60;
                    planLabel = "1x60";
                }

                // STRICT Availability Profile
                const avail = [];
                const d1 = 1 + Math.floor(Math.random() * 5); // 1-5

                const profile = Math.random();

                if (profile < 0.40) {
                    const startH = 15 + Math.floor(Math.random() * 4);
                    avail.push({ day: d1, start: `${startH}:00`, end: `${startH + 2}:00` });
                } else if (profile < 0.70) {
                    let d2 = (d1 % 5) + 1;
                    if (sessionsPerWeek > 1) d2 = (d1 + 2 > 5) ? (d1 + 2) - 5 : d1 + 2;
                    const startH = 15 + Math.floor(Math.random() * 4);
                    avail.push({ day: d1, start: `${startH}:00`, end: `${startH + 2}:00` });
                    avail.push({ day: d2, start: `${startH}:00`, end: `${startH + 2}:00` });
                } else if (profile < 0.90) {
                    const isMorning = Math.random() > 0.7;
                    if (isMorning) avail.push({ day: d1, start: "10:00", end: "13:00" });
                    else avail.push({ day: d1, start: "16:00", end: "20:00" });
                } else {
                    avail.push({ day: 1, start: "16:00", end: "20:00" });
                    avail.push({ day: 3, start: "16:00", end: "20:00" });
                    avail.push({ day: 5, start: "15:00", end: "19:00" });
                }

                newPatients.push({
                    id: generateId(),
                    name: `${fn} ${ln1} ${ln2}`,
                    age: 3 + Math.floor(Math.random() * 14),
                    phone: "600000000",
                    email: "test@logo.com",
                    status: 'waiting',
                    service: service,
                    treatmentType: treatmentType,
                    treatmentPlan: planLabel,
                    sessionsPerWeek: sessionsPerWeek,
                    preferredDuration: duration,
                    availability: avail,
                    totalSessions: totalSessions,
                    notesHistory: [],
                    files: []
                });
            }

            // 5. SCHEDULE ONLY LUNCH BREAKS - DEPRECATED
            // Lunch breaks are now handled by Global Config & Visual Blocks in CalendarManager.
            // We no longer generate "fake" appointments for them.
            updateProgress("Configurando sistema...");
            const appointments = [];

            // Final Commit
            clinicStore.state.patients = newPatients;
            clinicStore.state.appointments = appointments;
            // waitingList is now a derived view, no need to set it separately
            clinicStore.save();

            // Final Refresh - We need to trigger render?
            // Store notify usually does it.
            // clinicStore.notify(); // Handled by caller or just call it here?
            // Usually caller refreshes UI.

            updateProgress("¡Completado!");
            setTimeout(() => loadingToast.remove(), 2000);
            ToastManager.showToast("✅ Simulación completada.", "success");

            return true; // Signal success to Caller

        } catch (e) {
            console.error(e);
            ToastManager.showToast("Error generación: " + e.message, "error");
            loadingToast.remove();
            return false;
        }
    }
}
