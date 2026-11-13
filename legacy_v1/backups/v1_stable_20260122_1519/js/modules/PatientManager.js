
import { ToastManager } from './ToastManager.js';

export class PatientManager {
    constructor(app, store) {
        this.app = app; // Reference to main App for shared state/methods if needed
        this.store = store;
        this.editingPatientId = null;
        this.currentProfilePatientId = null;
        this.currentImportFile = null;
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
        const availFilter = document.getElementById('filter-availability');
        const serviceFilter = document.getElementById('filter-service');

        const triggerRender = () => {
            const text = searchInput ? searchInput.value : '';
            this.renderPatientView(text);
        };

        if (searchInput) searchInput.addEventListener('input', triggerRender);
        if (statusFilter) statusFilter.addEventListener('change', triggerRender);
        if (availFilter) availFilter.addEventListener('change', triggerRender);
        if (serviceFilter) serviceFilter.addEventListener('change', triggerRender);

        // Initial population
        this.populateServiceFilter();

        // Treatment Type Logic Binding
        const radios = document.querySelectorAll('input[name="treatmentType"]');
        radios.forEach(radio => {
            radio.addEventListener('change', () => this.toggleTreatmentType());
        });
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
        if (currentVal && (currentVal === 'all' || services.some(s => s.id == currentVal))) {
            select.value = currentVal;
        }
    }

    handlePatientFormSubmit(e) {
        e.preventDefault();
        const patientForm = e.target;
        const formData = new FormData(patientForm);
        const name = formData.get('name');
        if (!name) return;

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
            this.store.updatePatient(this.editingPatientId, {
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
                id: Date.now(),
                name, age, phone, phoneOwner, email, phone2, email2, tutorName, tutorRole, contactType,
                notes, service,
                treatmentPlan, sessionsPerWeek, preferredDuration,
                treatmentType, totalSessions, sessionsCompleted: 0,
                startDate: new Date().toISOString(),
                status: 'waiting',
                availability,
                notesHistory: notes ? [{
                    id: Date.now(),
                    date: new Date().toISOString(),
                    content: `Nota Inicial: ${notes}`,
                    author: 'Sistema'
                }] : [],
                files: []
            };
            this.store.addPatient(newPatient);
            ToastManager.showToast(`Paciente ${name} creado.`, "success");
            const modal = document.getElementById('patient-modal');
            if (modal) modal.classList.add('hidden');
        }

        this.renderPatientView(); // Refresh list to show changes
    }

