import { FirebaseManager } from './modules/FirebaseManager.js';

// Initialize Firebase (we use the existing manager for consistency)
const firebaseManager = new FirebaseManager();
const initSuccess = firebaseManager.init();

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const btnLoading = document.getElementById('btn-login-loading');
const errorBox = document.getElementById('login-error');
const errorMsg = document.getElementById('login-error-msg');

// Focus email on load
window.addEventListener('load', () => {
    if (emailInput) emailInput.focus();

    // Check if already logged in
    firebaseManager.monitorAuthState((user) => {
        if (user) {
            // Already logged in, redirect
            window.location.href = 'index.html';
        }
    });
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value;
    const password = passwordInput.value;

    if (!email || !password) return;

    // UI Loading State
    setLoading(true);
    hideError();

    // Attempt Login
    if (initSuccess) {
        // Real Firebase Login
        const success = await firebaseManager.login(email, password);
        if (success) {
            // Redirect happens automatically or via callback, but let's force it on success
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 500);
        } else {
            setLoading(false);
            // FirebaseManager handles generic toasts, but we show inline error too
            showError("Credenciales inválidas o error de conexión.");
        }
    } else {
        // Firebase not configured — block login
        setLoading(false);
        showError("Servicio de autenticación no disponible. Contacta al administrador.");
    }
});

function setLoading(isLoading) {
    if (isLoading) {
        btnLogin.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        emailInput.disabled = true;
        passwordInput.disabled = true;
    } else {
        btnLogin.classList.remove('hidden');
        btnLoading.classList.add('hidden');
        emailInput.disabled = false;
        passwordInput.disabled = false;
    }
}

function showError(msg) {
    errorBox.classList.remove('hidden');
    errorMsg.textContent = msg;
    // Shake animation
    const formContainer = document.querySelector('form');
    formContainer.classList.add('animate-pulse');
    setTimeout(() => formContainer.classList.remove('animate-pulse'), 500);
}

function hideError() {
    errorBox.classList.add('hidden');
}
