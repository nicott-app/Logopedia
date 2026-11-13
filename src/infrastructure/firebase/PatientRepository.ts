import { db } from './config';
import { doc, getDoc, setDoc, updateDoc, collection, query, getDocs } from 'firebase/firestore';
import type { Patient } from '../../domain/models/types';
import { localStore } from '../storage/localStore';

export class PatientRepository {
  private getCollectionRef(clinicId: string) {
    return collection(db, 'clinics', clinicId, 'patients');
  }

  async getPatient(clinicId: string, patientId: string): Promise<Patient | null> {
    const local = localStore.getItem<Patient>(`patients_${clinicId}`, patientId);
    if (local) return local;

    try {
      const docRef = doc(db, 'clinics', clinicId, 'patients', patientId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const p = { id: docSnap.id, clinicId, ...docSnap.data() } as Patient;
        localStore.saveItem(`patients_${clinicId}`, p);
        return p;
      }
    } catch {
      // Offline fallback
    }
    return null;
  }

  async getPatientById(clinicId: string, patientId: string): Promise<Patient | null> {
    return this.getPatient(clinicId, patientId);
  }

  async getPatientsByClinic(clinicId: string): Promise<Patient[]> {
    const localList = localStore.getCollection<Patient>(`patients_${clinicId}`);
    if (localList.length > 0) {
      return localList;
    }

    try {
      const q = query(this.getCollectionRef(clinicId));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const patients = querySnapshot.docs.map(doc => ({ id: doc.id, clinicId, ...doc.data() } as Patient));
        localStore.setCollection(`patients_${clinicId}`, patients);
        return patients;
      }
    } catch {
      // Offline fallback
    }
    return [];
  }

  async savePatient(patient: Patient): Promise<void> {
    localStore.saveItem(`patients_${patient.clinicId}`, patient);
    try {
      const docRef = doc(db, 'clinics', patient.clinicId, 'patients', patient.id);
      const { id, clinicId, ...dataToSave } = patient;
      setDoc(docRef, dataToSave, { merge: true }).catch(() => {});
    } catch (e) {
      console.warn("Firestore savePatient queued/offline:", e);
    }
  }

  async updatePatient(clinicId: string, patientId: string, data: Partial<Patient>): Promise<void> {
    const existing = localStore.getItem<Patient>(`patients_${clinicId}`, patientId);
    if (existing) {
      localStore.saveItem(`patients_${clinicId}`, { ...existing, ...data });
    }
    try {
      const docRef = doc(db, 'clinics', clinicId, 'patients', patientId);
      updateDoc(docRef, data).catch(() => {});
    } catch (e) {
      console.warn("Firestore updatePatient queued/offline:", e);
    }
  }

  async deletePatient(clinicId: string, patientId: string): Promise<void> {
    const existing = localStore.getItem<Patient>(`patients_${clinicId}`, patientId);
    if (existing) {
      localStore.saveItem(`patients_${clinicId}`, { ...existing, status: 'deleted', isActive: false });
    }
    try {
      const docRef = doc(db, 'clinics', clinicId, 'patients', patientId);
      updateDoc(docRef, { status: 'deleted', isActive: false }).catch(() => {});
    } catch (e) {
      console.warn("Firestore deletePatient queued/offline:", e);
    }
  }
}
