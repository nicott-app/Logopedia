export const Scheduler = {
    holidays: [
        '2024-01-01', '2024-01-06', '2024-03-29', '2024-05-01', '2024-08-15', '2024-10-12', '2024-11-01', '2024-12-06', '2024-12-08', '2024-12-25',
        '2025-01-01', '2025-01-06', '2025-04-18', '2025-05-01', '2025-08-15', '2025-10-12', '2025-11-01', '2025-12-06', '2025-12-08', '2025-12-25'
    ],

    isHoliday(date) {
        const dateStr = date.toISOString().split('T')[0];
        return this.holidays.includes(dateStr);
    },

    isAvailable(patient, startDateTime, endDateTime) {
        if (this.isHoliday(startDateTime)) return false;

        if (!patient.availability) return false;

        const dayOfWeek = startDateTime.getDay();
        const startHour = startDateTime.getHours();
        const startMin = startDateTime.getMinutes();

        const requestStart = startHour * 60 + startMin;
        const requestEnd = endDateTime.getHours() * 60 + endDateTime.getMinutes();

        return patient.availability.some(slot => {
            if (slot.day !== dayOfWeek) return false;

            const [sH, sM] = slot.start.split(':').map(Number);
            const [eH, eM] = slot.end.split(':').map(Number);
            const availStart = sH * 60 + sM;
            const availEnd = eH * 60 + eM;

            return availStart <= requestStart && availEnd >= requestEnd;
        });
    },

    findSubstitutes(slot, candidates, existingAppointments) {
        const start = new Date(slot.start);
        const end = new Date(slot.end);

        return candidates.filter(patient => {
            // 1. Availability Check
            if (!this.isAvailable(patient, start, end)) return false;

            // 2. Conflict Check (ensure patient isn't already booked)
            const conflict = existingAppointments.find(appt => {
                if (appt.patientId !== patient.id) return false;
                if (appt.status === 'cancelled') return false;

                const aStart = new Date(appt.start);
                const aEnd = new Date(appt.end);

                // Overlap logic
                return (start < aEnd && end > aStart);
            });

            return !conflict;
        }).sort((a, b) => a.id - b.id); // FIFO: Oldest ID (timestamp) first
    },

    optimize(store) {
        const waitingPatients = store.state.waitingList || [];
        if (waitingPatients.length === 0) return 0;

        let scheduledCount = 0;
        const appointments = store.state.appointments;

        // Optimization Window: Next 5 days from today
        const today = new Date();
        const MAX_DAYS = 5;

        waitingPatients.forEach(patient => {
            if (patient.status !== 'waiting') return;

            // Try to find a slot
            let scheduled = false;

            for (let d = 0; d < MAX_DAYS; d++) {
                if (scheduled) break;
                const currentDay = new Date(today);
                currentDay.setDate(today.getDate() + d);

                if (this.isHoliday(currentDay)) continue;
                if (currentDay.getDay() === 0 || currentDay.getDay() === 6) continue; // Skip weekend for auto-opt?? Or follow availability?

                // Check constraints: Professional matching Service + Room
                const professionals = store.state.professionals.filter(p => {
                    // Check if professional handles patient's service
                    // Service ID in patient might be numeric now
                    return p.services.includes(patient.service) || p.services.includes(patient.service.toString());
                });

                for (const prof of professionals) {
                    if (scheduled) break;

                    // Simple Slot Search (9:00 to 20:00)
                    for (let h = 9; h < 20; h++) {
                        const start = new Date(currentDay);
                        start.setHours(h, 0, 0, 0);
                        const end = new Date(start);
                        end.setMinutes(start.getMinutes() + (patient.preferredDuration || 45));

                        // 1. Patient Available?
                        if (!this.isAvailable(patient, start, end)) continue;

                        // 2. Prof Available? (No intersection with existing appts)
                        const profBusy = appointments.some(a => {
                            if (a.professionalId !== prof.id) return false;
                            if (a.status === 'cancelled') return false;
                            const aStart = new Date(a.start);
                            const aEnd = new Date(a.end);
                            return (start < aEnd && end > aStart);
                        });
                        if (profBusy) continue;

                        // 3. Room Available? (Prof has rooms)
                        // Pick first room of prof?
                        const roomFunc = (prof.rooms && prof.rooms.length > 0) ? prof.rooms[0] : null; // Naive
                        if (!roomFunc) continue;

                        // Check Room Busy
                        const roomBusy = appointments.some(a => {
                            if (a.roomId !== roomFunc) return false;
                            if (a.status === 'cancelled') return false;
                            const aStart = new Date(a.start);
                            const aEnd = new Date(a.end);
                            return (start < aEnd && end > aStart);
                        });
                        if (roomBusy) continue;

                        // FOUND SLOT
                        const newAppt = {
                            id: Date.now() + Math.random(),
                            patientId: patient.id,
                            patientName: patient.name,
                            professionalId: prof.id,
                            professionalName: prof.name,
                            roomId: roomFunc,
                            start: start.toISOString(),
                            end: end.toISOString(),
                            status: 'scheduled',
                            service: patient.service,
                            type: 'single',
                            notes: 'Optimizado Auto'
                        };

                        store.addAppointment(newAppt);
                        store.removeFromWaitingList(patient.id);
                        // Update status? removeFromWaitingList handles list, but store.updatePatient needed?
                        store.updatePatient(patient.id, { status: 'active' });

                        scheduled = true;
                        scheduledCount++;
                        break;
                    }
                }
            }
        });
        return scheduledCount;
    }
};

window.ClinicScheduler = Scheduler;
