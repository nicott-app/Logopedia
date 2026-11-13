export class CryptoService {
    constructor() {
        this.enabled = localStorage.getItem('encryption_enabled') === 'true';
    }

    isEnabled() {
        return this.enabled;
    }

    enable(password) {
        if (!password) return false;
        // Verify we can encrypt/decrypt with this password before committing
        const test = this.encryptData("test", password);
        if (!test) return false;

        localStorage.setItem('encryption_enabled', 'true');
        this.enabled = true;
        return true;
    }

    disable() {
        localStorage.removeItem('encryption_enabled');
        this.enabled = false;
    }

    isEncrypted(data) {
        // Simple check: starts with 'U2FsdGVk' (Salted__ in base64, typical CryptoJS format)
        return typeof data === 'string' && data.startsWith('U2FsdGVk');
    }

    encryptData(data, password) {
        try {
            if (!data) return null;
            if (typeof CryptoJS === 'undefined') {
                console.error('CryptoJS library not loaded');
                return null;
            }
            // Ensure we are encrypting a string (JSON)
            const stringData = typeof data === 'object' ? JSON.stringify(data) : String(data);
            return CryptoJS.AES.encrypt(stringData, password).toString();
        } catch (e) {
            console.error("Encryption failed", e);
            return null;
        }
    }

    decryptData(ciphertext, password) {
        try {
            if (!ciphertext) return null;
            if (typeof CryptoJS === 'undefined') {
                console.error('CryptoJS library not loaded');
                return null;
            }
            const bytes = CryptoJS.AES.decrypt(ciphertext, password);
            const decryptedString = bytes.toString(CryptoJS.enc.Utf8);

            if (!decryptedString) return null; // Wrong password usually results in empty or junk

            try {
                return JSON.parse(decryptedString);
            } catch {
                return decryptedString;
            }
        } catch (e) {
            console.error("Decryption failed", e);
            return null;
        }
    }

    hashPin(pin) {
        try {
            if (!pin) return null;
            if (typeof CryptoJS === 'undefined') {
                console.error('CryptoJS library not loaded');
                return null;
            }
            return CryptoJS.SHA256(String(pin)).toString();
        } catch (e) {
            console.error("Hashing failed", e);
            return null;
        }
    }
}
