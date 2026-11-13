
// --- RELATIONAL DATABASE ENGINE (LogoDB) ---
export class ClinicDatabase {
    constructor() {
        this.tables = {
            patients: [],
            professionals: [],
            services: [],
            rooms: [],
            appointments: [],
            waitingList: [],
            exceptions: [],
            config: this.getDefaultConfig()
        };
        this.schemas = {
            patient: (p) => ({
                id: Number(p.id) || Date.now(),
                name: p.name || 'Paciente Sin Nombre',
                age: Number(p.age) || 0,
                // FK: SERVICE (ID)
                service: this.normalizeServiceId(p.service, p),
                status: ['active', 'waiting', 'archived'].includes(p.status) ? p.status : 'waiting',
                phone: p.phone || '',
                email: p.email || '',
                notes: p.notes || '',
                availability: Array.isArray(p.availability) ? p.availability : [],
                contactName: p.contactName || 'Familiar',
                contactType: p.contactType || 'parent',
                diagnosis: p.diagnosis || '',
                treatmentType: p.treatmentType || 'chronic',
                totalSessions: Number(p.totalSessions) || 0,
                sessionsCompleted: Number(p.sessionsCompleted) || 0,
                startDate: p.startDate || new Date().toISOString(),
                waitingSince: p.waitingSince && p.status === 'waiting' ? p.waitingSince : (p.status === 'waiting' ? new Date().toISOString() : null),
                pendingReassignments: Array.isArray(p.pendingReassignments) ? p.pendingReassignments : [],
                extraSessions: Array.isArray(p.extraSessions) ? p.extraSessions : [],
                files: Array.isArray(p.files) ? p.files : [],
                notesHistory: Array.isArray(p.notesHistory) ? p.notesHistory : []
            }),
            professional: (p) => {
                return {
                    id: Number(p.id) || Date.now(),
                    name: p.name || 'Doc',
                    color: p.color || 'blue',
                    services: Array.isArray(p.services) ? p.services : [], // Should be IDs
                    rooms: Array.isArray(p.rooms) ? p.rooms : [], // Should be IDs
                    schedule: p.schedule || {
                        start: null, // null = use global
                        end: null,
                        lunchStart: null,
                        lunchEnd: null
                    }
                };
            }
        };
    }

    getDefaultConfig() {
        return {
            clinicName: "TimeCare",
            clinicLogo: null,
            defaultView: "week",
            holidays: [],
            schedule: {
                start: "09:00",
                end: "21:00",
                lunchStart: "14:00",
                lunchEnd: "15:00",
                days: [1, 2, 3, 4, 5] // Mon-Fri
            }
        };
    }

    normalizeServiceId(val, context) {
        if (typeof val === 'number') return val;
        return val;
    }

    load() {
        try {
            // Check window.localStorage usage is valid in modules (yes)
            const raw = localStorage.getItem('clinicState');
            if (raw) {
                const parsed = JSON.parse(raw);

                this.tables.services = parsed.services || this.getDefaultServices();
                this.tables.rooms = parsed.rooms || this.getDefaultRooms();
                this.tables.professionals = parsed.professionals || this.getDefaultProfessionals();
                this.tables.patients = parsed.patients || [];
                this.tables.waitingList = parsed.waitingList || [];
                this.tables.waitingList = parsed.waitingList || [];
                this.tables.appointments = parsed.appointments || [];
                this.tables.config = parsed.config || this.getDefaultConfig();

                this.migrateToNumericIds();

                this.tables.professionals = this.tables.professionals.map(p => this.schemas.professional(p));
                this.tables.patients = this.tables.patients.map(p => this.schemas.patient(p));
                this.tables.waitingList = this.tables.waitingList.map(p => this.schemas.patient(p));

                this.tables.exceptions = parsed.exceptions || [];

                console.log("[LogoDB] Database Loaded & Normalized (ID-Based).");
                this.save();
                return true;
            }
        } catch (e) {
            console.error("[LogoDB] Load Failed:", e);
            return false;
        }
        return false;
    }

    hydrate(data) {
        if (!data) return;
        console.log("[LogoDB] Hydrating from Cloud...", data);

        // Deep Merge Safe Logic
        const defaults = this.getDefaultConfig();
        const mergedConfig = { ...defaults, ...(data.config || {}) };

        this.tables = {
            ...this.tables, // Keep existing structure/defaults as base
            ...data,        // Overwrite with cloud data
            config: mergedConfig // Ensure config is safe
        };

        this.migrateToNumericIds();
        this.save(true);
    }

