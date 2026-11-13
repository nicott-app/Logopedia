/**
 * ════════════════════════════════════════════════════════════════════════════
 *  CONFIGURACIÓN DE FIREBASE — LOGOPEDIA / TIMECARE
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  ⚠️  SEGURIDAD — LEE ESTO ANTES DE TOCAR ESTE ARCHIVO:
 *
 *  1.  Este archivo contiene credenciales de Firebase (API Keys, Project ID...).
 *  2.  NUNCA subas este archivo a un repositorio público (GitHub, GitLab, etc.).
 *  3.  Añade "js/config.js" a tu .gitignore si usas control de versiones.
 *  4.  Las API Keys de Firebase para web son de baja sensibilidad por diseño
 *      (el acceso real se controla en Firebase Security Rules y Firebase Auth),
 *      pero exponerlas públicamente permite abuso de cuota y costes inesperados.
 *  5.  Configura correctamente las "Authorized Domains" en Firebase Console →
 *      Authentication → Settings → Authorized Domains.
 *  6.  Activa Firebase App Check para protección adicional contra bots y abusos.
 *
 *  📋 Para cambiar de entorno (staging → producción), simplemente reemplaza
 *     los valores de este objeto con los del nuevo proyecto Firebase.
 *
 * ════════════════════════════════════════════════════════════════════════════
 */
export const FIREBASE_CONFIG = {
    apiKey:            "AIzaSyBRtmzHea_JMZVxvpHHZ680YEODr47oCz0",
    authDomain:        "timecare-105fe.firebaseapp.com",
    projectId:         "timecare-105fe",
    storageBucket:     "timecare-105fe.firebasestorage.app",
    messagingSenderId: "976600390044",
    appId:             "1:976600390044:web:391192338599a05a7a9059",
    measurementId:     "G-7RC55DLMSP"
};

/**
 * ID de la base de datos Firestore con nombre específico.
 * Para Firestore default usar "(default)".
 */
export const FIRESTORE_DATABASE_ID = "timecareapp";
