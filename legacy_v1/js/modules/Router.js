export class Router {
    constructor(app, store) {
        this.app = app;
        this.store = store;
        this.viewMode = localStorage.getItem('clinicViewMode') || 'week';
    }

    init() {
        this.bindNavigationEvents();
        // Theme init
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }

    bindNavigationEvents() {
        // Nav Tabs Delegation (More Robust)
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.nav-item');
            if (btn) {

                // Prevent interfering with other logic if needed, 
                // but usually fine. SidebarManager handles mobile close.
                this.setActiveNav(btn);
                this.switchMainView(btn.dataset.view);
            }
        });

        // Date Nav
        const prevBtn = document.getElementById('prev-week-btn');
        const nextBtn = document.getElementById('next-week-btn');
        const todayBtn = document.getElementById('today-btn');

        if (prevBtn) prevBtn.onclick = () => this.navigateCalendar(-1);
        if (nextBtn) nextBtn.onclick = () => this.navigateCalendar(1);
        if (todayBtn) todayBtn.onclick = () => {
            this.app.currentWeekStart = this.app.calculateInitialWeekStart();
            this.app.render(this.store.state);
        };

        // View Mode Select
        const viewSelect = document.getElementById('view-mode-select');
        if (viewSelect) {
            viewSelect.value = this.viewMode;
            viewSelect.onchange = (e) => this.setViewMode(e.target.value);
        }

        // Year Select
        const yearSelect = document.getElementById('year-select');
        if (yearSelect) {
            yearSelect.onchange = (e) => this.handleYearChange(e.target.value);
        }

        // Theme Toggle
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            themeBtn.onclick = () => {
                document.documentElement.classList.toggle('dark');
                localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
            };
        }
    }

    setActiveNav(targetBtn) {
        document.querySelectorAll('.nav-item').forEach(b => {
            b.classList.remove('bg-indigo-50', 'text-primary', 'dark:bg-indigo-900/20');
            b.classList.add('text-slate-500', 'hover:bg-slate-50', 'dark:text-slate-400');
            const icon = b.querySelector('.material-symbols-outlined');
            if (icon) icon.classList.remove('text-primary');
        });
        targetBtn.classList.add('bg-indigo-50', 'text-primary', 'dark:bg-indigo-900/20');
        targetBtn.classList.remove('text-slate-500', 'hover:bg-slate-50', 'dark:text-slate-400');
    }

    switchMainView(viewId) {
        const allViews = ['dashboard-view', 'calendar-view', 'patients-view', 'rooms-view', 'services-view', 'professionals-view', 'settings-view'];
        allViews.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('view-hidden');
        });

        const targetView = document.getElementById(viewId);
        if (targetView) targetView.classList.remove('view-hidden');

        // Trigger Render for specific view
        if (viewId === 'patients-view') this.app.patientManager.render();
        if (viewId === 'professionals-view') this.app.professionalManager.renderProfessionalsView();
        if (viewId === 'rooms-view') this.app.roomManager.render();
        if (viewId === 'services-view') this.app.serviceManager.render();
        if (viewId === 'calendar-view') this.app.calendarManager.renderCalendar(this.store.state);
        if (viewId === 'dashboard-view') this.app.dashboardManager.render();
        if (viewId === 'settings-view') this.app.settingsManager.render();
    }

    setViewMode(mode) {
        this.viewMode = mode;
        this.app.viewMode = mode; // Sync with App state if needed
        localStorage.setItem('clinicViewMode', mode);

        // Adjust start date
        if (mode === 'week') {
            this.app.currentWeekStart = this.app.calculateInitialWeekStart();
        } else if (mode === 'day') {
            this.app.currentWeekStart = new Date();
        }

        this.app.render(this.store.state);
    }

    navigateCalendar(direction) {
        const d = new Date(this.app.currentWeekStart);
        const mode = this.viewMode;

        if (mode === 'day') {
            d.setDate(d.getDate() + direction);
        } else if (mode === 'week') {
            d.setDate(d.getDate() + (direction * 7));
        } else if (mode === 'month') {
            d.setMonth(d.getMonth() + direction);
            d.setDate(1);
        } else if (mode === 'year') {
            d.setFullYear(d.getFullYear() + direction);
            d.setMonth(0, 1);
        }

        this.app.currentWeekStart = d;
        localStorage.setItem('clinicCurrentDate', d.toISOString());
        this.app.render(this.store.state);
    }

    handleYearChange(yearValue) {
        const newYear = parseInt(yearValue);
        const d = new Date(this.app.currentWeekStart);
        d.setFullYear(newYear);

        if (this.viewMode === 'month' || this.viewMode === 'year') {
            d.setMonth(0, 1);
        } else {
            // align to monday
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            d.setDate(diff);
        }
        this.app.currentWeekStart = d;
        this.app.render(this.store.state);
    }

    updateCalendarHeader(startDate) {
        const span = document.getElementById('current-week-span');
        if (!span) return;

        const d = new Date(startDate);
        let text = '';
        const mode = this.viewMode;

        if (mode === 'day') {
            text = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        } else if (mode === 'week') {
            const end = new Date(d);
            end.setDate(end.getDate() + 4);
            const m1 = d.toLocaleDateString('es-ES', { month: 'short' });
            const m2 = end.toLocaleDateString('es-ES', { month: 'short' });

            if (m1 === m2) {
                text = `${d.getDate()} - ${end.getDate()} ${d.toLocaleDateString('es-ES', { month: 'long' })}`;
            } else {
                text = `${d.getDate()} ${m1} - ${end.getDate()} ${m2}`;
            }
        } else if (mode === 'month') {
            text = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        } else {
            text = d.getFullYear().toString();
        }

        text = text.charAt(0).toUpperCase() + text.slice(1);
        span.innerText = text;

        const yearSel = document.getElementById('year-select');
        if (yearSel) yearSel.value = d.getFullYear();
    }

    updateBranding(config) {
        if (!config) return;
        const logoImg = document.getElementById('sidebar-logo');
        if (logoImg) {
            logoImg.src = config.clinicLogo || 'assets/logo.png';
            logoImg.alt = config.clinicName || 'TimeCare';
        }
        const nameSpan = document.getElementById('sidebar-clinic-name');
        if (nameSpan) nameSpan.innerText = config.clinicName || 'TimeCare';
        if (config.clinicName) document.title = `${config.clinicName} - Gestión`;
    }
}
