export class DateUtils {
    static getHolidays(year) {
        // Fixed National Holidays (Spain)
        let holidays = ['1-1', '1-6', '5-1', '8-15', '10-12', '11-1', '12-6', '12-8', '12-25'];

        // Variable Holidays (Semana Santa - Jueves/Viernes Santo)
        // https://www.calendarioslaborales.com/
        if (year === 2025) {
            holidays.push('4-17', '4-18'); // Jueves/Viernes Santo 2025
        } else if (year === 2026) {
            holidays.push('4-2', '4-3');   // Jueves/Viernes Santo 2026
        }

        return holidays;
    }

    static isHoliday(date, customHolidays = []) {
        const day = date.getDay();
        // Weekends (Sat=6, Sun=0)
        if (day === 0 || day === 6) return true;

        const d = date.getDate();
        const m = date.getMonth() + 1;
        const key = `${m}-${d}`;
        const nationalHolidays = this.getHolidays(date.getFullYear());

        if (nationalHolidays.includes(key)) return true;

        // Custom Holidays
        if (customHolidays && customHolidays.length > 0) {
            const yyyy = date.getFullYear();
            const mm = String(m).padStart(2, '0');
            const dd = String(d).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;
            if (customHolidays.includes(dateStr)) return true;
        }

        return false;
    }

    static calculateFreeSlots(date, appointments) {
        const day = date.getDay();
        if (day === 0) return []; // Sunday Closed

        const startHour = 9;
        const endHour = day === 6 ? 13 : 21; // Sat vs Mon-Fri
        const freeSlots = [];

        // Check each hour block
        for (let h = startHour; h < endHour; h++) {
            const slotStart = new Date(date);
            slotStart.setHours(h, 0, 0, 0);
            const slotEnd = new Date(date);
            slotEnd.setHours(h + 1, 0, 0, 0);

            // Check overlap
            const isOccupied = appointments.some(a => {
                const aStart = new Date(a.start);
                const aEnd = new Date(a.end);
                // Standard Overlap Logic: (StartA < EndB) && (EndA > StartB)
                return aStart < slotEnd && aEnd > slotStart;
            });

            if (!isOccupied) {
                freeSlots.push(`${h.toString().padStart(2, '0')}:00`);
            }
        }
        return freeSlots;
    }
}
