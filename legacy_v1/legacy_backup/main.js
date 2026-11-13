
import { App } from './modules/App.js';

window.addEventListener('DOMContentLoaded', () => {
    // Expose App globally for inline HTML events (legacy support)
    window.app = new App();
    window.clinicStore = window.app.store; // Global store ref

    window.app.init();
});
