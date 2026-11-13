import { generateId } from './DateUtils.js';

export class SecurityManager {
    constructor(app, store) {
        this.app = app;
        this.store = store;
        this.privacyMode = false;

        // Ensure log storage exists
        if (!this.store.state.auditLogs) {
            this.store.state.auditLogs = [];
        }
    }

    // --- AUDIT LOGS ---
    logAccess(action, resourceId, details = '') {
        const entry = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            user: this.getCurrentUser(),
            action: action, // e.g., 'VIEW_PATIENT', 'EDIT_NOTE', 'EXPORT_DATA'
            resourceId: resourceId,
            details: details
        };

        this.store.state.auditLogs.unshift(entry); // Newest first

        // Limit log size (e.g., last 1000 entries) to prevent bloat
        if (this.store.state.auditLogs.length > 1000) {
            this.store.state.auditLogs.pop();
        }

        this.store.save();
        this.store.notify();
    }

    getCurrentUser() {
        // In Phase 4 (Roles) this will be real. 
        // For now, assume "Current User" or get from Firebase Auth if available
        if (this.app.firebase && this.app.firebase.user) {
            return this.app.firebase.user.email || 'User';
        }
        return 'Local Admin';
    }

    getLogs() {
        return this.store.state.auditLogs;
    }

    // --- PRIVACY MODE ---
    togglePrivacyMode() {
        this.privacyMode = !this.privacyMode;
        if (this.privacyMode) {
            document.body.classList.add('privacy-restricted');
        } else {
            document.body.classList.remove('privacy-restricted');
        }
        return this.privacyMode;
    }

    /**
     * Determines if a specific user can access a specific patient's file.
     * Enforces Role-Based and Service-Based security policies.
     * 
     * @param {Object} user - The user object (must contain role, id, services)
     * @param {Object} patient - The patient object
     * @returns {boolean} - True if access is allowed
     */
    canAccessPatient(user, patient) {
        if (!user || !patient) return false;

        const role = (user.role || '').toLowerCase();

        // 1. Admins see everything
        if (role === 'admin') {
            return true;
        }

        // 2. Professionals
        if (role === 'professional') {
            // A. Explicit Assignment (Highest Priority)
            if (String(patient.assignedProfessionalId) === String(user.id)) {
                return true;
            }

            // B. Service Match Strategy
            // "See patients that belong to my Service Area"
            const myServices = (user.services || []).map(id => id);
            const patientService = patient.service;

            // Allow if:
            // - Patient has NO service defined (Unclassified/Waiting)
            // - Patient's service matches one of mine
            if (!patientService || myServices.includes(patientService)) {
                return true;
            }

            // C. Fallback: Access Denied
            return false;
        }

        // Default Deny
        return false;
    }
}
