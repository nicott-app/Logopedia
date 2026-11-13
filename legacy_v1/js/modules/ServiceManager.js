
import { ToastManager } from './ToastManager.js';
import { escapeHtml, generateId } from './DateUtils.js';

export class ServiceManager {
    constructor(app, store, clinicService) {
        this.app = app;
        this.store = store;
        this.clinicService = clinicService;
        this.editingServiceId = null;
    }

    render() {
        this.renderServicesView();
    }

    bindEvents() {
        const form = document.getElementById('service-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleServiceSubmit(e));
        }

        const grid = document.getElementById('services-grid');
        if (grid) {
            grid.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.action-edit-service');
                if (editBtn) {
                    const card = editBtn.closest('.service-card');
                    if (card && card.dataset.id) {
                        this.openEditServiceModal(card.dataset.id);
                    }
                }
            });
        }
        const btnCreate = document.getElementById('btn-create-service');
        if (btnCreate) btnCreate.onclick = () => this.openServiceModal();

        const btnClose = document.getElementById('btn-close-service-modal');
        if (btnClose) btnClose.onclick = () => document.getElementById('service-modal').classList.add('hidden');

        [30, 45, 60].forEach(dur => {
            const btn = document.getElementById(`btn-service-dur-${dur}`);
            if (btn) btn.onclick = () => this.setServiceDuration(dur);
        });
    }

    renderServicesView() {
        const container = document.getElementById('services-grid');
        const emptyState = document.getElementById('services-empty');
        if (!container) return; // Not in view

        try {
            const services = this.store.state.services || [];

            if (services.length === 0) {
                container.innerHTML = '';
                if (emptyState) emptyState.classList.remove('hidden');
                return;
            }

            if (emptyState) emptyState.classList.add('hidden');

            container.innerHTML = services.map(s => {
                const colorClass = this.app.colorPalette[s.color || 'blue'] || this.app.colorPalette['blue'];
                const icon = s.name.toLowerCase().includes('logo') ? 'record_voice_over' :
                    s.name.toLowerCase().includes('fisio') ? 'accessibility_new' :
                        s.name.toLowerCase().includes('psi') ? 'psychology' : 'medical_services';

                return `
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-md relative group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 service-card" data-id="${s.id}">
                <div class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" class="text-slate-300 hover:text-primary p-2 rounded-full bg-slate-50 dark:bg-slate-700 hover:bg-white shadow-sm action-edit-service">
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                </div>

                <div class="flex flex-col items-center mb-4">
                    <div class="size-16 rounded-2xl ${colorClass.bg} ${colorClass.text} flex items-center justify-center mb-3 shadow-md">
                        <span class="material-symbols-outlined text-3xl">${icon}</span>
                    </div>
                    <h3 class="font-bold text-lg text-slate-800 dark:text-gray-100 text-center">${escapeHtml(s.name)}</h3>
                </div>

                <div class="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4">
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-slate-500">Duración</span>
                        <span class="font-bold text-slate-700 dark:text-gray-300">${s.duration} min</span>
                    </div>
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-slate-500">Precio</span>
                        <span class="font-bold text-slate-700 dark:text-gray-300">${s.price || 0}€</span>
                    </div>
                </div>
            </div>`;
            }).join('');
        } catch (err) {
            console.error("Services Render Error:", err);
            container.innerHTML = '<div class="col-span-full p-8 text-center text-red-500">Error al renderizar servicios.</div>';
        }
    }

    openServiceModal() {
        this.openEditServiceModal(null);
    }

    openEditServiceModal(serviceId) {
        const modal = document.getElementById('service-modal');
        const form = document.getElementById('service-form');
        if (!modal || !form) return;

        form.reset();
        const title = document.getElementById('service-modal-title');
        const deleteBtn = document.getElementById('btn-delete-service');
        const nameInput = document.getElementById('service-name-input');
        const durationInput = document.getElementById('service-duration-input');
        const priceInput = document.getElementById('service-price-input');
        const descInput = document.getElementById('service-description-input');

        const saveBtn = document.getElementById('btn-save-service-confirm');
        const saveBtnText = document.getElementById('btn-save-service-text');

        // Populate
        if (serviceId) {
            this.editingServiceId = serviceId;
            // Strict ID check might fail if types mismatched, so assume loose for find, or cast
            const s = this.store.state.services.find(ser => String(ser.id) === String(serviceId));
            if (!s) return;

            if (title) title.innerText = "Editar Servicio";
            if (saveBtnText) saveBtnText.innerText = "Guardar cambios";
            else if (saveBtn) saveBtn.innerHTML = `<span class="material-symbols-outlined text-sm">check</span><span>Guardar cambios</span>`;

            if (nameInput) nameInput.value = s.name;
            if (durationInput) durationInput.value = s.duration;
            if (priceInput) priceInput.value = s.price;
            if (descInput) descInput.value = s.description || '';

            if (deleteBtn) {
                deleteBtn.classList.remove('hidden');
                // Ensure delete uses the instance method
                deleteBtn.onclick = () => this.deleteService();
            }
        } else {
            this.editingServiceId = null;
            if (title) title.innerText = "Nuevo Servicio";
            if (saveBtnText) saveBtnText.innerText = "Crear servicio";
            else if (saveBtn) saveBtn.innerHTML = `<span class="material-symbols-outlined text-sm">add</span><span>Crear servicio</span>`;

            if (deleteBtn) deleteBtn.classList.add('hidden');
        }

        modal.classList.remove('hidden');
        if (modal.classList.contains('opacity-0')) modal.classList.remove('opacity-0');
    }

    closeServiceModal() {
        const modal = document.getElementById('service-modal');
        if (modal) modal.classList.add('hidden');
    }

    setServiceDuration(mins) {
        const input = document.getElementById('service-duration-input');
        if (input) input.value = mins;
    }

    saveService() {
        // Direct call to avoid event listener issues
        this.submitServiceForm();
    }

    async submitServiceForm(e) {
        if (e) e.preventDefault();

        const nameInput = document.getElementById('service-name-input');
        const priceInput = document.getElementById('service-price-input');

        // Reset
        if (nameInput) nameInput.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
        if (priceInput) priceInput.classList.remove('border-red-500', 'ring-2', 'ring-red-200');

        if (!nameInput || !nameInput.value.trim()) {
            if (nameInput) nameInput.classList.add('border-red-500', 'ring-2', 'ring-red-200');
            import('./ToastManager.js').then(m => m.ToastManager.showToast("El nombre del servicio es obligatorio", "error"));
            return;
        }

        const name = nameInput.value;
        const duration = parseInt(document.getElementById('service-duration-input').value) || 0;

        const price = parseFloat(priceInput.value);

        if (isNaN(price)) {
            if (priceInput) priceInput.classList.add('border-red-500', 'ring-2', 'ring-red-200');
            import('./ToastManager.js').then(m => m.ToastManager.showToast("El precio no es válido", "error"));
            return;
        }
        const description = document.getElementById('service-description-input').value;

        const data = {
            name,
            duration,
            price,
            description,
            color: 'blue'
        };

        // Color logic
        if (name.toLowerCase().includes('fisio')) data.color = 'green';
        else if (name.toLowerCase().includes('psico')) data.color = 'purple';
        else if (name.toLowerCase().includes('neuro')) data.color = 'teal';

        if (this.editingServiceId != null) {
            // EDIT
            // VITAL: Cast ID to Number to ensure store match
            const id = Number(this.editingServiceId);

            await this.store.updateService(id, data);
            import('./ToastManager.js').then(m => m.ToastManager.showToast("Servicio actualizado.", "success"));
        } else {
            // CREATE
            data.id = generateId();

            await this.store.addService(data);
            import('./ToastManager.js').then(m => m.ToastManager.showToast("Servicio creado.", "success"));
        }

        this.closeServiceModal();
        // Force re-render just in case store notify is missed
        this.renderServicesView();
    }

    // Kept for binder compatibility
    handleServiceSubmit(e) {
        this.submitServiceForm(e);
    }

    async deleteService() {
        if (!this.editingServiceId) return;
        if (await this.app.showConfirm("¿Eliminar este servicio?", "Esta acción no se puede deshacer.", "danger")) {
            const id = this.editingServiceId; // Already string/ID.
            // Ensure we use the service layer
            await this.clinicService.deleteService(id);
            this.closeServiceModal();
            this.renderServicesView();
            import('./ToastManager.js').then(m => m.ToastManager.showToast("Servicio eliminado.", "success"));
        }
    }

    populatePatientServiceSelect() {
        const select = document.getElementById('patient-service-select');
        if (!select) return;

        const services = this.store.state.services || [];
        select.innerHTML = '<option value="">Seleccionar Servicio...</option>';

        services.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.name} (${s.duration || 45} min)`;
            select.appendChild(opt);
        });
        select.onchange = () => this.updateTreatmentOptions();
    }

    updateTreatmentOptions() {
        const serviceSelect = document.getElementById('patient-service-select');
        const planSelect = document.getElementById('patient-plan-select');
        if (!serviceSelect || !planSelect) return;

        const serviceId = serviceSelect.value;
        const service = this.store.state.services.find(s => String(s.id) === String(serviceId));

        planSelect.innerHTML = '';
        if (service) {
            const d = service.duration || 45;
            const opt = document.createElement('option');
            opt.value = `1x${d}`;
            opt.textContent = `1 sesión/sem (${d} min)`; // Simplified logic
            planSelect.appendChild(opt);
        }
    }
}
