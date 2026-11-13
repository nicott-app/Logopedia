/**
 * AuthService — Servicio de Autenticación Local
 *
 * Responsabilidades:
 *  - Verificar PIN de profesionales contra los hashes almacenados en el store.
 *  - Persistir en localStorage ÚNICAMENTE los datos mínimos de sesión:
 *      { id, name, role, email } — NUNCA el PIN ni su hash.
 *  - Proteger contra ataques de fuerza bruta con bloqueo progresivo.
 *
 * ═══════════════════════════════════════════
 *  HC-04: Política de PIN robusta
 *    · Validación de fortaleza antes de guardar un nuevo PIN.
 *    · Bloqueo de cuenta tras MAX_ATTEMPTS intentos fallidos.
 *    · Temporizador de desbloqueo almacenado en sessionStorage.
 *
 *  HC-05: Sesión mínima en localStorage
 *    · Solo se persiste { id, name, role, email }.
 *    · El usuario completo se reconcilia con el store en cada arranque.
 * ═══════════════════════════════════════════
 */

/** Máximo de intentos fallidos antes de bloqueo temporal. */
const MAX_ATTEMPTS = 5;
/** Duración del bloqueo en milisegundos (15 minutos). */
const LOCKOUT_DURATION = 15 * 60 * 1000;
/** Clave en sessionStorage para los contadores de bloqueo. */
const LOCKOUT_KEY = 'clinicLoginLockout';

/**
 * PINs triviales que no deben permitirse como PIN de acceso.
 * La lista incluye secuencias simples y PINs por defecto conocidos.
 */
const WEAK_PINS = new Set([
    '0000', '1111', '2222', '3333', '4444',
    '5555', '6666', '7777', '8888', '9999',
    '1234', '4321', '1230', '0123',
    '1357', '2468', '1122', '1212',
]);

// ─── Helpers de bloqueo (persistidos en sessionStorage) ─────────────────────

function _getLockout() {
    try {
        return JSON.parse(sessionStorage.getItem(LOCKOUT_KEY) || '{}');
    } catch {
        return {};
    }
}

function _saveLockout(data) {
    try {
        sessionStorage.setItem(LOCKOUT_KEY, JSON.stringify(data));
    } catch {
        // sessionStorage no disponible — degradación segura
    }
}

// ─── Clase principal ─────────────────────────────────────────────────────────

export class AuthService {
    constructor(store) {
        this.store = store;
        this.currentUser = null;
        this.isAuthenticated = false;

        // HC-05: Restaurar sesión solo con datos mínimos y reconciliar con el store
        const raw = localStorage.getItem('clinicAuthUser');
        if (raw) {
            try {
                const minimal = JSON.parse(raw);
                // Reconciliar con el store para obtener datos actualizados del profesional
                const live = this._findProfessionalById(minimal.id);
                if (live && live.isActive !== false) {
                    this.currentUser = this._minimalSession(live);
                    this.isAuthenticated = true;
                } else {
                    // El profesional ya no existe o está inactivo → limpiar sesión
                    localStorage.removeItem('clinicAuthUser');
                }
            } catch {
                localStorage.removeItem('clinicAuthUser');
            }
        }
    }

    // ─── Login ─────────────────────────────────────────────────────────────

    /**
     * Intenta autenticar al profesional indicado con el PIN proporcionado.
     *
     * @param {string} pin       - PIN introducido por el usuario (en claro).
     * @param {string|number} targetId - ID del profesional a autenticar.
     * @returns {{ success: boolean, message?: string, lockedUntil?: Date }}
     */
    login(pin, targetId = null) {
        // 1. Comprobación de bloqueo
        const lockoutCheck = this._checkLockout(targetId);
        if (lockoutCheck.locked) {
            const remaining = Math.ceil((lockoutCheck.until - Date.now()) / 60000);
            return {
                success: false,
                locked: true,
                message: `Cuenta bloqueada. Inténtalo de nuevo en ${remaining} minuto${remaining !== 1 ? 's' : ''}.`,
                lockedUntil: new Date(lockoutCheck.until)
            };
        }

        const professionals = this.store.state.professionals;
        const user = professionals.find(p => {
            if (!p.isActive) return false;
            if (targetId !== null && String(p.id) !== String(targetId)) return false;
            return this._verifyPin(pin, p.pin);
        });

        if (user) {
            // Éxito: limpiar contador de intentos
            this._clearLockout(user.id);

            this.currentUser = this._minimalSession(user);
            this.isAuthenticated = true;

            // HC-05: Persistir SOLO datos mínimos (sin PIN ni hash)
            localStorage.setItem('clinicAuthUser', JSON.stringify(this.currentUser));

            return { success: true, user: this.currentUser };
        } else {
            // Fallo: incrementar contador de intentos para el usuario seleccionado
            const remaining = this._recordFailedAttempt(targetId);
            const message = remaining > 0
                ? `PIN incorrecto. ${remaining} intento${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}.`
                : 'Cuenta bloqueada por demasiados intentos fallidos.';

            return { success: false, message };
        }
    }

