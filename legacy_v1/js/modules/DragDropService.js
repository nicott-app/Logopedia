import { ToastManager } from './ToastManager.js';
import { generateId, escapeHtml } from './DateUtils.js';


export class DragDropService {
    constructor(app, store) {
        this.app = app;
        this.store = store;
    }

    async handleCalendarDrop(data, dayIndex, timeSlotHour, professionalId = null) {
        // data: "PATIENT:ID" or "APPT:ID:Date"
        const parts = data.split(':');
        const type = parts[0];
        const id = Number(parts[1]);

        // Target Date
        const d = new Date(this.app.currentWeekStart);
        d.setDate(d.getDate() + dayIndex);
        d.setHours(timeSlotHour, 0, 0, 0);
        const targetDateObj = new Date(d);

        if (type === 'APPT') {
            const appt = this.store.state.appointments.find(a => a.id === id);
            if (!appt) return;

            const oldStart = new Date(appt.start);
            const oldEnd = new Date(appt.end);
            const duration = (oldEnd - oldStart);

            const newStart = new Date(targetDateObj);
            const newEnd = new Date(newStart.getTime() + duration);

            const updatePayload = {
                start: newStart.toISOString(),
                end: newEnd.toISOString()
            };
            if (professionalId) updatePayload.professionalId = professionalId;

            let msg = `¿Mover cita de ${appt.patientName} a ${newStart.toLocaleString()}?`;
            if (professionalId && professionalId !== appt.professionalId) {
                const newPro = this.store.state.professionals.find(p => p.id === professionalId);
                msg += ` y reasignar a ${newPro ? newPro.name : 'nuevo profesional'}?`;
            }

            if (await this.app.showConfirm("Mover Cita", msg, "question")) {
                this.store.updateAppointment(id, updatePayload);
                ToastManager.showToast("Cita movida.", "success");
            }

        } else if (type === 'PATIENT') {
            const patient = this.store.state.patients.find(p => String(p.id) === String(id));
            if (!patient) return;

            // Avail Check
            const duration = patient.preferredDuration || 45;
            const checkDay = targetDateObj.getDay();
            const dropTimeVal = targetDateObj.getHours() * 60 + targetDateObj.getMinutes();

            const parseTime = (t) => {
                if (!t) return 0;
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };

            let isAvailable = false;
            if (patient.availability && patient.availability.length > 0) {
                isAvailable = patient.availability.some(slot => {
                    const matchesDay = (slot.day === checkDay) || (checkDay === 0 && slot.day === 7);
                    return matchesDay && (dropTimeVal >= parseTime(slot.start) && dropTimeVal < parseTime(slot.end || "23:59"));
                });
            }

            if (!isAvailable) {
                const dayName = targetDateObj.toLocaleDateString('es-ES', { weekday: 'long' });
                const timeStr = targetDateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                this.app.modalService.showConflictModal(
                    `El paciente <b>${escapeHtml(patient.name)}</b> no tiene disponibilidad registrada para el <span class="capitalize">${dayName}</span> a las ${timeStr}.`,
                    () => {
                        this.finalizeDrop(patient, targetDateObj, professionalId);
                    }
                );
                return;
            }

            this.finalizeDrop(patient, targetDateObj, professionalId);
        }
    }

    finalizeDrop(patient, targetDateObj, professionalId) {
        const duration = patient.preferredDuration || 45;
        const end = new Date(targetDateObj);
        end.setMinutes(end.getMinutes() + duration);
        const targetStart = targetDateObj.toISOString();

        let finalProId = professionalId;
        if (!finalProId) {
            if (this.app.currentProfessionalId && this.app.currentProfessionalId !== 0) {
                finalProId = this.app.currentProfessionalId;
            } else {
                finalProId = this.store.state.professionals[0] ? this.store.state.professionals[0].id : null;
            }
        }

        const newAppt = {
            id: generateId(),
            patientId: patient.id,
            patientName: patient.name,
            professionalId: finalProId,
            start: targetStart,
            end: end.toISOString(),
            status: 'scheduled',
            type: 'single',
            serviceId: patient.service || null,
            notes: ''
        };

        this.store.addAppointment(newAppt);
        ToastManager.showToast(`Cita creada para ${patient.name}`, 'success');
    }
}
