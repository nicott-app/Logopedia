import { LogopediaConfig } from './logopedia.js';
import { DentistryConfig } from './dentistry.js';

/**
 * SectorConfigManager — Gestiona la configuración activa según el sector del centro.
 */
class SectorConfigManager {
    constructor() {
        this.currentSector = null;
        this.sectors = {
            'logopedia': LogopediaConfig,
            'dentistry': DentistryConfig
        };
        
        // Detectar sector (prioridad: localStorage > default)
        const savedSector = localStorage.getItem('clinicSector') || 'logopedia';
        this.setSector(savedSector);
    }

    setSector(sectorId) {
        if (this.sectors[sectorId]) {
            this.currentSector = this.sectors[sectorId];
            localStorage.setItem('clinicSector', sectorId);
            return true;
        }
        console.warn(`[SectorConfigManager] Sector ${sectorId} no encontrado. Usando logopedia.`);
        this.currentSector = this.sectors['logopedia'];
        return false;
    }

    get config() {
        return this.currentSector;
    }

    get terms() {
        return this.currentSector.terms;
    }

    get defaults() {
        return this.currentSector.defaults;
    }
}

export const sectorManager = new SectorConfigManager();
