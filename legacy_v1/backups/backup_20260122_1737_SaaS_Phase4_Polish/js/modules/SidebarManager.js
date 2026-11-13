
export class SidebarManager {
    constructor(app, store) {
        this.app = app;
        this.store = store;
        this.currentSidebarTab = 'waiting'; // 'waiting' or 'active'
        this.searchQuery = '';
    }

    init() {
        this.renderSidebar();
        this.bindEvents();
    }

    bindEvents() {
        // Tab Switching
        const btnWaiting = document.getElementById('sidebar-tab-waiting');
        const btnActive = document.getElementById('sidebar-tab-active');

        if (btnWaiting) btnWaiting.onclick = () => this.switchSidebarTab('waiting');
        if (btnActive) btnActive.onclick = () => this.switchSidebarTab('active');

        // Search Input (Unified: Name, Availability, Service)
        const searchInput = document.getElementById('sidebar-search-input');
        if (searchInput) {
            searchInput.oninput = (e) => {
                this.searchQuery = e.target.value;
                this.renderSidebar();
            };
        }
    }

    switchSidebarTab(tab) {
        this.currentSidebarTab = tab;
        const btnWaiting = document.getElementById('sidebar-tab-waiting');
        const btnActive = document.getElementById('sidebar-tab-active');

        // Update Visuals (Sidebar Style)
        const activeClass = "flex-1 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-gray-700 text-primary shadow-sm transition-all text-center";
        const inactiveClass = "flex-1 py-1.5 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all text-center";

        if (btnWaiting) btnWaiting.className = tab === 'waiting' ? activeClass : inactiveClass;
        if (btnActive) btnActive.className = tab === 'active' ? activeClass : inactiveClass;

        this.renderSidebar();
    }

    renderSidebar() {
        const listContainer = document.getElementById('sidebar-suggestions-list');
        const countEl = document.getElementById('sidebar-results-count');

        if (!listContainer) return;

        // 1. Data Source
        let patients = this.store.state.patients || [];

        // 2. Filter by Status (Tab)
        if (this.currentSidebarTab === 'waiting') {
            // Waiting: Not assigned to any professional (or explicit status 'waiting')
            patients = patients.filter(p => !p.assignedProfessionalId && p.status !== 'active');
        } else {
            // Active: Assigned to a professional OR explicit status 'active'
            patients = patients.filter(p => p.assignedProfessionalId || p.status === 'active');
        }

        // 3. Unified Search (Name, Availability, Service)
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            const services = this.store.state.services || [];

            // Helper to match Service
            const getServiceText = (p) => {
                if (!p.service) return '';
                const s = services.find(svc => svc.id == p.service);
                return s ? s.name.toLowerCase() : String(p.service).toLowerCase();
            };

            // Helper to match Availability (WYSIWYG: Match what is shown on the card)
            const getAvailabilityStrings = (p) => {
                if (!p.availability || !Array.isArray(p.availability)) return [];
                const dayNames = ['d', 'l', 'm', 'x', 'j', 'v', 's', 'd']; // 1=Mon
                return p.availability.map(slot => {
                    const d = dayNames[slot.day] || '';
                    // Format: "l 17:00"
                    return `${d} ${slot.start}`.toLowerCase();
                });
            };

            patients = patients.filter(p => {
                // 1. Name Match
                if (p.name.toLowerCase().includes(query)) return true;

                // 2. Service Match
                if (getServiceText(p).includes(query)) return true;

                // 3. Availability Match (Text based)
                const availStrings = getAvailabilityStrings(p);
                // Allow "L 17:00", "L17:00", "17:00"
                // Normalize query to remove extra spaces if user types "L  17"
                const normQuery = query.replace(/\s+/g, ' ').trim();
                const compressedQuery = query.replace(/\s+/g, ''); // "l17:00"

                return availStrings.some(str =>
                    str.includes(normQuery) ||
                    str.replace(/\s+/g, '').includes(compressedQuery)
                );
            });
        }

