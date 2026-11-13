import { generateId } from './DateUtils.js';
import { ToastManager } from './ToastManager.js';

export class AppointmentManager {
    constructor(app, store, clinicService) {
        this.app = app;
        this.store = store;
        this.clinicService = clinicService;
        this.currentApptId = null;

        this.injectModal();
    }

    injectModal() {
        if (document.getElementById('new-appointment-modal')) return;

        const modalHtml = `
    <!-- 1. NEW APPOINTMENT MODAL -->
    <div id="new-appointment-modal"
        class="modal-overlay hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all duration-300">
        <div
            class="bg-white dark:bg-[#1a1821] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden scale-100 transition-all duration-300 animate-in fade-in zoom-in-95">
            <!-- Header -->
            <div
                class="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/10">
                <h3 id="appt-modal-title"
                    class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary">event</span>
                    Nueva Cita
                </h3>
                <button class="close-modal-btn text-slate-400 hover:text-red-500 transition-colors">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>

            <!-- Form -->
            <form id="new-appointment-form" class="p-6 space-y-5">
                <!-- Patient Search/Select -->
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Paciente</label>
                    <div class="relative">
                        <select id="new-appt-patient-id" class="hidden"></select>
                        <!-- Fallback/Search UI -->
                        <input type="text" id="new-appt-patient-search" placeholder="Buscar paciente..."
                            class="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm font-medium text-slate-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/50 transition-all">
                        <span class="material-symbols-outlined absolute left-3 top-3 text-slate-400">search</span>
                        <!-- Quick Add Patient Button could go here -->
                    </div>
                </div>

                <!-- Professional -->
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Profesional</label>
                    <div class="relative">
                        <select id="new-appt-prof"
                            class="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm font-medium text-slate-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/50 appearance-none transition-all cursor-pointer">
                            <!-- Populated by JS -->
                        </select>
                        <span class="material-symbols-outlined absolute left-3 top-3 text-slate-400">stethoscope</span>
                        <span
                            class="material-symbols-outlined absolute right-3 top-3 text-slate-400 pointer-events-none">expand_more</span>
                    </div>
                </div>

                <!-- Date & Time -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Fecha</label>
                        <div class="relative">
                            <input type="date" id="new-appt-date"
                                class="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm font-medium text-slate-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/50 transition-all">
                            <span
                                class="material-symbols-outlined absolute left-3 top-3 text-slate-400">calendar_today</span>
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Hora</label>
                        <div class="relative">
                            <input type="time" id="new-appt-time"
                                class="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm font-medium text-slate-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/50 transition-all">
                            <span class="material-symbols-outlined absolute left-3 top-3 text-slate-400">schedule</span>
                        </div>
                    </div>
                </div>

                <!-- Notes (Added) -->
                <div class="col-span-2 space-y-2">
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Notas</label>
                    <div class="relative">
                        <textarea id="appt-notes" rows="3"
                            class="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-primary/50 outline-none transition-all text-slate-700 dark:text-gray-200 text-sm resize-none"
                            placeholder="Añadir notas..."></textarea>
                        <button id="btn-dictate-notes" type="button"
                            class="absolute bottom-3 right-3 text-slate-400 hover:text-primary transition-colors p-1.5 rounded-full hover:bg-white dark:hover:bg-gray-700 shadow-sm border border-transparent hover:border-gray-100 group"
                            title="Dictar notas">
                            <span class="material-symbols-outlined text-[20px] group-hover:scale-110">mic</span>
                        </button>
                    </div>
                </div>

                <!-- Actions -->
                <div class="flex gap-3 pt-2">
                    <button type="submit"
                        class="flex-1 bg-primary hover:bg-primary-dark text-white py-3 rounded-2xl font-bold shadow-lg shadow-primary/25 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2">
                        <span class="material-symbols-outlined">check</span>
                        <span id="btn-save-appt-text">Agendar Cita</span>
                    </button>
                    <button type="button" id="btn-delete-appt"
                        class="hidden bg-red-50 text-red-600 hover:bg-red-100 px-3 rounded-2xl font-bold transition-colors">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
            </form>
        </div>
    </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Bind internal close button
        const closeBtn = document.querySelector('#new-appointment-modal .close-modal-btn');
        if (closeBtn) {
            closeBtn.onclick = () => {
                document.getElementById('new-appointment-modal').classList.add('hidden');
            };
        }
    }

    bindEvents() {
        this.bindAppointmentFormEvents();
        this.bindDictationEvents();
    }

    bindAppointmentFormEvents() {
        const apptForm = document.getElementById('new-appointment-form');
        if (apptForm) {
            apptForm.onsubmit = (e) => {
                e.preventDefault();
                const pId = document.getElementById('new-appt-patient-id').value;
                const date = document.getElementById('new-appt-date').value;
                const time = document.getElementById('new-appt-time').value;
                const profId = document.getElementById('new-appt-prof').value;
                const notes = document.getElementById('appt-notes').value || '';

                if (!pId || !date || !time || !profId) {
                    ToastManager.showToast("Por favor completa todos los campos.", 'error');
                    return;
                }

                const startStr = `${date}T${time}:00`;
                const start = new Date(startStr);

                const patient = this.store.state.patients.find(p => String(p.id) === String(pId));
                const service = patient ? this.store.state.services.find(s => String(s.id) === String(patient.service)) : null;
                const duration = service ? service.duration : 45;
                const end = new Date(start.getTime() + duration * 60000);

                if (this.currentApptId) {
                    // UPDATE
                    (async () => {
                        if (await this.app.showConfirm("¿Confirmar actualización?", "¿Guardar los cambios de la cita?", "question")) {
                            const updates = {
                                patientId: pId,
                                professionalId: profId,
                                start: start.toISOString(),
                                end: end.toISOString(),
                                notes: notes
                            };
                            await this.store.updateAppointment(this.currentApptId, updates);
                            document.getElementById('new-appointment-modal').classList.add('hidden');
                            ToastManager.showToast("Cita actualizada correctamente", 'success');
                        }
                    })();
                } else {
                    // CREATE
                    (async () => {
                        const pNameLocal = document.getElementById('new-appt-patient-search').value;
                        const newAppt = {
                            id: generateId(),
                            patientId: pId,
                            patientName: pNameLocal || "Paciente",
                            professionalId: profId,
                            start: start.toISOString(),
                            end: end.toISOString(),
                            status: 'scheduled',
                            type: 'single',
                            serviceId: null,
                            notes: notes
                        };
                        await this.store.addAppointment(newAppt);
                        document.getElementById('new-appointment-modal').classList.add('hidden');
                        ToastManager.showToast("Cita agendada correctamente", 'success');
                    })();
                }
            };
        }
    }

    bindDictationEvents() {
        const btn = document.getElementById('btn-dictate-notes');
        const textarea = document.getElementById('appt-notes');

        if (btn && textarea) {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Access DictationService from App
                if (this.app.dictationService.isListening) {
                    this.app.dictationService.stop();
                    btn.classList.remove('text-red-500', 'animate-pulse');
                    btn.querySelector('span').innerText = 'mic';
                } else {
                    btn.classList.add('text-red-500', 'animate-pulse');
                    btn.querySelector('span').innerText = 'mic_off';

                    this.app.dictationService.start(
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

    populateModalProfessionalSelect() {
        const select = document.getElementById('new-appt-prof');
        if (!select) return;
        const profs = this.store.state.professionals || [];
        const currentUser = this.app.authService.currentUser;

        select.innerHTML = '';
        select.disabled = false;

        if (currentUser && currentUser.role === 'professional') {
            const me = profs.find(p => p.id === currentUser.id);
            if (me) {
                const opt = document.createElement('option');
                opt.value = me.id;
                opt.textContent = me.name;
                select.appendChild(opt);
            }
            select.value = currentUser.id;
        } else {
            profs.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                select.appendChild(opt);
            });

            // Use app.currentProfessionalId if strictly set, otherwise 0/all
            if (this.app.currentProfessionalId && this.app.currentProfessionalId !== 0) {
                select.value = this.app.currentProfessionalId;
            }
        }
    }

    openAppointmentModal(appt, defaults = null) {
        const modal = document.getElementById('new-appointment-modal');
        if (!modal) return;
        const form = document.getElementById('new-appointment-form');
        form.reset();
        this.currentApptId = null;

        const title = document.getElementById('appt-modal-title');
        title.innerText = "Nueva Cita";

        const btnText = document.getElementById('btn-save-appt-text');
        if (btnText) btnText.innerText = "Agendar";

        this.populateModalProfessionalSelect();

        const deleteBtn = document.getElementById('btn-delete-appt');
        if (deleteBtn) deleteBtn.classList.add('hidden');

        if (defaults) {
            const startD = new Date(defaults.start);
            const dateInput = document.getElementById('new-appt-date');
            const timeInput = document.getElementById('new-appt-time');

            if (dateInput) dateInput.value = startD.toISOString().split('T')[0];
            if (timeInput) timeInput.value = startD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const patientInput = document.getElementById('new-appt-patient-id');

            if (patientInput && defaults.patientId) patientInput.value = defaults.patientId;
            const profInput = document.getElementById('new-appt-prof');
            if (profInput && defaults.professionalId) profInput.value = defaults.professionalId;
        }
        modal.classList.remove('hidden');
    }

    openAppointmentDetails(appt) {
        const modal = document.getElementById('new-appointment-modal');
        const form = document.getElementById('new-appointment-form');
        if (!modal || !form) return;

        form.reset();
        this.currentApptId = appt.id;

        const title = document.getElementById('appt-modal-title');
        if (title) title.innerText = "Editar Cita";

        const btnText = document.getElementById('btn-save-appt-text');
        if (btnText) btnText.innerText = "Actualizar Cita";

        this.populateModalProfessionalSelect();

        const inputs = {
            'new-appt-patient-id': appt.patientId,
            'new-appt-prof': appt.professionalId,
            'appt-notes': appt.notes || '',
            'new-appt-date': appt.start.split('T')[0],
            'new-appt-time': new Date(appt.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        for (const [id, val] of Object.entries(inputs)) {
            const el = document.getElementById(id);
            if (el) el.value = val;
        }

        const pSearch = document.getElementById('new-appt-patient-search');
        if (pSearch) pSearch.value = appt.patientName;

        modal.classList.remove('hidden');

        const deleteBtn = document.getElementById('btn-delete-appt');
        if (deleteBtn) {
            deleteBtn.classList.remove('hidden');
            deleteBtn.onclick = () => {
                const choiceModal = document.getElementById('cancellation-choice-modal');
                if (choiceModal) {
                    choiceModal.classList.remove('hidden');
                    const btnSingle = document.getElementById('btn-cancel-single');

                    if (btnSingle) btnSingle.onclick = () => this.app.handleAdvancedCancellation('single', appt.id, appt.patientId);
                    const btnRec = document.getElementById('btn-cancel-recurring');
                    if (btnRec) btnRec.onclick = () => this.app.handleAdvancedCancellation('treatment', appt.id, appt.patientId);
                    const btnClose = document.getElementById('btn-cancel-choice-close');
                    if (btnClose) btnClose.onclick = () => choiceModal.classList.add('hidden');
                }
            };
        }
    }
}