    renderPatientView(filterText = '') {
        const container = document.getElementById('patient-list-container');
        if (!container) return;

        // Ensure filters are populated if empty (edge case: navigating directly)
        const serviceSelect = document.getElementById('filter-service');
        if (serviceSelect && serviceSelect.options.length <= 1 && this.store.state.services.length > 0) {
            this.populateServiceFilter();
        }

        const statusFilter = document.getElementById('filter-status')?.value || 'all';
        const availFilter = document.getElementById('filter-availability')?.value || 'all';
        const serviceFilter = document.getElementById('filter-service')?.value || 'all'; // New

        const patientsList = this.store.state.patients || [];

        if (!patientsList.length) {
            container.innerHTML = '<div class="p-8 text-center text-slate-500">Cargando datos...</div>';
            return;
        }

        const filtered = patientsList.filter(p => {
            // Resolve Service Name for Search
            const matchesText = p.name.toLowerCase().includes(filterText.toLowerCase()) ||
                (p.tutor && p.tutor.toLowerCase().includes(filterText.toLowerCase()));

            let matchesStatus = true;
            if (statusFilter !== 'all') matchesStatus = (p.status === statusFilter);

            let matchesAvail = true;
            if (availFilter !== 'all') {
                if (Array.isArray(p.availability) && p.availability.length > 0) {
                    const isMorning = p.availability.some(slot => parseInt(slot.start.split(':')[0]) < 14);
                    const isAfternoon = p.availability.some(slot => parseInt(slot.start.split(':')[0]) >= 14);
                    if (availFilter === 'morning') matchesAvail = isMorning;
                    if (availFilter === 'afternoon') matchesAvail = isAfternoon;
                } else {
                    matchesAvail = false;
                }
            }

            let matchesService = true;
            if (serviceFilter !== 'all') {
                // Loosely compare to handle string/number ID mismatch or names
                matchesService = (p.service == serviceFilter || p.service === serviceFilter);
            }

            return matchesText && matchesStatus && matchesAvail && matchesService;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="p-12 text-center text-slate-500">
                    <span class="material-symbols-outlined text-4xl mb-2 opacity-50">search_off</span>
                    <p>No se encontraron pacientes.</p>
                </div>`;
            return;
        }

        const rows = filtered.map(p => {
            const statusColors = {
                'active': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                'waiting': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                'archived': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
            };
            const statusLabels = { 'active': 'Activo', 'waiting': 'En Espera', 'archived': 'Archivado' };

            // Resolve Service Name
            let serviceName = 'General';
            if (p.service) {
                // p.service might be "1000" (string) or 1000 (number) or a legacy name
                const sObj = this.store.state.services.find(s => s.id == p.service || s.name === p.service);
                if (sObj) serviceName = sObj.name;
                else if (typeof p.service === 'string' && isNaN(p.service)) serviceName = p.service;
            }

            const serviceColors = {
                'Logopedia': 'bg-blue-50 text-blue-700 border-blue-100',
                'Fisioterapia': 'bg-emerald-50 text-emerald-700 border-emerald-100',
                'Psicología': 'bg-purple-50 text-purple-700 border-purple-100',
                'Neuropsicología': 'bg-teal-50 text-teal-700 border-teal-100'
            };
            // Approximate color match for custom services
            let sColorClass = 'bg-slate-100 text-slate-600 border-slate-200';
            if (serviceName.includes('Logo')) sColorClass = serviceColors['Logopedia'];
            else if (serviceName.includes('Fisio')) sColorClass = serviceColors['Fisioterapia'];
            else if (serviceName.includes('Psic')) sColorClass = serviceColors['Psicología'];
            else if (serviceName.includes('Neuro')) sColorClass = serviceColors['Neuropsicología'];

            return `
            <tr onclick="window.app.patientManager.editPatient(${p.id});" data-patient-id="${p.id}"
                class="group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0 border-l-4 border-l-transparent hover:border-l-primary">
                <td class="p-4 pl-6">
                    <div class="flex items-center gap-3">
                        <div class="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                            ${p.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                            <p class="font-bold text-slate-900 dark:text-white">${p.name}</p>
                            <p class="text-xs text-slate-400">${p.age} años · ${p.tutor || 'Sin tutor'}</p>
                        </div>
                    </div>
                </td>
                <td class="p-4">
                    <div class="text-sm text-slate-600 dark:text-gray-300">
                        <div class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[14px] opacity-70">call</span> ${p.phone}</div>
                        <div class="flex items-center gap-1.5 mt-0.5"><span class="material-symbols-outlined text-[14px] opacity-70">mail</span> ${p.email}</div>
                    </div>
                </td>
                <td class="p-4">
                    <!-- Service Column (New) -->
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${sColorClass}">
                        ${serviceName}
                    </span>
                    <div class="text-[10px] text-slate-400 mt-1">${p.treatmentPlan || ''}</div>
                </td>
                <td class="p-4">
                    <!-- Status Column (Separate) -->
                     <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status] || statusColors['active']}">
                        ${statusLabels[p.status] || 'Activo'}
                    </span>
                     ${p.pendingReassignments && p.pendingReassignments.length > 0 ?
                    `<span class="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-100" title="Debe sesión">
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
                    <button onclick="event.stopPropagation(); window.app.patientManager.showPatientProfile(window.clinicStore.state.patients.find(p => p.id === ${p.id}), 'history');" class="text-slate-400 hover:text-primary transition-colors p-1" title="Ver Historial"><span class="material-symbols-outlined">receipt_long</span></button>
                    <!-- Edit triggers the main panel now, so we can keep the row click or specific button. Row click is set to editPatient. -->
                </td>
            </tr>`;
        }).join('');

