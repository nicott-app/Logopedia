import { ToastManager } from './ToastManager.js';

export class ProfessionalManager {
    constructor(app, store) {
        this.app = app;
        this.store = store;
        this.editingProfessionalId = null;
    }

    bindEvents() {
        const addProfForm = document.getElementById('add-professional-form');
        if (addProfForm) {
            addProfForm.addEventListener('submit', (e) => this.handleProfessionalSubmit(e));
        }
    }

    renderProfessionalsView(filter = 'all') {
        const container = document.getElementById('professionals-grid');
        if (!container) return;

        let profs = this.store.state.professionals;

        if (profs.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-12">No hay profesionales registrados.</div>';
            return;
        }

        container.innerHTML = profs.map(p => {
            const serviceNames = (p.services || []).map(sid => this.store.getServiceName(sid));
            const roomNames = (p.rooms || []).map(rid => this.store.getRoomName(rid));

            return `
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-md relative group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <button onclick="window.app.professionalManager.openEditProfessionalModal(window.clinicStore.state.professionals.find(pr => pr.id === ${p.id}))" 
                    class="absolute top-4 right-4 text-slate-300 hover:text-primary transition-colors p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700">
                    <span class="material-symbols-outlined text-[20px]">edit</span>
                </button>

                <div class="flex flex-col items-center">
                    <div class="size-20 rounded-full ${this.app.colorPalette[p.color || 'blue'].bg} flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg shadow-${p.color}-500/30 ring-4 ring-white dark:ring-gray-700">
                        ${p.name.charAt(0)}
                    </div>
                    
                    <h3 class="font-bold text-lg text-slate-800 dark:text-gray-100 mb-1">${p.name}</h3>
                    <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">${serviceNames.join(', ') || 'Sin especialidad'}</p>

                    <div class="w-full flex flex-col gap-2">
                         <div class="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                            <span class="material-symbols-outlined text-[16px]">meeting_room</span>
                            <span class="truncate">${roomNames.length > 0 ? roomNames.join(', ') : 'Sin sala asignada'}</span>
                         </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    openEditProfessionalModal(prof) {
        this.prepareProfessionalModal(prof);
    }

    openAddProfessionalModal() {
        this.prepareProfessionalModal(null);
    }

    prepareProfessionalModal(prof) {
        const modal = document.getElementById('add-professional-modal');
        if (!modal) return;
        const form = document.getElementById('add-professional-form');
        if (form) form.reset();

        this.populateColorSelect();
        this.populateRoomMultiselect();
        this.populateServiceSelect();

        const title = modal.querySelector('h3');
        const saveBtn = document.getElementById('btn-save-prof-modal-v2');
        const deleteBtn = document.getElementById('btn-delete-prof');

        if (prof) {
            // EDIT MODE
            this.editingProfessionalId = prof.id;
            if (title) title.innerText = "Editar Profesional";
            if (saveBtn) saveBtn.innerHTML = `<span class="material-symbols-outlined text-sm">check</span><span>Guardar cambios</span>`;

            const nameInput = document.getElementById('add-prof-name');
            if (nameInput) nameInput.value = prof.name;

            // Schedule Prefill
            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
            if (prof.schedule) {
                setVal('prof-sched-start', prof.schedule.start);
                setVal('prof-sched-end', prof.schedule.end);
                setVal('prof-lunch-start', prof.schedule.lunchStart);
                setVal('prof-lunch-end', prof.schedule.lunchEnd);
            } else {
                setVal('prof-sched-start', '');
                setVal('prof-sched-end', '');
                setVal('prof-lunch-start', '');
                setVal('prof-lunch-end', '');
            }

            const serviceInput = document.getElementById('add-prof-service');
            if (serviceInput) serviceInput.value = (prof.services && prof.services.length > 0) ? prof.services[0] : '';

            // Rooms Multiselect Prefill
            if (prof.rooms && prof.rooms.length > 0) {
                prof.rooms.forEach(roomId => {
                    const cb = document.querySelector(`#room-multiselect-dropdown input[value="${roomId}"]`);
                    if (cb) cb.checked = true;
                });
                this.updateRoomServiceLabel(document.getElementById('room-multiselect-label'), prof.rooms.length, 'Salas');
            }

            // Set Color
            const colorInput = document.getElementById('input-prof-color');
            if (colorInput) colorInput.value = prof.color;
            document.querySelectorAll('.color-swatch-btn').forEach(btn => {
                if (btn.dataset.color === prof.color) btn.classList.add('ring-2', 'ring-offset-2', 'ring-slate-400');
                else btn.classList.remove('ring-2', 'ring-offset-2', 'ring-slate-400');
            });

