import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ToastManager } from "./ToastManager.js";
import { FIREBASE_CONFIG, FIRESTORE_DATABASE_ID } from "../config.js";

/**
 * FirebaseManager — Gestión de autenticación y sincronización en la nube.
 *
 * ⚠️  Las credenciales de Firebase se encuentran en js/config.js.
 *     Ese fichero está excluido del control de versiones (.gitignore).
 *     NO incluyas credenciales directamente en este archivo.
 */
export class FirebaseManager {
    constructor() {
        this.app = null;
        this.auth = null;
        this.db = null;
        this.user = null;
    }

    init() {
        try {
            if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) {
                console.warn("[Firebase] Configuración no encontrada. Revisa js/config.js.");
                return false;
            }
            this.app = initializeApp(FIREBASE_CONFIG);
            this.auth = getAuth(this.app);
            this.db = getFirestore(this.app, FIRESTORE_DATABASE_ID);
            return true;
        } catch (e) {
            console.error("[Firebase] Error de inicialización:", e);
            return false;
        }
    }

    // --- AUTH ---
    async login(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
            this.user = userCredential.user;
            ToastManager.showToast(`Bienvenido, ${this.user.email}`, "success");
            return true;
        } catch (error) {
            console.error("Login Error:", error);
            let msg = "Error al iniciar sesión";
            if (error.code === 'auth/invalid-credential') msg = "Credenciales incorrectas";
            if (error.code === 'auth/too-many-requests') msg = "Demasiados intentos. Espera un poco.";
            ToastManager.showToast(msg, "error");
            return false;
        }
    }

    async logout() {
        try {
            await signOut(this.auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Logout Error:", error);
        }
    }

    monitorAuthState(callback) {
        if (!this.auth) return;
        onAuthStateChanged(this.auth, (user) => {
            this.user = user;
            if (callback) callback(user);
        });
    }

    // --- FIRESTORE (BASIC) ---
    async saveClinicData(data) {
        if (!this.user || !this.db) return;
        try {
            // We save everything under a single document for the user (Multi-Tenant)
            await setDoc(doc(this.db, "clinics", this.user.uid), data);

        } catch (e) {
            console.error("[Firebase] Save Error:", e);
            ToastManager.showToast("Error guardando en la nube", "error");
            throw e;
        }
    }

    async loadClinicData() {
        if (!this.user || !this.db) throw new Error("Firebase not initialized");
        try {
            const docRef = doc(this.db, "clinics", this.user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data();
            } else {

                return null;
            }
        } catch (e) {
            console.error("[Firebase] Load Error:", e);
            throw e; // Throw so App handler knows it's an error, not emptiness
        }
    }

    async uploadLocalDataToCloud() {
        if (!this.user || !this.db) return false;
        try {
            const raw = localStorage.getItem('clinicState');
            if (!raw) {
                ToastManager.showToast("No hay datos locales para migrar", "warning");
                return false;
            }
            const data = JSON.parse(raw);
            await this.saveClinicData(data);
            ToastManager.showToast("Datos migrados a la nube correctamente", "success");
            return true;
        } catch (e) {
            console.error("Migration Error:", e);
            ToastManager.showToast("Error en la migración", "error");
            return false;
        }
    }
}