    migrateToNumericIds() {
        console.log("[LogoDB] Starting ID Migration...");

        if (this.tables.services.some(s => typeof s.id !== 'number')) {
            console.log("-> Migrating Services to Numeric IDs");
            const svcMap = {};
            this.tables.services = this.tables.services.map((s, idx) => {
                const newId = 1000 + idx;
                const oldKey = s.id || s.name;
                svcMap[oldKey] = newId;
                svcMap[s.name] = newId;
                return { ...s, id: newId };
            });
            this.tempSvcMap = svcMap;
        } else {
            this.tempSvcMap = {};
            this.tables.services.forEach(s => this.tempSvcMap[s.name] = s.id);
        }

        if (this.tables.rooms.some(r => typeof r.id !== 'number')) {
            console.log("-> Migrating Rooms to Numeric IDs");
            const roomMap = {};
            this.tables.rooms = this.tables.rooms.map((r, idx) => {
                const newId = 2000 + idx;
                const oldKey = r.id || r.name;
                roomMap[oldKey] = newId;
                roomMap[r.name] = newId;

                let types = [];
                if (Array.isArray(r.type)) types = r.type;
                else if (r.type && typeof r.type === 'string') types = [r.type];

                const typeIds = types.map(t => this.tempSvcMap[t]).filter(Boolean);

                return { ...r, id: newId, type: typeIds };
            });
            this.tempRoomMap = roomMap;
        } else {
            this.tempRoomMap = {};
            this.tables.rooms.forEach(r => this.tempRoomMap[r.name] = r.id);
        }

        this.tables.professionals.forEach(p => {
            if (Array.isArray(p.services)) {
                p.services = p.services.map(s => {
                    return (typeof s === 'string') ? this.tempSvcMap[s] : s;
                }).filter(Boolean);
            }

            if (Array.isArray(p.rooms)) {
                p.rooms = p.rooms.map(r => {
                    return (typeof r === 'string') ? this.tempRoomMap[r] : r;
                }).filter(Boolean);
            }
        });

        this.tables.patients.forEach(p => {
            if (typeof p.service === 'string') {
                const mapped = this.tempSvcMap[p.service];
                p.service = mapped || (this.tables.services[0] ? this.tables.services[0].id : null);
            }
        });

        this.tables.waitingList.forEach(p => {
            if (typeof p.service === 'string') {
                const mapped = this.tempSvcMap[p.service];
                p.service = mapped || (this.tables.services[0] ? this.tables.services[0].id : null);
            }
        });
    }

    save() {
        localStorage.setItem('clinicState', JSON.stringify(this.tables));
    }

    getDefaultServices() {
        return [
            { id: 1000, name: 'Logopedia', duration: 45, price: 45, color: 'blue' },
            { id: 1001, name: 'Psicología', duration: 60, price: 50, color: 'green' },
            { id: 1002, name: 'Neuropsicología', duration: 45, price: 60, color: 'purple' },
            { id: 1003, name: 'Fisioterapia', duration: 60, price: 45, color: 'orange' }
        ];
    }

    getDefaultRooms() {
        return [
            { id: 2000, name: 'Sala 1', type: [1000] },
            { id: 2001, name: 'Sala 2', type: [1000] }
        ];
    }

    getDefaultProfessionals() {
        return [
            { id: 1, name: 'Juan Pérez', color: 'blue', services: [1000], rooms: [2000] },
            { id: 2, name: 'María López', color: 'green', services: [1001], rooms: [2001] }
        ];
    }
}

