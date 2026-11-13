
import { MockDataManager } from './MockDataManager.js';
import { ToastManager } from './ToastManager.js';
import { SignaturePad } from './SignaturePad.js';
import { escapeHtml, generateId } from './DateUtils.js';

export class PatientManager {
    constructor(app, store) {
        this.app = app; // Reference to main App for shared state/methods if needed
        this.store = store;
        this.editingPatientId = null;
        this.currentProfilePatientId = null;
        this.currentImportFile = null;
        this.injectModal();
    }

    injectModal() {
        if (document.getElementById('patient-modal')) return;

        const modalHtml = `
    <!-- Patient Modal (Centered Popup) -->
    <div id="patient-modal" class="fixed inset-0 z-50 hidden flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            id="btn-close-patient-modal-backdrop"></div>

        <!-- Centered Panel -->
        <div
            class="relative w-full max-w-7xl bg-white dark:bg-surface-dark rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">


            <!-- Header -->
            <div
                class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-surface-dark z-10 shrink-0">
                <h2 id="patient-modal-title" class="text-xl font-bold text-slate-900 dark:text-white">Nuevo
                    Paciente</h2>
                <button id="btn-close-patient-modal-x"
                    class="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>

            <!-- Main Content (Form) -->
            <div class="flex-1 overflow-hidden">
                <form id="patient-form" class="h-full flex flex-col divide-y divide-gray-100 dark:divide-gray-700">
                    <!-- Content Columns Wrapper -->
                    <div
                        class="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-700 overflow-hidden">

                        <!-- Left Column: Personal & Contact Info -->
                        <div class="w-full md:w-1/3 overflow-y-auto p-5 bg-gray-50 dark:bg-[#131118]">
                            <div class="space-y-6">
                                <!-- Personal Data -->
                                <div>
                                    <h3
                                        class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <span class="material-symbols-outlined text-base">person</span> Datos
                                        Personales
                                    </h3>
                                    <div class="space-y-4">
                                        <div>
                                            <label
                                                class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre
                                                Completo</label>
                                            <input type="text" name="name" id="patient-name" required
                                                class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm text-sm">
                                        </div>
                                        <div class="grid grid-cols-3 gap-3">
                                            <div class="col-span-1">
                                                <label
                                                    class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Edad</label>
                                                <input type="number" name="age" id="patient-age"
                                                    class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm text-sm">
                                            </div>
                                            <div class="col-span-2">
                                                <label
                                                    class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha
                                                    Nac.</label>
                                                <input type="date" name="birthDate" id="patient-birthdate"
                                                    class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm text-sm">
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Tutor -->
                                <div>
                                    <h3
                                        class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <span class="material-symbols-outlined text-base">family_restroom</span>
                                        Tutor Legal
                                    </h3>
                                    <div class="grid grid-cols-3 gap-3">
                                        <div class="col-span-2">
                                            <label
                                                class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre</label>
                                            <input type="text" name="tutorName" id="patient-tutor"
                                                class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm text-sm">
                                        </div>
                                        <div class="col-span-1">
                                            <label
                                                class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Relación</label>
                                            <select name="tutorRole" id="patient-relation"
                                                class="w-full px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm text-sm">
                                                <option value="madre">Madre</option>
                                                <option value="padre">Padre</option>
                                                <option value="otro">Otro</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <!-- Contact -->
                                <div>
                                    <h3
                                        class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <span class="material-symbols-outlined text-base">contact_phone</span>
                                        Contacto
                                    </h3>
                                    <div class="grid grid-cols-1 gap-3">
                                        <div class="relative">
                                            <span
                                                class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">call</span>
                                            <input type="tel" name="phone" id="patient-phone" placeholder="Teléfono"
                                                class="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm text-sm">
                                        </div>
                                        <div class="relative">
                                            <span
                                                class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">mail</span>
                                            <input type="email" name="email" id="patient-email" placeholder="Email"
                                                class="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm text-sm">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Right Column: Clinical & Availability -->
                        <div class="w-full md:w-2/3 flex flex-col h-full bg-white dark:bg-surface-dark">
                            <div class="flex-1 overflow-y-auto p-6">
                                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <!-- Treatment Info -->
                                    <div class="space-y-6">
                                        <h3
                                            class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                                            <span class="material-symbols-outlined text-base">medical_services</span>
                                            Tratamiento
                                        </h3>

                                        <div class="grid grid-cols-2 gap-4">
                                            <div class="col-span-2">
                                                <label
                                                    class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Servicio</label>
                                                <select name="service" id="patient-service-select"
                                                    class="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-primary outline-none transition-all text-sm">
                                                    <!-- Injected by JS -->
                                                </select>
                                            </div>
                                            <div class="col-span-2">
                                                <label
                                                    class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Plan</label>
                                                <select name="treatmentPlan" id="patient-plan-select"
                                                    class="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-primary outline-none transition-all text-sm">
                                                    <option value="1x45">1 sesión/sem (45 min)</option>
                                                </select>
                                            </div>
                                            <div class="col-span-2">
                                                <label
                                                    class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo</label>
                                                <div class="flex gap-4 text-sm mt-2">
                                                    <label class="flex items-center gap-2 cursor-pointer group">
                                                        <input type="radio" name="treatmentType" value="chronic" checked
                                                            class="w-4 h-4 text-primary focus:ring-primary border-gray-300">
                                                        <span
                                                            class="text-slate-700 dark:text-gray-300 group-hover:text-primary transition-colors">Crónico</span>
                                                    </label>
                                                    <label class="flex items-center gap-2 cursor-pointer group">
                                                        <input type="radio" name="treatmentType" value="temporary"
                                                            class="w-4 h-4 text-primary focus:ring-primary border-gray-300">
                                                        <span
                                                            class="text-slate-700 dark:text-gray-300 group-hover:text-primary transition-colors">Temporal</span>
                                                    </label>
                                                </div>
                                            </div>
                                            <div id="sessions-input-container" class="hidden col-span-2">
                                                <label
                                                    class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sesiones</label>
                                                <input type="number" name="totalSessions" id="patient-sessions"
                                                    value="10"
                                                    class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm">
                                            </div>
                                        </div>

                                        <div class="mt-4">
                                            <label
                                                class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Notas</label>
                                            <textarea name="notes" id="patient-notes" rows="3"
                                                class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-primary outline-none transition-all resize-none text-sm"
                                                placeholder="Notas iniciales, diagnóstico previo..."></textarea>
                                        </div>
                                    </div>

                                    <!-- Availability -->
                                    <div class="space-y-6">
                                        <h3
                                            class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                                            <span class="material-symbols-outlined text-base">event_available</span>
                                            Disponibilidad
                                        </h3>

                                        <div
                                            class="space-y-3 bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                                            <!-- Loop for Days 0-4 (Mon-Fri) -->
                                            <!-- Monday (0) -->
                                            <div>
                                                <div class="flex items-center gap-2 mb-1">
                                                    <input type="checkbox" name="days" value="0" id="day-0"
                                                        class="w-4 h-4 rounded text-primary border-gray-300 focus:ring-primary">
                                                    <label for="day-0"
                                                        class="text-xs font-bold text-slate-700 dark:text-gray-300 w-20">Lunes</label>
                                                    <div id="slots-container-0" class="flex-1 flex flex-col gap-2">
                                                    </div>
                                                </div>
                                            </div>
                                            <!-- Tuesday (1) -->
                                            <div>
                                                <div class="flex items-center gap-2 mb-1">
                                                    <input type="checkbox" name="days" value="1" id="day-1"
                                                        class="w-4 h-4 rounded text-primary border-gray-300 focus:ring-primary">
                                                    <label for="day-1"
                                                        class="text-xs font-bold text-slate-700 dark:text-gray-300 w-20">Martes</label>
                                                    <div id="slots-container-1" class="flex-1 flex flex-col gap-2">
                                                    </div>
                                                </div>
                                            </div>
                                            <!-- Wednesday (2) -->
                                            <div>
                                                <div class="flex items-center gap-2 mb-1">
                                                    <input type="checkbox" name="days" value="2" id="day-2"
                                                        class="w-4 h-4 rounded text-primary border-gray-300 focus:ring-primary">
                                                    <label for="day-2"
                                                        class="text-xs font-bold text-slate-700 dark:text-gray-300 w-20">Miércoles</label>
                                                    <div id="slots-container-2" class="flex-1 flex flex-col gap-2">
                                                    </div>
                                                </div>
                                            </div>
                                            <!-- Thursday (3) -->
                                            <div>
                                                <div class="flex items-center gap-2 mb-1">
                                                    <input type="checkbox" name="days" value="3" id="day-3"
                                                        class="w-4 h-4 rounded text-primary border-gray-300 focus:ring-primary">
                                                    <label for="day-3"
                                                        class="text-xs font-bold text-slate-700 dark:text-gray-300 w-20">Jueves</label>
                                                    <div id="slots-container-3" class="flex-1 flex flex-col gap-2">
                                                    </div>
                                                </div>
                                            </div>
                                            <!-- Friday (4) -->
                                            <div>
                                                <div class="flex items-center gap-2 mb-1">
                                                    <input type="checkbox" name="days" value="4" id="day-4"
                                                        class="w-4 h-4 rounded text-primary border-gray-300 focus:ring-primary">
                                                    <label for="day-4"
                                                        class="text-xs font-bold text-slate-700 dark:text-gray-300 w-20">Viernes</label>
                                                    <div id="slots-container-4" class="flex-1 flex flex-col gap-2">
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer Actions -->
                    <!-- Footer Actions -->
                    <div
                        class="p-6 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-[#131118] flex items-center gap-3 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">

                        <button type="submit" id="btn-save-patient"
                            class="flex-1 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-2xl font-bold text-base shadow-lg shadow-primary/20 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2">
                            <span class="material-symbols-outlined" id="btn-save-patient-icon">save</span>
                            <span id="btn-save-patient-text">Guardar Paciente</span>
                        </button>

                        <button type="button" id="btn-delete-patient"
                            class="hidden bg-red-50 text-red-600 hover:bg-red-100 px-3 rounded-2xl font-bold transition-colors">
                            <span class="material-symbols-outlined text-lg">delete</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
        `;

        const profileModalHtml = `
    <!-- 6. PATIENT PROFILE MODAL -->
    <div id="patient-profile-modal"
        class="modal-overlay hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div
            class="bg-white dark:bg-[#1a1821] w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] animate-in zoom-in-95 duration-200">

            <!-- Left Sidebar (Profile Info) -->
            <div
                class="w-full md:w-80 bg-gray-50 dark:bg-gray-800/10 border-r border-gray-100 dark:border-gray-800 flex flex-col shrink-0 overflow-y-auto">
                <div class="p-6 text-center border-b border-gray-100 dark:border-gray-800">
                    <div id="profile-avatar"
                        class="size-20 bg-primary/10 text-primary text-2xl font-bold rounded-full flex items-center justify-center mx-auto mb-4">
                        --
                    </div>
                    <h2 id="profile-name" class="text-xl font-bold text-slate-800 dark:text-white">--</h2>
                    <p id="profile-age" class="text-sm text-slate-500 dark:text-gray-400 mt-1">-- años</p>
                </div>

                <div class="p-6 space-y-6 flex-1">
                    <!-- Contact -->
                    <div class="space-y-3">
                        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Contacto</h3>
                        <div class="flex items-start gap-3">
                            <span class="material-symbols-outlined text-slate-400 text-lg">call</span>
                            <div>
                                <p id="profile-phone" class="text-sm font-bold text-slate-700 dark:text-gray-300">--</p>
                            </div>
                        </div>
                        <div class="flex items-start gap-3">
                            <span class="material-symbols-outlined text-slate-400 text-lg">mail</span>
                            <p id="profile-email"
                                class="text-sm font-medium text-slate-700 dark:text-gray-300 break-all">--</p>
                        </div>
                    </div>

                    <!-- Tutor -->
                    <div class="space-y-3">
                        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Tutor Legal</h3>
                        <div class="flex items-start gap-3">
                            <span class="material-symbols-outlined text-slate-400 text-lg">family_restroom</span>
                            <p id="profile-tutor" class="text-sm font-medium text-slate-700 dark:text-gray-300">--</p>
                        </div>
                    </div>

                    <!-- Stats -->
                    <div class="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                        <div
                            class="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 text-center">
                            <h4 class="text-[10px] text-slate-400 uppercase font-bold mb-1">Citas</h4>
                            <p id="stat-total-appts" class="text-lg font-bold text-primary">0</p>
                        </div>
                        <div
                            class="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 text-center">
                            <h4 class="text-[10px] text-slate-400 uppercase font-bold mb-1">Asistencia</h4>
                            <p id="stat-attendance" class="text-lg font-bold text-green-500">--%</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Content -->
            <div class="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#1a1821]">
                <!-- Header / Tabs -->
                <div
                    class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
                    <div class="flex gap-6">
                        <button id="tab-history"
                            class="profile-tab-btn pb-4 -mb-4 border-b-2 border-primary text-primary font-bold text-sm transition-colors cursor-pointer">
                            Historial
                        </button>
                        <button id="tab-notes"
                            class="profile-tab-btn pb-4 -mb-4 border-b-2 border-transparent text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors cursor-pointer">
                            Notas Clínicas
                        </button>
                        <button id="tab-files"
                            class="profile-tab-btn pb-4 -mb-4 border-b-2 border-transparent text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors cursor-pointer">
                            Archivos
                        </button>
                        <button id="tab-consent"
                            class="profile-tab-btn pb-4 -mb-4 border-b-2 border-transparent text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors cursor-pointer">
                            Consentimiento
                        </button>
                    </div>
                    <button id="btn-close-patient-profile"
                        class="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>

                <!-- Content Body -->
                <div class="flex-1 overflow-y-auto p-6 bg-gray-50/30 dark:bg-gray-900/10">

                    <!-- Balance Alerts -->
                    <div id="profile-balance-container" class="hidden mb-6">
                        <div id="profile-balance-list" class="space-y-2"></div>
                    </div>

                    <!-- TAB: History -->
                    <div id="content-history" class="tab-content space-y-4">
                        <div id="profile-history-list" class="space-y-3"></div>
                    </div>

                    <!-- TAB: Notes -->
                    <div id="content-notes" class="tab-content hidden space-y-4">
                        <!-- Input -->
                        <div
                            class="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm mb-6">

                            <div class="flex justify-between items-center mb-2">
                                <label class="text-xs font-bold text-slate-400 uppercase">Nueva Nota</label>
                                <select id="note-template-select"
                                    onchange="window.app.patientManager.handleTemplateSelect(this.value)"
                                    class="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-gray-50 dark:bg-gray-900 text-slate-600 dark:text-gray-300 focus:ring-1 focus:ring-primary outline-none">
                                    <option value="">Cargar Plantilla...</option>
                                </select>
                            </div>

                            <textarea id="new-note-input" rows="4"
                                placeholder="Escribe aquí los detalles de la sesión..."
                                class="w-full bg-transparent border-none focus:ring-0 text-sm resize-none placeholder-slate-400 text-slate-700 dark:text-gray-200"></textarea>
                            <div class="flex justify-end mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                                <button id="btn-add-patient-note"
                                    class="bg-primary hover:bg-primary-dark text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm shadow-primary/20">
                                    Añadir Nota
                                </button>
                            </div>
                        </div>
                        <div id="profile-notes-list" class="space-y-4"></div>
                    </div>

                    <!-- TAB: Files -->
                    <div id="content-files" class="tab-content hidden">
                        <div id="profile-files-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>
                    </div>

                    <!-- TAB: Consent -->
                    <div id="content-consent" class="tab-content hidden h-full flex flex-col">
                        <!-- State: Not Signed -->
                        <div id="consent-unsigned-view" class="flex flex-col h-full">
                            <div
                                class="mb-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-3 rounded-xl flex items-start gap-3">
                                <span class="material-symbols-outlined text-amber-500">info</span>
                                <p class="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                                    Para cumplir con el <strong>RGPD</strong>, el paciente o tutor debe firmar este
                                    consentimiento autorizando el tratamiento de sus datos clínicos.
                                </p>
                            </div>

                            <div
                                class="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 rounded-xl mb-4 text-xs text-slate-600 dark:text-gray-400 leading-relaxed text-justify">
                                <p class="font-bold mb-2 uppercase">Consentimiento Informado</p>
                                <p class="mb-2">Por la presente autorizo a <strong>LogoPedia Clínica</strong> al
                                    tratamiento de mis datos personales y de salud con la finalidad de gestionar mi
                                    historial clínico y realizar el seguimiento de mi tratamiento logopédico.</p>
                                <p class="mb-2">Entiendo que mis datos serán tratados con confidencialidad y podré
                                    ejercer mis derechos de acceso, rectificación, cancelación y oposición.</p>
                                <p>Acepto recibir comunicaciones relacionadas con mis citas y tratamiento por vías
                                    electrónicas.</p>
                            </div>

                            <div
                                class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 relative">
                                <canvas id="signature-canvas" class="w-full h-[200px] cursor-crosshair"></canvas>
                                <div class="absolute bottom-2 right-2 flex gap-2">
                                    <button id="btn-clear-signature"
                                        class="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-slate-500">Borrar</button>
                                </div>
                                <span
                                    class="absolute top-2 left-3 text-[10px] text-slate-400 font-bold uppercase pointer-events-none select-none">Firma
                                    Aquí</span>
                            </div>

                            <div class="mt-4 flex justify-end">
                                <button id="btn-save-consent"
                                    class="bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
                                    <span class="material-symbols-outlined">ink_pen</span>
                                    Firmar y Guardar
                                </button>
                            </div>
                        </div>

                        <!-- State: Signed -->
                        <div id="consent-signed-view"
                            class="hidden flex flex-col items-center justify-center h-full text-center p-6">
                            <div
                                class="size-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center text-green-500 mb-4">
                                <span class="material-symbols-outlined text-3xl">verified</span>
                            </div>
                            <h3 class="text-lg font-bold text-slate-800 dark:text-white mb-2">Consentimiento Firmado
                            </h3>
                            <p class="text-sm text-slate-500 dark:text-gray-400 mb-6">El paciente autorizó el
                                tratamiento de datos.</p>

                            <div
                                class="bg-white dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-2">
                                <img id="consent-signature-image" class="h-24 object-contain dark:invert" alt="Firma">
                            </div>
                            <p id="consent-date-label" class="text-xs text-slate-400 font-mono">Firmado el: --</p>

                            <button id="btn-revoke-consent"
                                class="mt-8 text-red-500 hover:text-red-600 text-xs font-bold underline">
                                Revocar y Borrar Firma
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

        document.body.insertAdjacentHTML('beforeend', modalHtml + profileModalHtml);

    }

    render() {
        this.renderPatientView();
    }

    toggleTreatmentType() {
        const chronicRadio = document.querySelector('input[name="treatmentType"][value="chronic"]');
        const sessionInput = document.getElementById('sessions-input-container');
        if (chronicRadio && sessionInput) {
            // Logic: if Chronic is checked, HIDE sessions. If Temporal (not chronic) is checked/chronic unchecked, SHOW sessions.
            if (chronicRadio.checked) {
                sessionInput.classList.add('hidden');
            } else {
                sessionInput.classList.remove('hidden');
            }
        }
    }

    bindEvents() {
        const patientForm = document.getElementById('patient-form');
        if (patientForm) {
            patientForm.addEventListener('submit', (e) => this.handlePatientFormSubmit(e));

            // Availability Editor Delegation
            patientForm.addEventListener('click', (e) => {
                const addBtn = e.target.closest('.action-add-slot');
                const removeBtn = e.target.closest('.action-remove-slot');

                if (addBtn && addBtn.dataset.day) {
                    this.addSlot(addBtn.dataset.day);
                } else if (removeBtn) {
                    const row = removeBtn.closest('.input-slot-row');
                    if (row) row.remove();
                }
            });

            patientForm.addEventListener('change', (e) => {
                if (e.target.name === 'days' && e.target.type === 'checkbox') {
                    this.toggleDay(e.target);
                }
            });
        }

        // Import binding
        const importInput = document.getElementById('import-file-input');
        if (importInput) {
            importInput.onchange = (e) => {
                if (e.target.files.length > 0) this.handleImportFileSelect(e.target.files[0]);
            }
        }

        // Filter Binding (New)
        const searchInput = document.getElementById('patient-search-input');
        const statusFilter = document.getElementById('filter-status');
        // const availFilter = document.getElementById('filter-availability'); // Removed/Legacy? Keeping logic generic
        const serviceFilter = document.getElementById('filter-service');
        const dayFilter = document.getElementById('filter-avail-day');
        const hourFilter = document.getElementById('filter-avail-hour');

        const triggerRender = () => {
            const text = searchInput ? searchInput.value : '';
            this.renderPatientView(text);
        };

        if (searchInput) searchInput.addEventListener('input', triggerRender);
        if (statusFilter) statusFilter.addEventListener('change', triggerRender);
        if (serviceFilter) serviceFilter.addEventListener('change', triggerRender);
        // New Mobile Filters
        if (dayFilter) dayFilter.addEventListener('change', triggerRender);
        if (hourFilter) hourFilter.addEventListener('change', triggerRender);

        // Initial population
        this.populateServiceFilter();

        // Treatment Type Logic Binding
        const radios = document.querySelectorAll('input[name="treatmentType"]');
        radios.forEach(radio => {
            radio.addEventListener('change', () => this.toggleTreatmentType());
        });

        // Dictation
        const btnDictate = document.getElementById('btn-dictate-profile-note');
        if (btnDictate) {
            btnDictate.onclick = (e) => {
                e.preventDefault(); // Prevent form submit if inside form
                this.handleDictation();
            };
        }

        // Patient List Delegation
        const listContainer = document.getElementById('patient-list-container');
        if (listContainer) {
            listContainer.addEventListener('click', (e) => {
                // 1. Mobile Card Profile View
                const mobileCard = e.target.closest('[data-action="view-profile"]');
                if (mobileCard && mobileCard.dataset.id) {
                    const p = this.store.state.patients.find(pt => String(pt.id) === String(mobileCard.dataset.id));
                    if (p) this.showPatientProfile(p, 'history');
                    return;
                }

                // 2. Desktop History Button
                const historyBtn = e.target.closest('.action-view-history');
                if (historyBtn) {
                    e.stopPropagation(); // prevent row click
                    const row = historyBtn.closest('.patient-row');
                    if (row && row.dataset.id) {
                        const p = this.store.state.patients.find(pt => String(pt.id) === String(row.dataset.id));
                        if (p) this.showPatientProfile(p, 'history');
                    }
                    return;
                }

                // 3. Desktop Row Edit (solo si no está borrado)
                const row = e.target.closest('.patient-row');
                if (row && row.dataset.action === 'edit-patient') {
                    if (row.dataset.status !== 'deleted') {
                        this.editPatient(row.dataset.id);
                    }
                }

                // 4. Papelera - Restaurar
                const restoreBtn = e.target.closest('.action-restore-patient');
                if (restoreBtn) {
                    e.stopPropagation();
                    const rowContainer = restoreBtn.closest('.patient-row') || restoreBtn.closest('.patient-card-mobile');
                    if (rowContainer && rowContainer.dataset.id) {
                        this.handleRestorePatient(rowContainer.dataset.id);
                    }
                    return;
                }

                // 5. Papelera - Purgar
                const purgeBtn = e.target.closest('.action-purge-patient');
                if (purgeBtn) {
                    e.stopPropagation();
                    const rowContainer = purgeBtn.closest('.patient-row') || purgeBtn.closest('.patient-card-mobile');
                    if (rowContainer && rowContainer.dataset.id) {
                        this.handlePurgePatient(rowContainer.dataset.id);
                    }
                    return;
                }
            });
        }

        this.bindGlobalUIEvents();
    }

    bindGlobalUIEvents() {
        const btnCreate = document.getElementById('btn-create-patient');
        if (btnCreate) btnCreate.onclick = () => this.openCreatePatientModal();

        const btnImport = document.getElementById('btn-import-patient-modal');
        if (btnImport) btnImport.onclick = () => this.openImportPatientModal();

        const btnNote = document.getElementById('btn-add-patient-note');
        if (btnNote) btnNote.onclick = () => this.addPatientNote();

        const btnSign = document.getElementById('btn-save-consent');
        if (btnSign) btnSign.onclick = () => this.saveConsent();

        const btnRevoke = document.getElementById('btn-revoke-consent');
        if (btnRevoke) btnRevoke.onclick = () => this.revokeConsent();

        const btnClearSign = document.getElementById('btn-clear-signature');
        if (btnClearSign) btnClearSign.onclick = () => this.clearSignature();

        const closeProfile = document.getElementById('btn-close-patient-profile');
        if (closeProfile) closeProfile.onclick = () => document.getElementById('patient-profile-modal').classList.add('hidden');

        const closeBackdrop = document.getElementById('btn-close-patient-modal-backdrop');
        if (closeBackdrop) closeBackdrop.onclick = () => document.getElementById('patient-modal').classList.add('hidden');

        const closeX = document.getElementById('btn-close-patient-modal-x');
        if (closeX) closeX.onclick = () => document.getElementById('patient-modal').classList.add('hidden');

        const btnProcessImport = document.getElementById('btn-process-import');
        if (btnProcessImport) {
            btnProcessImport.onclick = async () => {
                if (!this.currentImportFile) return;

                try {
                    const text = await this.currentImportFile.text();
                    const rawData = JSON.parse(text);
                    const rawArray = Array.isArray(rawData) ? rawData : [rawData];

                    const result = this.validateAndNormalizePatients(rawArray);

                    if (result.valid.length > 0) {
                        this.store.startBatch();
                        for (const p of result.valid) {
                            await this.store.addPatient(p);
                        }
                        await this.store.endBatch();
                        this.renderPatientView();
                    }

                    import('./ToastManager.js').then(m => {
                        if (result.valid.length > 0) {
                            m.ToastManager.showToast(`${result.valid.length} válidos, ${result.skipped.length} omitidos.`, 'success');
                        } else {
                            m.ToastManager.showToast(`0 válidos, revisa el formato del JSON.`, 'error');
                        }
                    });

                    this.resetImportFile();
                    document.getElementById('import-patient-modal').classList.add('hidden');
                } catch (err) {
                    console.error("Error validando importación:", err);
                    import('./ToastManager.js').then(m => m.ToastManager.showToast('Error procesando el archivo JSON', 'error'));
                }
            };
        }

        const btnSavePatient = document.getElementById('btn-save-patient');
        // If form exists, calculate handles submit, but let's ensure the button type submit works naturally.

        // Tabs
        ['history', 'notes', 'files', 'consent'].forEach(tab => {
            const btn = document.getElementById(`tab-${tab}`);
            if (btn) btn.onclick = () => this.switchProfileTab(tab);
        });
    }

    handleDictation() {
        const input = document.getElementById('new-note-input');
        const btn = document.getElementById('btn-dictate-profile-note');
        if (!input || !btn) return;

        const icon = btn.querySelector('span');

        if (this.app.dictationService.isListening) {
            this.app.dictationService.stop();
            return;
        }

        // Start
        const initialText = input.value;
        icon.classList.add('text-red-500', 'animate-pulse');
        icon.innerText = 'mic_off'; // Visual cue to stop

        this.app.dictationService.start(
            (final, interim) => {
                // Update input
                const separator = initialText && !initialText.endsWith(' ') ? ' ' : '';
                input.value = initialText + separator + final + (interim ? ' ' + interim : '');
                // Auto-scroll to bottom of textarea
                input.scrollTop = input.scrollHeight;
            },
            () => {
                // On End
                icon.classList.remove('text-red-500', 'animate-pulse');
                icon.innerText = 'mic';
            }
        );
    }

    populateServiceFilter() {
        const select = document.getElementById('filter-service');
        if (!select) return;

        // Preserve current selection if re-populating (optional, but good UX)
        const currentVal = select.value;

        const services = this.store.state.services || [];
        // Only keep "All" option initially
        select.innerHTML = '<option value="all">Todos los Servicios</option>';

        services.forEach(s => {
            const opt = document.createElement('option');
            // Use ID as value for reliable filtering
            opt.value = s.id;
            opt.textContent = s.name;
            select.appendChild(opt);
        });

        // Restore if valid
        if (currentVal && (currentVal === 'all' || services.some(s => String(s.id) === String(currentVal)))) {
            select.value = currentVal;
        }
    }

    async handlePatientFormSubmit(e) {
        e.preventDefault();
        const patientForm = e.target;

        // Validation Visuals
        const nameInput = document.getElementById('patient-name');
        if (nameInput) nameInput.classList.remove('border-red-500', 'ring-2', 'ring-red-200');

        const formData = new FormData(patientForm);
        const name = formData.get('name');

        if (!name || !name.trim()) {
            if (nameInput) nameInput.classList.add('border-red-500', 'ring-2', 'ring-red-200');
            import('./ToastManager.js').then(m => m.ToastManager.showToast("El nombre es obligatorio", "error"));
            return;
        }

        const age = parseInt(formData.get('age')) || 0;
        const phone = formData.get('phone') || '';
        const phoneOwner = formData.get('phoneOwner') || 'Madre';
        const email = formData.get('email') || '';
        const phone2 = formData.get('phone2') || '';
        const email2 = formData.get('email2') || '';
        const tutorName = formData.get('tutorName') || '';
        const tutorRole = formData.get('tutorRole') || 'Otro';
        const contactType = formData.get('contactType') || 'parent';
        const notes = formData.get('notes') || '';
        const service = formData.get('service') || '';

        // Validation Logic
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^[0-9\s+()-]{9,15}$/;

        if (!name || name.length < 2) {
            ToastManager.showToast("El nombre es muy corto.", "error");
            return;
        }

        if (email && !emailRegex.test(email)) {
            ToastManager.showToast("Formato de email inválido.", "error");
            return;
        }

        if (phone && !phoneRegex.test(phone)) {
            ToastManager.showToast("Formato de teléfono inválido (9-15 dígitos).", "error");
            return;
        }

        // Treatment Logic
        const treatmentType = formData.get('treatmentType') || 'chronic';
        const totalSessions = parseInt(formData.get('totalSessions')) || 0;

        // Frequency Logic
        const treatmentPlan = formData.get('treatmentPlan') || '1x45';
        const [sessionsStr, durationStr] = treatmentPlan.split('x');
        const sessionsPerWeek = parseInt(sessionsStr) || 1;
        const preferredDuration = parseInt(durationStr) || 45;

        // Availability
        const availability = [];
        const checkedDays = formData.getAll('days').map(d => parseInt(d));
        checkedDays.forEach(dayIndex => {
            const starts = formData.getAll(`start_${dayIndex}`);
            const ends = formData.getAll(`end_${dayIndex}`);
            starts.forEach((start, i) => {
                const end = ends[i];
                if (start && end) {
                    availability.push({ day: dayIndex + 1, start, end });
                }
            });
        });

        if (this.editingPatientId) {
            // UPDATE EXISTING
            await this.store.updatePatient(this.editingPatientId, {
                name, age, phone, phoneOwner, email, phone2, email2, tutorName, tutorRole, contactType,
                treatmentType, totalSessions, service,
                treatmentPlan, sessionsPerWeek, preferredDuration,
                availability,
                notes
            });
            ToastManager.showToast(`Paciente ${name} actualizado.`, "success");
            this.closeDetailPanel(); // Return to empty state (or keep selected? Close for now)
            const modal = document.getElementById('patient-modal');
            if (modal) modal.classList.add('hidden');
        } else {
            // CREATE NEW
            const newPatient = {
                id: generateId(),
                name, age, phone, phoneOwner, email, phone2, email2, tutorName, tutorRole, contactType,
                notes, service,
                treatmentPlan, sessionsPerWeek, preferredDuration,
                treatmentType, totalSessions, sessionsCompleted: 0,
                startDate: new Date().toISOString(),
                status: 'waiting',
                availability,
                notesHistory: notes ? [{
                    id: generateId(),
                    date: new Date().toISOString(),
                    content: `Nota Inicial: ${notes}`,
                    author: 'Sistema'
                }] : [],
                files: []
            };
            // Better to await to be safe.
            await this.store.addPatient(newPatient);
            ToastManager.showToast(`Paciente ${name} creado.`, "success");
            const modal = document.getElementById('patient-modal');
            if (modal) modal.classList.add('hidden');
        }

        this.renderPatientView(); // Refresh list to show changes
    }

    closeDetailPanel() {
        // Implementation might be missing in snippet, assume existing or empty
    }

    // --- LISTING & FILTERING ---
    renderPatientView(filterText = '') {
        const container = document.getElementById('patient-list-content');
        if (!container) return;

        // Show deleted filter option ONLY for admin
        const optDeleted = document.getElementById('opt-filter-deleted');
        if (optDeleted) {
            optDeleted.style.display = (this.app?.authService?.currentUser?.role === 'admin') ? 'block' : 'none';
        }

        try {
            // Ensure filters are populated if empty
            const serviceSelect = document.getElementById('filter-service');
            if (serviceSelect && serviceSelect.options.length <= 1 && this.store.state.services.length > 0) {
                this.populateServiceFilter();
            }

            const statusFilter = document.getElementById('filter-status')?.value || 'all';
            const serviceFilter = document.getElementById('filter-service')?.value || 'all';
            const dayFilterVal = document.getElementById('filter-avail-day')?.value || 'all';
            const hourFilterVal = document.getElementById('filter-avail-hour')?.value || 'all';

            let patients = this.store.state.patients || [];

            // 1. Filter by Search (Argument or Input)
            // If filterText is empty, check if there's an input value (e.g. from Sidebar)
            // actually Sidebar calls renderSidebar, this is main view. keeping filterText arg support.
            const query = filterText.toLowerCase();
            // Note: The original code used this.searchQuery in one block and filterText in another. 
            // Let's unify. If filterText is passed, use it. 

            if (patients.length === 0) {
                container.innerHTML = '<div class="p-8 text-center text-slate-500">Cargando datos...</div>';
                return;
            }

            const currentUser = this.app.authService.currentUser;

            patients = patients.filter(p => {
                // Security Check
                if (!this.app.securityManager.canAccessPatient(currentUser, p)) return false;

                // Search
                const matchesText = p.name.toLowerCase().includes(query) ||
                    (p.tutorName && p.tutorName.toLowerCase().includes(query)) ||
                    (p.phone && p.phone.includes(query)) ||
                    (p.email && p.email.toLowerCase().includes(query));

                // Status
                let matchesStatus = true;
                if (statusFilter !== 'all') {
                    matchesStatus = (p.status === statusFilter);
                } else {
                    matchesStatus = (p.status !== 'deleted');
                }

                // Service
                let matchesService = true;
                if (serviceFilter !== 'all') {
                    // serviceFilter val is likely string from select, p.service is number
                    matchesService = (String(p.service) === String(serviceFilter));
                }

                // Role/Prof Check (Private patients)
                if (currentUser && currentUser.role === 'professional') {
                    const prof = this.store.state.professionals.find(pr => pr.id === currentUser.id);
                    if (prof && prof.services && !prof.services.includes(p.service)) {
                        return false;
                    }
                }

                // Availability
                let matchesAvail = true;
                if (dayFilterVal !== 'all' || hourFilterVal !== 'all') {
                    if (!Array.isArray(p.availability) || p.availability.length === 0) {
                        matchesAvail = false;
                    } else {
                        matchesAvail = p.availability.some(slot => {
                            let dayMatch = true;
                            let hourMatch = true;
                            if (dayFilterVal !== 'all') dayMatch = (String(slot.day) === String(dayFilterVal));
                            if (hourFilterVal !== 'all') hourMatch = (slot.start <= hourFilterVal && slot.end > hourFilterVal);
                            return dayMatch && hourMatch;
                        });
                    }
                }

                return matchesText && matchesStatus && matchesService && matchesAvail;
            });

            if (patients.length === 0) {
                container.innerHTML = `
                <div class="flex flex-col items-center justify-center p-12 text-slate-400">
                    <span class="material-symbols-outlined text-6xl mb-4 text-slate-200 dark:text-gray-700">group_off</span>
                    <p class="text-lg font-medium">No se encontraron pacientes</p>
                    <p class="text-sm">Intenta ajustar los filtros de búsqueda</p>
                </div>`;
                return;
            }

            const statusColors = {
                'active': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                'waiting': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                'archived': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                'deleted': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            };

            const statusLabels = { 'active': 'Activo', 'waiting': 'En Espera', 'archived': 'Archivado', 'deleted': 'Eliminado' };

            // --- MOBILE CARD VIEW (< md) ---
            const mobileCards = patients.map(p => {
                const serviceName = this.store.getServiceName(p.service);
                return `
            <div data-action="${p.status === 'deleted' ? '' : 'view-profile'}" data-id="${p.id}" data-status="${p.status}"
                 class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-3 transition-transform ${p.status === 'deleted' ? '' : 'active:scale-[0.98] cursor-pointer'} patient-card-mobile">
                
                <div class="flex justify-between items-start">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                            ${escapeHtml(p.name.split(' ').map(n => n[0]).slice(0, 2).join(''))}
                        </div>
                        <div>
                            <h3 class="font-bold text-slate-700 dark:text-gray-200 text-sm">${escapeHtml(p.name)}</h3>
                            <p class="text-xs text-slate-500">${escapeHtml(String(p.age))} años • ${escapeHtml(serviceName)}</p>
                        </div>
                    </div>
                     <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusColors[p.status] || statusColors['active']}">
                        ${statusLabels[p.status] || 'Activo'}
                    </span>
                </div>

