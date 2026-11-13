import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ToastManager } from "./ToastManager.js";

export class FirebaseManager {
    constructor() {
        // ⚠️ PASTE YOUR FIREBASE CONFIG HERE
        this.firebaseConfig = {
            apiKey: "AIzaSyBRtmzHea_JMZVxvpHHZ680YEODr47oCz0",
            authDomain: "timecare-105fe.firebaseapp.com",
            projectId: "timecare-105fe",
            storageBucket: "timecare-105fe.firebasestorage.app",
            messagingSenderId: "976600390044",
            appId: "1:976600390044:web:391192338599a05a7a9059",
            measurementId: "G-7RC55DLMSP"
        };

        this.app = null;
        this.auth = null;
        this.db = null;
        this.user = null;
    }

    init() {
        try {
            if (this.firebaseConfig.apiKey === "API_KEY_PLACEHOLDER") {
                console.warn("[Firebase] Config not set. Skipping init.");
                return false;
            }
            this.app = initializeApp(this.firebaseConfig);
            this.auth = getAuth(this.app);
            // Connect to the named database (as seen in user screenshot)
            this.db = getFirestore(this.app, "timecareapp");
            console.log("[Firebase] Initialized (DB: timecareapp)");
            return true;
        } catch (e) {
            console.error("[Firebase] Init Error:", e);
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
            console.log("[Firebase] Data Saved");
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
                console.log("[Firebase] No cloud data found for user.");
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
