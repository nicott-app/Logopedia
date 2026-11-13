
import { ToastManager } from './ToastManager.js';

export class SettingsManager {
    constructor(app, store) {
        this.app = app;
        this.store = store;
        this.tempLogo = null;
        this.tempHolidays = [];
        this.bindEvents();
    }

    bindEvents() {
        const form = document.getElementById('settings-form');
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                this.saveSettings();
            };
        }

        // Logo Upload
        const logoInput = document.getElementById('setting-logo-upload');
        if (logoInput) logoInput.onchange = (e) => this.handleLogoUpload(e);

        const removeLogoBtn = document.getElementById('btn-remove-logo');
        if (removeLogoBtn) removeLogoBtn.onclick = () => {
            this.tempLogo = null;
            this.renderLogoPreview();
        };

        // Holidays
        const addHolidayBtn = document.getElementById('btn-add-holiday');
        if (addHolidayBtn) addHolidayBtn.onclick = () => this.addHoliday();

        // Data
        const exportBtn = document.getElementById('btn-export-data');
        if (exportBtn) exportBtn.onclick = () => this.exportData();

        const importInput = document.getElementById('import-data-file');
        if (importInput) importInput.onchange = (e) => this.importData(e);

        this.bindImportEvents();
    }

    render() {
        const config = this.store.state.config;
        if (!config || !config.schedule) return;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        };

        // Identity
        setVal('setting-clinic-name', config.clinicName);
        this.tempLogo = config.clinicLogo;
        this.renderLogoPreview();

        // Prefs
        setVal('setting-default-view', config.defaultView || 'week');

        // Schedule
        setVal('setting-sched-start', config.schedule.start);
        setVal('setting-sched-end', config.schedule.end);
        setVal('setting-lunch-start', config.schedule.lunchStart);
        setVal('setting-lunch-end', config.schedule.lunchEnd);

        // Holidays
        this.tempHolidays = [...(config.holidays || [])];
        this.renderHolidaysList();
    }

    // --- LOGO ---
    handleLogoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Validation: Max 500KB match UI text
        if (file.size > 500 * 1024) {
            ToastManager.showToast("El archivo es demasiado grande (Máx 500KB)", "error");
            e.target.value = ''; // Clear input
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.tempLogo = e.target.result;
            this.renderLogoPreview();
        };
        reader.readAsDataURL(file);
    }

    renderLogoPreview() {
        const img = document.getElementById('setting-logo-preview');
        const placeholder = document.getElementById('setting-logo-placeholder');
        const removeBtn = document.getElementById('btn-remove-logo');

        if (this.tempLogo) {
            img.src = this.tempLogo;
            img.classList.remove('hidden');
            placeholder.classList.add('hidden');
            if (removeBtn) removeBtn.classList.remove('hidden');
        } else {
            img.src = '';
            img.classList.add('hidden');
            placeholder.classList.remove('hidden');
            if (removeBtn) removeBtn.classList.add('hidden');
        }
    }

    // --- HOLIDAYS ---
    addHoliday() {
        const input = document.getElementById('setting-holiday-date');
        const date = input.value;
        if (!date) return;

        if (!this.tempHolidays.includes(date)) {
            this.tempHolidays.push(date);
            this.tempHolidays.sort(); // Keep sorted
            this.renderHolidaysList();
        }
        input.value = '';
    }

    removeHoliday(date) {
        this.tempHolidays = this.tempHolidays.filter(d => d !== date);
        this.renderHolidaysList();
    }

    renderHolidaysList() {
        const container = document.getElementById('settings-holiday-list');
        if (!container) return;
        container.innerHTML = '';

        this.tempHolidays.forEach(date => {
            const chip = document.createElement('div');
            chip.className = 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2';

            // Format nice date
            const d = new Date(date);
            const label = d.toLocaleDateString();

            chip.innerHTML = `
                <span>${label} (${date})</span>
                <button type="button" class="hover:text-red-800 dark:hover:text-red-200 transition-colors">
                    <span class="material-symbols-outlined text-[14px]">close</span>
                </button>
            `;

            // Delete Action
            chip.querySelector('button').onclick = () => this.removeHoliday(date);

            container.appendChild(chip);
        });
    }

    // --- DATA ---
    exportData() {
        const dataStr = JSON.stringify(this.store.state, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().split('T')[0];
        a.download = `logopedia_backup_${date}.json`;
        a.click();
        URL.revokeObjectURL(url);

        ToastManager.showToast("Copia de seguridad descargada", "success");
    }

    importData(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm("⚠️ ATENCIÓN: Al restaurar una copia se BORRARÁN todos los datos actuales. ¿Estás seguro?")) {
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                // Basic Validation
                if (!json.config || !json.patients) throw new Error("Formato inválido");

                this.store.state = json;
                this.store.save();
                alert("Datos restaurados correctamente. La página se recargará.");
                location.reload();
            } catch (err) {
                alert("Error al leer el archivo: " + err.message);
            }
        };
        reader.readAsText(file);
    }

    // --- ICS IMPORT ---
    bindImportEvents() {
        const btnOpen = document.getElementById('btn-open-import-ics');
        const btnConfirm = document.getElementById('btn-confirm-import');
        const modal = document.getElementById('import-ics-modal');

        if (btnOpen) btnOpen.onclick = () => {
            if (modal) modal.classList.remove('hidden');
        };

        if (btnConfirm) btnConfirm.onclick = () => this.handleICSImport();

        // Cloud Migration
        const btnMigrate = document.getElementById('btn-migrate-cloud');
        if (btnMigrate) btnMigrate.onclick = async () => {
            if (confirm("¿Subir tus datos locales a la nube? Esto sobrescribirá lo que haya en Firebase.")) {
                await this.app.firebase.uploadLocalDataToCloud();
            }
        };
    }

    async handleICSImport() {
        const fileInput = document.getElementById('ics-file-input');
        const strategy = document.querySelector('input[name="import-strategy"]:checked').value; // 'match' or 'new'
        const statusArea = document.getElementById('import-status-area');

        if (!fileInput.files[0]) {
            ToastManager.showToast("Selecciona un archivo .ics primero", "error");
            return;
        }

        const file = fileInput.files[0];
        const text = await file.text();

        statusArea.innerHTML = "Analizando archivo...<br>";
        statusArea.classList.remove('hidden');

        const events = this.parseICS(text);

        if (events.length === 0) {
            statusArea.innerHTML += `<span class="text-red-500">No se encontraron eventos válidos.</span>`;
            return;
        }

        statusArea.innerHTML += `Encontrados ${events.length} eventos. Procesando...<br>`;

        let createdPatients = 0;
        let matchedPatients = 0;
        let importedAppts = 0;

        events.forEach(ev => {
            let patientId = null;
            const cleanName = this.cleanImportName(ev.summary);

            // 1. Find or Create Patient
            if (strategy === 'match') {
                const existing = this.store.state.patients.find(p => p.name.toLowerCase() === cleanName.toLowerCase());
                if (existing) {
                    patientId = existing.id;
                    matchedPatients++;
                }
            }

            if (!patientId) {
                // Create New
                const newP = {
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    name: strategy === 'new' ? `${cleanName} (Importado)` : cleanName,
                    phone: '',
                    notes: 'Paciente importado de calendario externo.',
                    status: 'active',
                    treatmentPlan: '1x45',
                    pendingReassignments: []
                };
                this.store.state.patients.push(newP);
                patientId = newP.id;
                createdPatients++;
            }

            // 2. Create Appointment
            if (ev.start && ev.end) {
                this.store.state.appointments.push({
                    id: Date.now() + Math.floor(Math.random() * 10000),
                    patientId: patientId,
                    start: ev.start.toISOString(),
                    end: ev.end.toISOString(),
                    status: 'scheduled',
                    notes: ev.description || 'Importado via ICS'
                });
                importedAppts++;
            }
        });

        this.store.save();

        statusArea.innerHTML += `<br>
            <span class="text-green-600 font-bold">¡Proceso Finalizado!</span><br>
            - Citas Importadas: ${importedAppts}<br>
            - Pacientes Vinculados: ${matchedPatients}<br>
            - Pacientes Nuevos: ${createdPatients}<br>
        `;

        ToastManager.showToast(`Importación completada: ${importedAppts} citas.`, "success");

        // Optional: Close modal after delay
        setTimeout(() => {
            // this.app.render(this.store.state); // Refresh UI
            // document.getElementById('import-ics-modal').classList.add('hidden');
        }, 2000);
    }

    cleanImportName(summary) {
        // Remove common prefixes
        return summary
            .replace(/^(Cita con|Sesión|Reunión|Meeting|Appt):?\s*/i, '')
            .trim();
    }

    parseICS(content) {
        const events = [];
        const lines = content.split(/\r\n|\n|\r/);
        let inEvent = false;
        let currentEvent = {};

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('BEGIN:VEVENT')) {
                inEvent = true;
                currentEvent = {};
            } else if (line.startsWith('END:VEVENT')) {
                inEvent = false;
                if (currentEvent.start && currentEvent.summary) {
                    events.push(currentEvent);
                }
            } else if (inEvent) {
                // Handle folded lines (lines starting with space) - simplified
                if (line.startsWith('SUMMARY:')) currentEvent.summary = line.substring(8);
                if (line.startsWith('DESCRIPTION:')) currentEvent.description = line.substring(12);
                if (line.startsWith('DTSTART')) currentEvent.start = this.parseICSDate(line);
                if (line.startsWith('DTEND')) currentEvent.end = this.parseICSDate(line);
            }
        }
        return events;
    }

    parseICSDate(line) {
        // Format: DTSTART:20230120T090000Z or DTSTART;TZID=...:2023...
        const parts = line.split(':');
        const val = parts[1]; // 20230120T090000Z
        if (!val) return null;

        // Check for Z (UTC)
        const isUTC = val.endsWith('Z');

        // Regex for YYYYMMDDTHHMMSS (T optional for safety, though usually present)
        const match = val.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);

        if (match) {
            const y = parseInt(match[1]);
            const m = parseInt(match[2]) - 1; // Months are 0-indexed
            const d = parseInt(match[3]);
            const h = match[4] ? parseInt(match[4]) : 0;
            const min = match[5] ? parseInt(match[5]) : 0;
            const s = match[6] ? parseInt(match[6]) : 0;

            if (isUTC) {
                return new Date(Date.UTC(y, m, d, h, min, s));
            } else {
                // Treat as Local Time (Browser's Timezone)
                return new Date(y, m, d, h, min, s);
            }
        }
        return null;
    }

    // --- SAVE ---
    saveSettings() {
        const getVal = (id) => document.getElementById(id).value;

        const newConfig = {
            ...this.store.state.config,
            clinicName: getVal('setting-clinic-name'),
            clinicLogo: this.tempLogo,
            defaultView: getVal('setting-default-view'),
            holidays: this.tempHolidays,
            schedule: {
                ...this.store.state.config.schedule,
                start: getVal('setting-sched-start'),
                end: getVal('setting-sched-end'),
                lunchStart: getVal('setting-lunch-start'),
                lunchEnd: getVal('setting-lunch-end'),
            }
        };

        // Update Store
        this.store.state.config = newConfig;
        this.store.save();

        ToastManager.showToast("Configuración guardada", "success");

        // Update Sidebar Elements (Name/Logo)
        // Ideally this.app.updatebranding()
        // Reload for safety on big changes or dynamic update
        if (confirm("Configuración guardada. ¿Recargar para aplicar todos los cambios visuales?")) {
            location.reload();
        } else {
            this.app.render(this.store.state);
        }
    }
}
