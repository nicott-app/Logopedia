
import { ToastManager } from './ToastManager.js';
import { generateId } from './DateUtils.js';
import { escapeHtml } from './DateUtils.js';

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

        // Security
        this.renderSecurityLogs();
        this.updateEncryptionUI();

        // Comms
        this.renderTemplates();
    }

    renderSecurityLogs() {
        const container = document.getElementById('security-logs-body');
        if (!container) return;

        const logs = this.store.state.auditLogs || [];
        if (logs.length === 0) {
            container.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400 italic">No hay registros de actividad recientes.</td></tr>';
            return;
        }

        container.innerHTML = logs.map(log => `
            <tr class="hover:bg-white dark:hover:bg-gray-800 transition-colors">
                <td class="px-4 py-2 font-mono text-[10px] whitespace-nowrap">${new Date(log.timestamp).toLocaleString()}</td>
                <td class="px-4 py-2 font-bold text-xs">${escapeHtml(log.action)}</td>
                <td class="px-4 py-2 truncate max-w-[150px]" title="${escapeHtml(log.details)}">${escapeHtml(log.details)}</td>
                <td class="px-4 py-2 text-[10px]">${escapeHtml(log.user)}</td>
            </tr>
        `).join('');
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
        const password = prompt("🔐 SEGURIDAD: Introduce una contraseña para encriptar la copia (Deja vacío para guardar sin encriptar):");

        let dataContent = JSON.stringify(this.store.state, null, 2);
        let filename = `logopedia_backup_${new Date().toISOString().split('T')[0]}.json`;

        if (password) {
            const encrypted = this.store.db.crypto.encryptData(this.store.state, password);
            if (encrypted) {
                dataContent = encrypted;
                filename = `logopedia_backup_SECURE_${new Date().toISOString().split('T')[0]}.txt`;
                ToastManager.showToast("Archivo encriptado correctamente.", "success");
            } else {
                ToastManager.showToast("Error al encriptar. Se guardará sin encriptar.", "error");
            }
        } else {
            ToastManager.showToast("⚠️ Archivo guardado SIN encriptar.", "warning");
        }

        const blob = new Blob([dataContent], { type: "text/plain" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // --- ENCRYPTION ---
    async toggleEncryption() {
        const isEnabled = this.store.db.crypto.isEnabled();

        if (!isEnabled) {
            // Enable Flow
            const pass1 = prompt("Establece la Contraseña Maestra (IMPORTANTE: No la olvides):");
            if (!pass1) return;
            const pass2 = prompt("Repite la contraseña:");
            if (pass1 !== pass2) {
                alert("Las contraseñas no coinciden.");
                return;
            }

            if (this.store.db.crypto.enable(pass1)) {
                // HC-03: Almacenar contraseña mediante API segura (nunca como propiedad pública)
                this.store.db.setSessionPassword(pass1);
                await this.store.save(true); // Force save encrypted
                this.updateEncryptionUI();
                this._dismissEncryptionBanner();
                ToastManager.showToast("🔒 Cifrado ACTIVADO. Guarda bien tu contraseña.", "success");
            } else {
                ToastManager.showToast("Error al encriptar. Intenta otra contraseña.", "error");
            }

        } else {
            // Disable Flow — HC-03: verificación criptográfica real, no comparación directa
            const pass = prompt("Introduce tu contraseña actual para desactivar el cifrado:");
            if (!pass) return;

            // Intentar desencriptar los datos actuales con la contraseña dada
            // Si tiene éxito, la contraseña es correcta (prueba criptográfica real)
            const raw = localStorage.getItem('clinicState');
            const verified = raw
                ? this.store.db.crypto.decryptData(raw, pass) !== null
                : pass === this.store.db.getSessionPassword(); // Fallback sin datos

            if (verified) {
                this.store.db.crypto.disable();
                this.store.db.clearSessionPassword();
                await this.store.save(true); // Guardar sin cifrar
                this.updateEncryptionUI();
                ToastManager.showToast("🔓 Cifrado DESACTIVADO. Los datos se guardan en claro.", "info");
            } else {
                ToastManager.showToast("Contraseña incorrecta. Operación cancelada.", "error");
            }
        }
    }

    updateEncryptionUI() {
        const statusText = document.getElementById('encryption-status-text');
        const btn = document.getElementById('btn-toggle-encryption');
        if (!btn || !statusText) return;

        const isEnabled = this.store.db.crypto.isEnabled();
        if (isEnabled) {
            btn.innerHTML = '<span class="material-symbols-outlined text-sm">lock_open</span><span>Desactivar Cifrado</span>';
            btn.className = "flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-4 py-2 rounded-lg text-xs font-bold transition-all";
            statusText.innerHTML = '✅ <strong>Base de datos cifrada y protegida.</strong>';
            statusText.className = "text-xs text-emerald-600 font-bold mt-1";
        } else {
            btn.innerHTML = '<span class="material-symbols-outlined text-sm">shield</span><span>Activar Cifrado</span>';
            btn.className = "flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md shadow-amber-500/20 transition-all";
            statusText.innerHTML = '⚠️ Los datos clínicos se guardan <strong>sin cifrar</strong>. Se recomienda activar el cifrado.';
            statusText.className = "text-xs text-amber-700 dark:text-amber-400 mt-1 font-medium";
        }
        // HC-02: Sincronizar el banner global
        this._syncEncryptionBanner(isEnabled);
    }

    /** HC-02: Muestra/oculta el banner global de advertencia de cifrado. */
    _syncEncryptionBanner(isEncryptionActive) {
        const banner = document.getElementById('encryption-warning-banner');
        if (!banner) return;
        if (isEncryptionActive) {
            banner.classList.add('hidden');
        } else {
            banner.classList.remove('hidden');
        }
    }

    /** HC-02: Descarta el banner (el usuario ya activó el cifrado). */
    _dismissEncryptionBanner() {
        const banner = document.getElementById('encryption-warning-banner');
        if (banner) banner.classList.add('hidden');
    }

    // --- TEMPLATES ---
    renderTemplates() {
        const templates = this.app.communicationService.getTemplates();

        // Simple mapping to existing or new inputs?
        // Check index.html to see where to inject or if inputs exist.
        // Assuming we need to add the HTML for this section usually, or if index.html already has it?
        // I will assume I need to ADD the HTML via innerHTML injection or check if I need to update index.html first.
        // The Plan said "Add new Tab/Section".
        // Let's create a Render method that targets a container, OR assumes inputs exist.

        // Strategy: Inject HTML into a new "settings-comms" container that I will add to index.html.
        const container = document.getElementById('settings-templates-container');
        if (!container) return; // Need to add to index.html first

        // Helper
        const mkInput = (key, label, value) => `
            <div class="mb-4">
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">${label}</label>
                <textarea data-tpl-key="${key}" rows="2" class="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-primary outline-none transition-all resize-none">${escapeHtml(value)}</textarea>
            </div>
        `;

        if (!templates.clinical) templates.clinical = { initial: "Evaluación Inicial de {{patient}} ({{age}} años)...", session: "Sesión del día {{today}}..." };

        container.innerHTML = `
            <div class="flex gap-4 mb-4 border-b border-gray-100 dark:border-gray-700">
                <button type="button" id="tab-tpl-comms" class="pb-2 border-b-2 border-indigo-600 text-indigo-600 font-bold text-sm transition-colors">Mensajería</button>
                <button type="button" id="tab-tpl-clinical" class="pb-2 border-b-2 border-transparent text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors">Informes Clínicos</button>
            </div>

            <!-- COMMS -->
            <div id="tpl-content-comms">
                <h4 class="font-bold text-slate-800 dark:text-white mb-2">WhatsApp</h4>
                ${mkInput('whatsapp.reminder', 'Recordatorio de Cita', templates.whatsapp.reminder)}
                ${mkInput('whatsapp.delay', 'Aviso de Retraso', templates.whatsapp.delay)}

                <h4 class="font-bold text-slate-800 dark:text-white mb-2 mt-6">Email</h4>
                ${mkInput('email.reminder.subject', 'Asunto Recordatorio', templates.email.reminder.subject)}
                ${mkInput('email.reminder.body', 'Cuerpo Recordatorio', templates.email.reminder.body)}
            </div>

            <!-- CLINICAL -->
            <div id="tpl-content-clinical" class="hidden">
                 <div class="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg mb-4 text-xs text-blue-800 dark:text-blue-300">
                    Puedes usar variables: <b>{{patient}}, {{age}}, {{today}}</b>
                </div>
                ${mkInput('clinical.initial', 'Evaluación Inicial', templates.clinical.initial)}
                ${mkInput('clinical.session', 'Nota de Sesión', templates.clinical.session)}
                ${mkInput('clinical.discharge', 'Informe de Alta', templates.clinical.discharge || '')}
            </div>

            <div class="mt-4 flex justify-end">
                <button type="button" id="btn-save-templates" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors">
                    Guardar Plantillas
                </button>
            </div>
        `;

        // Tab Logic
        const tabComms = document.getElementById('tab-tpl-comms');
        const tabClinical = document.getElementById('tab-tpl-clinical');
        const contentComms = document.getElementById('tpl-content-comms');
        const contentClinical = document.getElementById('tpl-content-clinical');

        const switchTab = (toClinical) => {
            if (toClinical) {
                tabComms.classList.replace('border-indigo-600', 'border-transparent');
                tabComms.classList.replace('text-indigo-600', 'text-slate-400');
                tabClinical.classList.replace('border-transparent', 'border-indigo-600');
                tabClinical.classList.replace('text-slate-400', 'text-indigo-600');
                contentComms.classList.add('hidden');
                contentClinical.classList.remove('hidden');
            } else {
                tabClinical.classList.replace('border-indigo-600', 'border-transparent');
                tabClinical.classList.replace('text-indigo-600', 'text-slate-400');
                tabComms.classList.replace('border-transparent', 'border-indigo-600');
                tabComms.classList.replace('text-slate-400', 'text-indigo-600');
                contentClinical.classList.add('hidden');
                contentComms.classList.remove('hidden');
            }
        };

        tabComms.onclick = () => switchTab(false);
        tabClinical.onclick = () => switchTab(true);

        // Bind Save
        document.getElementById('btn-save-templates').onclick = () => this.saveTemplatesAndUI();
    }

    saveTemplatesAndUI() {
        const container = document.getElementById('settings-templates-container');
        const getVal = (key) => {
            const el = container.querySelector(`textarea[data-tpl-key="${key}"]`);
            return el ? el.value : '';
        };

        const newTemplates = {
            whatsapp: {
                reminder: getVal('whatsapp.reminder'),
                cancel: getVal('whatsapp.cancel'), // Preserving if available somewhere or blank
                delay: getVal('whatsapp.delay')
            },
            email: {
                reminder: {
                    subject: getVal('email.reminder.subject'),
                    body: getVal('email.reminder.body')
                }
            },
            clinical: {
                initial: getVal('clinical.initial'),
                session: getVal('clinical.session'),
                discharge: getVal('clinical.discharge')
            }
        };

        // Merge to keep unedited keys (like whatsapp.cancel hidden)
        const current = this.app.communicationService.getTemplates();
        if (current.whatsapp && current.whatsapp.cancel) newTemplates.whatsapp.cancel = current.whatsapp.cancel;

        this.app.communicationService.saveTemplates(newTemplates);
        ToastManager.showToast("Plantillas guardadas correctamente", "success");
    }

    // Removed old saveTemplates
    // saveTemplates() {



    async importData(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!await this.app.showConfirm("⚠️ RESTAURAR COPIA DE SEGURIDAD", "Al restaurar una copia se BORRARÁN todos los datos actuales. ¿Estás seguro?", "danger")) {
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                let rawData = e.target.result;
                let parsedData = null;

                // Check for Encryption (CryptoJS format usually starts with Salted__)
                if (this.store.db.crypto.isEncrypted(rawData)) {
                    const pass = prompt("🔐 Este archivo está encriptado. Introduce la contraseña:");
                    if (!pass) return;

                    const decrypted = this.store.db.crypto.decryptData(rawData, pass);
                    if (!decrypted) {
                        alert("❌ Contraseña incorrecta o archivo dañado.");
                        return;
                    }
                    parsedData = decrypted; // decryptData already returns JSON object if successful
                } else {
                    parsedData = JSON.parse(rawData);
                }

                // Basic Validation
                if (!parsedData.config || !parsedData.patients) throw new Error("Formato de datos inválido");

                this.store.state = parsedData;
                await this.store.save();
                alert("✅ Datos restaurados correctamente. La página se recargará.");
                location.reload();
            } catch (err) {
                alert("Error al procesar el archivo: " + err.message);
                console.error(err);
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
            if (await this.app.showConfirm("¿Subir datos a la nube?", "Esto sobrescribirá lo que haya en Firebase con tus datos locales.", "warning")) {
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
            statusArea.innerHTML += `< span class="text-red-500" > No se encontraron eventos válidos.</span > `;
            return;
        }

        statusArea.innerHTML += `Encontrados ${events.length} eventos.Procesando...<br>`;

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
                    id: generateId(),
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
                    id: generateId(),
                    patientId: patientId,
                    start: ev.start.toISOString(),
                    end: ev.end.toISOString(),
                    status: 'scheduled',
                    notes: ev.description || 'Importado via ICS'
                });
                importedAppts++;
            }
        });

        await this.store.save();

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
    async saveSettings() {
        try {
            console.log("Saving settings...");
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

            console.log("New Config:", newConfig);

            // Update Store
            this.store.state.config = newConfig;
            await this.store.save();

            // Update UI Immediately
            this.app.router.updateBranding(newConfig);
            this.app.render(this.store.state);

            ToastManager.showToast("Configuración guardada correctamente", "success");
        } catch (e) {
            console.error("Error saving settings:", e);
            ToastManager.showToast("Error al guardar: " + e.message, "error");
        }
    }
}
