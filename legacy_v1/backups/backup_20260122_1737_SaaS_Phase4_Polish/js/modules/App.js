
import { store } from '../store.js';
import { Scheduler } from '../scheduler.js';
import { PatientManager } from './PatientManager.js';
import { ProfessionalManager } from './ProfessionalManager.js';
import { RoomManager } from './RoomManager.js';
import { CalendarManager } from './CalendarManager.js';
import { SidebarManager } from './SidebarManager.js';
import { MockDataManager } from './MockDataManager.js';
import { ToastManager } from './ToastManager.js';
import { DateUtils } from './DateUtils.js';
import { ServiceManager } from './ServiceManager.js';
import { AlertsManager } from './AlertsManager.js';
import { SettingsManager } from './SettingsManager.js';

import { FirebaseManager } from './FirebaseManager.js';

export class App {
    constructor() {
        this.store = store;

        // Firebase Init
        this.firebase = new FirebaseManager();
        this.firebase.init();

        // State
        this.currentProfessionalId = 0; // 0 = All
        this.currentWeekStart = this.calculateInitialWeekStart();

        // Default View Priority: Config > LocalStorage > 'week'
        const configDefault = this.store.state.config && this.store.state.config.defaultView;
        this.viewMode = configDefault || localStorage.getItem('clinicViewMode') || 'week';
        this.hourHeight = 60; // Configurable

        this.colorPalette = {
            blue: { bg: 'bg-blue-500', text: 'text-blue-700', apptBg: 'bg-blue-50', label: 'Azul' },
            green: { bg: 'bg-green-500', text: 'text-green-700', apptBg: 'bg-green-50', label: 'Verde' },
            purple: { bg: 'bg-purple-500', text: 'text-purple-700', apptBg: 'bg-purple-50', label: 'Morado' },
            orange: { bg: 'bg-orange-500', text: 'text-orange-700', apptBg: 'bg-orange-50', label: 'Naranja' },
            red: { bg: 'bg-red-500', text: 'text-red-700', apptBg: 'bg-red-50', label: 'Rojo' },
            teal: { bg: 'bg-teal-500', text: 'text-teal-700', apptBg: 'bg-teal-50', label: 'Turquesa' },
            pink: { bg: 'bg-pink-500', text: 'text-pink-700', apptBg: 'bg-pink-50', label: 'Rosa' },
            indigo: { bg: 'bg-indigo-500', text: 'text-indigo-700', apptBg: 'bg-indigo-50', label: 'Índigo' },
            amber: { bg: 'bg-amber-500', text: 'text-amber-700', apptBg: 'bg-amber-50', label: 'Ámbar' },
            lime: { bg: 'bg-lime-500', text: 'text-lime-700', apptBg: 'bg-lime-50', label: 'Lima' },
            cyan: { bg: 'bg-cyan-500', text: 'text-cyan-700', apptBg: 'bg-cyan-50', label: 'Cian' },
            fuchsia: { bg: 'bg-fuchsia-500', text: 'text-fuchsia-700', apptBg: 'bg-fuchsia-50', label: 'Fucsia' }
        };

        // Managers
        this.patientManager = new PatientManager(this, this.store);
        this.professionalManager = new ProfessionalManager(this, this.store);
        this.roomManager = new RoomManager(this, this.store);
        this.calendarManager = new CalendarManager(this, this.store, Scheduler);
        this.sidebarManager = new SidebarManager(this, this.store);
        this.serviceManager = new ServiceManager(this, this.store);
        this.alertsManager = new AlertsManager(this);
        this.settingsManager = new SettingsManager(this, this.store);

        // Modules Expose
        this.MockDataManager = MockDataManager;
        this.ToastManager = ToastManager;
        this.DateUtils = DateUtils;

        // Undo History
        // Undo History
        this.history = [];

        // CRITICAL: Bind Logout immediately so user is never trapped
        this.bindLogoutEvent();

        // Auth Protection & Init
        this.initialized = false;
        this.firebase.monitorAuthState((user) => {
            const isMockAuth = localStorage.getItem('mock_session') === 'true';

            if (!user && !isMockAuth) {
                console.log("No user logged in. Redirecting...");
                window.location.href = 'login.html';
            } else {
                console.log("User authenticated");

                // 1. Initialize App Immediately (Optimistic UI)
                // This ensures events are bound and UI works with local data while cloud loads
                if (!this.initialized) {
                    this.init();
                    this.initialized = true;
                }

                // 2. Trigger Cloud Sync in Background
                if (user && !isMockAuth) {
                    this.handleCloudSync();
                }
            }
        });
    }

    async handleCloudSync() {
        try {
            ToastManager.showToast("☁️ Conectando...", "info");

            // Timeout to avoid infinite pending state UI
            const loadPromise = this.firebase.loadClinicData();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));

            const cloudData = await Promise.race([loadPromise, timeoutPromise]);

