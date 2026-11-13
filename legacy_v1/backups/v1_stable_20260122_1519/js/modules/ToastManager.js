export class ToastManager {
    static showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        // Base Styles: Glassmorphism + Animation
        toast.className = "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg transform transition-all duration-300 translate-x-full opacity-0 backdrop-blur-md border";

        // Type Styles
        if (type === 'success') {
            toast.classList.add('bg-green-50/90', 'dark:bg-green-900/90', 'text-green-700', 'dark:text-green-100', 'border-green-200', 'dark:border-green-800');
            toast.innerHTML = `<span class="material-symbols-outlined text-xl">check_circle</span>`;
        } else if (type === 'error') {
            toast.classList.add('bg-red-50/90', 'dark:bg-red-900/90', 'text-red-700', 'dark:text-red-100', 'border-red-200', 'dark:border-red-800');
            toast.innerHTML = `<span class="material-symbols-outlined text-xl">error</span>`;
        } else {
            toast.classList.add('bg-blue-50/90', 'dark:bg-blue-900/90', 'text-blue-700', 'dark:text-blue-100', 'border-blue-200', 'dark:border-blue-800');
            toast.innerHTML = `<span class="material-symbols-outlined text-xl">info</span>`;
        }

        // Message
        const msgSpan = document.createElement('span');
        msgSpan.className = "text-sm font-bold pr-2";
        msgSpan.innerText = message;
        toast.appendChild(msgSpan);

        container.appendChild(toast);

        // Animate In (Next Frame)
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        });

        // Auto Remove
        setTimeout(() => {
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => toast.remove(), 300); // Wait for transition
        }, 3000); // 3 seconds visible
    }
}
