
import { store } from '../store.js';
import { Scheduler } from '../scheduler.js';
import { PatientManager } from './PatientManager.js';
import { ProfessionalManager } from './ProfessionalManager.js';
import { RoomManager } from './RoomManager.js';
import { CalendarManager } from './CalendarManager.js';
import { SidebarManager } from './SidebarManager.js';
import { MockDataManager } from './MockDataManager.js';
import { ToastManager } from './ToastManager.js';
import { DateUtils, generateId, escapeHtml } from './DateUtils.js';
import { ServiceManager } from './ServiceManager.js';
import { ClinicService } from '../services/ClinicService.js';

import { AlertsManager } from './AlertsManager.js';
import { SettingsManager } from './SettingsManager.js';
import { FirebaseManager } from './FirebaseManager.js';

// New Modules
import { Router } from './Router.js';
import { ModalService } from './ModalService.js';
import { DragDropService } from './DragDropService.js';
import { DictationService } from './DictationService.js';
import { PredictionService } from './PredictionService.js';
import { SecurityManager } from './SecurityManager.js';
import { CommunicationService } from './CommunicationService.js';
import { CommunicationService } from './CommunicationService.js';
import { AuthService } from './AuthService.js';
import { AppointmentManager } from './AppointmentManager.js';

export class App {
    constructor() {
        this.store = store;

        // Firebase Init
        this.firebase = new FirebaseManager();
        this.firebase.init();

        // State
        this.currentProfessionalId = 0; // 0 = All
        this.currentWeekStart = this.calculateInitialWeekStart();

        // View Mode Init (Logic moved to Router but state kept here for compatibility)
        this.viewMode = localStorage.getItem('clinicViewMode') || 'week';
        this.hourHeight = 90; // Balanced scale (was 60, then 120)

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

        // Core Services
        this.authService = new AuthService(this.store); // Init Auth First
        this.securityManager = new SecurityManager(this, this.store);
        this.predictionService = new PredictionService(this.store); // Init first
        this.router = new Router(this, this.store);
        this.modalService = new ModalService(this, this.store);
        this.dragDropService = new DragDropService(this, this.store);
        this.dictationService = new DictationService();

        // Managers - These will be initialized in postAuthInit
        this.patientManager = null;
        this.professionalManager = null;
        this.roomManager = null;
        this.calendarManager = null;
        this.sidebarManager = null;
        this.serviceManager = null;
        this.alertsManager = null;
        this.settingsManager = null;
        this.appointmentManager = null; // Added for new postAuthInit

        // Modules Expose
        this.MockDataManager = MockDataManager;
        this.ToastManager = ToastManager;
        this.DateUtils = DateUtils;

        this.history = [];
        this.bindLogoutEvent(); // Now uses modalService

        // Auth Protection & Init
        this.initialized = false;
        this.firebase.monitorAuthState((user) => {
            // For "Local First" approach with Roles, we ignore Firebase Auth for Dashboard access
            // and use it only for Cloud Sync.
            // We trigger init() immediately if not already active.
            if (!this.initialized) {
                this.init();
                this.initialized = true;
            }
            if (user) {
                this.handleCloudSync();
            }
        });
    }

    // --- PROXY METHODS (Compatibility) ---
    showConfirm(title, message, type, confirmText) {
        return this.modalService.showConfirm(title, message, type, confirmText);
    }
    showConflictModal(msg, onConfirm) {
        return this.modalService.showConflictModal(msg, onConfirm);
    }
    handleAdvancedCancellation(mode, apptId, pId) {
        return this.modalService.handleAdvancedCancellation(mode, apptId, pId);
    }
    handleCalendarDrop(data, dayIndex, hour, profId) {
        return this.dragDropService.handleCalendarDrop(data, dayIndex, hour, profId);
    }
    switchMainView(viewId) {
        return this.router.switchMainView(viewId);
    }

    navigateDate(days) {
        // Prepare new date
        const newDate = new Date(this.currentWeekStart);
        newDate.setDate(newDate.getDate() + days);
        this.currentWeekStart = newDate;

        // Persist logic (similar to CalendarManager)
        localStorage.setItem('clinicCurrentDate', this.currentWeekStart.toISOString());

        // Update View - Explicitly check active view to force refresh if needed
        this.render(this.store.state);

        // Force specific view update just in case general render misses it
        const activeView = document.querySelector('.view-section:not(.view-hidden)');
        if (activeView && activeView.id === 'rooms-view') {
            this.roomManager.render();
        }
    }

