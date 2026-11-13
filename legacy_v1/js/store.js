import { CryptoService } from './modules/CryptoService.js';
import { MockDataManager } from './modules/MockDataManager.js';
import { generateId } from './modules/DateUtils.js';
import { sectorManager } from './sectors/SectorConfigManager.js';

/**
 * HC-03 — Módulo de contraseña maestra seguro.
 *
 * La contraseña de cifrado NUNCA se expone como propiedad pública del objeto store.
 * Se almacena en sessionStorage (auto-purged al cerrar la pestaña) y se accede
 * únicamente mediante las funciones internas de este módulo.
 *
 * El propósito es asegurar que `window.clinicStore.sessionPassword` no devuelva nada.
 */
const _sessionPass = (() => {
    const KEY = '__tc_sp__'; // Clave ofuscada en sessionStorage
    return {
        get() { try { return sessionStorage.getItem(KEY) || null; } catch { return null; } },
        set(pwd) { try { sessionStorage.setItem(KEY, pwd); } catch { /* degradación segura */ } },
        clear() { try { sessionStorage.removeItem(KEY); } catch { /* degradación segura */ } }
    };
})();

// --- RELATIONAL DATABASE ENGINE (LogoDB) ---
export class ClinicDatabase {
    constructor() {
        this.crypto = new CryptoService();
        this.tables = {
            patients: [],
            professionals: [],
            services: [],
            rooms: [],
            appointments: [],
            exceptions: [],
            config: this.getDefaultConfig()
        };
        this.schemas = {
            patient: (p) => ({
                id: p.id || generateId(),
                name: p.name || 'Paciente Sin Nombre',
                age: Number(p.age) || 0,
                // FK: SERVICE (ID)
                service: this.normalizeServiceId(p.service, p),
                status: ['active', 'waiting', 'archived', 'deleted'].includes(p.status) ? p.status : 'waiting',
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
                    id: p.id || generateId(),
                    name: p.name || 'Doc',
                    color: p.color || 'blue',
                    // Role Management
                    role: ['admin', 'professional'].includes(p.role) ? p.role : 'professional',
                    email: p.email || '',
                    // HC-04: sin PIN por defecto; null fuerza asignación explícita por el admin
                    pin: p.pin || null,
                    requiresPinChange: p.requiresPinChange !== false || !p.pin,
                    isActive: p.isActive !== false,
                    // Resources
                    services: Array.isArray(p.services) ? p.services : [],
                    rooms: Array.isArray(p.rooms) ? p.rooms : [],
                    schedule: p.schedule || {
                        start: null,
                        end: null,
                        lunchStart: null,
                        lunchEnd: null
                    }
                };
            },
            appointment: (a) => ({
                id: a.id || generateId(),
                patientId: a.patientId,
                patientName: a.patientName || '',
                professionalId: a.professionalId,
                roomId: a.roomId || null,
                start: a.start,
                end: a.end,
                status: ['scheduled', 'completed', 'cancelled'].includes(a.status) ? a.status : 'scheduled',
                service: a.service || a.serviceId || null,
                type: a.type || 'single',
                notes: a.notes || ''
            }),
            service: (s) => ({
                id: s.id || generateId(),
                name: s.name || 'Servicio',
                duration: Number(s.duration) || 45,
                price: Number(s.price) || 0,
                color: s.color || 'blue',
                description: s.description || ''
            }),
            room: (r) => ({
                id: r.id || generateId(),
                name: r.name || 'Sala',
                type: r.type || 'standard',
                capacity: Number(r.capacity) || 1,
                resources: Array.isArray(r.resources) ? r.resources : []
            })
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
        if (typeof val === 'string' && val.trim()) {
            // Try to find service by name and return its numeric ID
            const match = this.tables.services.find(s => s.name === val);
            if (match) return match.id;
            // Try parsing as number string
            const parsed = Number(val);
            if (!isNaN(parsed)) return parsed;
        }
        return null;
    }

    async load() {
        try {


            const raw = localStorage.getItem('clinicState');
            if (raw) {
                // Check for Encryption
                if (this.crypto.isEncrypted(raw)) {
                    this.locked = true;
                    return false; // Signal that load failed (locked)
                }

                const parsed = JSON.parse(raw);
                this.hydrateFromParsed(parsed);
                return true;
            }
        } catch (e) {
            console.error("[LogoDB] Load Failed:", e);
            return false;
        }
        return false;
    }

    hydrateFromParsed(parsed) {
        this.tables.services = (parsed.services || this.getDefaultServices()).map(s => this.schemas.service(s));
        this.tables.rooms = (parsed.rooms || this.getDefaultRooms()).map(r => this.schemas.room(r));
        this.tables.professionals = (parsed.professionals || this.getDefaultProfessionals()).map(p => this.schemas.professional(p));
        this.tables.patients = (parsed.patients || []).map(p => this.schemas.patient(p));
        this.tables.appointments = (parsed.appointments || []).map(a => this.schemas.appointment(a));
        this.tables.config = parsed.config || this.getDefaultConfig();
        this.tables.exceptions = parsed.exceptions || [];

        // Migrate Legacy PINs (Auto-Hash)
        if (this.tables.professionals) {
            this.tables.professionals.forEach(p => {
                // If PIN exists, is not default '0000', and is not length 64 (sha256 hex), hash it.
                if (p.pin && p.pin !== '0000' && p.pin.length !== 64) {
                    console.log(`[Migration] Hashing PIN for user ${p.name}`);
                    p.pin = this.crypto.hashPin(p.pin);
                }
            });
        }

        // Migrate legacy waitingList: merge into patients if not already present
        if (Array.isArray(parsed.waitingList) && parsed.waitingList.length > 0) {
            const existingIds = new Set(this.tables.patients.map(p => p.id));
            parsed.waitingList.forEach(wp => {
                if (!existingIds.has(wp.id)) {
                    wp.status = 'waiting';
                    this.tables.patients.push(this.schemas.patient(wp));
                }
            });
        }

        this.migrateToNumericIds();

        this.locked = false;
    }

    // --- HC-03: API de Contraseña Maestra ---
    // La contraseña NUNCA se almacena como propiedad pública.
    // Estos métodos delegan al módulo privado _sessionPass.
    getSessionPassword() { return _sessionPass.get(); }
    setSessionPassword(p) { _sessionPass.set(p); }
    clearSessionPassword() { _sessionPass.clear(); }

    async attemptUnlock(password) {
        const raw = localStorage.getItem('clinicState');
        if (!raw) return true; // Empty is unlocked

        const decrypted = this.crypto.decryptData(raw, password);
        if (decrypted) {
            // HC-03: Guardar en sessionStorage mediante closure, NUNCA como propiedad pública
            _sessionPass.set(password);
            this.hydrateFromParsed(decrypted);
            this.locked = false;
            return true;
        }
        return false;
    }

    async encryptAndSave() {
        // HC-03: Obtener contraseña del módulo seguro
        const pwd = _sessionPass.get();
        if (pwd) {
            this.crypto.enable(pwd);
            await this.save();
        }
    }

    hydrate(data) {
        if (!data) return;

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

        if (this.tables.services.some(s => typeof s.id !== 'number')) {
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
            const roomMap = {};
            this.tables.rooms = this.tables.rooms.map((r, idx) => {
                const newId = 2000 + idx;
                const oldKey = r.id || r.name;
                roomMap[oldKey] = newId;
                roomMap[r.name] = newId;

                // Preserve type as category string; migrate legacy service arrays
                let roomType = r.type;
                if (Array.isArray(roomType)) {
                    // Legacy: type was an array of service IDs — move to serviceIds
                    r.serviceIds = roomType.map(t => this.tempSvcMap[t] || t).filter(Boolean);
                    roomType = 'standard'; // Default category
                } else if (!roomType || typeof roomType !== 'string') {
                    roomType = 'standard';
                }

                return { ...r, id: newId, type: roomType, capacity: r.capacity || 1, resources: r.resources || [] };
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
    }

    async save(force = false) {
        if (this.locked) return;

        let dataToSave = JSON.stringify(this.tables);

        // HC-03: Obtener contraseña del módulo seguro (nunca de una propiedad pública)
        const pwd = _sessionPass.get();
        if (pwd && this.crypto.isEnabled()) {
            const encrypted = this.crypto.encryptData(this.tables, pwd);
            if (encrypted) {
                dataToSave = encrypted;
            }
        }

        localStorage.setItem('clinicState', dataToSave);
    }

    getDefaultServices() {
        return sectorManager.defaults.services;
    }

    getDefaultRooms() {
        return sectorManager.defaults.rooms;
    }

    getDefaultProfessionals() {
        // HC-04: Los profesionales por defecto NO tienen un PIN asignado.
        // requiresPinChange: true fuerza al admin a asignar un PIN válido antes del primer acceso.
        // El store.crypto.hashPin() no se llama aquí porque aún no hay PIN que hashear.
        return [
            { id: 1, name: 'Administrador', color: 'blue', role: 'admin', pin: null, requiresPinChange: true, services: [1000], rooms: [2000] },
            { id: 2, name: 'Profesional 1', color: 'green', role: 'professional', pin: null, requiresPinChange: true, services: [1001], rooms: [2001] }
        ];
    }
}

// --- STORE API WRAPPER ---
export const store = {
    db: new ClinicDatabase(),
    state: null,
    listeners: [],
    _batching: false,
    _batchDirty: false,

    async init() {
        this.state = this.db.tables; // Set initial empty state immediately
        const loaded = await this.db.load();
        if (loaded) {
            this.notify(); // Notify listeners that data is ready
        }
    },

    subscribe(listener) { this.listeners.push(listener); },
    notify() {
        if (this._batching) { this._batchDirty = true; return; }
        this.listeners.forEach(l => l(this.state));
    },
    hydrate(data) {
        this.db.hydrate(data);
        this.state = this.db.tables;
        this.notify();
    },

    async save() {
        if (this._batching) { this._batchDirty = true; return; }
        try {
            await this.db.save();
        } catch (e) {
            console.error('[Store] Save failed:', e);
        }
    },

    startBatch() {
        this._batching = true;
        this._batchDirty = false;
    },

    async endBatch() {
        this._batching = false;
        if (this._batchDirty) {
            this._batchDirty = false;
            try { await this.db.save(); } catch (e) { console.error('[Store] Save failed:', e); }
            this.listeners.forEach(l => l(this.state));
        }
    },

    // Derived view: waitingList is computed from patients, not stored separately
    get waitingList() {
        return this.state.patients.filter(p => p.status === 'waiting');
    },

    getServiceName(id) {
        const s = this.state.services.find(s => String(s.id) === String(id));
        return s ? s.name : 'Desconocido';
    },

    getRoomName(id) {
        const r = this.state.rooms.find(r => String(r.id) === String(id));
        return r ? r.name : 'Sala Desconocida';
    },

    getRoom(id) {
        return this.state.rooms.find(r => String(r.id) === String(id));
    },

    getPatientsByService(serviceId) {
        return this.state.patients.filter(p => p.service === serviceId);
    },

    getPatientsForProfessional(profId) {
        const prof = this.db.tables.professionals.find(p => String(p.id) === String(profId));
        if (!prof) return [];
        return this.state.patients.filter(p => prof.services.includes(p.service));
    },

    async addPatient(patient) {
        const clean = this.db.schemas.patient(patient);
        this.state.patients.push(clean);
        await this.save();
        this.notify();
    },

    async updatePatient(id, updates) {
        const p = this.state.patients.find(p => String(p.id) === String(id));
        if (p) {
            Object.assign(p, updates);
            if (updates.service) p.service = this.db.normalizeServiceId(updates.service, p);
            await this.save();
            this.notify();
        }
    },

    async addProfessional(prof) {
        const clean = this.db.schemas.professional(prof);
        this.state.professionals.push(clean);
        await this.save();
        this.notify();
    },

    async updateProfessional(id, updates) {
        const p = this.state.professionals.find(p => String(p.id) === String(id));
        if (p) {
            Object.assign(p, updates);
            if (!p.services || !Array.isArray(p.services) || p.services.length === 0) {
                p.services = this.db.schemas.professional(p).services;
            }
            await this.save();
            this.notify();
        }
    },

    async deleteProfessional(id) {
        this.state.professionals = this.state.professionals.filter(p => String(p.id) !== String(id));
        await this.save();
        this.notify();
        return true;
    },

    async addRoom(room) {
        const clean = this.db.schemas.room(room);
        this.state.rooms.push(clean);
        await this.save();
        this.notify();
    },

    async updateRoom(id, updates) {
        const r = this.state.rooms.find(r => String(r.id) === String(id));
        if (r) {
            Object.assign(r, updates);
            await this.save();
            this.notify();
        }
    },

    async deleteRoom(id) {
        this.state.rooms = this.state.rooms.filter(r => String(r.id) !== String(id));
        await this.save();
        this.notify();
    },

    // --- Services ---
    async addService(service) {
        const clean = this.db.schemas.service(service);
        this.state.services.push(clean);
        await this.save();
        this.notify();
    },

    async updateService(id, updates) {
        const s = this.state.services.find(s => String(s.id) === String(id));
        if (s) {
            Object.assign(s, updates);
            await this.save();
            this.notify();
        }
    },

    async deleteService(id) {
        this.state.services = this.state.services.filter(s => String(s.id) !== String(id));
        await this.save();
        this.notify();
    },

    async addAppointment(appt) {
        const clean = this.db.schemas.appointment(appt);
        this.state.appointments.push(clean);
        await this.save();
        this.notify();
    },

    async updateAppointment(id, updates) {
        const appt = this.state.appointments.find(a => String(a.id) === String(id));
        if (appt) { Object.assign(appt, updates); await this.save(); this.notify(); }
    },



    async cancelAppointment(id) {
        const appt = this.state.appointments.find(a => String(a.id) === String(id));
        if (appt) {
            appt.status = 'cancelled';
            await this.save();
            this.notify();
        }
    },

    async deleteAppointment(id) {
        this.state.appointments = this.state.appointments.filter(a => String(a.id) !== String(id));
        await this.save();
        this.notify();
    },

    async removeFromWaitingList(patientId) {
        // waitingList is now a derived view. Just change the patient status.
        const p = this.state.patients.find(pt => String(pt.id) === String(patientId));
        if (p) {
            p.status = 'active';
            await this.save();
            this.notify();
        }
    },

    async deletePatient(id) {
        const p = this.state.patients.find(pt => String(pt.id) === String(id));
        if (p) {
            p.status = 'deleted';
            p.deletedAt = new Date().toISOString();
            await this.save();
            this.notify();
        }
    },

    async restorePatient(id, targetStatus = 'waiting') {
        const p = this.state.patients.find(pt => String(pt.id) === String(id));
        if (p && p.status === 'deleted') {
            p.status = targetStatus;
            delete p.deletedAt;
            await this.save();
            this.notify();
        }
    },

    async purgePatient(id) {
        this.state.patients = this.state.patients.filter(p => String(p.id) !== String(id));
        await this.save();
        this.notify();
    },

    async addException(exception) {
        if (!this.state.exceptions) this.state.exceptions = [];
        this.state.exceptions.push(exception);
        await this.save();
    },


};

// Expose globally
window.clinicStore = store;
store.init();
