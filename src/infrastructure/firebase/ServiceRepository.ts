import { db } from './config';
import { doc, getDoc, setDoc, updateDoc, collection, query, getDocs, where, deleteDoc } from 'firebase/firestore';
import type { ClinicalService } from '../../domain/models/types';
import { localStore } from '../storage/localStore';

export class ServiceRepository {
  private getCollectionRef(clinicId: string) {
    return collection(db, 'clinics', clinicId, 'services');
  }

  async getService(clinicId: string, serviceId: string): Promise<ClinicalService | null> {
    const local = localStore.getItem<ClinicalService>(`services_${clinicId}`, serviceId);
    if (local) return local;

    try {
      const docRef = doc(db, 'clinics', clinicId, 'services', serviceId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const item = { id: docSnap.id, clinicId, ...docSnap.data() } as ClinicalService;
        localStore.saveItem(`services_${clinicId}`, item);
        return item;
      }
    } catch {
      // Offline fallback
    }
    return null;
  }

  async getServicesByClinic(clinicId: string, includeInactive: boolean = false): Promise<ClinicalService[]> {
    const local = localStore.getCollection<ClinicalService>(`services_${clinicId}`);
    if (local.length > 0) {
      return includeInactive ? local : local.filter(s => s.isActive);
    }

    try {
      const conditions = [];
      if (!includeInactive) {
        conditions.push(where('isActive', '==', true));
      }
      
      const q = query(this.getCollectionRef(clinicId), ...conditions);
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const services = querySnapshot.docs.map(doc => ({ id: doc.id, clinicId, ...doc.data() } as ClinicalService));
        localStore.setCollection(`services_${clinicId}`, services);
        return services;
      }
    } catch {
      // Offline fallback
    }
    return [];
  }

  async saveService(service: ClinicalService): Promise<void> {
    localStore.saveItem(`services_${service.clinicId}`, service);
    try {
      const docRef = doc(db, 'clinics', service.clinicId, 'services', service.id);
      const { id, clinicId, ...dataToSave } = service;
      setDoc(docRef, dataToSave, { merge: true }).catch(() => {});
    } catch {
      // Ignore background firestore error
    }
  }

  async updateServiceStatus(clinicId: string, serviceId: string, isActive: boolean): Promise<void> {
    const local = localStore.getItem<ClinicalService>(`services_${clinicId}`, serviceId);
    if (local) {
      localStore.saveItem(`services_${clinicId}`, { ...local, isActive });
    }
    try {
      const docRef = doc(db, 'clinics', clinicId, 'services', serviceId);
      updateDoc(docRef, { isActive }).catch(() => {});
    } catch {
      // Ignore background firestore error
    }
  }

  async deleteService(clinicId: string, serviceId: string): Promise<void> {
    localStore.deleteItem(`services_${clinicId}`, serviceId);
    try {
      const docRef = doc(db, 'clinics', clinicId, 'services', serviceId);
      deleteDoc(docRef).catch(() => {});
    } catch {
      // Ignore background firestore error
    }
  }
}

export const serviceRepository = new ServiceRepository();