        // Update Count
        if (countEl) countEl.innerText = `RESULTADOS (${patients.length})`;

        // 4. Render
        listContainer.innerHTML = '';

        if (patients.length === 0) {
            listContainer.innerHTML = `<div class="p-8 text-center"><span class="material-symbols-outlined text-4xl text-slate-200 mb-2">search_off</span><p class="text-xs text-slate-400 italic">No se encontraron pacientes.</p></div>`;
        } else {
            try {
                const html = patients.map(p => this.createSidebarPatientCard(p)).join('');
                listContainer.innerHTML = html;

                // Re-bind Drag Events
                listContainer.querySelectorAll('.sidebar-patient-card').forEach(card => {
                    card.addEventListener('dragstart', (e) => this.handleDragStart(e));
                    card.addEventListener('dragend', (e) => this.handleDragEnd(e));
                });
            } catch (err) {
                console.error("Sidebar Render Error:", err);
                listContainer.innerHTML = `<div class="p-4 text-red-500 text-xs">Error visualizando pacientes: ${err.message}</div>`;
            }
        }
    }

    getServiceNameById(id) {
        if (!this.store.state.services) return null;
        const s = this.store.state.services.find(svc => svc.id == id);
        return s ? s.name : null;
    }

    createSidebarPatientCard(p) {
        return `
            <div class="sidebar-patient-card p-3 mb-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary hover:shadow-lg transition-all group relative"
                draggable="true" 
                data-id="${p.id}"
                onclick="window.app.patientManager.showPatientProfile(window.clinicStore.state.patients.find(pt => pt.id === ${p.id}))">
                
                <div class="flex items-start justify-between mb-1 gap-2">
                    <span class="font-bold text-slate-800 dark:text-gray-200 text-sm leading-tight line-clamp-2">${p.name}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded-lg font-bold max-w-[80px] truncate shrink-0 ${(() => {
                // Resolve Service & Color
                let sName = 'Gen';
                let sColor = 'gray';

                if (p.service) {
                    const s = this.store.state.services.find(i => i.id == p.service);
                    if (s) {
                        sName = s.name;
                        sColor = s.color || 'blue';
                    } else {
                        sName = p.service;
                    }
                }

                const colorMap = {
                    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                    green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
                    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
                    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
                    pink: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
                    teal: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
                    red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
                    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
                    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                };

                return colorMap[sColor] || colorMap['gray'];
            })()}">
                        ${(() => {
                if (p.service) {
                    const s = this.store.state.services.find(i => i.id == p.service);
                    return s ? s.name : p.service;
                }
                return 'Gen';
            })()}
                    </span>
                </div>
                
                <!-- Availability Slots -->
                <div class="flex flex-wrap gap-1 mb-1.5">
                    ${p.availability ? p.availability.map(slot => {
                const dayNames = ['D', 'L', 'M', 'X', 'J', 'V', 'S', 'D']; // 1=Mon, 2=Tue...
                const dayStr = dayNames[slot.day] || '';
                return `
                        <span class="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-600">
                            ${dayStr} ${slot.start}
                        </span>`;
            }).join('') : '<span class="text-[10px] text-slate-400 italic">Sin disponibilidad</span>'}
                </div>
                <div class="flex items-center justify-between text-xs text-slate-500">
                    <span>${p.treatmentPlan || '1x45'}</span>
                     ${p.pendingReassignments && p.pendingReassignments.length > 0
                ? `<span class="text-red-500 font-bold flex items-center gap-0.5"><span class="material-symbols-outlined text-[10px]">warning</span> ${p.pendingReassignments.length}</span>`
                : ''}
                </div>
            </div>
        `;
    }

    handleDragStart(e) {
        const id = e.currentTarget.dataset.id;
        e.dataTransfer.setData('text/plain', `PATIENT:${id}`);
        e.dataTransfer.effectAllowed = 'all';
        e.currentTarget.classList.add('opacity-50', 'scale-95');
    }

    handleDragEnd(e) {
        e.currentTarget.classList.remove('opacity-50', 'scale-95');
    }
}
