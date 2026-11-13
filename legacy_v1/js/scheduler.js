import { DateUtils, generateId } from './modules/DateUtils.js';

export const Scheduler = {

    /**
     * Check if a date is a holiday.
     * Uses config.holidays from the store (user-defined in Settings).
     * Falls back to national holidays from DateUtils if no store available.
     */
    isHoliday(date, store = null) {
        const dateStr = date.toISOString().split('T')[0];
        const d = date.getDate();
        const m = date.getMonth() + 1;
        const shortKey = `${m}-${d}`;

        // 1. Check user-configured holidays from store config
        if (store && store.state && store.state.config && Array.isArray(store.state.config.holidays)) {
            if (store.state.config.holidays.includes(dateStr)) return true;
        }

        // 2. Check national holidays via DateUtils
        const nationalHolidays = DateUtils.getHolidays(date.getFullYear());
        if (nationalHolidays.includes(shortKey)) return true;

        // 3. Check weekends
        const day = date.getDay();
        if (day === 0 || day === 6) return true;

        return false;
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

    optimize(store, options = {}) {
        const { strategy = 'tetris', bufferMins = 0, elasticity = 0, tunnelWeeks = 4 } = options;
        const waitingPatients = store.waitingList || [];
        if (waitingPatients.length === 0) return 0;

        let scheduledCount = 0;
        const appointments = store.state.appointments;
        const today = new Date();
        const MAX_DAYS = 14; // Increased searching window

        waitingPatients.forEach(patient => {
            if (patient.status !== 'waiting') return;

            let bestSlot = null;
            let bestScore = -Infinity;

            // Search Window
            for (let d = 0; d < MAX_DAYS; d++) {
                if (bestSlot && strategy !== 'tetris') break; // Tetris searches diverse options to find BEST fit

                const currentDay = new Date(today);
                currentDay.setDate(today.getDate() + d);

                if (this.isHoliday(currentDay, store)) continue;

                // Find Professionals
                const professionals = store.state.professionals.filter(p => {
                    return (!p.status || p.status === 'active') &&
                        (p.services.includes(patient.service) || p.services.includes(patient.service.toString()));
                });

                for (const prof of professionals) {
                    if (bestSlot && strategy !== 'tetris') break;

                    const dayStart = new Date(currentDay); dayStart.setHours(9, 0, 0, 0); // Config?
                    const dayEnd = new Date(currentDay); dayEnd.setHours(20, 0, 0, 0);

                    // Iterate Minutes (Granularity 15m)
                    for (let time = dayStart.getTime(); time < dayEnd.getTime(); time += 15 * 60000) {
                        const slotStart = new Date(time);
                        let duration = patient.preferredDuration || 45;

                        // Elasticity Check
                        let usedElasticity = false;
                        let actualDuration = duration;

                        if (strategy === 'elastic' && elasticity > 0) {
                            // Try normal first, if fails, try compressed
                            // Logic below mainly checks availability.
                            // We define minDuration based on elasticity
                            const minDuration = duration * (1 - (elasticity / 100));
                            // For simplicity in this loop, we try standard first.
                            // If standard fails availability check, we try minDuration?
                            // Or we strictly search for BEST slot?
                            // Let's simplified: If Elastic, we allow fitting in minDuration gap.
                        }

                        let slotEnd = new Date(time + duration * 60000);

                        // 1. Availability Check (Basic + Zen Buffer)
                        let checkStart = new Date(slotStart);
                        let checkEnd = new Date(slotEnd);

                        if (strategy === 'zen' && bufferMins > 0) {
                            checkStart = new Date(slotStart.getTime() - bufferMins * 60000);
                            checkEnd = new Date(slotEnd.getTime() + bufferMins * 60000);
                        }

                        // Patient + Prof + Room Check
                        if (!this.checkCompositionAvailability(patient, prof, checkStart, checkEnd, appointments)) {
                            // If Elastic, try compressing
                            if (strategy === 'elastic' && elasticity > 0) {
                                const minDur = duration * (1 - (elasticity / 100));
                                const compressedEnd = new Date(time + minDur * 60000);
                                if (this.checkCompositionAvailability(patient, prof, slotStart, compressedEnd, appointments)) {
                                    slotEnd = compressedEnd;
                                    actualDuration = minDur;
                                    usedElasticity = true;
                                } else {
                                    continue;
                                }
                            } else {
                                continue;
                            }
                        }

                        // 2. Specialized Strategy Checks

                        if (strategy === 'tunnel') {
                            // Check next X weeks
                            let tunnelValid = true;
                            for (let w = 1; w <= tunnelWeeks; w++) {
                                const futureStart = new Date(slotStart.getTime() + w * 7 * 24 * 60 * 60 * 1000);
                                const futureEnd = new Date(slotEnd.getTime() + w * 7 * 24 * 60 * 60 * 1000);
                                if (this.isHoliday(futureStart, store)) continue; // Skip holidays in tunnel
                                if (!this.checkCompositionAvailability(patient, prof, futureStart, futureEnd, appointments)) {
                                    tunnelValid = false;
                                    break;
                                }
                            }
                            if (!tunnelValid) continue;
                        }

                        // 3. Scoring (Tetris)
                        let score = 100 - d; // Prefer sooner

                        if (strategy === 'tetris') {
                            // Check Adjacency
                            const adjBefore = appointments.some(a =>
                                a.professionalId === prof.id && Math.abs(new Date(a.end).getTime() - slotStart.getTime()) < 60000 // < 1min gap
                            );
                            const adjAfter = appointments.some(a =>
                                a.professionalId === prof.id && Math.abs(new Date(a.start).getTime() - slotEnd.getTime()) < 60000
                            );
                            if (adjBefore) score += 50;
                            if (adjAfter) score += 50;
                        }

                        if (score > bestScore) {
                            bestScore = score;
                            bestSlot = {
                                start: slotStart,
                                end: slotEnd,
                                prof: prof,
                                duration: actualDuration,
                                note: strategy === 'elastic' && usedElasticity ? `Optimizado (Elástico ${Math.round(actualDuration)}m)` : `Optimizado (${strategy})`
                            };
                        }

                        // If not tetris, first find is good enough (greedy)
                        if (strategy !== 'tetris' && bestSlot) break;
                    }
                }
            }

            // Book Best Slot
            if (bestSlot) {
                // Room logic (naive pick first available)
                const roomFunc = (bestSlot.prof.rooms && bestSlot.prof.rooms.length > 0) ? bestSlot.prof.rooms[0] : 1;

                const newAppt = {
                    id: generateId(),
                    patientId: patient.id,
                    patientName: patient.name,
                    professionalId: bestSlot.prof.id,
                    professionalName: bestSlot.prof.name,
                    roomId: roomFunc,
                    start: bestSlot.start.toISOString(),
                    end: bestSlot.end.toISOString(),
                    status: 'scheduled',
                    service: patient.service,
                    type: 'single', // Or 'recurring' if tunnel? Let's keep single for now unless tunnel
                    notes: bestSlot.note
                };

                if (strategy === 'tunnel') {
                    newAppt.type = 'recurring';
                    newAppt.notes += ' [Tunel Tratamiento]';
                    // Should we book future ones too? 
                    // For "Optimization" batch, usually we book the NEXT one. 
                    // The system implies "finding a slot". 
                    // If we want to book the series, we'd add multiple. 
                    // User request: "el algoritmo descarta... ofrece huecos que garantizan paz mental".
                    // Implies finding the START date that works.
                }

                store.addAppointment(newAppt);
                store.removeFromWaitingList(patient.id);
                store.updatePatient(patient.id, { status: 'active' });
                scheduledCount++;
            }
        });

        return scheduledCount;
    },

    checkCompositionAvailability(patient, prof, start, end, appointments) {
        // 1. Patient Available
        // Need to pass patient object to isAvailable? Yes.
        // But patient might be in WaitingList format.
        // Assuming patient object has availability rules attached or simple check.
        // If availability is complex, we use Scheduler.isAvailable.
        if (!this.isAvailable(patient, start, end)) return false;

        // 2. Prof Available
        const profBusy = appointments.some(a => {
            if (a.professionalId !== prof.id) return false;
            if (a.status === 'cancelled') return false;
            const aStart = new Date(a.start);
            const aEnd = new Date(a.end);
            return (start < aEnd && end > aStart);
        });
        if (profBusy) return false;

        // 3. Room Available (Naive check on Prof's first room)
        const roomFunc = (prof.rooms && prof.rooms.length > 0) ? prof.rooms[0] : null;
        if (roomFunc) {
            const roomBusy = appointments.some(a => {
                if (a.roomId !== roomFunc) return false;
                if (a.status === 'cancelled') return false;
                const aStart = new Date(a.start);
                const aEnd = new Date(a.end);
                return (start < aEnd && end > aStart);
            });
            if (roomBusy) return false;
        }

        return true;
    }
};
