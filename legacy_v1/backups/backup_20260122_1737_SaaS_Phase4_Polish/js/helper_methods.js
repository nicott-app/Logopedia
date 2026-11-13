isHoliday(date) {
    const holidays = this.getHolidays(date.getFullYear());
    const dStr = `${date.getMonth() + 1}-${date.getDate()}`;
    return holidays.includes(dStr);
}

getHolidays(year) {
    // Simple fixed holidays (M-D)
    return ['1-1', '1-6', '5-1', '8-15', '10-12', '11-1', '12-6', '12-8', '12-25'];
}

injectLegend() {
    const legend = document.getElementById('calendar-legend');
    if (!legend) return;
    legend.innerHTML = `
                <div class="flex items-center gap-4 text-xs">
                    <div class="flex items-center gap-1">
                        <div class="w-3 h-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded"></div>
                        <span class="text-slate-500 dark:text-gray-400">Laborable</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <div class="w-3 h-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30 rounded"></div>
                        <span class="text-slate-500 dark:text-gray-400">Festivo</span>
                    </div>
                </div>
            `;
}
    }