        container.innerHTML = `
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
                ${rows}
            </tbody>
        </table>`;
    }

    showPatientProfile(patient, initialTab = 'history') {
        const modal = document.getElementById('patient-profile-modal');
        if (!modal) return;

        this.currentProfilePatientId = patient.id;

        document.getElementById('profile-name').innerText = patient.name;
        document.getElementById('profile-avatar').innerText = patient.name.split(' ').map(n => n[0]).slice(0, 2).join('');
        document.getElementById('profile-age').innerText = `${patient.age} años`;
        document.getElementById('profile-phone').innerHTML = patient.phone + (patient.phoneOwner && patient.phoneOwner !== 'Propio' ? ` <span class="text-[10px] text-slate-400 font-normal">(${patient.phoneOwner})</span>` : '');
        document.getElementById('profile-email').innerText = patient.email;

        const roleBadge = patient.tutorRole
            ? `<span class="ml-1 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide border border-slate-200 dark:border-slate-600">${patient.tutorRole}</span>`
            : '';
        document.getElementById('profile-tutor').innerHTML = `${patient.tutorName || patient.tutor || 'No registrado'} ${roleBadge}`;

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
                        <div class="flex items-start gap-2 text-xs bg-red-50 dark:bg-red-900/10 p-2 rounded border border-red-100 dark:border-red-900/30">
                            <span class="material-symbols-outlined text-[16px] text-red-500">remove_circle</span>
                            <div>
                                <p class="font-bold text-red-600 dark:text-red-400">Reasignación Pendiente</p>
                                <p class="text-slate-500 dark:text-gray-400">Canceló el ${new Date(item.date).toLocaleDateString()}. <br>Sustituido por: ${item.substitutedBy}</p>
                            </div>
                        </div>`;
                });
            }
            if (patient.extraSessions && patient.extraSessions.length > 0) {
                patient.extraSessions.forEach(item => {
                    html += `
                        <div class="flex items-start gap-2 text-xs bg-green-50 dark:bg-green-900/10 p-2 rounded border border-green-100 dark:border-green-900/30">
                            <span class="material-symbols-outlined text-[16px] text-green-500">add_circle</span>
                            <div>
                                <p class="font-bold text-green-600 dark:text-green-400">Sesión Extra Realizada</p>
                                <p class="text-slate-500 dark:text-gray-400">Fecha: ${new Date(item.date).toLocaleDateString()}. <br>Cubrió a: ${item.coveredFor}</p>
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
                <div class="text-center p-8 text-slate-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
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
                <div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
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
                                · Prof. ${appt.professionalName || 'Logopeda'}
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
            <div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded capitalize">
                         ${new Date(note.date).toLocaleDateString()}
                    </span>
                    <span class="text-xs text-slate-400">${note.author || 'Logopeda'}</span>
                </div>
                <p class="text-sm text-slate-600 dark:text-gray-300 leading-relaxed">${note.content}</p>
            </div>`).join('');
    }

    addPatientNote() {
        const input = document.getElementById('new-note-input');
        const content = input.value.trim();
        if (!content || !this.currentProfilePatientId) return;

        const patient = this.store.state.patients.find(p => p.id === this.currentProfilePatientId);
        if (patient) {
            if (!patient.notesHistory) patient.notesHistory = [];
            patient.notesHistory.push({
                id: Date.now(),
                date: new Date().toISOString(),
                content: content,
                author: 'Yo'
            });
            this.store.save();
            this.renderPatientNotes(patient);
            input.value = '';
        }
    }

    renderPatientFiles(patient) {
        const container = document.getElementById('profile-files-grid');
        if (!patient.files || patient.files.length === 0) {
            container.innerHTML = `<p class="col-span-3 text-sm text-slate-400 text-center italic py-4">No hay archivos adjuntos.</p>`;
            return;
        }
        container.innerHTML = patient.files.map(file => `
            <div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-3 group hover:border-primary transition-colors cursor-pointer">
                <div class="flex items-start justify-between">
                     <div class="size-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center">
                        <span class="material-symbols-outlined">description</span>
                     </div>
                     <button class="text-slate-300 hover:text-slate-500"><span class="material-symbols-outlined">more_vert</span></button>
                </div>
                <div>
                    <p class="font-bold text-sm text-slate-700 dark:text-gray-200 truncate" title="${file.name}">${file.name}</p>
                    <p class="text-[10px] text-slate-400 mt-1">${file.size} · ${new Date(file.date).toLocaleDateString()}</p>
                </div>
            </div>`).join('');
    }

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
                delBtn.onclick = () => {
                    if (confirm(`¿Estás seguro de que quieres eliminar a ${patient.name}?`)) {
                        this.store.deletePatient(id);
                        this.renderPatientView();
                        modal.classList.add('hidden');
                        ToastManager.showToast('Paciente eliminado', 'success');
                    }
                };
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
            <button type="button" onclick="this.parentElement.remove()" class="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
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
                        <button type="button" onclick="window.app.patientManager.addSlot(${i})" disabled
                            class="slot-btn size-7 rounded bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors disabled:opacity-0">
                            <span class="material-symbols-outlined text-[16px]">add</span>
                        </button>
                    </div>`;
            }
            if (cb) {
                cb.checked = false;
                cb.onchange = () => this.toggleDay(cb);
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
                cb.onchange = () => this.toggleDay(cb);
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
                            btnHtml = `<button type="button" onclick="window.app.patientManager.addSlot(${i})" class="slot-btn size-7 rounded bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors"><span class="material-symbols-outlined text-[16px]">add</span></button>`;
                        } else {
                            btnHtml = `<button type="button" onclick="this.parentElement.remove()" class="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><span class="material-symbols-outlined text-[16px]">close</span></button>`;
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
                            <button type="button" onclick="window.app.patientManager.addSlot(${i})" disabled class="slot-btn size-7 rounded bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors disabled:opacity-0"><span class="material-symbols-outlined text-[16px]">add</span></button>
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
}