    logout() {
        this.currentUser = null;
        this.isAuthenticated = false;
        localStorage.removeItem('clinicAuthUser');
    }

    // ─── Validación de fortaleza de PIN (HC-04) ─────────────────────────────

    /**
     * Valida que el PIN cumpla la política de seguridad.
     *
     * @param {string} pin - PIN a validar (en claro).
     * @returns {{ valid: boolean, reason?: string }}
     */
    static validatePinStrength(pin) {
        if (!pin || typeof pin !== 'string') {
            return { valid: false, reason: 'El PIN no puede estar vacío.' };
        }

        const trimmed = pin.trim();

        if (!/^\d+$/.test(trimmed)) {
            return { valid: false, reason: 'El PIN solo puede contener dígitos.' };
        }

        if (trimmed.length < 4) {
            return { valid: false, reason: 'El PIN debe tener al menos 4 dígitos.' };
        }

        if (trimmed.length > 8) {
            return { valid: false, reason: 'El PIN no puede tener más de 8 dígitos.' };
        }

        if (WEAK_PINS.has(trimmed)) {
            return { valid: false, reason: 'El PIN es demasiado simple. Elige un PIN más seguro.' };
        }

        // Detectar secuencias consecutivas (ej. 1235, 9876)
        const digits = trimmed.split('').map(Number);
        let isAscending = true, isDescending = true;
        for (let i = 1; i < digits.length; i++) {
            if (digits[i] !== digits[i - 1] + 1) isAscending = false;
            if (digits[i] !== digits[i - 1] - 1) isDescending = false;
        }
        if (isAscending || isDescending) {
            return { valid: false, reason: 'El PIN no puede ser una secuencia numérica consecutiva.' };
        }

        return { valid: true };
    }

    // ─── Permisos ──────────────────────────────────────────────────────────

    hasPermission(permission) {
        if (!this.currentUser) return false;
        const role = this.currentUser.role;

        switch (permission) {
            case 'view_clinical':
            case 'edit_clinical':
                return role === 'admin' || role === 'professional';
            case 'manage_settings':
            case 'manage_team':
            case 'manage_billing':
            case 'view_all_calendars':
                return role === 'admin';
            default:
                return false;
        }
    }

    requireRole(roles = []) {
        if (!this.currentUser) return false;
        return roles.includes(this.currentUser.role);
    }

    // ─── Helpers privados ──────────────────────────────────────────────────

    /**
     * HC-05: Construye el objeto de sesión mínimo que se persiste en localStorage.
     * NUNCA incluye el PIN ni su hash.
     */
    _minimalSession(professional) {
        return {
            id: professional.id,
            name: professional.name,
            role: professional.role,
            email: professional.email || '',
            color: professional.color || 'blue'
        };
    }

    /** Busca un profesional en el store por ID. */
    _findProfessionalById(id) {
        if (!this.store?.state?.professionals) return null;
        return this.store.state.professionals.find(p => String(p.id) === String(id)) || null;
    }

    /**
     * Verifica el PIN introducido contra el valor almacenado.
     * Soporta tanto hashes SHA-256 como texto plano (migración legacy).
     */
    _verifyPin(inputPin, storedPin) {
        if (!storedPin) return false;

        // Detectar hash SHA-256 (64 hex chars)
        if (storedPin.length === 64 && /^[0-9a-fA-F]+$/.test(storedPin)) {
            const hashed = this.store.crypto.hashPin(inputPin);
            return storedPin === hashed;
        }

        // Comparación legacy en texto plano (solo para migración)
        return storedPin === inputPin;
    }

    // ─── Bloqueo por intentos fallidos ────────────────────────────────────

    _checkLockout(userId) {
        if (!userId) return { locked: false };
        const lockouts = _getLockout();
        const entry = lockouts[String(userId)];
        if (!entry) return { locked: false };

        if (Date.now() < entry.until) {
            return { locked: true, until: entry.until };
        }

        // Bloqueo expirado: limpiar
        delete lockouts[String(userId)];
        _saveLockout(lockouts);
        return { locked: false };
    }

    _recordFailedAttempt(userId) {
        if (!userId) return MAX_ATTEMPTS - 1;
        const lockouts = _getLockout();
        const key = String(userId);
        const entry = lockouts[key] || { attempts: 0, until: null };

        entry.attempts += 1;

        if (entry.attempts >= MAX_ATTEMPTS) {
            entry.until = Date.now() + LOCKOUT_DURATION;
            entry.attempts = MAX_ATTEMPTS; // Cap
            lockouts[key] = entry;
            _saveLockout(lockouts);
            return 0; // Bloqueado
        }

        lockouts[key] = entry;
        _saveLockout(lockouts);
        return MAX_ATTEMPTS - entry.attempts;
    }

    _clearLockout(userId) {
        if (!userId) return;
        const lockouts = _getLockout();
        delete lockouts[String(userId)];
        _saveLockout(lockouts);
    }
}
