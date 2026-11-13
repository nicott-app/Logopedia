import { ToastManager } from './ToastManager.js';
import { DateUtils } from './DateUtils.js';

export class RoomManager {
    constructor(app, store) {
        this.app = app;
        this.store = store;
        this.editingRoomId = null;
    }

    render() {
        this.renderRoomsView();
    }

    bindEvents() {
        // Room Form
        const roomForm = document.getElementById('create-room-form');
        if (roomForm) {
            roomForm.addEventListener('submit', (e) => this.handleRoomSubmit(e));
        }

        // Room Resources Input (Enter key)
        const resInput = document.getElementById('room-resources-input');
        if (resInput) {
            resInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addResource();
                }
            };
        }

        // Room Resources Button (Click)
        const addResBtn = document.getElementById('btn-add-resource');
        if (addResBtn) {
            addResBtn.onclick = () => {
                this.addResource();
            };
        }
    }

    renderRoomsView() {
        const container = document.getElementById('rooms-dashboard');
        if (!container) return;

        const rooms = this.store.state.rooms || [];

        if (rooms.length === 0) {
            container.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400">No hay salas configuradas.</div>`;
            return;
        }

        container.innerHTML = rooms.map(room => {
            // Calculate Availability Overview (Mock or Real?)
            // We can check today's appointments for this room.
            const today = new Date(); // Or view date
            const roomAppts = this.store.state.appointments.filter(a => {
                const aDate = new Date(a.start);
                return a.roomId === room.id &&
                    aDate.toDateString() === today.toDateString() &&
                    a.status !== 'cancelled';
            });

            // Simple capacity check logic could go here

            const resourcesHtml = (room.resources || []).slice(0, 3).map(r =>
                `<span class="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-gray-300 font-bold">${r}</span>`
            ).join('');

            return `
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-md relative group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div class="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="window.app.roomManager.openEditRoomModal(window.clinicStore.getRoom(${room.id}))" class="text-slate-300 hover:text-primary p-2 rounded-full bg-slate-50 dark:bg-slate-700 hover:bg-white shadow-sm">
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onclick="window.app.roomManager.openAvailabilityModal(${room.id})" class="text-slate-300 hover:text-green-500 p-2 rounded-full bg-slate-50 dark:bg-slate-700 hover:bg-white shadow-sm" title="Ver Disponibilidad">
                        <span class="material-symbols-outlined text-[18px]">calendar_month</span>
                    </button>
                </div>

                <div class="flex items-center gap-4 mb-4">
                    <div class="size-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-md">
                        <span class="material-symbols-outlined text-2xl">meeting_room</span>
                    </div>
                    <div>
                        <h3 class="font-bold text-lg text-slate-800 dark:text-gray-100">${room.name}</h3>
                        <p class="text-xs text-slate-500 capitalize">${room.type === 'gym' ? 'Gimnasio' : (room.type === 'office' ? 'Despacho' : 'Sala Estándar')}</p>
                    </div>
                </div>

                <div class="space-y-3">
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-slate-500 flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">group</span> Capacidad</span>
                        <span class="font-bold text-slate-700 dark:text-gray-200">${room.capacity || 1} personas</span>
                    </div>
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-slate-500 flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">event</span> Hoy</span>
                        <span class="font-bold text-indigo-600">${roomAppts.length} citas</span>
                    </div>
                </div>

                <div class="mt-4 flex flex-wrap gap-1">
                    ${resourcesHtml}
                    ${(room.resources || []).length > 3 ? `<span class="text-[10px] px-2 py-1 rounded-lg bg-slate-50 text-slate-400">+${room.resources.length - 3}</span>` : ''}
                </div>
            </div>`;
        }).join('');
    }

    openCreateRoomModal() {
        this.openEditRoomModal(null);
    }

    openEditRoomModal(room) {
        const modal = document.getElementById('create-room-modal');
        const form = document.getElementById('create-room-form');
        if (!modal || !form) return;

        const title = document.getElementById('room-modal-title');
        const btn = document.getElementById('btn-save-room-modal');
        const resContainer = document.getElementById('room-resources-list');

        // Helper for chips
        const addResChip = (text) => {
            const chip = document.createElement('div');
            chip.className = 'flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-gray-300 group';
            chip.innerHTML = `
                 <span>${text}</span>
                 <input type="hidden" name="resources" value="${text}">
                 <button type="button" onclick="this.parentElement.remove()" class="text-slate-400 hover:text-red-500"><span class="material-symbols-outlined text-[14px]">close</span></button>
             `;
            resContainer.appendChild(chip);
        };

        if (room) {
            this.editingRoomId = room.id;
            title.innerText = "Editar Sala";
            btn.innerHTML = `<span class="material-symbols-outlined text-sm">check</span><span>Guardar Cambios</span>`;

            document.getElementById('room-name').value = room.name;
            document.getElementById('room-type').value = room.type;
            document.getElementById('room-capacity').value = room.capacity;

            resContainer.innerHTML = '';
            (room.resources || []).forEach(r => addResChip(r));

            const deleteBtn = document.getElementById('btn-delete-room');
            if (deleteBtn) {
                deleteBtn.classList.remove('hidden');
                deleteBtn.onclick = () => this.deleteRoomFromModal();
            }

        } else {
            this.editingRoomId = null;
            title.innerText = "Nueva Sala";
            btn.innerHTML = `<span class="material-symbols-outlined text-sm">add</span><span>Crear Sala</span>`;
            form.reset();
            resContainer.innerHTML = '<span class="text-xs text-slate-400 italic">Ningún recurso añadido.</span>';

            const deleteBtn = document.getElementById('btn-delete-room');
            if (deleteBtn) deleteBtn.classList.add('hidden');
        }

        modal.classList.remove('hidden');
    }

    handleRoomSubmit(e) {
        e.preventDefault();
        const fd = new FormData(e.target);

        const resources = [];
        const resInputs = document.querySelectorAll('input[name="resources"]');
        resInputs.forEach(i => resources.push(i.value));

        const roomData = {
            name: fd.get('name'),
            type: fd.get('type'),
            capacity: parseInt(fd.get('capacity')) || 1,
            resources: resources
        };

        if (this.editingRoomId) {
            this.store.updateRoom(this.editingRoomId, roomData);
            ToastManager.showToast(`Sala ${roomData.name} actualizada.`, "success");
        } else {
            const newRoom = { ...roomData, id: Date.now() };
            this.store.addRoom(newRoom);
            ToastManager.showToast(`Sala ${roomData.name} creada.`, "success");
        }

        document.getElementById('create-room-modal').classList.add('hidden');
        this.renderRoomsView();
    }

    async deleteRoomFromModal() {
        if (!this.editingRoomId) return;
        if (await window.app.showConfirm("¿Eliminar esta sala?", "Se desvinculará de las citas existentes.", "danger")) {
            this.store.deleteRoom(this.editingRoomId);
            document.getElementById('create-room-modal').classList.add('hidden');
            ToastManager.showToast("Sala eliminada.", "success");
            this.renderRoomsView();
        }
    }

    addResource() {
        const input = document.getElementById('room-resources-input');
        const container = document.getElementById('room-resources-list');
        const val = input.value.trim();
        if (!val) return;

        // Clear placeholder if any
        if (container.querySelector('span.italic')) container.innerHTML = '';

        const chip = document.createElement('div');
        chip.className = 'flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-gray-300 group';
        chip.innerHTML = `
            <span>${val}</span>
            <input type="hidden" name="resources" value="${val}">
            <button type="button" onclick="this.parentElement.remove()" class="text-slate-400 hover:text-red-500"><span class="material-symbols-outlined text-[14px]">close</span></button>
        `;
        container.appendChild(chip);
        input.value = '';
    }

    // Helper used by other modules, now instance method
    populateRoomSelect() {
        // Can target multiple selects if needed, or specific IDs
        // For now, let's target the generic ones found in modals.
        // Specifically: 'professional-room-select' is one used in AddProf modal (single select legacy)
        // And 'room-multiselect' is used in AddProf modal.
        // Actually ProfessionalManager handles its own room population for its modal.
        // This might be redundant or used by generic utils.
    }

    openAvailabilityModal(roomId) {
        const modal = document.getElementById('room-availability-modal');
        if (!modal) return;

        const room = this.store.getRoom(roomId);
        if (!room) return;

        document.getElementById('avail-modal-title').innerText = `Agenda: ${room.name}`;

        const container = document.getElementById('avail-slots-grid');
        if (container) {
            // Get appointments for this room (future & active)
            const appts = this.store.state.appointments.filter(a =>
                a.roomId == roomId &&
                a.status !== 'cancelled' &&
                new Date(a.end) > new Date() // Future only
            ).sort((a, b) => new Date(a.start) - new Date(b.start));

            if (appts.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-8 text-slate-400">
                        <span class="material-symbols-outlined text-4xl mb-2 opacity-50">event_busy</span>
                        <p class="text-sm">No hay citas programadas próximamente en esta sala.</p>
                    </div>`;
            } else {
                container.innerHTML = `
                    <h4 class="text-xs font-bold text-slate-500 uppercase mb-3">Próximas Citas</h4>
                    ${appts.map(a => {
                    const date = new Date(a.start);
                    const dateStr = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
                    const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    const endStr = new Date(a.end).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                    return `
                        <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div class="flex-col flex items-center justify-center w-12 h-12 bg-white dark:bg-gray-700 rounded-lg shadow-sm text-center">
                                <span class="text-[10px] uppercase font-bold text-red-500">${dateStr.split(' ')[0].substring(0, 3)}</span>
                                <span class="text-lg font-bold text-slate-700 dark:text-white leading-none">${date.getDate()}</span>
                            </div>
                            <div class="flex-1">
                                <p class="font-bold text-slate-800 dark:text-white text-sm">${a.patientName}</p>
                                <p class="text-xs text-slate-500">${a.professionalName} • ${a.service}</p>
                            </div>
                            <div class="text-right">
                                <p class="font-bold text-primary text-sm">${timeStr}</p>
                                <p class="text-xs text-slate-400">${endStr}</p>
                            </div>
                        </div>`;
                }).join('')}
                `;
            }
        }

        modal.classList.remove('hidden');
    }

    toggleRoomServiceDropdown() {
        const dropdown = document.getElementById('room-service-multiselect-dropdown');
        if (dropdown) dropdown.classList.toggle('hidden');

        // Populate if empty?
        if (dropdown && dropdown.children.length === 0) {
            const services = window.clinicStore.state.services || [];
            dropdown.innerHTML = services.map(s => `
                <label class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" value="${s.id}" checked class="rounded border-gray-300 text-primary focus:ring-primary" onchange="window.app.roomManager.updateRoomServiceLabel()">
                    <span class="text-sm font-medium text-slate-700 dark:text-gray-300">${s.name}</span>
                </label>
            `).join('');
        }
    }

    updateRoomServiceLabel() {
        // Logic to update label text
        const container = document.getElementById('room-service-multiselect-dropdown');
        const label = document.getElementById('room-service-multiselect-label');
        if (!container || !label) return;

        const checked = container.querySelectorAll('input:checked');
        if (checked.length === 0) label.innerText = "Selecciona usos...";
        else if (checked.length === 1) label.innerText = `${checked.length} servicio`;
        else label.innerText = `${checked.length} servicios`;
    }
}
