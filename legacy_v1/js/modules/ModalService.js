import { ToastManager } from './ToastManager.js';
import { escapeHtml } from './DateUtils.js';

export class ModalService {
    constructor(app, store) {
        this.app = app;
        this.store = store;
        this.bindGlobalModalEvents();
    }

    bindGlobalModalEvents() {
        // Overlay Click Close
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.add('hidden');
            });
        });
        // Close Buttons
        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.onclick = () => {
                const modal = btn.closest('.modal-overlay');
                if (modal) modal.classList.add('hidden');
            };
        });
    }

    showConfirm(title, message, type = 'info', confirmText = null) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            if (!modal) {
                resolve(confirm(`${title}\n${message}`));
                return;
            }

            const titleEl = document.getElementById('confirm-modal-title');
            const msgEl = document.getElementById('confirm-modal-message');
            const btnConfirm = document.getElementById('confirm-modal-ok');
            const btnCancel = document.getElementById('confirm-modal-cancel');
            const iconEl = document.getElementById('confirm-modal-icon');

            if (titleEl) titleEl.innerText = title;
            if (msgEl) msgEl.textContent = message;

            if (iconEl) {
                if (type === 'danger') {
                    iconEl.innerText = 'warning';
                    iconEl.className = 'material-symbols-outlined text-4xl text-red-500 mb-2';
                    btnConfirm.className = 'bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-bold transition-colors';
                    btnConfirm.innerText = confirmText || "Eliminar";
                } else if (type === 'warning') {
                    iconEl.innerText = 'error';
                    iconEl.className = 'material-symbols-outlined text-4xl text-orange-500 mb-2';
                    btnConfirm.className = 'bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-bold transition-colors';
                    btnConfirm.innerText = confirmText || "Continuar";
                } else {
                    iconEl.innerText = 'info';
                    iconEl.className = 'material-symbols-outlined text-4xl text-blue-500 mb-2';
                    btnConfirm.className = 'bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-xl font-bold transition-colors';
                    btnConfirm.innerText = confirmText || "Aceptar";
                }
            }

            // Clean legacy listeners
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

    showConflictModal(msgHtml, onConfirm) {
        const modal = document.getElementById('warning-modal');
        if (!modal) return;

        const warningMsg = document.getElementById('warning-message');
        if (warningMsg) warningMsg.innerHTML = msgHtml;
        document.getElementById('warning-title').innerText = "Conflicto de Disponibilidad";

        const btnConfirm = document.getElementById('warning-confirm-btn');
        const btnCancel = document.getElementById('warning-cancel-btn');

        const newBtnConfirm = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);

        newBtnConfirm.onclick = () => {
            onConfirm();
            modal.classList.add('hidden');
        };

        const newBtnCancel = btnCancel.cloneNode(true);
        btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

        newBtnCancel.onclick = () => modal.classList.add('hidden');

        modal.classList.remove('hidden');
    }

    async handleAdvancedCancellation(mode, apptId, patientId) {
        const choiceModal = document.getElementById('cancellation-choice-modal');
        const detailsModal = document.getElementById('new-appointment-modal');

        if (mode === 'single') {
            if (await this.showConfirm('Confirmar Cancelación', '¿Cancelar solo esta cita?', 'warning')) {
                await this.store.deleteAppointment(apptId);
                ToastManager.showToast('Cita cancelada', 'success');
            }
        } else if (mode === 'treatment') {
            if (await this.showConfirm('⚠️ Cancelar Tratamiento', 'Esto cancelará TODAS las citas futuras y archivará al paciente. ¿Continuar?', 'danger')) {
                this.store.startBatch();
                await this.store.deleteAppointment(apptId);
                const now = new Date();
                const futureAppts = this.store.state.appointments.filter(a =>
                    a.patientId === patientId &&
                    new Date(a.start) > now
                );
                // Use Promise.all for parallel deletes if store supports it, or sequential. 
                // store.deleteAppointment is async.
                for (const a of futureAppts) {
                    await this.store.deleteAppointment(a.id);
                }
                await this.store.updatePatient(patientId, { status: 'archived' });
                await this.store.endBatch();
                ToastManager.showToast(`Tratamiento finalizado. ${futureAppts.length + 1} citas eliminadas.`, 'info');
            }
        }

        if (choiceModal) choiceModal.classList.add('hidden');
        if (detailsModal) detailsModal.classList.add('hidden');
        this.app.render(this.store.state);
    }
}