                <div class="flex items-center justify-between text-xs text-slate-500 dark:text-gray-400 border-t border-gray-50 dark:border-gray-800 pt-3">
                    <div class="flex items-center gap-1">
                        <span class="material-symbols-outlined text-[14px]">phone</span>
                        ${escapeHtml(p.phone || 'Sin teléfono')}
                    </div>
                     <div class="flex items-center gap-1">
                        ${p.status === 'deleted' ? `
                            <button type="button" class="text-green-500 action-restore-patient p-1"><span class="material-symbols-outlined text-[16px]">restore</span></button>
                            <button type="button" class="text-red-500 action-purge-patient p-1"><span class="material-symbols-outlined text-[16px]">delete_forever</span></button>
                        ` : `
                            <span class="material-symbols-outlined text-[14px]">calendar_month</span>
                            ${Array.isArray(p.availability) && p.availability.length > 0 ? (p.availability.length + ' franjas') : 'Flexible'}
                        `}
                    </div>
                </div>
            </div>`;
            }).join('');

            // --- DESKTOP TABLE VIEW (md +) ---
            const desktopRows = patients.map(p => {
                const serviceName = this.store.getServiceName(p.service);
                return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group cursor-pointer patient-row" data-id="${p.id}" data-action="${p.status === 'deleted' ? '' : 'edit-patient'}" data-status="${p.status}">
                <td class="p-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs group-hover:bg-primary group-hover:text-white transition-colors">
                            ${escapeHtml(p.name.split(' ').map(n => n[0]).slice(0, 2).join(''))}
                        </div>
                        <div>
                            <div class="font-bold text-slate-700 dark:text-gray-200 text-sm">${escapeHtml(p.name)}</div>
                            <div class="text-xs text-slate-400">${escapeHtml(String(p.age))} años</div>
                        </div>
                    </div>
                </td>
                <td class="p-4">
                    <div class="flex flex-col">
                        <span class="text-sm text-slate-600 dark:text-gray-300 font-medium">${escapeHtml(p.phone || '-')}</span>
                         ${p.email ? `<span class="text-xs text-slate-400 truncate max-w-[120px]" title="${escapeHtml(p.email)}">${escapeHtml(p.email)}</span>` : ''}
                    </div>
                </td>
                <td class="p-4">
                    <span class="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 text-xs font-bold border border-gray-200 dark:border-gray-600">
                        ${escapeHtml(serviceName)}
                    </span>
                </td>
                <td class="p-4">
                     <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status] || statusColors['active']}">
                        ${statusLabels[p.status] || 'Activo'}
                    </span>
                     ${p.pendingReassignments && p.pendingReassignments.length > 0 ?
                        `<span class="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-600 border border-red-100" title="Debe sesión">
                             <span class="material-symbols-outlined text-[12px]">remove_circle</span> -${p.pendingReassignments.length}
                          </span>` : ''}
                </td>
                <td class="p-4">
                    <p class="text-xs text-slate-600 dark:text-gray-400 max-w-xs truncate">
                        ${Array.isArray(p.availability) && p.availability.length > 0
                        ? p.availability.map(a => {
                            const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
                            return `${days[a.day - 1] || 'd'} ${a.start}-${a.end}`;
                        }).join(', ')
                        : (p.availability || 'Flexible')}
                    </p>
                </td> 
                <td class="p-4 text-center">
                    ${p.status === 'deleted' ? `
                    <div class="flex items-center justify-center gap-2">
                        <button type="button" class="text-green-500 hover:text-green-600 transition-colors p-1 action-restore-patient" title="Restaurar Paciente"><span class="material-symbols-outlined">restore_from_trash</span></button>
                        <button type="button" class="text-red-500 hover:text-red-600 transition-colors p-1 action-purge-patient" title="Eliminar Definitivamente"><span class="material-symbols-outlined">delete_forever</span></button>
                    </div>
                    ` : `
                    <button type="button" class="text-slate-400 hover:text-primary transition-colors p-1 action-view-history" title="Ver Historial"><span class="material-symbols-outlined">receipt_long</span></button>
                    `}
                </td>
            </tr>`;
            }).join('');

            container.innerHTML = `
            <!-- Mobile: Card List -->
            <div class="md:hidden flex flex-col gap-3 p-4 bg-gray-50/50 dark:bg-black/20">
                ${mobileCards}
            </div>

            <!-- Desktop: Table -->
            <div class="hidden md:block w-full overflow-hidden">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                            <th class="px-6 py-4">Paciente</th>
                            <th class="px-4 py-4">Contacto</th>
                            <th class="px-4 py-4">Servicio</th>
                            <th class="px-4 py-4">Estado</th>
                            <th class="px-4 py-4">Horario Pref.</th>
                            <th class="px-6 py-4 text-center">Historial</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                        ${desktopRows}
                    </tbody>
                </table>
            </div>`;
        } catch (err) {
            console.error("Patient View Render Error:", err);
            container.innerHTML = '<div class="p-8 text-center text-red-500">Error al renderizar pacientes.</div>';
        }
    }

    showPatientProfile(patient, initialTab = 'history') {
        const modal = document.getElementById('patient-profile-modal');
        if (!modal) return;

        // Log Access
        if (this.app.securityManager) {
            this.app.securityManager.logAccess('VIEW_PATIENT', patient.id, `Visto perfil de ${patient.name}`);
        }

        // Permission Check
        const setTabVisible = (id, visible) => {
            const el = document.getElementById(id);
            if (el) {
                if (visible) el.classList.remove('hidden');
                else el.classList.add('hidden');
            }
        };

        // Notes are always visible for remaining roles (Admin/Professional)
        setTabVisible('tab-notes', true);

        this.currentProfilePatientId = patient.id;
        this.signaturePad = null; // Reset signature pad logic

        document.getElementById('profile-name').innerText = patient.name;
        document.getElementById('profile-avatar').innerText = patient.name.split(' ').map(n => n[0]).slice(0, 2).join('');
        document.getElementById('profile-age').innerText = `${patient.age} años`;
        document.getElementById('profile-phone').innerHTML = escapeHtml(patient.phone) + (patient.phoneOwner && patient.phoneOwner !== 'Propio' ? ` <span class="text-[10px] text-slate-400 font-normal">(${escapeHtml(patient.phoneOwner)})</span>` : '');
        document.getElementById('profile-email').innerText = patient.email;

        const roleBadge = patient.tutorRole
            ? `<span class="ml-1 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-1 rounded-lg font-bold uppercase tracking-wide border border-slate-200 dark:border-slate-600">${escapeHtml(patient.tutorRole)}</span>`
            : '';
        document.getElementById('profile-tutor').innerHTML = `${escapeHtml(patient.tutorName || patient.tutor || 'No registrado')} ${roleBadge}`;

        // Stats
        const patientAppts = this.store.state.appointments.filter(a => a.patientId === patient.id);
        const total = patientAppts.length;
        const cancelled = patientAppts.filter(a => a.status === 'cancelled').length;
        const attended = patientAppts.filter(a => a.status !== 'cancelled' && new Date(a.start) < new Date()).length;
        const completedOrPast = patientAppts.filter(a => new Date(a.start) < new Date()).length;
        const attendanceRate = completedOrPast > 0 ? Math.round((attended / completedOrPast) * 100) : 100;

        document.getElementById('stat-total-appts').innerText = total;
        document.getElementById('stat-attendance').innerText = `${attendanceRate}%`;

        // Balance
        const balanceContainer = document.getElementById('profile-balance-container');
        const balanceList = document.getElementById('profile-balance-list');

        if (balanceContainer && balanceList) {
            let html = '';
            if (patient.pendingReassignments && patient.pendingReassignments.length > 0) {
                patient.pendingReassignments.forEach(item => {
                    html += `
                        <div class="flex items-start gap-2 text-xs bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
                            <span class="material-symbols-outlined text-[16px] text-red-500">remove_circle</span>
                            <div>
                                <p class="font-bold text-red-600 dark:text-red-400">Reasignación Pendiente</p>
                                <p class="text-slate-500 dark:text-gray-400">Canceló el ${new Date(item.date).toLocaleDateString()}. <br>Sustituido por: ${escapeHtml(item.substitutedBy)}</p>
                            </div>
                        </div>`;
                });
            }
            if (patient.extraSessions && patient.extraSessions.length > 0) {
                patient.extraSessions.forEach(item => {
                    html += `
                        <div class="flex items-start gap-2 text-xs bg-green-50 dark:bg-green-900/10 p-3 rounded-xl border border-green-100 dark:border-green-900/30">
                            <span class="material-symbols-outlined text-[16px] text-green-500">add_circle</span>
                            <div>
                                <p class="font-bold text-green-600 dark:text-green-400">Sesión Extra Realizada</p>
                                <p class="text-slate-500 dark:text-gray-400">Fecha: ${new Date(item.date).toLocaleDateString()}. <br>Cubrió a: ${escapeHtml(item.coveredFor)}</p>
                            </div>
                        </div>`;
                });
            }

            if (html) {
                balanceList.innerHTML = html;
                balanceContainer.classList.remove('hidden');
            } else {
                balanceContainer.classList.add('hidden');
            }
        }

        this.renderPatientHistory(patient.id, document.getElementById('profile-history-list'));
        this.renderPatientNotes(patient);
        this.renderPatientFiles(patient);
        this.switchProfileTab(initialTab);

        modal.classList.remove('hidden');
    }

    renderPatientHistory(patientId, container) {
        const history = this.store.state.appointments
            .filter(a => a.patientId === patientId)
            .sort((a, b) => new Date(b.start) - new Date(a.start));

        if (history.length === 0) {
            container.innerHTML = `
                <div class="text-center p-8 text-slate-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                    <span class="material-symbols-outlined mb-2 text-3xl opacity-50">event_busy</span>
                    <p class="text-sm">Este paciente no tiene historial de citas.</p>
                </div>`;
            return;
        }

        container.innerHTML = history.map(appt => {
            const date = new Date(appt.start);
            const isUpcoming = date > new Date();
            const statusColor = appt.status === 'cancelled' ? 'text-red-500' : (isUpcoming ? 'text-primary' : 'text-green-600');
            const statusIcon = appt.status === 'cancelled' ? 'cancel' : (isUpcoming ? 'upcoming' : 'check_circle');

            return `
                <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-md flex items-center justify-between hover:shadow-lg transition-shadow">
                    <div class="flex items-center gap-4">
                        <div class="size-10 rounded-full ${appt.status === 'cancelled' ? 'bg-red-50 text-red-500' : 'bg-primary/5 text-primary'} flex items-center justify-center">
                            <span class="material-symbols-outlined">${statusIcon}</span>
                        </div>
                        <div>
                            <p class="font-bold text-slate-800 dark:text-gray-200 text-sm capitalize">
                                ${date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                            <p class="text-xs text-slate-500">
                                ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                                ${new Date(appt.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                                · Prof. ${escapeHtml(appt.professionalName || 'Logopeda')}
                            </p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-xs font-bold ${statusColor} uppercase tracking-wider">
                            ${appt.status === 'cancelled' ? 'Cancelada' : (isUpcoming ? 'Pendiente' : 'Asistió')}
                        </span>
                    </div>
                </div>`;
        }).join('');
    }

    renderPatientNotes(patient) {
        const container = document.getElementById('profile-notes-list');
        if (!patient.notesHistory || patient.notesHistory.length === 0) {
            container.innerHTML = `<p class="text-sm text-slate-400 text-center italic">No hay notas clínicas registradas.</p>`;
            return;
        }
        container.innerHTML = patient.notesHistory.sort((a, b) => new Date(b.date) - new Date(a.date)).map(note => `
            <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-md mb-2">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg capitalize">
                         ${new Date(note.date).toLocaleDateString()}
                    </span>
                    <span class="text-xs text-slate-400">${escapeHtml(note.author || 'Logopeda')}</span>
                </div>
                <p class="text-sm text-slate-600 dark:text-gray-300 leading-relaxed">${escapeHtml(note.content)}</p>
            </div>`).join('');
    }

    async addPatientNote() {
        console.log("Adding Patient Note...");
        const input = document.getElementById('new-note-input');
        if (!input) {
            console.error("Note input 'new-note-input' not found!");
            return;
        }

        const content = input.value.trim();
        if (!content) {
            console.warn("Note content is empty");
            return;
        }

        if (!this.currentProfilePatientId) {
            console.error("No current patient profile ID set!");
            return;
        }

        const patient = this.store.state.patients.find(p => String(p.id) === String(this.currentProfilePatientId));
        if (patient) {
            if (!patient.notesHistory) patient.notesHistory = [];

            const newNote = {
                id: generateId(),
                date: new Date().toISOString(),
                content: content,
                author: 'Yo' // TODO: Get current user
            };

            patient.notesHistory.push(newNote);
            console.log("Note added to array. New count:", patient.notesHistory.length);

            // Save Store
            await this.store.save();
            console.log("Store saved.");

            // Log Audit
            if (this.app.securityManager) {
                this.app.securityManager.logAccess('ADD_NOTE', patient.id, `Nota añadida`);
            } else {
                console.warn("SecurityManager not available for logging.");
            }

            this.renderPatientNotes(patient);
            input.value = '';
        } else {
            console.error("Patient not found in store:", this.currentProfilePatientId);
        }
    }

    renderPatientFiles(patient) {
        const container = document.getElementById('profile-files-grid');
        if (!patient.files || patient.files.length === 0) {
            container.innerHTML = `<p class="col-span-3 text-sm text-slate-400 text-center italic py-4">No hay archivos adjuntos.</p>`;
            return;
        }
        container.innerHTML = patient.files.map(file => `
            <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-md flex flex-col gap-3 group hover:border-primary transition-colors cursor-pointer hover:shadow-lg">
                <div class="flex items-start justify-between">
                     <div class="size-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
                        <span class="material-symbols-outlined">description</span>
                     </div>
                     <button class="text-slate-300 hover:text-slate-500"><span class="material-symbols-outlined">more_vert</span></button>
                </div>
                <div>
                    <p class="font-bold text-sm text-slate-700 dark:text-gray-200 truncate" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</p>
                    <p class="text-[10px] text-slate-400 mt-1">${escapeHtml(file.size)} · ${new Date(file.date).toLocaleDateString()}</p>
                </div>
            </div>`).join('');
    }


    // --- Consent & Signature ---

    switchProfileTab(tabName) {
        document.querySelectorAll('.profile-tab-btn').forEach(btn => {
            if (btn.id === `tab-${tabName}`) {
                btn.classList.add('text-primary', 'border-primary');
                btn.classList.remove('text-slate-400', 'border-transparent');
            } else {
                btn.classList.remove('text-primary', 'border-primary');
                btn.classList.add('text-slate-400', 'border-transparent');
            }
        });
        document.querySelectorAll('.tab-content').forEach(div => div.classList.add('hidden'));
        document.getElementById(`content-${tabName}`).classList.remove('hidden');

        // Init Signature Pad if tab is consent
        if (tabName === 'consent') {
            this.loadConsentInfo();
            if (!this.signaturePad) {
                // Small delay to ensure validation of visibility
                setTimeout(() => {
                    this.signaturePad = new SignaturePad('signature-canvas');
                }, 50);
            } else {
                // Resize handling
                setTimeout(() => this.signaturePad.resizeCanvas(), 50);
            }
        }

        // Init Notes Template if tab is notes
        if (tabName === 'notes') {
            this.populateNoteTemplates();
        }
    }

    populateNoteTemplates() {
        const select = document.getElementById('note-template-select');
        if (!select) return;

        const templates = this.app.communicationService.getTemplates();
        const clinicalTpls = templates.clinical || {};

        let html = '<option value="">Cargar Plantilla...</option>';

        // Map friendly names
        const names = {
            'initial': 'Evaluación Inicial',
            'session': 'Nota de Sesión',
            'discharge': 'Informe de Alta'
        };

        Object.keys(clinicalTpls).forEach(key => {
            const label = names[key] || key.charAt(0).toUpperCase() + key.slice(1);
            html += `<option value="${key}">${label}</option>`;
        });

        select.innerHTML = html;
    }

    handleTemplateSelect(key) {
        if (!key || !this.currentProfilePatientId) return;

        const templates = this.app.communicationService.getTemplates();
        const tplContent = templates.clinical ? templates.clinical[key] : null;

        if (tplContent) {
            const patient = this.store.state.patients.find(p => p.id === this.currentProfilePatientId);
            if (patient) {
                // Process template (no appointment context for generic notes)
                const text = this.app.communicationService.processTemplate(tplContent, null, patient);

                const input = document.getElementById('new-note-input');
                if (input) {
                    input.value = text;
                    // Optional: auto-resize?
                }
            }
        }

        // Reset select to default so you can select the same one again if needed
        const select = document.getElementById('note-template-select');
        if (select) select.value = "";
    }

    loadConsentInfo() {
        if (!this.currentProfilePatientId) return;
        const patient = this.store.state.patients.find(p => p.id === this.currentProfilePatientId);

        const unsignedView = document.getElementById('consent-unsigned-view');
        const signedView = document.getElementById('consent-signed-view');

        if (patient && patient.consent && patient.consent.signedAt) {
            unsignedView.classList.add('hidden');
            signedView.classList.remove('hidden');
            signedView.classList.add('flex');

            document.getElementById('consent-signature-image').src = patient.consent.signature;
            document.getElementById('consent-date-label').innerText = `Firmado el: ${new Date(patient.consent.signedAt).toLocaleString()}`;
        } else {
            signedView.classList.add('hidden');
            signedView.classList.remove('flex');
            unsignedView.classList.remove('hidden');
        }
    }

    clearSignature() {
        if (this.signaturePad) {
            this.signaturePad.clear();
        }
    }

    async saveConsent() {
        if (!this.signaturePad || this.signaturePad.isEmpty()) {
            ToastManager.showToast('Por favor, firme antes de guardar', 'error');
            return;
        }

        const patient = this.store.state.patients.find(p => p.id === this.currentProfilePatientId);
        if (patient) {
            patient.consent = {
                signature: this.signaturePad.toDataURL(),
                signedAt: new Date().toISOString(),
                version: '1.0'
            };
            this.store.save();
            this.loadConsentInfo();
            ToastManager.showToast('Consentimiento firmado y guardado', 'success');
        }
    }

    async revokeConsent() {
        if (!this.currentProfilePatientId) return;

        if (await this.app.showConfirm('Revocar Consentimiento', '¿Está seguro? Esto eliminará la firma digital y el paciente deberá volver a firmar.', 'danger')) {
            const patient = this.store.state.patients.find(p => p.id === this.currentProfilePatientId);
            if (patient) {
                delete patient.consent;
                await this.store.save();
                this.loadConsentInfo();
                this.clearSignature();
                ToastManager.showToast('Consentimiento revocado', 'info');
            }
        }
    }

    openCreatePatientModal() {
        const modal = document.getElementById('patient-modal');
        const form = document.getElementById('patient-form');
        if (modal && form) {
            form.reset();
            this.editingPatientId = null;
            const title = document.getElementById('patient-modal-title');
            if (title) title.innerText = 'Nuevo Paciente';

            // Buttons
            const btnText = document.getElementById('btn-save-patient-text');
            const btnIcon = document.getElementById('btn-save-patient-icon');
            const delBtn = document.getElementById('btn-delete-patient');

            if (btnText) btnText.innerText = 'Guardar Paciente';
            if (btnIcon) btnIcon.innerText = 'save';
            if (delBtn) delBtn.classList.add('hidden');

            this.populatePatientServiceSelect();
            this.resetAvailabilityUI(form);
            modal.classList.remove('hidden');
        }
    }



    editPatient(id) {
        const patient = this.store.state.patients.find(p => p.id === id);
        if (!patient) return;

        this.editingPatientId = id;
        const modal = document.getElementById('patient-modal');
        const form = document.getElementById('patient-form');
        if (modal && form) {
            form.reset();
            this.populatePatientServiceSelect();

            const title = document.getElementById('patient-modal-title');
            if (title) title.innerText = "Editar Paciente";

            // Buttons Logic
            const btnText = document.getElementById('btn-save-patient-text');
            const btnIcon = document.getElementById('btn-save-patient-icon');
            const delBtn = document.getElementById('btn-delete-patient');

            if (btnText) btnText.innerText = 'Actualizar Paciente';
            if (btnIcon) btnIcon.innerText = 'sync';
            if (delBtn) {
                delBtn.classList.remove('hidden');
                // Remove old listeners to prevent duplicates if any (though usually modal is re-rendered or existing one reused)
                const newDelBtn = delBtn.cloneNode(true);
                delBtn.parentNode.replaceChild(newDelBtn, delBtn);

                newDelBtn.addEventListener('click', async () => {
                    if (await this.app.showConfirm("Eliminar Paciente", `¿Estás seguro de que quieres eliminar a ${patient.name}?`, "danger")) {
                        await this.app.clinicService.deletePatient(id);
                        this.renderPatientView();
                        modal.classList.add('hidden');
                        import('./ToastManager.js').then(m => m.ToastManager.showToast('Paciente movido a la papelera', 'success'));
                    }
                });
            }

            const setVal = (name, val) => { if (form.elements[name]) form.elements[name].value = val; };

            setVal('name', patient.name);
            setVal('age', patient.age);
            setVal('phone', patient.phone);
            setVal('phoneOwner', patient.phoneOwner || 'Madre');
            setVal('email', patient.email);
            setVal('tutorName', patient.tutorName || patient.tutor || '');
            setVal('tutorRole', patient.tutorRole || 'Otro');
            setVal('notes', patient.notes || '');

            setVal('service', patient.service || '');
            this.updateTreatmentOptions();
            setVal('treatmentPlan', patient.treatmentPlan || '1x45');

            const tType = patient.treatmentType || 'chronic';
            const tRadio = form.querySelector(`input[name="treatmentType"][value="${tType}"]`);
            if (tRadio) {
                tRadio.checked = true;
                this.toggleTreatmentType();
            }
            if (patient.totalSessions) setVal('totalSessions', patient.totalSessions);

            // Restore Availability
            if (patient.availability && Array.isArray(patient.availability)) {
                this.restoreAvailabilityUI(form, patient.availability);
            } else {
                this.resetAvailabilityUI(form);
            }

            modal.classList.remove('hidden');
        }
    }

    async handleRestorePatient(id) {
        if (!id) return;
        if (await this.app.showConfirm("Restaurar Paciente", "¿Quieres restaurar este paciente? Volverá a estar Activo.", "info")) {
            await this.store.restorePatient(id);
            this.renderPatientView();
            import('./ToastManager.js').then(m => m.ToastManager.showToast('Paciente restaurado', 'success'));
        }
    }

    async handlePurgePatient(id) {
        if (!id) return;
        if (await this.app.showConfirm("Eliminar Definitivamente", "Esta acción es irreversible y borrará todo el historial clínico del paciente. ¿Estás absolutamente seguro?", "danger")) {
            await this.store.purgePatient(id);
            this.renderPatientView();
            import('./ToastManager.js').then(m => m.ToastManager.showToast('Paciente eliminado definitivamente', 'success'));
        }
    }

    // Availability Helpers
    addSlot(dayIndex) {
        const container = document.getElementById(`slots-container-${dayIndex}`);
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'flex items-center gap-2 mt-2 input-slot-row group';
        div.innerHTML = `
            <input type="time" name="start_${dayIndex}" class="w-24 px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-primary outline-none font-medium">
            <span class="text-slate-400">-</span>
            <input type="time" name="end_${dayIndex}" class="w-24 px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-primary outline-none font-medium">
            <button type="button" class="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 action-remove-slot">
                <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
        `;
        container.appendChild(div);
    }

    toggleDay(checkbox) {
        const dayIndex = checkbox.value;
        const container = document.getElementById(`slots-container-${dayIndex}`);
        if (!container) return;

        const inputs = container.querySelectorAll('input, button');
        if (checkbox.checked) {
            inputs.forEach(el => el.disabled = false);
            container.classList.remove('opacity-50', 'pointer-events-none');
            // If empty (re-enabled), ensure at least one slot?
            // resetAvailabilityUI handles the initial state.
        } else {
            inputs.forEach(el => el.disabled = true);
            container.classList.add('opacity-50', 'pointer-events-none');
        }
    }

    resetAvailabilityUI(form) {
        for (let i = 0; i < 5; i++) {
            const cb = form.querySelector(`input[name="days"][value="${i}"]`);
            const container = document.getElementById(`slots-container-${i}`);

            if (container) {
                container.innerHTML = `
                    <div class="flex items-center gap-2 mt-2 input-slot-row group">
                        <input type="time" name="start_${i}" class="w-24 px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-primary outline-none font-medium" disabled>
                        <span class="text-slate-400">-</span>
                        <input type="time" name="end_${i}" class="w-24 px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-primary outline-none font-medium" disabled>
                        <button type="button" disabled data-day="${i}"
                            class="slot-btn size-7 rounded bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors disabled:opacity-0 action-add-slot">
                            <span class="material-symbols-outlined text-[16px]">add</span>
                        </button>
                    </div>`;
            }
            if (cb) {
                cb.checked = false;
                // cb.onchange handled by delegation
                this.toggleDay(cb); // Initialize state
            }
        }
    }

    restoreAvailabilityUI(form, availability) {
        // Group by day (1-based from store)
        const slotsByDay = {}; // Key: 0-4
        availability.forEach(s => {
            const dIndex = s.day - 1;
            if (!slotsByDay[dIndex]) slotsByDay[dIndex] = [];
            slotsByDay[dIndex].push(s);
        });

        for (let i = 0; i < 5; i++) {
            const cb = form.querySelector(`input[name="days"][value="${i}"]`);
            const container = document.getElementById(`slots-container-${i}`);

            if (cb) {
                // cb.onchange handled by delegation
            }

            if (slotsByDay[i]) {
                if (cb) {
                    cb.checked = true;
                    this.toggleDay(cb);
                }
                if (container) {
                    container.innerHTML = ''; // Clear default
                    slotsByDay[i].forEach((slot, index) => {
                        const div = document.createElement('div');
                        div.className = 'flex items-center gap-2 mt-2 input-slot-row group';

                        let btnHtml = '';
                        if (index === 0) {
                            btnHtml = `<button type="button" data-day="${i}" class="slot-btn size-7 rounded bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors action-add-slot"><span class="material-symbols-outlined text-[16px]">add</span></button>`;
                        } else {
                            btnHtml = `<button type="button" class="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 action-remove-slot"><span class="material-symbols-outlined text-[16px]">close</span></button>`;
                        }

                        div.innerHTML = `
                            <input type="time" name="start_${i}" value="${slot.start}" class="w-24 px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-primary outline-none font-medium">
                            <span class="text-slate-400">-</span>
                            <input type="time" name="end_${i}" value="${slot.end}" class="w-24 px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-primary outline-none font-medium">
                            ${btnHtml}
                        `;
                        container.appendChild(div);
                    });
                }
            } else {
                // If not in availability, reset
                if (cb && cb.checked) {
                    cb.checked = false;
                    this.toggleDay(cb);
                }
                // Ensure default structure exists for empty day
                const container = document.getElementById(`slots-container-${i}`);
                if (container && container.children.length === 0) {
                    // Call reset logic just for this day or inline it?
                    // Inline for safety
                    container.innerHTML = `
                        <div class="flex items-center gap-2 mt-2 input-slot-row group">
                            <input type="time" name="start_${i}" class="w-24 px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-primary outline-none font-medium" disabled>
                            <span class="text-slate-400">-</span>
                            <input type="time" name="end_${i}" class="w-24 px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-primary outline-none font-medium" disabled>
                            <button type="button" disabled data-day="${i}" class="slot-btn size-7 rounded bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors disabled:opacity-0 action-add-slot"><span class="material-symbols-outlined text-[16px]">add</span></button>
                        </div>`;
                }
                if (cb) this.toggleDay(cb); // Ensure disabled state
            }
        }
    }


    toggleTreatmentType() {
        const tempRadio = document.querySelector('input[name="treatmentType"][value="temporary"]');
        const container = document.getElementById('sessions-input-container');
        if (tempRadio && container) {
            if (tempRadio.checked) container.classList.remove('hidden');
            else container.classList.add('hidden');
        }
    }

    populatePatientServiceSelect() {
        const select = document.getElementById('patient-service-select');
        if (!select) return;

        const services = this.store.state.services || [];
        select.innerHTML = '<option value="">Seleccionar Servicio...</option>';

        if (services.length > 0) {
            services.forEach(s => {
                let d = s.duration || 45;
                if (s.name.includes('Psicología') || s.name.includes('Fisioterapia')) d = 60;
                else if (s.name.includes('Neuropsicología')) d = 45;
                else if (s.name.includes('Logopedia')) d = 45;

                const opt = document.createElement('option');
                opt.value = s.name;
                opt.textContent = `${s.name} (${d} min)`;
                select.appendChild(opt);
            });
        } else {
            const defaults = ["Logopedia", "Psicología", "Terapia Ocupacional", "Neuropsicología"];
            defaults.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                select.appendChild(opt);
            });
        }

        select.onchange = () => this.updateTreatmentOptions();
    }

    updateTreatmentOptions() {
        const serviceSelect = document.getElementById('patient-service-select');
        const planSelect = document.getElementById('patient-plan-select');
        const planContainer = planSelect ? planSelect.parentElement : null;

        if (!serviceSelect || !planSelect) return;
        if (serviceSelect.selectedIndex === -1) return;

        const serviceName = serviceSelect.options[serviceSelect.selectedIndex].text.split(' (')[0];
        planSelect.innerHTML = '';

        if (serviceName.includes('Logopedia')) {
            const opts = [
                { val: '1x30', text: '1 sesión/sem (30 min)' },
                { val: '1x45', text: '1 sesión/sem (45 min)' },
                { val: '2x30', text: '2 sesiones/sem (30 min)' }
            ];
            opts.forEach(o => {
                const el = document.createElement('option');
                el.value = o.val;
                el.textContent = o.text;
                planSelect.appendChild(el);
            });
            planSelect.value = '1x45';
            if (planContainer) planContainer.classList.remove('hidden');

        } else {
            let duration = 60;
            if (serviceName.includes('Psicología') || serviceName.includes('Fisioterapia')) duration = 60;
            else if (serviceName.includes('Neuropsicología') || serviceName.includes('Logopedia')) duration = 45;
            else {
                const serviceObj = this.store.state.services.find(s => s.name === serviceName);
                if (serviceObj && serviceObj.duration) duration = serviceObj.duration;
            }

            const el = document.createElement('option');
            el.value = `1x${duration}`;
            el.textContent = `1 sesión/sem (${duration} min)`;
            planSelect.appendChild(el);
            planSelect.value = `1x${duration}`;
        }
    }

    openImportPatientModal() {
        const modal = document.getElementById('import-patient-modal');
        if (modal) modal.classList.remove('hidden');
        this.resetImportFile();
    }

    handleImportFileSelect(file) {
        this.currentImportFile = file;
        const infoDiv = document.getElementById('import-file-info');
        const dropZone = document.getElementById('import-drop-zone');
        const filename = document.getElementById('import-filename');
        const btn = document.getElementById('btn-process-import');

        if (infoDiv && dropZone && filename && btn) {
            filename.innerText = file.name;
            infoDiv.classList.remove('hidden');
            infoDiv.classList.add('flex');
            dropZone.classList.add('hidden');
            btn.disabled = false;
        }
    }

    resetImportFile() {
        this.currentImportFile = null;
        const infoDiv = document.getElementById('import-file-info');
        const dropZone = document.getElementById('import-drop-zone');
        const btn = document.getElementById('btn-process-import');
        const input = document.getElementById('import-file-input');

        if (infoDiv && dropZone && btn && input) {
            infoDiv.classList.add('hidden');
            infoDiv.classList.remove('flex');
            dropZone.classList.remove('hidden');
            btn.disabled = true;
            input.value = '';
        }
    }

    validateAndNormalizePatients(rawArray) {
        const result = { valid: [], skipped: [] };

        rawArray.forEach(raw => {
            if (!raw || typeof raw !== 'object' || !raw.name) {
                result.skipped.push(raw);
                return;
            }

            // Clean/Normalize using store schema
            const clean = this.store.schemas.patient(raw);

            // Ensure unique ID if it collides with existing
            const exists = this.store.state.patients.some(p => String(p.id) === String(clean.id));
            if (exists) {
                import('./DateUtils.js').then(m => {
                    clean.id = m.generateId('pat');
                });
                // Note: since this is sync and dynamic import is async, we do a fallback here if needed,
                // but usually Date.now() + random works synchronously:
                clean.id = 'pat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            }

            result.valid.push(clean);
        });

        return result;
    }
}