    // --- MAIN INITIALIZATION ---

    async handleCloudSync() {
        const loader = document.getElementById('global-loader');
        try {
            if (loader) loader.classList.remove('hidden');

            // Artificial delay for UX (prevent flicker)
            // ToastManager.showToast("☁️ Conectando...", "info"); // Loader replaces toast

            const loadPromise = this.firebase.loadClinicData();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));

            // Minimum 800ms loader visibility
            const minTimePromise = new Promise(resolve => setTimeout(resolve, 800));

            const [cloudData] = await Promise.all([
                Promise.race([loadPromise, timeoutPromise]),
                minTimePromise
            ]);

            if (cloudData) {
                this.store.hydrate(cloudData);
                ToastManager.showToast("Datos sincronizados", "success");
            } else {

                // Don't auto-migrate if we are just starting fresh locally
            }
        } catch (err) {
            console.error("Cloud Sync Error:", err);
            ToastManager.showToast("Modo Offline / Error Sync", "error");
        } finally {
            if (loader) {
                loader.classList.add('opacity-0');
                setTimeout(() => loader.classList.add('hidden'), 500);
            }
        }
    }

    onStoreUpdate(newState) {
        if (this.firebase && this.firebase.user) {
            if (this.saveTimeout) clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => {
                this.firebase.saveClinicData(newState)
                    .catch(() => { /* silent auto-save failure */ });
            }, 2000);
        }
    }

    async init() {
        // Wait for store lock check
        if (this.store.db.locked) {
            this.showVaultScreen();
            const loader = document.getElementById('global-loader');
            if (loader) loader.classList.add('hidden');
            return;
        }

        // Check Auth
        if (!this.authService.isAuthenticated) {
            this.showUserSelectScreen();
            const loader = document.getElementById('global-loader');
            if (loader) loader.classList.add('hidden');
            return;
        }

        await this.postAuthInit();
    }

    showUserSelectScreen() {
        const screen = document.getElementById('user-select-screen');
        const listDiv = document.getElementById('user-select-list');
        const listView = document.getElementById('user-select-list-view');
        const pinView = document.getElementById('user-select-pin-view');
        const backBtn = document.getElementById('btn-back-to-users');
        const pinForm = document.getElementById('user-pin-form');
        const pinInput = document.getElementById('user-login-pin');
        const errorMsg = document.getElementById('login-error-msg');

        if (!screen || !listDiv) return;

        screen.classList.remove('hidden');
        screen.classList.add('flex');

        // Reset Views
        listView.classList.remove('hidden');
        pinView.classList.add('hidden');
        pinInput.value = '';
        errorMsg.style.opacity = '0';

        // Render Users
        const users = this.store.state.professionals.filter(p => p.isActive);
        listDiv.innerHTML = '';

        if (users.length === 0) {
            // Failsafe: Create default admin if no users (shouldn't happen with seed)
            listDiv.innerHTML = '<p class="text-center text-red-500 font-bold">Error: No hay usuarios activos.</p>';
        }

        let selectedUser = null;

        users.forEach(u => {
            const btn = document.createElement('button');
            btn.className = "flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 shadow-sm hover:shadow-md transition-all group w-full text-left";
            btn.innerHTML = `
                <div class="size-12 rounded-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-lg font-bold text-slate-700 dark:text-gray-300 shadow-sm group-hover:scale-110 transition-transform">
                    ${u.name.charAt(0)}
                </div>
                <div>
                     <p class="font-bold text-slate-800 dark:text-white">${u.name}</p>
                     <p class="text-xs text-slate-400 font-medium uppercase tracking-wide">${u.role}</p>
                </div>
                <span class="material-symbols-outlined ml-auto text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
            `;
            btn.onclick = () => {
                selectedUser = u;
                // Switch to PIN
                listView.classList.add('hidden');
                pinView.classList.remove('hidden');

                document.getElementById('pin-user-name').innerText = u.name;
                document.getElementById('pin-user-role').innerText = u.role.toUpperCase();
                document.getElementById('pin-user-avatar').innerText = u.name.charAt(0);

                pinInput.value = '';
                pinInput.focus();
                errorMsg.style.opacity = '0';
            };
            listDiv.appendChild(btn);
        });

        // Back Button
        backBtn.onclick = () => {
            listView.classList.remove('hidden');
            pinView.classList.add('hidden');
            selectedUser = null;
        };

        // Pin Form
        pinForm.onsubmit = async (e) => {
            e.preventDefault();

            if (!selectedUser) return;

            try {
                errorMsg.style.opacity = '0';
                const result = this.authService.login(pinInput.value, selectedUser.id);

                if (result.success) {
                    screen.classList.add('hidden');
                    screen.classList.remove('flex');
                    ToastManager.showToast(`Bienvenida/o, ${selectedUser.name}`, 'success');
                    await this.postAuthInit();
                } else {
                    // HC-04: Mensaje dinámico — si está bloqueada, informar del tiempo restante
                    const msg = result.message || 'PIN incorrecto. Verifica y vuelve a intentarlo.';
                    errorMsg.innerText = msg;
                    errorMsg.style.opacity = '1';
                    pinInput.value = '';
                    pinInput.focus();
                    pinInput.classList.add('animate-shake');
                    setTimeout(() => pinInput.classList.remove('animate-shake'), 500);
                }
            } catch (err) {
                console.error("Login Error:", err);
                alert("Error al iniciar sesión: " + err.message);
            }
        };
    }

    showVaultScreen() {
        const screen = document.getElementById('vault-lock-screen');
        const form = document.getElementById('vault-unlock-form');
        const input = document.getElementById('vault-pass-input');
        const errorMsg = document.getElementById('vault-error-msg');

        if (screen) {
            screen.classList.remove('hidden');
            screen.classList.add('flex');
        }

        if (form) {
            // Bind existing Hard Reset Button
            const resetBtn = document.getElementById('btn-hard-reset-vault');
            if (resetBtn) {
                resetBtn.onclick = () => window.app.hardResetVault();
            }

            form.onsubmit = (e) => {
                e.preventDefault();
                const password = input.value;

                if (this.store.db.attemptUnlock(password)) {
                    screen.classList.add('hidden');
                    screen.classList.remove('flex');
                    this.postAuthInit();
                } else {
                    errorMsg.classList.remove('hidden');
                    input.classList.add('border-red-500', 'bg-red-50');
                    input.value = '';
                    input.focus();
                }
            };

            // Bind Hard Reset Function globally
            window.app.hardResetVault = () => {
                if (confirm("¿Estás SEGURO? Perderás TODOS los datos de la clínica para siempre. No hay vuelta atrás.")) {
                    if (confirm("ÚLTIMA ADVERTENCIA: Se borrará todo.")) {
                        localStorage.removeItem('clinicState');
                        localStorage.removeItem('encryption_enabled');
                        location.reload();
                    }
                }
            };
        }
    }

    async postAuthInit() {
        // Service Layer — must be initialized BEFORE managers that depend on it
        this.clinicService = new ClinicService(this.store);

        // Initialize Managers
        this.appointmentManager = new AppointmentManager(this, this.store, this.clinicService);
        this.securityManager = new SecurityManager(this, this.store); // Init first for logging
        this.patientManager = new PatientManager(this, this.store, this.clinicService);
        this.professionalManager = new ProfessionalManager(this, this.store, this.clinicService);
        this.roomManager = new RoomManager(this, this.store, this.clinicService);
        this.calendarManager = new CalendarManager(this, this.store, Scheduler);
        this.sidebarManager = new SidebarManager(this, this.store);
        this.serviceManager = new ServiceManager(this, this.store, this.clinicService);
        this.alertsManager = new AlertsManager(this, this.store);
        this.settingsManager = new SettingsManager(this, this.store);
        this.communicationService = new CommunicationService(this.store);

        this.store.subscribe((state) => {
            this.render(state);
        });
        this.store.subscribe((state) => {
            this.onStoreUpdate(state);
        });

        // Safe Bind Events
        if (this.patientManager) this.patientManager.bindEvents();
        if (this.appointmentManager) this.appointmentManager.bindEvents();
        if (this.professionalManager) this.professionalManager.bindEvents();
        if (this.roomManager) this.roomManager.bindEvents();
        if (this.sidebarManager) this.sidebarManager.bindEvents();
        if (this.serviceManager) this.serviceManager.bindEvents();

        this.router.init();
        this.bindGlobalLocalEvents();

        this.render(this.store.state);
        this.router.updateBranding(this.store.state.config);

        // HC-02: Sincronizar banner de cifrado en el primer render
        if (this.settingsManager) this.settingsManager.updateEncryptionUI();

        // Hide Loader
        setTimeout(() => {
            const loader = document.getElementById('global-loader');
            if (loader) loader.classList.add('hidden');
        }, 800);
    }

    calculateInitialWeekStart() {
        const saved = localStorage.getItem('clinicCurrentDate');
        let d = saved ? new Date(saved) : new Date();
        const day = d.getDay() || 7;
        if (day !== 1) d.setDate(d.getDate() - day + 1);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    changeViewMode(mode) {
        if (this.router) {
            this.router.setViewMode(mode);
            // Update UI selector if it exists
            const select = document.getElementById('view-mode-select');
            if (select) select.value = mode;
        }
    }

    bindGlobalLocalEvents() {
        // App-specific events NOT handled by Router/ModalService

        // Alerts Nav
        const alertsBtn = document.getElementById('nav-alerts');
        if (alertsBtn) {
            alertsBtn.onclick = (e) => {
                e.preventDefault();
                this.alertsManager.openAlertsModal();
            };
        }

        // Filters
        const profSelect = document.getElementById('professional-select');
        if (profSelect) {
            profSelect.onchange = (e) => {
                this.currentProfessionalId = parseInt(e.target.value);
                localStorage.setItem('clinicProfId', this.currentProfessionalId);
                this.render(this.store.state);
            };
        }

        // Optimization Btn
        const optimizeBtn = document.getElementById('btn-optimize-schedule');
        if (optimizeBtn) optimizeBtn.onclick = () => this.optimizeSchedule();


        const btnReset = document.getElementById('btn-hard-reset-vault');
        if (btnReset) btnReset.onclick = () => this.hardResetVault();

        const btnMock = document.getElementById('btn-generate-mock-data');
        if (btnMock) btnMock.onclick = () => this.MockDataManager.generateMockData(this.store, this);

        const btnToggle = document.getElementById('btn-toggle-encryption');
        if (btnToggle) btnToggle.onclick = () => this.settingsManager.toggleEncryption();

        const btnImportTrigger = document.getElementById('btn-trigger-import');
        if (btnImportTrigger) btnImportTrigger.onclick = () => document.getElementById('import-data-file').click();

        const btnUploadLogo = document.getElementById('btn-upload-logo');
        if (btnUploadLogo) btnUploadLogo.onclick = () => document.getElementById('setting-logo-upload').click();

        const btnCloseAlerts = document.getElementById('btn-close-alerts');
        if (btnCloseAlerts) btnCloseAlerts.onclick = () => this.alertsManager.closeAlertsModal();

        // this.bindAppointmentFormEvents(); // Moved to AppointmentManager
        this.bindDictationEvents();
    }

    bindDictationEvents() {
        const btn = document.getElementById('btn-dictate-notes');
        const textarea = document.getElementById('appt-notes');

        if (btn && textarea) {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (this.dictationService.isListening) {
                    this.dictationService.stop();
                    btn.classList.remove('text-red-500', 'animate-pulse');
                    btn.querySelector('span').innerText = 'mic';
                } else {
                    btn.classList.add('text-red-500', 'animate-pulse');
                    btn.querySelector('span').innerText = 'mic_off';

                    this.dictationService.start(
                        (final, interim) => {
                            if (final) {
                                const currentText = textarea.value;
                                const separator = currentText.length > 0 && !currentText.endsWith(' ') ? ' ' : '';
                                textarea.value = currentText + separator + final;
                            }
                        },
                        () => {
                            btn.classList.remove('text-red-500', 'animate-pulse');
                            btn.querySelector('span').innerText = 'mic';
                        }
                    );
                }
            };
        }
    }

    render(state) {
        if (!state) return;

        this.router.updateBranding(state.config);
        this.sidebarManager.renderSidebar();
        this.renderProfessionalFilters(state); // Update filters based on role

        // Current View Logic
        const activeView = document.querySelector('.view-section:not(.view-hidden)');
        if (activeView) {
            const viewId = activeView.id;
            if (viewId === 'calendar-view') {
                this.router.updateCalendarHeader(this.currentWeekStart); // Use Router logic
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

        if (this.alertsManager) this.alertsManager.checkAlerts();
    }

    renderProfessionalFilters(state) {
        if (!state) state = this.store.state; // Safety

        // Used by Filters
        const select = document.getElementById('professional-select');
        if (!select) return;

        const profs = state.professionals || [];
        const currentUser = this.authService.currentUser;



        select.innerHTML = '';
        select.disabled = false;

        // Restriction Logic
        // Normalize role check
        const role = currentUser ? (currentUser.role || '').toLowerCase() : '';


        if (role === 'professional') {
            // Only show self
            const me = profs.find(p => p.id === currentUser.id);
            if (me) {
                const opt = document.createElement('option');
                opt.value = me.id;
                opt.textContent = me.name;
                select.appendChild(opt);
            }
            select.value = currentUser.id;
            select.disabled = true;
            this.currentProfessionalId = currentUser.id;
        } else {
            // Admin/Secretariat/None: Show All
            const allOpt = document.createElement('option');
            allOpt.value = "0";
            allOpt.textContent = "Todos los Profesionales";
            select.appendChild(allOpt);

            profs.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                select.appendChild(opt);
            });

            if (this.currentProfessionalId) select.value = this.currentProfessionalId;
        }
    }

    populateModalProfessionalSelect() {
        if (this.appointmentManager) this.appointmentManager.populateModalProfessionalSelect();
    }

    // --- FORM EVENTS ---

    bindAppointmentFormEvents() {
        // Handled by AppointmentManager
    }

    openAppointmentModal(appt, defaults = null) {
        if (this.appointmentManager) this.appointmentManager.openAppointmentModal(appt, defaults);
    }

    openAppointmentDetails(appt) {
        if (this.appointmentManager) this.appointmentManager.openAppointmentDetails(appt);
    }

    bindLogoutEvent() {
        const btnPrivacy = document.getElementById('btn-privacy-toggle');
        if (btnPrivacy) {
            btnPrivacy.onclick = () => {
                const isActive = this.securityManager.togglePrivacyMode();
                const icon = btnPrivacy.querySelector('span:first-child');
                const dot = document.getElementById('privacy-dot');

                if (isActive) {
                    icon.textContent = 'visibility_off';
                    icon.classList.add('text-emerald-400');
                    if (dot) dot.classList.remove('hidden');
                    ToastManager.showToast('Modo Privacidad Activado', 'success');
                } else {
                    icon.textContent = 'visibility';
                    icon.classList.remove('text-emerald-400');
                    if (dot) dot.classList.add('hidden');
                    ToastManager.showToast('Modo Privacidad Desactivado', 'info');
                }
            };
        }

        const btnLogout = document.getElementById('logout-btn');
        if (btnLogout) {
            btnLogout.addEventListener('click', async () => {
                if (await this.showConfirm('Cerrar Sesión', '¿Estás seguro de que quieres salir?', 'warning')) {
                    localStorage.removeItem('mock_session');
                    localStorage.removeItem('user_email');
                    if (this.firebase) {
                        await this.firebase.logout();
                    } else {
                        window.location.href = 'login.html';
                    }
                }
            });
        }
    }

    // --- OPTIMIZATION & SCHEDULING LOGIC (Retained in App for now) ---

    getSuggestions(targetDay, startMins) {
        const waitingListState = this.store.waitingList || [];
        const patientsState = this.store.state.patients || [];

        const check = (patient) => {
            if (!patient.availability) return false;
            return patient.availability.some(s => {
                if (s.day !== targetDay) return false;
                const [sH, sM] = s.start.split(':').map(Number);
                const [eH, eM] = s.end.split(':').map(Number);
                const sTime = sH * 60 + sM;
                const eTime = eH * 60 + eM;
                return startMins >= sTime && startMins < eTime;
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
        const modal = document.getElementById('optimization-modal');
        const list = document.getElementById('opt-suggestions-list');
        const info = document.getElementById('opt-slot-info');
        const searchInput = document.getElementById('opt-search-input');
        const tabWaiting = document.getElementById('opt-tab-waiting');
        const tabActive = document.getElementById('opt-tab-active');

        if (!modal || !list) return;

        const dayName = slot.date?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) || "Fecha desconocida";
        if (info) info.innerText = `${dayName} - ${slot.start}`;

        // Tabs Logic
        let currentSuggestions = allSuggestions;

        const renderList = () => {
            list.innerHTML = '';
            if (currentSuggestions.length === 0) {
                const empty = document.getElementById('opt-no-results');
                if (empty) empty.classList.remove('hidden');
                return;
            } else {
                const empty = document.getElementById('opt-no-results');
                if (empty) empty.classList.add('hidden');
            }

            currentSuggestions.forEach(p => {
                const div = document.createElement('div');
                div.className = "flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all cursor-pointer group";
                div.innerHTML = `
                     <div class="flex items-center gap-3">
                        <div class="size-8 rounded-full ${p.isWaiting ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'} flex items-center justify-center font-bold text-xs">
                            ${p.name.charAt(0)}
                        </div>
                        <div>
                            <p class="font-bold text-sm text-slate-700 dark:text-gray-200">${escapeHtml(p.name)}</p>
                            <p class="text-[10px] text-slate-400">${p.isWaiting ? 'En lista de espera' : 'Paciente activo'}</p>
                        </div>
                     </div>
                     <button class="size-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors">
                        <span class="material-symbols-outlined text-sm">add</span>
                     </button>
                 `;
                div.onclick = () => {
                    modal.classList.add('hidden');
                    this.startBookingFlow(p, slot);
                };
                list.appendChild(div);
            });
        };

        const updateTabs = (tab) => {
            if (tab === 'waiting') {
                currentSuggestions = allSuggestions.filter(p => p.isWaiting);
            } else {
                currentSuggestions = allSuggestions.filter(p => !p.isWaiting);
            }
            const activeClass = "flex-1 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-gray-700 text-purple-600 shadow-sm transition-all text-center";
            const inactiveClass = "flex-1 py-1.5 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all text-center";

            if (tabWaiting) tabWaiting.className = tab === 'waiting' ? activeClass : inactiveClass;
            if (tabActive) tabActive.className = tab === 'active' ? activeClass : inactiveClass;
            renderList();
        };

        if (tabWaiting) tabWaiting.onclick = () => updateTabs('waiting');
        if (tabActive) tabActive.onclick = () => updateTabs('active');

        updateTabs('waiting');
        modal.classList.remove('hidden');
    }

    async startBookingFlow(patient, slot) {
        const professionalId = slot.professionalId || (this.currentProfessionalId && this.currentProfessionalId !== 0 ? this.currentProfessionalId : (this.store.state.professionals[0]?.id || 1));

        if (patient.isWaiting) {
            this.openBookingOptions(patient, slot, professionalId);
        } else {
            const newAppt = {
                id: generateId(),
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
            await this.store.addAppointment(newAppt);

            if (!patient.extraSessions) patient.extraSessions = [];
            patient.extraSessions.push({ date: new Date().toISOString(), reason: 'Sesión Extra' });
            await this.store.updatePatient(patient.id, { extraSessions: patient.extraSessions });

            ToastManager.showToast(`Sesión extra agendada para ${patient.name}`, 'success');
        }
    }

    openBookingOptions(patient, slot, professionalId) {
        const modal = document.getElementById('booking-options-modal');
        const content = document.getElementById('booking-options-content');
        if (!modal || !content) return;
        content.innerHTML = '';

        const btnSporadic = this.createOptionButton('confirmation_number', 'Cita Esporádica', 'Una sola sesión puntual.', 'blue');
        btnSporadic.onclick = async () => {
            await this.createSingleAppointment(patient, slot, professionalId, 'Cita Esporádica (Waiting)');
            modal.classList.add('hidden');
            ToastManager.showToast('Cita esporádica creada', 'success');
        };

        const btnFixed = this.createOptionButton('event_repeat', 'Tratamiento Fijo', 'Pasar a activo con horario recurrente.', 'purple');
        btnFixed.onclick = () => {
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
        btnChronic.onclick = async () => {
            await this.createRecurringAppointment(patient, slot, professionalId, null);
            await this.store.updatePatient(patient.id, { status: 'active' });
            document.getElementById('booking-options-modal').classList.add('hidden');
            ToastManager.showToast('Tratamiento crónico iniciado', 'success');
        };
        const btnTemporal = this.createOptionButton('date_range', 'Temporal', 'Número fijo de sesiones.', 'amber');
        btnTemporal.onclick = () => {
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
        document.getElementById('btn-confirm-temporal').onclick = async () => {
            const n = parseInt(document.getElementById('temporal-sessions-input').value) || 1;
            await this.createMultipleAppointments(patient, slot, professionalId, n);
            await this.store.updatePatient(patient.id, { status: 'active', totalSessions: n });
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

    async createSingleAppointment(patient, slot, professionalId, note) {
        const appt = {
            id: generateId(),
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
        await this.store.addAppointment(appt);
    }

    async createRecurringAppointment(patient, slot, professionalId, duration) {
        const appt = {
            id: generateId(),
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
        await this.store.addAppointment(appt);
    }

    async createMultipleAppointments(patient, slot, professionalId, count) {
        let currentStart = new Date(slot.start);
        let currentEnd = new Date(slot.end);

        for (let i = 0; i < count; i++) {
            const appt = {
                id: generateId(),
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
            await this.store.addAppointment(appt);
            currentStart.setDate(currentStart.getDate() + 7);
            currentEnd.setDate(currentEnd.getDate() + 7);
        }
    }

    optimizeSchedule() {
        // Open Modal
        const modal = document.getElementById('optimization-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.bindOptimizerEvents();
        }
    }

    bindOptimizerEvents() {
        // Params Visibility Logic
        const zenParams = document.getElementById('opt-params-zen');
        const elasticParams = document.getElementById('opt-params-elastic');
        const radios = document.querySelectorAll('input[name="opt-strategy"]');
        const descEl = document.getElementById('opt-strategy-desc');

        const descriptions = {
            tetris: "<strong>Tetris:</strong> Maximiza la eficiencia rellenando los huecos adyacentes a otras citas. Ideal para evitar tiempos muertos.",
            zen: "<strong>Zen:</strong> Prioriza tu bienestar añadiendo un tiempo de descanso obligatorio entre cada paciente.",
            tunnel: "<strong>Túnel:</strong> Solo ofrece huecos que estarán libres durante los próximos 4 semanas. Ideal para tratamientos recurrentes.",
            elastic: "<strong>Elástica:</strong> Si no encuentra hueco, intenta reducir ligeramente la duración de la cita (ej. 60m → 50m) para encajarla."
        };

        // Init default description
        if (descEl) descEl.innerHTML = descriptions['tetris'];

        radios.forEach(r => {
            r.onchange = () => {
                if (r.value === 'zen') zenParams.classList.remove('hidden'); else zenParams.classList.add('hidden');
                if (r.value === 'elastic') elasticParams.classList.remove('hidden'); else elasticParams.classList.add('hidden');

                if (descEl && descriptions[r.value]) {
                    descEl.innerHTML = descriptions[r.value];
                }
            };
        });

        // Range Value Updates
        document.getElementById('opt-buffer').oninput = (e) => document.getElementById('opt-buffer-val').innerText = `${e.target.value} min`;

        document.getElementById('opt-elasticity').oninput = (e) => {
            const val = e.target.value;
            document.getElementById('opt-elasticity-val').innerText = `${val}%`;

            // Calculate example (base 60m)
            const reduced = Math.round(60 * (1 - (val / 100)));
            const exampleEl = document.getElementById('opt-elastic-example');
            if (exampleEl) {
                exampleEl.innerHTML = `Ejemplo: Una cita de 60 min podría reducirse a <span class="font-bold text-amber-600">${reduced} min</span>.`;
            }
        };

        // Execution
        const btnRun = document.getElementById('btn-run-optimizer');
        // Prevent multiple bindings
        btnRun.onclick = () => {
            const strategy = document.querySelector('input[name="opt-strategy"]:checked').value;
            const bufferMins = parseInt(document.getElementById('opt-buffer').value);
            const elasticity = parseInt(document.getElementById('opt-elasticity').value);

            ToastManager.showToast(`Ejecutando algoritmo ${strategy.toUpperCase()}...`, "info");

            // Similate processing delay for UX
            setTimeout(() => {
                const count = Scheduler.optimize(this.store, { strategy, bufferMins, elasticity });
                document.getElementById('optimization-modal').classList.add('hidden');
                if (count > 0) {
                    ToastManager.showToast(`¡Éxito! Se han agendado ${count} citas.`, "success");
                    this.render(this.store.state);
                } else {
                    ToastManager.showToast("No se encontraron huecos disponibles con esta estrategia.", "warning");
                }
            }, 800);
        };
    }
}

// Initialize App
window.app = new App();
