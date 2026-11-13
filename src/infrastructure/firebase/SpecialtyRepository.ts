import { db } from './config';
import { doc, setDoc, updateDoc, collection, query, getDocs, where } from 'firebase/firestore';
import type { Specialty } from '../../domain/models/types';
import { localStore } from '../storage/localStore';

export class SpecialtyRepository {
  private getCollectionRef(clinicId: string) {
    return collection(db, 'clinics', clinicId, 'specialties');
  }

  async getSpecialtiesByClinic(clinicId: string, includeInactive: boolean = false): Promise<Specialty[]> {
    const local = localStore.getCollection<Specialty>(`specialties_${clinicId}`);
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
        const specs = querySnapshot.docs.map(doc => ({ id: doc.id, clinicId, ...doc.data() } as Specialty));
        localStore.setCollection(`specialties_${clinicId}`, specs);
        return specs;
      }
    } catch {
      // Offline fallback
    }
    return [];
  }

  async saveSpecialty(specialty: Specialty): Promise<void> {
    localStore.saveItem(`specialties_${specialty.clinicId}`, specialty);
    try {
      const docRef = doc(db, 'clinics', specialty.clinicId, 'specialties', specialty.id);
      const { id, clinicId, ...dataToSave } = specialty;
      setDoc(docRef, dataToSave, { merge: true }).catch(() => {});
    } catch (e) {
      console.warn("Firestore saveSpecialty queued/offline:", e);
    }
  }

  async deleteSpecialty(clinicId: string, specialtyId: string): Promise<void> {
    const list = localStore.getCollection<Specialty>(`specialties_${clinicId}`);
    const found = list.find(s => s.id === specialtyId);
    if (found) {
      localStore.saveItem(`specialties_${clinicId}`, { ...found, isActive: false });
    }
    try {
      const docRef = doc(db, 'clinics', clinicId, 'specialties', specialtyId);
      updateDoc(docRef, { isActive: false }).catch(() => {});
    } catch (e) {
      console.warn("Firestore deleteSpecialty queued/offline:", e);
    }
  }
}
