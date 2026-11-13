import { db } from './config';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import type { Clinic, ClinicSchedule } from '../../domain/models/types';
import { CLINIC_SECTORS } from '../../domain/models/types';
import { localStore } from '../storage/localStore';

export const DEFAULT_CLINIC_SCHEDULE: ClinicSchedule = {
  monday: { isOpen: true, openTime: '09:00', closeTime: '21:00' },
  tuesday: { isOpen: true, openTime: '09:00', closeTime: '21:00' },
  wednesday: { isOpen: true, openTime: '09:00', closeTime: '21:00' },
  thursday: { isOpen: true, openTime: '09:00', closeTime: '21:00' },
  friday: { isOpen: true, openTime: '09:00', closeTime: '21:00' },
  saturday: { isOpen: false, openTime: '10:00', closeTime: '14:00' },
  sunday: { isOpen: false, openTime: '10:00', closeTime: '14:00' }
};

export class ClinicRepository {
  async getClinic(clinicId: string): Promise<Clinic | null> {
    const local = localStore.getItem<Clinic>('clinics', clinicId);
    if (local) return local;

    try {
      const docRef = doc(db, 'clinics', clinicId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const item = { id: docSnap.id, ...docSnap.data() } as Clinic;
        localStore.saveItem('clinics', item);
        return item;
      }
    } catch {
      // Offline fallback
    }

    // Default fallback clinic ONLY for demo-clinic-id
    if (clinicId === 'demo-clinic-id') {
      const fallbackClinic: Clinic = {
        id: clinicId,
        name: 'LogoPedia — Centro de Logopedia y Neurodesarrollo',
        createdAt: Date.now(),
        phone: '+34 912 345 678',
        email: 'info@logopedia-centro.com',
        address: 'Calle Mayor 45, Planta 1ª, Madrid',
        sector: 'logopedia',
        inviteCode: 'DEMO-2026',
        schedule: DEFAULT_CLINIC_SCHEDULE,
        cif: 'B-87654321',
        dpoEmail: 'rgpd@logopedia-centro.com'
      };
      localStore.saveItem('clinics', fallbackClinic);
      return fallbackClinic;
    }

    return null;
  }

  async getClinicByInviteCode(code: string): Promise<Clinic | null> {
    const norm = code.trim().toUpperCase();
    if (!norm) return null;

    // Check demo code
    if (norm === 'DEMO-2026') {
      return await this.getClinic('demo-clinic-id');
    }

    // 1. Search in local store
    const localList = localStore.getCollection<Clinic>('clinics');
    const localFound = localList.find(c => c.inviteCode && c.inviteCode.toUpperCase() === norm);
    if (localFound) return localFound;

    // 2. Search in Firestore
    try {
      const q = query(collection(db, 'clinics'), where('inviteCode', '==', norm));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        const clinic = { id: docSnap.id, ...docSnap.data() } as Clinic;
        localStore.saveItem('clinics', clinic);
        return clinic;
      }
    } catch {
      // Offline / Firestore query fallback
    }

    return null;
  }

  async createClinic(params: {
    name: string;
    sector: string;
    phone?: string;
    email?: string;
    address?: string;
    logoUrl?: string;
  }): Promise<Clinic> {
    const clinicId = 'clinic-' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    
    // Find sector prefix
    const sectorDef = CLINIC_SECTORS.find(s => s.id === params.sector);
    const prefix = sectorDef ? sectorDef.prefix : 'CLIN';
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const inviteCode = `${prefix}-${randomDigits}`;

    const newClinic: Clinic = {
      id: clinicId,
      name: params.name.trim(),
      sector: params.sector,
      inviteCode,
      createdAt: Date.now(),
      phone: params.phone?.trim() || '',
      email: params.email?.trim() || '',
      address: params.address?.trim() || '',
      logoUrl: params.logoUrl || '',
      schedule: DEFAULT_CLINIC_SCHEDULE
    };

    await this.saveClinic(newClinic);
    return newClinic;
  }

  async saveClinic(clinic: Clinic): Promise<void> {
    localStore.saveItem('clinics', clinic);
    try {
      const docRef = doc(db, 'clinics', clinic.id);
      const { id, ...dataToSave } = clinic;
      setDoc(docRef, dataToSave, { merge: true }).catch(() => {});
    } catch {
      // Ignore background firestore error
    }
  }

  async updateSchedule(clinicId: string, schedule: ClinicSchedule): Promise<void> {
    const clinic = await this.getClinic(clinicId);
    if (clinic) {
      clinic.schedule = schedule;
      await this.saveClinic(clinic);
    }
  }
}

export const clinicRepository = new ClinicRepository();
