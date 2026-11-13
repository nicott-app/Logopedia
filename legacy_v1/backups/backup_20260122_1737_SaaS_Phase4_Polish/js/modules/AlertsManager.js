
export class AlertsManager {
    constructor(app) {
        this.app = app;
        this.currentAlertTab = 'debt'; // Default tab
    }

    getAlerts() {
        const alerts = [];
        const state = window.clinicStore.state;
        const now = new Date();

        // 1. DEBTS (Title: "X Sesión(es)", Desc: Name)
        state.patients.forEach(p => {
            if (p.pendingReassignments && p.pendingReassignments.length > 0) {
                alerts.push({
                    type: 'debt',
                    priority: 'high',
                    patient: p,
                    title: `${p.pendingReassignments.length} Sesión(es)`,
                    desc: p.name,
                    actionLabel: 'Buscar Hueco',
                    actionFn: () => {
                        alert(`Por favor, arrastra a ${p.name} desde la barra lateral a un hueco libre para saldar su deuda.`);
                    }
                });
            }
        });

        // 2. CRITICAL WAITS (Individual, Sorted by Days Desc, Title: "X días", Desc: Name)
        const waitAlerts = [];
        state.waitingList.forEach(p => {
            if (p.waitingSince) {
                const days = Math.floor((now - new Date(p.waitingSince)) / (1000 * 60 * 60 * 24));
                if (days > 30) {
                    waitAlerts.push({
                        type: 'wait',
                        priority: 'medium',
                        patient: p,
                        days: days, // for sorting
                        title: `${days} días`,
                        desc: p.name,
                        actionLabel: 'Priorizar',
                        actionFn: () => {
                            const msg = `Hola, seguimos buscando hueco para ${p.name}. Gracias por la paciencia.`;
                            window.open(`https://wa.me/${p.phone.replace(/\s/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                        }
                    });
                }
            }
        });
        // Sort by days descending
        waitAlerts.sort((a, b) => b.days - a.days);
        alerts.push(...waitAlerts);


        // 3. LOW RELIABILITY
        state.patients.filter(p => !p.isWaiting).forEach(p => {
            const history = state.appointments.filter(a => a.patientId === p.id && new Date(a.end) < now);
            const total = history.length;
            const cancelled = history.filter(a => a.status === 'cancelled').length;
            const score = total === 0 ? 100 : Math.round(((total - cancelled) / total) * 100);

            if (total > 3 && score < 80) {
                alerts.push({
                    type: 'risk',
                    priority: 'high',
                    patient: p,
                    title: `Riesgo Abandono: ${score}%`,
                    desc: `${p.name} ha cancelado ${cancelled} de ${total} sesiones.`,
                    actionLabel: 'Ver Ficha',
                    actionFn: () => { console.log("Ver ficha", p.id); }
                });
            }
        });

        // 4. GAP COUNT (Current Week: Mon-Fri)
        const curr = new Date();
        const day = curr.getDay() || 7;
        if (day !== 1) curr.setHours(-24 * (day - 1)); // adjust to Monday
        else curr.setHours(0, 0, 0, 0);

        const START_HOUR = 9;
        const END_HOUR = 21;

        for (let i = 0; i < 5; i++) {
            const iterDate = new Date(curr);
            iterDate.setDate(curr.getDate() + i);
            iterDate.setHours(0, 0, 0, 0);

            const dateStr = iterDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'numeric' });
            const isoDate = iterDate.toISOString().split('T')[0];

            const dailyAppts = state.appointments.filter(a => a.start.startsWith(isoDate) && a.status !== 'cancelled');

            const occupiedCount = dailyAppts.length;
            const capacity = END_HOUR - START_HOUR; // 12
            const freeCount = Math.max(0, capacity - occupiedCount);

            alerts.push({
                type: 'gap',
                priority: 'info',
                title: dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
                desc: `${freeCount} huecos disponibles`,
                actionLabel: 'Ver Agenda',
                actionFn: () => {
                    this.app.currentWeekStart = new Date(iterDate);
                    const d = this.app.currentWeekStart.getDay();
                    const diff = this.app.currentWeekStart.getDate() - d + (d === 0 ? -6 : 1);
                    this.app.currentWeekStart.setDate(diff);

                    this.app.renderCalendar(state);
                    document.getElementById('alerts-modal').style.display = 'none';
                }
            });
        }

        return alerts;
    }

    renderAlertsModal() {
        const list = document.getElementById('alerts-list');
        const modal = document.getElementById('alerts-modal');
        const badge = document.getElementById('nav-alerts-badge');

        const allAlerts = this.getAlerts();

        // Update Badge (Global count)
        if (badge) {
            if (allAlerts.length > 0) {
                badge.classList.remove('hidden');
                badge.innerText = allAlerts.length > 9 ? '9+' : allAlerts.length;
            } else {
                badge.classList.add('hidden');
            }
        }

        if (!list || !modal) return;
        if (modal.classList.contains('hidden')) return; // Don't render content if hidden, unless opening? 
        // Logic check: app.js called renderAlertsModal usually when opening OR refreshing.

        // Define Tabs (No Icons, No Emojis)
        const tabs = [
            { id: 'gap', label: 'Agenda' },
            { id: 'debt', label: 'Sesiones pendientes' },
            { id: 'wait', label: 'Esperas' },
            { id: 'risk', label: 'Riesgo' }
        ];

        // Filter Alerts
        const filteredAlerts = allAlerts.filter(a => a.type === this.currentAlertTab);

        // Render Tabs + Content
        let html = `
            <div class="mb-6 flex space-x-1 bg-gray-100 dark:bg-slate-700/50 p-1 rounded-xl overflow-x-auto no-scrollbar">
        `;

        tabs.forEach(t => {
            const active = this.currentAlertTab === t.id;
            const count = allAlerts.filter(a => a.type === t.id).length;
            const activeClass = active
                ? 'bg-white dark:bg-slate-600 text-primary shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700';

            // IMPORTANT: Using window.app.alertsManager reference
            html += `
                <button onclick="window.app.alertsManager.currentAlertTab = '${t.id}'; window.app.alertsManager.renderAlertsModal()"
                    class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeClass} whitespace-nowrap">
                    ${t.label}
                    <span class="ml-1 text-xs opacity-80 font-normal">(${count})</span>
                </button>
            `;
        });

        html += `</div>`;

        // Render List (Clean, No Icons)
        if (filteredAlerts.length === 0) {
            html += `
                <div class="flex flex-col items-center justify-center py-12 text-center">
                    <span class="material-symbols-outlined text-4xl text-slate-300 mb-3">check_circle</span>
                    <h3 class="text-base font-medium text-slate-900 dark:text-white">Todo en orden</h3>
                    <p class="text-slate-500 text-sm">No hay alertas en esta sección.</p>
                </div>
            `;
        } else {
            html += `<div class="space-y-3">` + filteredAlerts.map((alert, index) => {
                return `
                    <div class="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm transition-transform hover:scale-[1.01]">
                        <div class="flex-1 min-w-0">
                            <h4 class="text-base font-bold text-slate-800 dark:text-gray-100 leading-tight mb-1">${alert.title}</h4>
                            <p class="text-sm text-slate-500 dark:text-slate-400">${alert.desc}</p>
                        </div>
                        <button id="btn-alert-filtered-${index}" class="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors">
                            ${alert.actionLabel}
                        </button>
                    </div>
                `;
            }).join('') + `</div>`;
        }

        list.innerHTML = html;

        // Bind Actions (Scoped to filtered list)
        filteredAlerts.forEach((alert, index) => {
            const btn = document.getElementById(`btn-alert-filtered-${index}`);
            if (btn) {
                btn.onclick = () => {
                    if (alert.actionFn) alert.actionFn();
                };
            }
        });
    }

    openAlertsModal() {
        const modal = document.getElementById('alerts-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.renderAlertsModal();
        }
    }

    closeAlertsModal() {
        const modal = document.getElementById('alerts-modal');
        if (modal) modal.classList.add('hidden');
    }

    checkAlerts() {
        const allAlerts = this.getAlerts();
        const badge = document.getElementById('nav-alerts-badge');

        if (badge) {
            if (allAlerts.length > 0) {
                badge.classList.remove('hidden');
                badge.innerText = allAlerts.length > 9 ? '9+' : allAlerts.length;
            } else {
                badge.classList.add('hidden');
            }
        }
    }
}