// --- STORE API WRAPPER ---
export const store = {
    db: new ClinicDatabase(),
    state: null,
    listeners: [],

    init() {
        const loaded = this.db.load();
        this.state = this.db.tables;

        if (!loaded || this.state.patients.length === 0) {
            console.log("[Store] Seeding Mock Data...");
            if (this.state.patients.length < 5) {
                this.generateMockData();
                this.state.isMock = true; // Tag as Mock
            }
        }
    },

    subscribe(listener) { this.listeners.push(listener); },
    notify() { this.listeners.forEach(l => l(this.state)); },
    hydrate(data) {
        this.db.hydrate(data);
        this.state = this.db.tables;
        this.notify();
    },

    save() {
        this.db.save();
        if (window.app && window.app.onStoreUpdate) window.app.onStoreUpdate(this.state);
    },

    getServiceName(id) {
        const s = this.state.services.find(s => s.id == id);
        return s ? s.name : 'Desconocido';
    },

    getRoomName(id) {
        const r = this.state.rooms.find(r => r.id == id);
        return r ? r.name : 'Sala Desconocida';
    },

    getRoom(id) {
        return this.state.rooms.find(r => r.id == id);
    },

    getPatientsByService(serviceId) {
        return this.state.patients.filter(p => p.service === serviceId);
    },

    getPatientsForProfessional(profId) {
        const prof = this.db.tables.professionals.find(p => p.id == profId);
        if (!prof) return [];
        return this.state.patients.filter(p => prof.services.includes(p.service));
    },

    addPatient(patient) {
        const clean = this.db.schemas.patient(patient);
        this.state.patients.push(clean);
        if (clean.status === 'waiting') this.state.waitingList.push(clean);
        this.save();
        this.notify();
    },

    updatePatient(id, updates) {
        const p = this.state.patients.find(p => p.id == id);
        if (p) {
            Object.assign(p, updates);
            if (updates.service) p.service = this.db.normalizeServiceId(updates.service, p);
            this.save();
            this.notify();
        }
    },

    addProfessional(prof) {
        const clean = this.db.schemas.professional(prof);
        this.state.professionals.push(clean);
        this.save();
        this.notify();
    },

    updateProfessional(id, updates) {
        const p = this.state.professionals.find(p => p.id == id);
        if (p) {
            Object.assign(p, updates);
            if (!p.services || !Array.isArray(p.services) || p.services.length === 0) {
                p.services = this.db.schemas.professional(p).services;
            }
            this.save();
            this.notify();
        }
    },

    deleteProfessional(id) {
        this.state.professionals = this.state.professionals.filter(p => p.id != id);
        this.save();
        this.notify();
        return true;
    },

    addRoom(room) {
        this.state.rooms.push(room);
        this.save();
        this.notify();
    },

    updateRoom(id, updates) {
        const r = this.state.rooms.find(r => r.id == id);
        if (r) {
            Object.assign(r, updates);
            this.save();
            this.notify();
        }
    },

    deleteRoom(id) {
        this.state.rooms = this.state.rooms.filter(r => r.id != id);
        this.save();
        this.notify();
    },

    // --- Services ---
    addService(service) {
        this.state.services.push(service);
        this.save();
        this.notify();
    },

    updateService(id, updates) {
        const s = this.state.services.find(s => s.id == id);
        if (s) {
            Object.assign(s, updates);
            this.save();
            this.notify();
        }
    },

    deleteService(id) {
        this.state.services = this.state.services.filter(s => s.id != id);
        this.save();
        this.notify();
    },

    addAppointment(appt) {
        this.state.appointments.push(appt);
        this.save();
        this.notify();
    },

    updateAppointment(id, updates) {
        const appt = this.state.appointments.find(a => a.id == id);
        if (appt) { Object.assign(appt, updates); this.save(); this.notify(); }
    },

    // Helper to register substitution (could be in logic module, but store acts as db here)
    registerSubstitution(originalAppt, newPatientId) {
        // Find or create substitution record?
        // App logic handled this by just updating appt usually.
        // If we want a trace, we log it.
        // For now, assume App/CalendarManager handles complex logic using updateAppointment/addAppointment.
        // This is just a stub if referenced.
    },

    updateService(id, updates) {
        const svc = this.state.services.find(s => s.id === id);
        if (svc) {
            Object.assign(svc, updates);
            this.save();
        }
    },

    cancelAppointment(id) {
        const appt = this.state.appointments.find(a => a.id == id);
        if (appt) {
            appt.status = 'cancelled';
            this.save();
            this.notify();
        }
    },

    deleteAppointment(id) {
        this.state.appointments = this.state.appointments.filter(a => a.id != id);
        this.save();
        this.notify();
    },

    removeFromWaitingList(patientId) {
        this.state.waitingList = this.state.waitingList.filter(p => p.id !== patientId);
        // Also update patient status if present
        const p = this.state.patients.find(p => p.id === patientId);
        if (p) {
            p.status = 'active'; // Assume moved to active? Or leave it to caller?
            // Caller usually sets status.
        }
        this.save();
        this.notify();
    },

    addException(exception) {
        if (!this.state.exceptions) this.state.exceptions = [];
        this.state.exceptions.push(exception);
        this.save();
    },

    generateMockData() {
        const services = ['Logopedia', 'Psicología', 'Neuropsicología', 'Fisioterapia'];
        const names = ['Ana', 'Carlos', 'Luis', 'Marta', 'Elena', 'Jorge', 'Sofia', 'David'];
        for (let i = 0; i < 50; i++) {
            const name = names[i % names.length] + ' ' + (i + 1);
            this.addPatient({
                id: Date.now() + i,
                name: name,
                age: 5 + (i % 10),
                status: i % 3 === 0 ? 'active' : 'waiting',
                service: services[i % services.length]
            });
        }
    }
}


// Helper to expose manually if needed (optional)
// Helper to expose manually if needed (optional)
window.clinicStore = store;
store.init();
