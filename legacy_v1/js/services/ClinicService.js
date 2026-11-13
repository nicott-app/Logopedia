
import { ToastManager } from '../modules/ToastManager.js';

export class ClinicService {
    constructor(store) {
        this.store = store;
    }

    // --- PROFESSIONALS ---

    async deleteProfessional(id) {
        const prof = this.store.state.professionals.find(p => String(p.id) === String(id));
        if (!prof) return false;

        this.store.startBatch();
        try {
            await this.store.deleteProfessional(id);

            const appts = this.store.state.appointments.filter(a => String(a.professionalId) === String(id));
            for (const a of appts) {
                await this.store.deleteAppointment(a.id);
            }

            const patients = this.store.state.patients.filter(p => String(p.assignedProfessionalId) === String(id));
            for (const p of patients) {
                await this.store.updatePatient(p.id, { assignedProfessionalId: null });
            }
        } finally {
            await this.store.endBatch();
        }

        return true;
    }

    // --- ROOMS ---

    async deleteRoom(id) {
        this.store.startBatch();
        try {
            await this.store.deleteRoom(id);

            // Update professionals who have this room
            const profs = this.store.state.professionals.filter(p => p.rooms && p.rooms.includes(id));
            for (const p of profs) {
                const newRooms = p.rooms.filter(rId => String(rId) !== String(id));
                await this.store.updateProfessional(p.id, { rooms: newRooms });
            }

            const appts = this.store.state.appointments.filter(a => String(a.roomId) === String(id));
            for (const a of appts) {
                await this.store.updateAppointment(a.id, { roomId: null });
            }
        } finally {
            await this.store.endBatch();
        }

        return true;
    }

    // --- SERVICES ---

    async deleteService(id) {
        this.store.startBatch();
        try {
            await this.store.deleteService(id);

            // Update patients
            const patients = this.store.state.patients.filter(p => String(p.service) === String(id));
            for (const p of patients) {
                await this.store.updatePatient(p.id, { service: null });
            }

            // Update professionals
            const profs = this.store.state.professionals.filter(p => p.services && p.services.includes(id));
            for (const p of profs) {
                const newServices = p.services.filter(sId => String(sId) !== String(id));
                await this.store.updateProfessional(p.id, { services: newServices });
            }

            const appts = this.store.state.appointments.filter(a => String(a.service) === String(id) || String(a.serviceId) === String(id));
            for (const a of appts) {
                await this.store.updateAppointment(a.id, { service: null, serviceId: null });
            }
        } finally {
            await this.store.endBatch();
        }

        return true;
    }

    // --- PATIENTS ---
    async deletePatient(id) {
        this.store.startBatch();
        try {
            await this.store.deletePatient(id);

            const appts = this.store.state.appointments.filter(a => String(a.patientId) === String(id));
            for (const a of appts) {
                await this.store.updateAppointment(a.id, {
                    status: 'cancelled',
                    notes: (a.notes ? a.notes + '\n' : '') + '[Cancelada: Paciente Eliminado]'
                });
            }
        } finally {
            await this.store.endBatch();
        }

        return true;
    }
}
