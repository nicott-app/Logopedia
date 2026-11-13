import { ToastManager } from './ToastManager.js';
import { DateUtils, escapeHtml, generateId } from './DateUtils.js';

export class RoomManager {
    constructor(app, store, clinicService) {
        this.app = app;
        this.store = store;
        this.clinicService = clinicService;
        this.editingRoomId = null;
        this.viewMode = 'week'; // 'week' or 'day'
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

        const grid = document.getElementById('rooms-dashboard');
        if (grid) {
            grid.addEventListener('click', (e) => {
                const btnEdit = e.target.closest('.action-edit-room');
                const btnAvail = e.target.closest('.action-view-avail');
                const card = e.target.closest('.room-card');

                if (btnEdit && card && card.dataset.id) {
                    const room = this.store.getRoom(card.dataset.id);
                    if (room) this.openEditRoomModal(room);
                } else if (btnAvail && card && card.dataset.id) {
                    this.openAvailabilityModal(card.dataset.id);
                }
            });
        }

        // Room Date Label Wrapper - Ensure click opens picker
        const dateWrapper = document.getElementById('rooms-date-label')?.parentElement;
        const datePicker = document.getElementById('rooms-date-picker');
        if (dateWrapper && datePicker) {
            dateWrapper.onclick = () => {
                try {
                    datePicker.showPicker(); // Modern API
                } catch (e) {
                    datePicker.click(); // Fallback
                    datePicker.focus();
                }
            };
        }

        // Resources Inputs
        const resInput = document.getElementById('room-resources-input');
        if (resInput) {
            resInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addResource();
                }
            };
        }
        const addResBtn = document.getElementById('btn-add-resource');
        if (addResBtn) addResBtn.onclick = () => this.addResource();
        const btnCreate = document.getElementById('btn-create-room');
        if (btnCreate) btnCreate.onclick = () => this.openCreateRoomModal();

        const btnPrev = document.getElementById('btn-rooms-prev');
        if (btnPrev) btnPrev.onclick = () => this.navigate(-1);

        const btnNext = document.getElementById('btn-rooms-next');
        if (btnNext) btnNext.onclick = () => this.navigate(1);

        const btnWeek = document.getElementById('btn-rooms-week');
        if (btnWeek) btnWeek.onclick = () => this.setViewMode('week');

        const btnDay = document.getElementById('btn-rooms-day');
        if (btnDay) btnDay.onclick = () => this.setViewMode('day');

        const btnCloseCreate = document.getElementById('btn-close-create-room');
        if (btnCloseCreate) btnCloseCreate.onclick = () => document.getElementById('create-room-modal').classList.add('hidden');

        const closeAvail = document.getElementById('btn-close-room-availability');
        if (closeAvail) closeAvail.onclick = () => document.getElementById('room-availability-modal').classList.add('hidden');
    }

    // --- NAVIGATION LOGIC ---

    setViewMode(mode) {
        this.viewMode = mode;
        this.updateViewModeButtons();
        this.renderRoomsView();
    }

    updateViewModeButtons() {
        const btnWeek = document.getElementById('btn-rooms-week');
        const btnDay = document.getElementById('btn-rooms-day');
        if (!btnWeek || !btnDay) return;

        const activeClass = "px-3 py-1 text-xs font-bold rounded-md bg-white dark:bg-gray-700 shadow-sm text-indigo-600 transition-all";
        const inactiveClass = "px-3 py-1 text-xs font-bold rounded-md text-slate-500 hover:bg-white/50 dark:hover:bg-gray-700/50 transition-all";

        btnWeek.className = this.viewMode === 'week' ? activeClass : inactiveClass;
        btnDay.className = this.viewMode === 'day' ? activeClass : inactiveClass;
    }

    navigate(direction) {
        // direction is 1 or -1
        const days = this.viewMode === 'week' ? 7 : 1;
        this.app.navigateDate(direction * days);
    }

    handleDatePick(dateStr) {
        if (!dateStr) return;
        const newDate = new Date(dateStr);
        // Correct timezone offset issue if naive
        // newDate.setMinutes(newDate.getMinutes() + newDate.getTimezoneOffset()); 
        // Better: Set to noon to avoid midnight rollover
        newDate.setHours(12, 0, 0, 0);

        if (this.viewMode === 'week') {
            // Find Monday
            const day = newDate.getDay() || 7;
            newDate.setDate(newDate.getDate() - day + 1);
        }

        this.app.currentWeekStart = newDate;
        localStorage.setItem('clinicCurrentDate', newDate.toISOString());
        this.app.render(this.store.state);
    }

    // --- RENDER LOGIC ---

    renderRoomsView() {
        const container = document.getElementById('rooms-dashboard');
        if (!container) return;

        this.updateViewModeButtons();

        try {
            // 1. Update Date Label & Picker
            const dateLabel = document.getElementById('rooms-date-label');
            const datePicker = document.getElementById('rooms-date-picker');

            const start = this.app.currentWeekStart; // App state is always a date object
            // If viewMode is DAY, 'start' acts as 'current day' (though variable name is legacy)
            // Actually App.js 'currentWeekStart' logic enforces Monday if we rely purely on it?
            // Let's assume App.js state IS the pivot date.

            let labelText = '';
            let filterStart, filterEnd;

            if (this.viewMode === 'week') {
                // Ensure start is Monday (just in case App state drifted)
                const d = new Date(start);
                const day = d.getDay() || 7;
                if (day !== 1) d.setDate(d.getDate() - day + 1);

                filterStart = new Date(d);
                filterStart.setHours(0, 0, 0, 0);

                filterEnd = new Date(filterStart);
                filterEnd.setDate(filterEnd.getDate() + 6);
                filterEnd.setHours(23, 59, 59, 999);

                const sStr = filterStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                const eStr = filterEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                labelText = `${sStr} - ${eStr}`;

                // Sync picker to start date
                if (datePicker) datePicker.value = filterStart.toISOString().split('T')[0];
            } else {
                // Day Mode
                filterStart = new Date(start);
                filterStart.setHours(0, 0, 0, 0);

                filterEnd = new Date(filterStart);
                filterEnd.setHours(23, 59, 59, 999);

                labelText = filterStart.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                if (datePicker) datePicker.value = filterStart.toISOString().split('T')[0];
            }

            if (dateLabel) dateLabel.innerText = labelText;

            // 2. Render Rooms
            const rooms = this.store.state.rooms || [];
            const countBadge = document.getElementById('rooms-count-badge');
            if (countBadge) countBadge.innerText = rooms.length;

            if (rooms.length === 0) {
                container.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400">No hay salas configuradas.</div>`;
                return;
            }

            container.innerHTML = rooms.map(room => {
                // Filter Appointments
                const roomAppts = this.store.state.appointments.filter(a => {
                    const aDate = new Date(a.start);
                    return a.roomId === room.id &&
                        aDate >= filterStart && aDate <= filterEnd &&
                        a.status !== 'cancelled';
                });

                // Status Calculation (for Day Mode mostly)
                let statusBadge = '';
                if (this.viewMode === 'day') {
                    // Check if currently occupied?
                    const now = new Date();
                    const isToday = filterStart.toDateString() === now.toDateString();

                    if (isToday) {
                        const currentAppt = roomAppts.find(a => {
                            return new Date(a.start) <= now && new Date(a.end) > now;
                        });
                        if (currentAppt) {
                            statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">Ocupada</span>`;
                        } else {
                            statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-600">Libre</span>`;
                        }
                    }
                }

                const labelStat = this.viewMode === 'week' ? 'Semanal' : 'Día';

                const resourcesHtml = (room.resources || []).slice(0, 3).map(r =>
                    `<span class="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-gray-300 font-bold">${escapeHtml(r)}</span>`
                ).join('');

                return `
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-md relative group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 room-card" data-id="${room.id}">
                <div class="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" class="text-slate-300 hover:text-primary p-2 rounded-full bg-slate-50 dark:bg-slate-700 hover:bg-white shadow-sm action-edit-room">
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button type="button" class="text-slate-300 hover:text-green-500 p-2 rounded-full bg-slate-50 dark:bg-slate-700 hover:bg-white shadow-sm action-view-avail" title="Ver Disponibilidad">
                        <span class="material-symbols-outlined text-[18px]">calendar_month</span>
                    </button>
                </div>

                <div class="flex items-center gap-4 mb-4">
                    <div class="size-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-md">
                        <span class="material-symbols-outlined text-2xl">meeting_room</span>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="font-bold text-lg text-slate-800 dark:text-gray-100">${escapeHtml(room.name)}</h3>
                            ${statusBadge}
                        </div>
                        <p class="text-xs text-slate-500 capitalize">${room.type === 'gym' ? 'Gimnasio' : (room.type === 'office' ? 'Despacho' : 'Sala Estándar')}</p>
                    </div>
                </div>

                <div class="space-y-3">
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-slate-500 flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">group</span> Capacidad</span>
                        <span class="font-bold text-slate-700 dark:text-gray-200">${room.capacity || 1} personas</span>
                    </div>
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-slate-500 flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">event</span> ${labelStat}</span>
                        <span class="font-bold text-indigo-600">${roomAppts.length} citas</span>
                    </div>
                </div>

                <div class="mt-4 flex flex-wrap gap-1">
                    ${resourcesHtml}
                    ${(room.resources || []).length > 3 ? `<span class="text-[10px] px-2 py-1 rounded-lg bg-slate-50 text-slate-400">+${room.resources.length - 3}</span>` : ''}
                </div>
            </div>`;
            }).join('');
        } catch (err) {
            console.error("Rooms Render Error:", err);
            container.innerHTML = '<div class="col-span-full p-8 text-center text-red-500">Error al renderizar salas.</div>';
        }
    }

    // ... (Keep existing Modal methods: openCreateRoomModal, openEditRoomModal, handleRoomSubmit, deleteRoomFromModal, addResource, openAvailabilityModal, etc.)
    // For brevity in rewrite/restore, assuming they are preserved or I need to re-output them. 
    // Since I'm doing a full overwrite, I MUST include them.

    openCreateRoomModal() { this.openEditRoomModal(null); }

    openEditRoomModal(room) {
        const modal = document.getElementById('create-room-modal');
        const form = document.getElementById('create-room-form');
        if (!modal || !form) return;

        const title = document.getElementById('room-modal-title');
        const btn = document.getElementById('btn-save-room-modal');
        const resContainer = document.getElementById('room-resources-list');

        const addResChip = (text) => {
            const chip = document.createElement('div');
            chip.className = 'flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-gray-300 group';
            chip.innerHTML = `<span>${escapeHtml(text)}</span><input type="hidden" name="resources" value="${escapeHtml(text)}"><button type="button" class="text-slate-400 hover:text-red-500"><span class="material-symbols-outlined text-[14px]">close</span></button>`;
            chip.querySelector('button').onclick = () => chip.remove();
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
            if (deleteBtn) { deleteBtn.classList.remove('hidden'); deleteBtn.onclick = () => this.deleteRoomFromModal(); }
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

    async handleRoomSubmit(e) {
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
            await this.store.updateRoom(this.editingRoomId, roomData);
            ToastManager.showToast(`Sala ${roomData.name} actualizada.`, "success");
        } else {
            const newRoom = { ...roomData, id: generateId() };
            await this.store.addRoom(newRoom);
            ToastManager.showToast(`Sala ${roomData.name} creada.`, "success");
        }
        document.getElementById('create-room-modal').classList.add('hidden');
        this.renderRoomsView();
    }

    async deleteRoomFromModal() {
        if (!this.editingRoomId) return;
        if (await this.app.showConfirm("¿Eliminar esta sala?", "Se desvinculará de las citas existentes.", "danger")) {
            await this.clinicService.deleteRoom(this.editingRoomId);
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
        if (container.querySelector('span.italic')) container.innerHTML = '';
        const chip = document.createElement('div');
        chip.className = 'flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-gray-300 group';
        chip.innerHTML = `<span>${escapeHtml(val)}</span><input type="hidden" name="resources" value="${escapeHtml(val)}"><button type="button" class="text-slate-400 hover:text-red-500"><span class="material-symbols-outlined text-[14px]">close</span></button>`;
        chip.querySelector('button').onclick = () => chip.remove();
        container.appendChild(chip);
        input.value = '';
    }

    openAvailabilityModal(roomId) {
        const modal = document.getElementById('room-availability-modal');
        if (!modal) return;
        const room = this.store.getRoom(roomId);
        if (!room) return;
        document.getElementById('avail-modal-title').innerText = `Agenda: ${room.name}`;
        const container = document.getElementById('avail-slots-grid');
        if (container) {
            const appts = this.store.state.appointments.filter(a =>
                String(a.roomId) === String(roomId) && a.status !== 'cancelled' && new Date(a.end) > new Date()
            ).sort((a, b) => new Date(a.start) - new Date(b.start));

            if (appts.length === 0) {
                container.innerHTML = `<div class="text-center py-8 text-slate-400"><span class="material-symbols-outlined text-4xl mb-2 opacity-50">event_busy</span><p class="text-sm">No hay citas programadas próximamente en esta sala.</p></div>`;
            } else {
                container.innerHTML = `<h4 class="text-xs font-bold text-slate-500 uppercase mb-3">Próximas Citas</h4>` + appts.map(a => {
                    const date = new Date(a.start);
                    const dateStr = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
                    const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    const endStr = new Date(a.end).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    return `<div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
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
                }).join('');
            }
        }
        modal.classList.remove('hidden');
    }
}
