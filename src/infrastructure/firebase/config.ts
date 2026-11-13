import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, disableNetwork } from 'firebase/firestore';

// TODO: Replace with your actual Firebase config from environment variables
const env = (import.meta as any).env || {};
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "dummy-api-key",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "localhost",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "timecare-105fe",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "localhost",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000",
  appId: env.VITE_FIREBASE_APP_ID || "1:000000000:web:000000000",
};

const app = initializeApp(firebaseConfig);

const databaseId = env.VITE_FIREBASE_DATABASE_ID || "timecareapp";

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
}, databaseId);

// Modo de red:
// - En Node.js (scripts de auditoría / simulación): la red se desactiva para no bloquear procesos.
// - En el navegador (producción / dev conectado): la red está activa en la nube para sincronización en tiempo real.
// - Si se define VITE_OFFLINE_DEMO="true", se fuerza el modo local.
const isNode = typeof window === 'undefined';
const isOfflineDemo = isNode || env.VITE_OFFLINE_DEMO === 'true';

if (isOfflineDemo) {
  disableNetwork(db).catch(() => {});
} else {
  console.info("🌐 Firestore: Conexión a la nube activa para sincronización en tiempo real");
}