            if (deleteBtn) {
                deleteBtn.classList.remove('hidden');
                deleteBtn.onclick = async () => {
                    if (await window.app.showConfirm("Eliminar Profesional", `¿Seguro que quieres eliminar a ${prof.name}?`, "danger")) {
                        this.store.removeProfessional(prof.id);
                        ToastManager.showToast(`Profesional ${prof.name} eliminado.`, "success");
                        modal.classList.add('hidden');
                        this.renderProfessionalsView();
                        if (this.app.renderProfessionalFilters) this.app.renderProfessionalFilters(this.store.state);
                    }
                };
            }

        } else {
            // CREATE MODE
            this.editingProfessionalId = null;
            if (title) title.innerText = "Nuevo Profesional";
            if (saveBtn) saveBtn.innerHTML = `<span class="material-symbols-outlined text-sm">add</span><span>Crear profesional</span>`;

            const deleteBtn = document.getElementById('btn-delete-prof');
            if (deleteBtn) deleteBtn.classList.add('hidden');

            const colorInput = document.getElementById('input-prof-color');
            if (colorInput) colorInput.value = 'blue';

            document.querySelectorAll('.color-swatch-btn').forEach(btn => btn.classList.remove('ring-2', 'ring-offset-2', 'ring-slate-400'));
            this.updateRoomServiceLabel(document.getElementById('room-multiselect-label'), 0, 'Salas');

            // Clear Schedule
            ['prof-sched-start', 'prof-sched-end', 'prof-lunch-start', 'prof-lunch-end'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        }

        modal.classList.remove('hidden');
    }

    handleProfessionalSubmit(e) {
        e.preventDefault();
        e.stopImmediatePropagation();

        const fd = new FormData(e.target);
        const name = fd.get('name');
        const color = fd.get('color');
        const service = fd.get('service');

        const selectedRooms = [];
        const checkboxes = document.querySelectorAll('#room-multiselect-dropdown .room-checkbox:checked');
        checkboxes.forEach(cb => selectedRooms.push(cb.value));

        const getVal = (name) => fd.get(name) || null; // Return null if empty strings

        const profData = {
            name: name,
            color: color,
            services: service ? service.split(',').map(s => Number(s.trim())) : [],
            rooms: selectedRooms.map(Number),
            status: 'active',
            schedule: {
                start: getVal('scheduleStart'),
                end: getVal('scheduleEnd'),
                lunchStart: getVal('lunchStart'),
                lunchEnd: getVal('lunchEnd')
            }
        };

        const editingProfId = this.editingProfessionalId;

        if (editingProfId) {
            this.store.updateProfessional(editingProfId, profData);
            ToastManager.showToast(`Profesional ${name} actualizado.`, "success");
        } else {
            this.store.addProfessional(profData);
            ToastManager.showToast(`Profesional ${name} añadido.`, "success");
        }

        document.getElementById('add-professional-modal').classList.add('hidden');
        this.renderProfessionalsView();
        // Refresh filters in App
        if (this.app.renderProfessionalFilters) this.app.renderProfessionalFilters(this.store.state);
    }

    populateColorSelect() {
        const grid = document.getElementById('color-picker-grid');
        const input = document.getElementById('input-prof-color');
        if (!grid || !input) return;

        grid.innerHTML = '';
        Object.entries(this.app.colorPalette).forEach(([key, val]) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `color-swatch-btn size-8 rounded-full ${val.bg} hover:scale-110 transition-transform focus:outline-none`;
            btn.dataset.color = key;

            btn.onclick = () => {
                input.value = key;
                document.querySelectorAll('.color-swatch-btn').forEach(b => b.classList.remove('ring-2', 'ring-offset-2', 'ring-slate-400'));
                btn.classList.add('ring-2', 'ring-offset-2', 'ring-slate-400');
            };
            grid.appendChild(btn);
        });
    }

    populateRoomMultiselect() {
        const list = document.getElementById('room-multiselect-dropdown');
        if (!list) return;

        // Move to body for floating behavior
        if (list.parentElement !== document.body) {
            document.body.appendChild(list);
            list.style.position = 'fixed';
            list.style.zIndex = '9999';
            list.style.width = 'auto';
            list.style.maxHeight = '300px';
            list.style.overflowY = 'auto';
        }

        const rooms = this.store.state.rooms || [];
        list.innerHTML = rooms.map(r => `
            <label class="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded">
                <input type="checkbox" value="${r.id}" class="room-checkbox form-checkbox h-4 w-4 text-primary rounded border-gray-300">
                <span class="ml-2 text-sm text-slate-700 dark:text-gray-200">${r.name}</span>
            </label>
         `).join('');

        const label = document.getElementById('room-multiselect-label');
        const trigger = document.getElementById('room-multiselect-trigger');

        if (trigger) {
            trigger.onclick = (e) => {
                e.stopPropagation();

                if (!list.classList.contains('hidden')) {
                    list.classList.add('hidden');
                    return;
                }

                // Position dynamically
                const rect = trigger.getBoundingClientRect();
                list.style.top = `${rect.bottom + 5}px`;
                list.style.left = `${rect.left}px`;
                list.style.width = `${rect.width}px`;

                list.classList.remove('hidden');

                // Close on outside click
                const closeFn = (evt) => {
                    if (!list.contains(evt.target) && evt.target !== trigger) {
                        list.classList.add('hidden');
                        document.removeEventListener('click', closeFn);
                    }
                };
                document.addEventListener('click', closeFn);
            };
        }

        list.querySelectorAll('input').forEach(input => {
            input.onchange = () => {
                const count = list.querySelectorAll('input:checked').length;
                this.updateRoomServiceLabel(label, count, 'Salas');
            }
        });
    }

    populateServiceSelect() {
        const select = document.getElementById('add-prof-service');
        if (!select) return;
        select.innerHTML = '';

        const services = this.store.state.services || [];
        const defaultOpt = document.createElement('option');
        defaultOpt.value = "";
        defaultOpt.textContent = "Selecciona especialidad...";
        select.appendChild(defaultOpt);

        services.forEach(svc => {
            const opt = document.createElement('option');
            opt.value = svc.id;
            opt.textContent = svc.name;
            select.appendChild(opt);
        });
    }

    updateRoomServiceLabel(labelEl, count, typeStr) {
        if (!labelEl) return;
        if (count === 0) labelEl.innerText = `Seleccionar ${typeStr}...`;
        else if (count === 1) labelEl.innerText = `1 Seleccionado`;
        else labelEl.innerText = `${count} Seleccionados`;
    }
}
