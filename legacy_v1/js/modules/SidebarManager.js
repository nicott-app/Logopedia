
import { escapeHtml } from './DateUtils.js';

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
        this.updateNavigation(); // Initial check
    }

    updateNavigation() {
        const user = this.app.authService.currentUser;
        const role = user ? (user.role || '').toLowerCase() : '';
        const isAdmin = role === 'admin';

        // Elements to toggle
        const servicesTab = document.querySelector('button[data-view="services-view"]');
        const settingsTab = document.querySelector('button[data-view="settings-view"]');

        // Toggle Visibility
        if (servicesTab) servicesTab.classList.toggle('hidden', !isAdmin);
        if (settingsTab) settingsTab.classList.toggle('hidden', !isAdmin);

        // If current view is forbidden, switch to calendar
        const activeView = document.querySelector('.view-section:not(.view-hidden)');
        if (activeView && !isAdmin) {
            const forbiddenIds = ['services-view', 'settings-view'];
            if (forbiddenIds.includes(activeView.id)) {
                this.app.router.navigateTo('calendar-view');
            }
        }
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

        // Mobile Sidebar Toggle
        const btnMobileMenu = document.getElementById('btn-mobile-menu');
        const overlay = document.getElementById('sidebar-overlay');

        if (btnMobileMenu) btnMobileMenu.onclick = () => this.toggleSidebar();

        // Right Sidebar Toggle
        const btnRightToggle = document.getElementById('btn-toggle-right-sidebar');
        if (btnRightToggle) btnRightToggle.onclick = () => this.toggleRightSidebar();

        if (overlay) overlay.onclick = () => {
            this.closeSidebar();
            this.closeRightSidebar();
        };

        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.innerWidth < 768) this.closeSidebar();
            });
        });

        // Logout
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.onclick = async () => {
                // ... (existing logout logic) ...
                const confirmed = await this.app.showConfirm(
                    "Cerrar Sesión",
                    "¿Estás seguro de que quieres cerrar la sesión actual?",
                    "danger",
                    "Cerrar Sesión"
                );

                if (confirmed) {
                    this.app.authService.logout();
                    window.location.reload();
                }
            };
        }

        // Sidebar List Delegation
        const listContainer = document.getElementById('sidebar-suggestions-list');
        if (listContainer) {
            listContainer.addEventListener('click', (e) => {
                const card = e.target.closest('[data-action="view-profile"]');
                if (card && card.dataset.id) {
                    const p = this.store.state.patients.find(pt => String(pt.id) === String(card.dataset.id));
                    if (p) this.app.patientManager.showPatientProfile(p);
                }
            });
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (!sidebar) return;

        // Check current transform state
        const isClosed = sidebar.classList.contains('-translate-x-full');
        if (isClosed) {
            this.openSidebar();
        } else {
            this.closeSidebar();
        }
    }

    toggleRightSidebar() {
        const rightSidebar = document.getElementById('right-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (!rightSidebar) return;

        const isClosed = rightSidebar.classList.contains('translate-x-full') || rightSidebar.classList.contains('hidden');
        if (isClosed) {
            this.openRightSidebar();
        } else {
            this.closeRightSidebar();
        }
    }

    openRightSidebar() {
        const rightSidebar = document.getElementById('right-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        // Mobile behavior
        if (rightSidebar) {
            rightSidebar.classList.remove('hidden');
            // Small delay to allow display:block to apply before transition
            requestAnimationFrame(() => rightSidebar.classList.remove('translate-x-full'));
        }
        if (overlay) overlay.classList.remove('hidden');
    }

    closeRightSidebar() {
        const rightSidebar = document.getElementById('right-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (rightSidebar) {
            rightSidebar.classList.add('translate-x-full');
            // Wait for transition to finish before hiding (optional, or just kept in DOM if managed by CSS)
            setTimeout(() => {
                // Only if window is small, otherwise keep flex
                if (window.innerWidth < 1024) rightSidebar.classList.add('hidden');
            }, 300);
        }
        // Only hide overlay if left sidebar is also closed
        const leftSidebar = document.getElementById('sidebar');
        if (leftSidebar && leftSidebar.classList.contains('-translate-x-full')) {
            if (overlay) overlay.classList.add('hidden');
        }
    }
    openSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('-translate-x-full');
        if (overlay) overlay.classList.remove('hidden');
    }

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.add('-translate-x-full');

        // Check if right sidebar is open before hiding overlay
        const rightSidebar = document.getElementById('right-sidebar');
        const rightClosed = !rightSidebar || rightSidebar.classList.contains('translate-x-full') || rightSidebar.classList.contains('hidden');

        if (rightClosed && overlay) overlay.classList.add('hidden');
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
        this.updateNavigation(); // Ensure links are correct based on role

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

            // Role Restriction
            const user = this.app.authService.currentUser;
            if (user && this.app.securityManager) {
                patients = patients.filter(p => this.app.securityManager.canAccessPatient(user, p));
            }
        }

        // 3. Unified Search (Name, Availability, Service)
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            const services = this.store.state.services || [];

            // Helper to match Service
            const getServiceText = (p) => {
                if (!p.service) return '';
                const s = services.find(svc => String(svc.id) === String(p.service));
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
                listContainer.innerHTML = `<div class="p-4 text-red-500 text-xs">Error visualizando pacientes: ${escapeHtml(err.message)}</div>`;
            }
        }
    }

    getServiceNameById(id) {
        if (!this.store.state.services) return null;
        const s = this.store.state.services.find(svc => String(svc.id) === String(id));
        return s ? s.name : null;
    }

    createSidebarPatientCard(p) {
        return `
            <div class="sidebar-patient-card p-3 mb-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary hover:shadow-lg transition-all group relative"
                draggable="true" 
                data-id="${p.id}"
                data-action="view-profile">
                
                <div class="flex items-start justify-between mb-1 gap-2">
                    <span class="font-bold text-slate-800 dark:text-gray-200 text-sm leading-tight line-clamp-2">${escapeHtml(p.name)}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded-lg font-bold max-w-[80px] truncate shrink-0 ${(() => {
                // ... color logic kept ...
                // Resolve Service & Color
                let sName = 'Gen';
                let sColor = 'gray';

                if (p.service) {
                    const s = this.store.state.services.find(i => String(i.id) === String(p.service));
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
                    const s = this.store.state.services.find(i => String(i.id) === String(p.service));
                    return s ? escapeHtml(s.name) : escapeHtml(p.service);
                }
                return 'Gen';
            })()}
                    </span>
                </div>
                
                <!-- Availability Slots -->
                <div class="flex flex-wrap gap-1 mb-1.5">
                    ${p.availability ? p.availability.map(slot => {
                const dayNames = ['D', 'L', 'M', 'X', 'J', 'V', 'S', 'D'];
                const dayStr = dayNames[slot.day] || '';
                return `<span class="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-600">
                            ${dayStr} ${slot.start}
                        </span>`;
            }).join('') : '<span class="text-[10px] text-slate-400 italic">Sin disponibilidad</span>'}
                </div>
                <div class="flex items-center justify-between text-xs text-slate-500">
                    <span>${escapeHtml(p.treatmentPlan || '1x45')}</span>
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
