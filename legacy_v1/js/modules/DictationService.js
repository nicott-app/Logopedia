
import { ToastManager } from './ToastManager.js';

export class DictationService {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.onResultCallback = null;
        this.onEndCallback = null;

        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'es-ES';

            this.recognition.onstart = () => {
                this.isListening = true;
            };

            this.recognition.onend = () => {
                this.isListening = false;
                if (this.onEndCallback) this.onEndCallback();
            };

            this.recognition.onerror = (event) => {
                console.error('Dictation Error:', event.error);
                this.isListening = false;
                if (this.onEndCallback) this.onEndCallback();
                if (event.error === 'not-allowed') {
                    ToastManager.showToast('Permiso de micrófono denegado', 'error');
                } else {
                    ToastManager.showToast('Error en dictado: ' + event.error, 'error');
                }
            };

            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                if (this.onResultCallback) {
                    this.onResultCallback(finalTranscript, interimTranscript);
                }
            };
        } else {
            // Web Speech API not supported, this.recognition remains null
        }
    }

    start(onResult, onEnd) {
        if (!this.recognition) {
            ToastManager.showToast('Tu navegador no soporta dictado de voz', 'warning');
            return;
        }
        if (this.isListening) return;

        this.onResultCallback = onResult;
        this.onEndCallback = onEnd;
        try {
            this.recognition.start();
        } catch (e) {
            console.error('Failed to start recognition', e);
        }
    }

    stop() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    isSupported() {
        return !!this.recognition;
    }
}