            if (cloudData) {
                this.store.hydrate(cloudData);
                ToastManager.showToast("Datos sincronizados", "success");
            } else {
                console.log("No cloud data found.");

                // Only upload if we have REAL local data (not Mocks)
                if (!this.store.state.isMock) {
                    console.log("Uploading local legacy data to new user slot...");
                    this.firebase.saveClinicData(this.store.state)
                        .then(() => ToastManager.showToast("Datos migrados con éxito", "success"))
                        .catch(e => console.error("Migration failed", e));
                } else {
                    console.log("Local is Mock Data. NOT uploading to Cloud. Waiting for user input.");
                }
            }
        } catch (err) {
            console.error("Cloud Sync Error:", err);
            ToastManager.showToast("Modo Offline / Error Sync", "error");
        }
    }

    onStoreUpdate(newState) {
        if (this.firebase && this.firebase.user) {
            // Simple debounce to avoid spamming Firestore
            if (this.saveTimeout) clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => {
                this.firebase.saveClinicData(newState)
                    .catch(err => console.warn("[App] Auto-save silent error:", err));
            }, 2000);
        }
    }

    init() {
        // Init Logic

        // Store Subscribe
        this.store.subscribe((state) => {
            this.render(state);
        });

        // Initialize Managers Events
        this.patientManager.bindEvents();
        this.professionalManager.bindEvents();
        this.roomManager.bindEvents();
        this.sidebarManager.bindEvents();
        this.serviceManager.bindEvents();
        // this.calendarManager handled internally or delegated? drag events are in render.

        this.bindGlobalEvents();
        // this.bindLogoutEvent(); // Now bound in constructor

        // Initial Render
        this.render(this.store.state);
        this.updateBranding(this.store.state.config);

        // Theme Check
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }

    calculateInitialWeekStart() {
        const saved = localStorage.getItem('clinicCurrentDate');
        let d = saved ? new Date(saved) : new Date();
        const day = d.getDay() || 7;
        if (day !== 1) d.setDate(d.getDate() - day + 1);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    navigateCalendar(direction) {
        // direction: -1 (prev) / 1 (next)
        const d = new Date(this.currentWeekStart);

        if (this.viewMode === 'day') {
            d.setDate(d.getDate() + direction);
        } else if (this.viewMode === 'week') {
            d.setDate(d.getDate() + (direction * 7));
        } else if (this.viewMode === 'month') {
            d.setMonth(d.getMonth() + direction);
            d.setDate(1); // Reset to 1st
        } else if (this.viewMode === 'year') {
            d.setFullYear(d.getFullYear() + direction);
            d.setMonth(0, 1); // Reset to Jan 1st
        }

        this.currentWeekStart = d;
        localStorage.setItem('clinicCurrentDate', d.toISOString());
        this.render(this.store.state);
    }

    setViewMode(mode) {
        this.viewMode = mode;
        localStorage.setItem('clinicViewMode', mode);
        // Adjust currentWeekStart if needed
        if (mode === 'week') {
            this.currentWeekStart = this.calculateInitialWeekStart();
        } else if (mode === 'day') {
            this.currentWeekStart = new Date();
        }
        const sel = document.getElementById('view-mode-select');
        if (sel) sel.value = mode;
        this.render(this.store.state);
    }



    bindGlobalEvents() {
        // Nav Tabs
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.nav-item').forEach(b => {
                    b.classList.remove('bg-indigo-50', 'text-primary', 'dark:bg-indigo-900/20');
                    b.classList.add('text-slate-500', 'hover:bg-slate-50', 'dark:text-slate-400');
                    const icon = b.querySelector('.material-symbols-outlined');
                    if (icon) icon.classList.remove('text-primary');
                });
                btn.classList.add('bg-indigo-50', 'text-primary', 'dark:bg-indigo-900/20');
                btn.classList.remove('text-slate-500', 'hover:bg-slate-50', 'dark:text-slate-400');
                this.switchMainView(btn.dataset.view);
            });
        });

        // Alerts Nav
        const alertsBtn = document.getElementById('nav-alerts');
        if (alertsBtn) {
            alertsBtn.onclick = (e) => {
                e.preventDefault();
                this.alertsManager.openAlertsModal();
            };
        }

        // Date Nav (Dynamic)
        const prevBtn = document.getElementById('prev-week-btn');
        const nextBtn = document.getElementById('next-week-btn');
        const todayBtn = document.getElementById('today-btn');

        if (prevBtn) prevBtn.onclick = () => this.navigateCalendar(-1);
        if (nextBtn) nextBtn.onclick = () => this.navigateCalendar(1);

        if (todayBtn) todayBtn.onclick = () => {
            this.currentWeekStart = this.calculateInitialWeekStart();
            this.render(this.store.state);
        };

        // Filters
        const profSelect = document.getElementById('professional-select');
        if (profSelect) {
            profSelect.onchange = (e) => {
                this.currentProfessionalId = parseInt(e.target.value);
                localStorage.setItem('clinicProfId', this.currentProfessionalId);
                this.render(this.store.state);
            };
        }

        // View Mode
        const viewSelect = document.getElementById('view-mode-select');
        if (viewSelect) {
            viewSelect.onchange = (e) => this.setViewMode(e.target.value);
        }

        // Year Select
        const yearSelect = document.getElementById('year-select');
        if (yearSelect) {
            yearSelect.onchange = (e) => {
                const newYear = parseInt(e.target.value);
                const d = new Date(this.currentWeekStart);
                d.setFullYear(newYear);

                // Logic depends on View Mode
                if (this.viewMode === 'month') {
                    d.setMonth(0, 1);
                } else if (this.viewMode === 'year') {
                    // Start of Year
                    d.setMonth(0, 1);
                } else {
                    // Week/Day: Align to Monday to ensure columns match
                    const day = d.getDay();
                    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                    d.setDate(diff);
                }

                this.currentWeekStart = d;
                this.render(this.store.state);
            };
        }
        // Theme
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            themeBtn.onclick = () => {
                document.documentElement.classList.toggle('dark');
                localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
            };
        }

        // Optimization Btn
        const optimizeBtn = document.getElementById('btn-optimize-schedule');
        if (optimizeBtn) optimizeBtn.onclick = () => this.optimizeSchedule();

        // Modals
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.add('hidden');
            });
        });
        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.onclick = () => {
                const modal = btn.closest('.modal-overlay');
                if (modal) modal.classList.add('hidden');
            };
        });

        this.bindAppointmentFormEvents();
    }

    switchMainView(viewId) {
        // Ensure robust hiding
        const allViews = ['calendar-view', 'patients-view', 'rooms-view', 'services-view', 'professionals-view', 'settings-view'];
        allViews.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('view-hidden');
        });

        const targetView = document.getElementById(viewId);
        if (targetView) targetView.classList.remove('view-hidden');

        if (viewId === 'patients-view') this.patientManager.render();
        if (viewId === 'professionals-view') this.professionalManager.renderProfessionalsView();
        if (viewId === 'rooms-view') this.roomManager.render();
        if (viewId === 'services-view') this.serviceManager.render();
        if (viewId === 'calendar-view') this.calendarManager.renderCalendar(this.store.state);
        if (viewId === 'settings-view') this.settingsManager.render();
    }

    render(state) {
        if (!state) return;

        this.updateBranding(state.config);

        // Sidebar
        // Sidebar
        this.sidebarManager.renderSidebar();

        // Current View
        const activeView = document.querySelector('.view-section:not(.view-hidden)');
        if (activeView) {
            const viewId = activeView.id;
            if (viewId === 'calendar-view') {
                this.updateCalendarHeader();
                this.calendarManager.renderCalendar(state);
            } else if (viewId === 'patients-view') {
                this.patientManager.render();
            } else if (viewId === 'rooms-view') {
                this.roomManager.render();
            } else if (viewId === 'settings-view') {
                this.settingsManager.render();
            } else if (viewId === 'services-view') {
                this.serviceManager.render();
            } else if (viewId === 'professionals-view') {
                this.professionalManager.renderProfessionalsView();
            }
        }

        // Alerts
        if (this.alertsManager) this.alertsManager.checkAlerts();
    }

    updateCalendarHeader() {
        const span = document.getElementById('current-week-span');
        if (!span) return;

        const d = new Date(this.currentWeekStart);
        const options = { month: 'long', year: 'numeric' };

        let text = '';

        if (this.viewMode === 'day') {
            text = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        } else if (this.viewMode === 'week') {
            // Get End of Week
            const end = new Date(d);
            end.setDate(end.getDate() + 4); // Mon-Fri usually
            // Handle cross-month: "28 Oct - 01 Nov"
            const m1 = d.toLocaleDateString('es-ES', { month: 'short' });
            const m2 = end.toLocaleDateString('es-ES', { month: 'short' });

            if (m1 === m2) {
                text = `${d.getDate()} - ${end.getDate()} ${d.toLocaleDateString('es-ES', { month: 'long' })}`;
            } else {
                text = `${d.getDate()} ${m1} - ${end.getDate()} ${m2}`;
            }
        } else if (this.viewMode === 'month') {
            text = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        } else {
            text = d.getFullYear();
        }

        // Capitalize first letter
        text = text.charAt(0).toUpperCase() + text.slice(1);
        span.innerText = text;

        // Sync Year Select if exists
        const yearSel = document.getElementById('year-select');
        if (yearSel) yearSel.value = d.getFullYear();
    }

    updateBranding(config) {
        if (!config) return;

        // Logo
        const logoImg = document.getElementById('sidebar-logo');
        if (logoImg) {
            if (config.clinicLogo) {
                logoImg.src = config.clinicLogo;
            } else {
                logoImg.src = 'assets/logo.png';
            }
            logoImg.alt = config.clinicName || 'TimeCare';
        }

        // Clinic Name In Sidebar (if visible)
        const nameSpan = document.getElementById('sidebar-clinic-name');
        if (nameSpan) {
            nameSpan.innerText = config.clinicName || 'TimeCare';
        }

        // Title (Document)
        if (config.clinicName) {
            document.title = `${config.clinicName} - Gestión`;
        }
    }

    populateProfessionalSelect() {
        const select = document.getElementById('professional-select');
        if (!select) return;
        const currentVal = select.value;
        const profs = this.store.state.professionals || [];
        // Preserve value if possible, else 0
        const isSet = currentVal && currentVal !== "0";

        select.innerHTML = '<option value="0">Todos los Profesionales</option>';
        profs.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            select.appendChild(opt);
        });
        // Restore
        if (this.currentProfessionalId) select.value = this.currentProfessionalId;
    }

    populateModalProfessionalSelect() {
        const select = document.getElementById('new-appt-prof');
        if (!select) return;
        const profs = this.store.state.professionals || [];
        select.innerHTML = ''; // Clear
        profs.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            select.appendChild(opt);
        });
    }





    // Form Submit
    bindAppointmentFormEvents() {
        const apptForm = document.getElementById('new-appointment-form');
        if (apptForm) {
            // Remove any existing listeners by cloning (if needed) or just assuming we are the main handler.
            // Better: use onsubmit property to overwrite any potential legacy handler or ensure single handler.
            apptForm.onsubmit = (e) => {
                e.preventDefault();
                const pId = document.getElementById('new-appt-patient-id').value;
                const date = document.getElementById('new-appt-date').value;
                const time = document.getElementById('new-appt-time').value;
                const profId = document.getElementById('new-appt-prof').value;

                if (!pId || !date || !time || !profId) {
                    ToastManager.showToast("Por favor completa todos los campos.", 'error');
                    return;
                }

                // Construct Date
                const startStr = `${date}T${time}:00`;
                const start = new Date(startStr);
                const end = new Date(start.getTime() + 45 * 60000); // Default 45m

                if (this.currentApptId) {
                    // UPDATE
                    (async () => {
                        if (await window.app.showConfirm("¿Confirmar actualización?", "¿Guardar los cambios de la cita?", "question")) {
                            const updates = {
                                patientId: parseInt(pId),
                                professionalId: parseInt(profId),
                                start: start.toISOString(),
                                end: end.toISOString()
                            };
                            this.store.updateAppointment(this.currentApptId, updates);
                            document.getElementById('new-appointment-modal').classList.add('hidden');
                            ToastManager.showToast("Cita actualizada correctamente", 'success');
                        }
                    })();
                } else {
                    // CREATE
                    const pNameLocal = document.getElementById('new-appt-patient-search').value; // Fallback
                    const newAppt = {
                        id: Date.now(),
                        patientId: parseInt(pId),
                        patientName: pNameLocal || "Paciente",
                        professionalId: parseInt(profId),
                        start: start.toISOString(),
                        end: end.toISOString(),
                        status: 'scheduled',
                        type: 'single',
                        serviceId: null, // Logic needed
                        notes: ''
                    };
                    this.store.addAppointment(newAppt);
                    document.getElementById('new-appointment-modal').classList.add('hidden');
                    ToastManager.showToast("Cita agendada correctamente", 'success');
                }
            };
        }
    }

    // --- LOGIC ---

    async handleCalendarDrop(data, dayIndex, timeSlotHour, professionalId = null) {
        // data: "PATIENT:ID" or "APPT:ID:Date"
        const parts = data.split(':');
        const type = parts[0];
        const id = parseFloat(parts[1]);

        // Target Date Construction
        const d = new Date(this.currentWeekStart);
        d.setDate(d.getDate() + dayIndex);
        d.setHours(timeSlotHour, 0, 0, 0); // 9:00 -> 09:00:00
        const targetStart = d.toISOString();
        const targetDateObj = new Date(d);

        if (type === 'APPT') {
            // Move Appointment
            const appt = this.store.state.appointments.find(a => a.id === id);
            if (!appt) return;

            // Calculate duration
            const oldStart = new Date(appt.start);
            const oldEnd = new Date(appt.end);
            const duration = (oldEnd - oldStart);

            const newStart = new Date(targetDateObj);
            const newEnd = new Date(newStart.getTime() + duration);

            // Build update object
            const updatePayload = {
                start: newStart.toISOString(),
                end: newEnd.toISOString()
            };
            if (professionalId) updatePayload.professionalId = professionalId;

            // Confirm Logic
            let msg = `¿Mover cita de ${appt.patientName} a ${newStart.toLocaleString()}?`;
            if (professionalId && professionalId !== appt.professionalId) {
                const newPro = this.store.state.professionals.find(p => p.id === professionalId);
                msg += ` y reasignar a ${newPro ? newPro.name : 'nuevo profesional'}?`;
            }

            if (await window.app.showConfirm("Mover Cita", msg, "question")) {
                this.store.updateAppointment(id, updatePayload);
                ToastManager.showToast("Cita movida.", "success");
            }

        } else if (type === 'PATIENT') {
            // New Appointment (Patient)
            // Use == for loose equality (String vs Number)
            const patient = this.store.state.patients.find(p => p.id == id);

            if (!patient) {
                console.warn("Drop: Patient not found", id);
                return;
            }

            // Default duration
            const duration = patient.preferredDuration || 45;
            const end = new Date(targetDateObj);
            end.setMinutes(end.getMinutes() + duration);

            // 1. Availability Check
            const checkDay = targetDateObj.getDay();
            const dropTimeVal = targetDateObj.getHours() * 60 + targetDateObj.getMinutes();

            const parseTime = (t) => {
                if (!t) return 0;
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };

            let isAvailable = false;
            if (patient.availability && patient.availability.length > 0) {
                isAvailable = patient.availability.some(slot => {
                    // Match either standard 0 or ISO 7 for Sunday
                    const matchesDay = (slot.day === checkDay) || (checkDay === 0 && slot.day === 7);
                    return matchesDay &&
                        (dropTimeVal >= parseTime(slot.start) && dropTimeVal < parseTime(slot.end || "23:59"));
                });
            } else {
                isAvailable = false;
            }

            if (!isAvailable) {
                const dayName = targetDateObj.toLocaleDateString('es-ES', { weekday: 'long' });
                const timeStr = targetDateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                // Show Custom Warning Modal
                this.showConflictModal(
                    `El paciente <b>${patient.name}</b> no tiene disponibilidad registrada para el <span class="capitalize">${dayName}</span> a las ${timeStr}.`,
                    () => {
                        // On Confirm
                        this.finalizeDrop(patient, targetDateObj, professionalId);
                    }
                );
                return; // Wait for user interaction
            }

            // If available, proceed directly
            this.finalizeDrop(patient, targetDateObj, professionalId);
        }

    }

    finalizeDrop(patient, targetDateObj, professionalId) {
        // Duration
        const duration = patient.preferredDuration || 45;
        const end = new Date(targetDateObj);
        end.setMinutes(end.getMinutes() + duration);
        const targetStart = targetDateObj.toISOString();

        // 2. Auto-Book (No Modal)
        let finalProId = professionalId;
        if (!finalProId) {
            if (this.currentProfessionalId && this.currentProfessionalId !== 0) {
                finalProId = this.currentProfessionalId;
            } else {
                finalProId = this.store.state.professionals[0] ? this.store.state.professionals[0].id : null;
            }
        }

        const newAppt = {
            id: Date.now(),
            patientId: patient.id,
            patientName: patient.name,
            professionalId: finalProId,
            start: targetStart,
            end: end.toISOString(),
            status: 'scheduled',
            type: 'single',
            serviceId: patient.service || null,
            notes: ''
        };

        this.store.addAppointment(newAppt);
        ToastManager.showToast(`Cita creada para ${patient.name}`, 'success');
    }

    showConflictModal(msgHtml, onConfirm) {
        const modal = document.getElementById('warning-modal');
        if (!modal) return;

        document.getElementById('warning-message').innerHTML = msgHtml;
        document.getElementById('warning-title').innerText = "Conflicto de Disponibilidad";

        const btnConfirm = document.getElementById('warning-confirm-btn');
        const btnCancel = document.getElementById('warning-cancel-btn'); // Actually "No/Delete" usually, but here "Cancel/Block"

        // Re-bind
        const newBtnConfirm = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);

        newBtnConfirm.onclick = () => {
            onConfirm();
            modal.classList.add('hidden');
        };

        // Cancel just closes
        btnCancel.onclick = () => modal.classList.add('hidden');

        // SHOW
        modal.classList.remove('hidden');

    }

    openAppointmentModal(appt, defaults = null) {
        // Delegate to CalendarManager or handle here. App legacy handled here.
        const modal = document.getElementById('new-appointment-modal');
        if (!modal) return;
        const form = document.getElementById('new-appointment-form');
        form.reset();
        this.currentApptId = null; // Reset ID for new appt

        const title = document.getElementById('appt-modal-title');
        title.innerText = "Nueva Cita";

        const btnText = document.getElementById('btn-save-appt-text');
        if (btnText) btnText.innerText = "Agendar";

        // Populate Professionals
        this.populateModalProfessionalSelect();

        // Hide Delete Button for New Appts
        const deleteBtn = document.getElementById('btn-delete-appt');
        if (deleteBtn) deleteBtn.classList.add('hidden');

        // Logic to populate fields
        if (defaults) {
            const startD = new Date(defaults.start);
            const endD = new Date(defaults.end);

            const dateInput = document.getElementById('appt-date');
            const timeInput = document.getElementById('appt-time');
            const durationInput = document.getElementById('appt-duration');
            const patientInput = document.getElementById('appt-patient-id');
            const profInput = document.getElementById('appt-professional-id');

            if (dateInput) dateInput.value = startD.toISOString().split('T')[0];
            if (timeInput) timeInput.value = startD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (durationInput) durationInput.value = (endD - startD) / 60000;

            if (patientInput && defaults.patientId) patientInput.value = defaults.patientId;
            if (profInput && defaults.professionalId) profInput.value = defaults.professionalId;
        }

        modal.classList.remove('hidden');
    }

    getSuggestions(targetDay, startMins) {
        // Logic reused from CalendarManager analysis
        const waitingListState = this.store.state.waitingList || [];
        const patientsState = this.store.state.patients || [];

        // Simple overlap check
        const check = (patient) => {
            if (!patient.availability) return false; // Flexible?
            return patient.availability.some(s => {
                if (s.day !== targetDay) return false;
                const [sH, sM] = s.start.split(':').map(Number);
                const [eH, eM] = s.end.split(':').map(Number);
                const sTime = sH * 60 + sM;
                const eTime = eH * 60 + eM;
                return startMins >= sTime && startMins < eTime; // Starts within availability
            });
        };

        const waitingList = waitingListState.filter(check).map(p => ({ ...p, isWaiting: true }));
        const activePatients = patientsState
            .filter(p => !waitingList.some(w => w.id === p.id))
            .filter(check)
            .map(p => ({ ...p, isWaiting: false }));

        const suggestions = [...waitingList, ...activePatients];
        suggestions.sort((a, b) => {
            if (a.isWaiting && b.isWaiting) return (new Date(a.waitingSince) - new Date(b.waitingSince));
            return (b.isWaiting === true) - (a.isWaiting === true);
        });
        return suggestions;
    }

    renderOptimizationModal(allSuggestions, originalAppt, slot) {
        console.log("AppDebug: renderOptimizationModal called");
        console.log("AppDebug: suggestions count:", allSuggestions ? allSuggestions.length : "NULL");

        const modal = document.getElementById('optimization-modal');
        const list = document.getElementById('opt-suggestions-list');
        const info = document.getElementById('opt-slot-info');
        const searchInput = document.getElementById('opt-search-input');
        const tabWaiting = document.getElementById('opt-tab-waiting');
        const tabActive = document.getElementById('opt-tab-active');

        console.log("AppDebug: Elements found?", {
            modal: !!modal,
            list: !!list,
            input: !!searchInput,
            tabW: !!tabWaiting,
            tabA: !!tabActive
        });

        if (!modal || !list) {
            console.error("AppDebug: CRITICAL - Modal or List not found in DOM");
            return;
        }

        // Populate Slot Info
        const dateStr = new Date(slot.start).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        const timeStr = new Date(slot.start).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        if (info) info.innerHTML = `<span class="capitalize">${dateStr}</span> - ${timeStr}`;

        // Filter State
        let currentFilter = {
            text: '',
            tab: 'waiting'
        };

        // Render Helper
        const renderList = () => {
            list.innerHTML = '';

            // Filter
            const filtered = allSuggestions.filter(p => {
                const matchTab = (currentFilter.tab === 'waiting' && p.isWaiting) || (currentFilter.tab === 'active' && !p.isWaiting);
                const matchText = !currentFilter.text || p.name.toLowerCase().includes(currentFilter.text.toLowerCase());
                return matchTab && matchText;
            });

            if (filtered.length === 0) {
                document.getElementById('opt-no-results').classList.remove('hidden');
            } else {
                document.getElementById('opt-no-results').classList.add('hidden');
                filtered.forEach(p => {
                    const div = document.createElement('div');
                    div.className = "p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center hover:shadow-md cursor-pointer transition-all group";

                    const statusBadge = p.isWaiting
                        ? `<span class="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider">En espera</span>`
                        : `<span class="ml-2 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider">Activo</span>`;

                    const serviceName = this.store.state.services.find(s => s.id == p.service)?.name || 'General';

                    div.innerHTML = `
                         <div class="flex items-center gap-3">
                             <div class="size-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-bold text-xs">
                                ${p.name.charAt(0)}
                             </div>
                             <div>
                                 <p class="font-bold text-slate-800 dark:text-white text-sm flex items-center">${p.name} ${statusBadge}</p>
                                 <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                                    <span class="size-2 rounded-full bg-primary/50"></span> ${serviceName}
                                 </p>
                             </div>
                         </div>
                         <button class="bg-gray-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 group-hover:bg-primary group-hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                            Asignar
                         </button>
                     `;
                    div.onclick = () => {
                        this.startBookingFlow(p, slot);
                        modal.classList.add('hidden');
                    };
                    list.appendChild(div);
                });
            }
        };

        // Bind Events
        if (searchInput) {
            searchInput.value = '';
            searchInput.className = "w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all";
            searchInput.oninput = (e) => {
                currentFilter.text = e.target.value;
                renderList();
            };
        }

        const updateTabs = (tab) => {
            currentFilter.tab = tab;
            const activeClass = "flex-1 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-gray-700 text-primary shadow-sm transition-all text-center";
            const inactiveClass = "flex-1 py-1.5 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all text-center";

            if (tabWaiting) tabWaiting.className = tab === 'waiting' ? activeClass : inactiveClass;
            if (tabActive) tabActive.className = tab === 'active' ? activeClass : inactiveClass;
            renderList();
        };

        if (tabWaiting) tabWaiting.onclick = () => updateTabs('waiting');
        if (tabActive) tabActive.onclick = () => updateTabs('active');

        // Initial Render
        updateTabs('waiting');
        modal.classList.remove('hidden');
    }

    startBookingFlow(patient, slot) {
        // Advanced Booking Logic
        console.log("Starting Booking Flow:", patient.name, patient.status);

        const professionalId = slot.professionalId || (this.currentProfessionalId && this.currentProfessionalId !== 0 ? this.currentProfessionalId : (this.store.state.professionals[0]?.id || 1));

        if (patient.isWaiting) {
            // Flow for Waiting List
            this.openBookingOptions(patient, slot, professionalId);
        } else {
            // Flow for Active: Just Add + Log
            const newAppt = {
                id: Date.now(),
                patientId: patient.id,
                patientName: patient.name,
                professionalId: professionalId,
                start: slot.start,
                end: slot.end,
                status: 'scheduled',
                type: 'single',
                serviceId: patient.service || null,
                notes: 'Sesión Extra (Smart Scheduler)'
            };
            this.store.addAppointment(newAppt);

            // Log Extra Session
            if (!patient.extraSessions) patient.extraSessions = [];
            patient.extraSessions.push({ date: new Date().toISOString(), reason: 'Sesión Extra' });
            this.store.updatePatient(patient.id, { extraSessions: patient.extraSessions });

            ToastManager.showToast(`Sesión extra agendada para ${patient.name}`, 'success');
        }
    }

    // --- BOOKING FLOW & CONFLICTS ---

    openBookingOptions(patient, slot, professionalId) {
        const modal = document.getElementById('booking-options-modal');
        const content = document.getElementById('booking-options-content');
        if (!modal || !content) return;

        // Step 1: Sporadic vs Fixed
        content.innerHTML = '';

        const btnSporadic = this.createOptionButton('confirmation_number', 'Cita Esporádica', 'Una sola sesión puntual.', 'blue');
        btnSporadic.onclick = () => {
            // Action: Single Appt
            this.createSingleAppointment(patient, slot, professionalId, 'Cita Esporádica (Waiting)');
            modal.classList.add('hidden');
            ToastManager.showToast('Cita esporádica creada', 'success');
        };

        const btnFixed = this.createOptionButton('event_repeat', 'Tratamiento Fijo', 'Pasar a activo con horario recurrente.', 'purple');
        btnFixed.onclick = () => {
            // Step 2: Chronic vs Temporal
            this.renderBookingStep2(patient, slot, professionalId);
        };

        content.appendChild(btnSporadic);
        content.appendChild(btnFixed);

        modal.classList.remove('hidden');
    }

    renderBookingStep2(patient, slot, professionalId) {
        const content = document.getElementById('booking-options-content');
        content.innerHTML = '';

        const btnChronic = this.createOptionButton('all_inclusive', 'Crónico / Indefinido', 'Citas recurrentes sin fecha fin.', 'emerald');
        btnChronic.onclick = () => {
            // Action: Recurring Infinite
            this.createRecurringAppointment(patient, slot, professionalId, null); // null = infinite
            this.store.updatePatient(patient.id, { status: 'active' });
            document.getElementById('booking-options-modal').classList.add('hidden');
            ToastManager.showToast('Tratamiento crónico iniciado', 'success');
        };

        const btnTemporal = this.createOptionButton('date_range', 'Temporal', 'Número fijo de sesiones.', 'amber');
        btnTemporal.onclick = () => {
            // Step 3: Input N Sessions
            this.renderBookingStep3(patient, slot, professionalId);
        };

        content.appendChild(btnChronic);
        content.appendChild(btnTemporal);
    }

    renderBookingStep3(patient, slot, professionalId) {
        const content = document.getElementById('booking-options-content');
        content.innerHTML = `
            <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Número de Sesiones</label>
                <input type="number" id="temporal-sessions-input" value="10" min="1" max="50" 
                    class="w-full text-center text-2xl font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-600 rounded-lg py-3 focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white">
                <p class="text-xs text-center text-slate-400 mt-2">Se generarán las citas semanalmente.</p>
            </div>
            <button id="btn-confirm-temporal" class="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl shadow-lg mt-2 transition-all">
                Confirmar y Generar
            </button>
        `;

        document.getElementById('btn-confirm-temporal').onclick = () => {
            const n = parseInt(document.getElementById('temporal-sessions-input').value) || 1;
            this.createMultipleAppointments(patient, slot, professionalId, n);

            this.store.updatePatient(patient.id, { status: 'active', totalSessions: n });

            document.getElementById('booking-options-modal').classList.add('hidden');
            ToastManager.showToast(`Generadas ${n} sesiones temporales`, 'success');
        };
    }

    createOptionButton(icon, title, subtitle, color) {
        const btn = document.createElement('button');
        const colorClasses = {
            blue: 'hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-900/20 group-hover:text-blue-500',
            purple: 'hover:bg-purple-50 hover:border-purple-200 dark:hover:bg-purple-900/20 group-hover:text-purple-500',
            emerald: 'hover:bg-emerald-50 hover:border-emerald-200 dark:hover:bg-emerald-900/20 group-hover:text-emerald-500',
            amber: 'hover:bg-amber-50 hover:border-amber-200 dark:hover:bg-amber-900/20 group-hover:text-amber-500'
        };
        const activeClass = colorClasses[color] || colorClasses.blue;

        btn.className = `w-full text-left p-4 rounded-xl border border-gray-200 dark:border-gray-700 transition-all group flex items-start gap-4 ${activeClass}`;
        btn.innerHTML = `
            <div class="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 group-hover:bg-white dark:group-hover:bg-gray-700 transition-colors">
                <span class="material-symbols-outlined text-slate-500 dark:text-slate-400 ${activeClass.split(' ').pop()}">${icon}</span>
            </div>
            <div>
                <p class="font-bold text-slate-800 dark:text-white text-sm">${title}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${subtitle}</p>
            </div>
        `;
        return btn;
    }

    createSingleAppointment(patient, slot, professionalId, note) {
        const appt = {
            id: Date.now(),
            patientId: patient.id,
            patientName: patient.name,
            professionalId: professionalId,
            start: slot.start,
            end: slot.end,
            status: 'scheduled',
            type: 'single',
            serviceId: patient.service || null,
            notes: note || ''
        };
        this.store.addAppointment(appt);
    }

    createRecurringAppointment(patient, slot, professionalId, duration) {
        const appt = {
            id: Date.now(),
            patientId: patient.id,
            patientName: patient.name,
            professionalId: professionalId,
            start: slot.start,
            end: slot.end,
            status: 'scheduled',
            type: 'recurring',
            serviceId: patient.service || null,
            notes: 'Tratamiento Crónico'
        };
        this.store.addAppointment(appt);
    }

    createMultipleAppointments(patient, slot, professionalId, count) {
        let currentStart = new Date(slot.start);
        let currentEnd = new Date(slot.end);

        for (let i = 0; i < count; i++) {
            const appt = {
                id: Date.now() + i,
                patientId: patient.id,
                patientName: patient.name,
                professionalId: professionalId,
                start: currentStart.toISOString(),
                end: currentEnd.toISOString(),
                status: 'scheduled',
                type: 'single',
                serviceId: patient.service || null,
                notes: `Sesión ${i + 1}/${count} (Temporal)`
            };
            this.store.addAppointment(appt);

            // Add 1 week
            currentStart.setDate(currentStart.getDate() + 7);
            currentEnd.setDate(currentEnd.getDate() + 7);
        }
    }
    optimizeSchedule() {
        if (!confirm("¿Ejecutar algoritmo de optimización? Esto puede reorganizar muchas citas.")) return;
        ToastManager.showToast("Optimizando agenda...", "info");

        // Execute Logic
        const count = Scheduler.optimize(this.store);

        setTimeout(() => {
            ToastManager.showToast(`Optimización completada. ${count} citas agendadas.`, "success");
            this.render(this.store.state);
        }, 500);
    }
    // --- APPOINTMENT DETAILS & CANCELLATION ---

    openAppointmentDetails(appt) {
        // Reuse the New Appointment Modal for editing
        const modal = document.getElementById('new-appointment-modal');
        const form = document.getElementById('new-appointment-form');
        if (!modal || !form) return;

        form.reset();
        this.currentApptId = appt.id; // Track ID

        // Title
        const title = document.getElementById('appt-modal-title');
        if (title) title.innerText = "Editar Cita";

        // Button Text
        const btnText = document.getElementById('btn-save-appt-text');
        if (btnText) btnText.innerText = "Actualizar Cita";

        // Populate Professionals
        this.populateModalProfessionalSelect();

        // Populate Fields (Basic implementation - requires IDs of inputs match)
        const inputs = {
            'new-appt-patient-id': appt.patientId,
            'new-appt-prof': appt.professionalId,
            'new-appt-date': appt.start.split('T')[0],
            'new-appt-time': new Date(appt.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        for (const [id, val] of Object.entries(inputs)) {
            const el = document.getElementById(id);
            if (el) el.value = val;
        }

        // Special: Populate Patient Name for Search Input
        const pSearch = document.getElementById('new-appt-patient-search');
        if (pSearch) pSearch.value = appt.patientName;

        // Show Modal
        modal.classList.remove('hidden');

        // HANDLE DELETE BUTTON
        const deleteBtn = document.getElementById('btn-delete-appt');
        if (deleteBtn) {
            deleteBtn.classList.remove('hidden');
            deleteBtn.onclick = () => {
                // Open Cancellation Choice Modal instead of direct delete
                const choiceModal = document.getElementById('cancellation-choice-modal');
                if (choiceModal) {
                    choiceModal.classList.remove('hidden');
                    // Bind choices
                    const btnSingle = document.getElementById('btn-cancel-single');
                    if (btnSingle) btnSingle.onclick = () => this.handleAdvancedCancellation('single', appt.id, appt.patientId);

                    const btnRec = document.getElementById('btn-cancel-recurring');
                    if (btnRec) btnRec.onclick = () => this.handleAdvancedCancellation('treatment', appt.id, appt.patientId);

                    const btnClose = document.getElementById('btn-cancel-choice-close');
                    if (btnClose) btnClose.onclick = () => choiceModal.classList.add('hidden');
                } else {
                    // Fallback
                    if (confirm('¿Eliminar cita?')) {
                        this.store.deleteAppointment(appt.id);
                        modal.classList.add('hidden');
                        this.render(this.store.state);
                    }
                }
            };
        }
    }

    async handleAdvancedCancellation(mode, apptId, patientId) {
        const choiceModal = document.getElementById('cancellation-choice-modal');
        const detailsModal = document.getElementById('new-appointment-modal');

        if (mode === 'single') {
            if (await this.showConfirm('Confirmar Cancelación', '¿Cancelar solo esta cita?', 'warning')) {
                this.store.deleteAppointment(apptId);
                ToastManager.showToast('Cita cancelada', 'success');
            }
        } else if (mode === 'treatment') {
            if (await this.showConfirm('⚠️ Cancelar Tratamiento', 'Esto cancelará TODAS las citas futuras y archivará al paciente. ¿Continuar?', 'danger')) {
                // 1. Delete this appointment
                this.store.deleteAppointment(apptId);

                // 2. Find and delete future appointments for this patient
                const now = new Date();
                const futureAppts = this.store.state.appointments.filter(a =>
                    a.patientId === patientId &&
                    new Date(a.start) > now
                );
                futureAppts.forEach(a => this.store.deleteAppointment(a.id));

                // 3. Archive Patient
                this.store.updatePatient(patientId, { status: 'archived' });

                ToastManager.showToast(`Tratamiento finalizado. ${futureAppts.length + 1} citas eliminadas.`, 'info');
            }
        }

        // Close Modals
        if (choiceModal) choiceModal.classList.add('hidden');
        if (detailsModal) detailsModal.classList.add('hidden');
        this.render(this.store.state);
    }

    showConfirm(title, message, type = 'info') {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            if (!modal) {
                // Fallback if modal DOM is missing
                console.warn("Confirm Modal DOM not found, using native.");
                resolve(confirm(`${title}\n${message}`));
                return;
            }

            const titleEl = document.getElementById('confirm-modal-title');
            const msgEl = document.getElementById('confirm-modal-message');
            const btnConfirm = document.getElementById('confirm-modal-ok');
            const btnCancel = document.getElementById('confirm-modal-cancel');
            const iconEl = document.getElementById('confirm-modal-icon');

            if (titleEl) titleEl.innerText = title;
            if (msgEl) msgEl.innerHTML = message;

            // Icon & Color Logic
            if (iconEl) {
                if (type === 'danger') {
                    iconEl.innerText = 'warning';
                    iconEl.className = 'material-symbols-outlined text-4xl text-red-500 mb-2';
                    btnConfirm.className = 'bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-bold transition-colors';
                    btnConfirm.innerText = "Eliminar"; // Default for danger
                } else if (type === 'warning') {
                    iconEl.innerText = 'error';
                    iconEl.className = 'material-symbols-outlined text-4xl text-orange-500 mb-2';
                    btnConfirm.className = 'bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-bold transition-colors';
                    btnConfirm.innerText = "Continuar";
                } else {
                    iconEl.innerText = 'info';
                    iconEl.className = 'material-symbols-outlined text-4xl text-blue-500 mb-2';
                    btnConfirm.className = 'bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-xl font-bold transition-colors';
                    btnConfirm.innerText = "Aceptar";
                }
            }

            // Clean previous listeners by cloning
            const newConfirm = btnConfirm.cloneNode(true);
            const newCancel = btnCancel.cloneNode(true);
            btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
            btnCancel.parentNode.replaceChild(newCancel, btnCancel);

            newConfirm.onclick = () => {
                modal.classList.add('hidden');
                resolve(true);
            };

            newCancel.onclick = () => {
                modal.classList.add('hidden');
                resolve(false);
            };

            modal.classList.remove('hidden');
        });
    }

    bindLogoutEvent() {
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', async () => {
                if (await this.showConfirm('Cerrar Sesión', '¿Estás seguro de que quieres salir?', 'warning')) {
                    // Clear Mock Session
                    localStorage.removeItem('mock_session');
                    localStorage.removeItem('user_email');

                    // Clear Firebase Session
                    if (this.firebase) {
                        await this.firebase.logout();
                    } else {
                        window.location.href = 'login.html';
                    }
                }
            });
        }
    }
}

// Initialize App
window.app = new App();
