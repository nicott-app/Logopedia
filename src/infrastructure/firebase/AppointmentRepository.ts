import { db } from './config';
import { doc, getDoc, setDoc, updateDoc, collection, query, getDocs, where, deleteDoc } from 'firebase/firestore';
import type { Appointment } from '../../domain/models/types';
import { localStore } from '../storage/localStore';

export class AppointmentRepository {
  private getCollectionRef(clinicId: string) {
    return collection(db, 'clinics', clinicId, 'appointments');
  }

  async getAppointment(clinicId: string, appointmentId: string): Promise<Appointment | null> {
    const local = localStore.getItem<Appointment>(`appointments_${clinicId}`, appointmentId);
    if (local) return local;

    try {
      const docRef = doc(db, 'clinics', clinicId, 'appointments', appointmentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const item = { id: docSnap.id, clinicId, ...docSnap.data() } as Appointment;
        localStore.saveItem(`appointments_${clinicId}`, item);
        return item;
      }
    } catch {
      // Offline fallback
    }
    return null;
  }

  async getAppointmentsByDateRange(clinicId: string, startIso: string, endIso: string): Promise<Appointment[]> {
    const all = localStore.getCollection<Appointment>(`appointments_${clinicId}`);
    if (all.length > 0) {
      return all.filter(a => a.start >= startIso && a.start <= endIso);
    }

    try {
      const q = query(
        this.getCollectionRef(clinicId),
        where('start', '>=', startIso),
        where('start', '<=', endIso)
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const appts = querySnapshot.docs.map(doc => ({ id: doc.id, clinicId, ...doc.data() } as Appointment));
        localStore.setCollection(`appointments_${clinicId}`, appts);
        return appts;
      }
    } catch {
      // Offline fallback
    }
    return [];
  }
  
  async getAppointmentsByProfessional(clinicId: string, professionalId: string): Promise<Appointment[]> {
    const all = localStore.getCollection<Appointment>(`appointments_${clinicId}`);
    if (all.length > 0) {
      return all.filter(a => a.professionalId === professionalId);
    }

    try {
      const q = query(
        this.getCollectionRef(clinicId),
        where('professionalId', '==', professionalId)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        return querySnapshot.docs.map(doc => ({ id: doc.id, clinicId, ...doc.data() } as Appointment));
      }
    } catch {
      // Offline fallback
    }
    return [];
  }

  async getAppointmentsByPatient(clinicId: string, patientId: string): Promise<Appointment[]> {
    const all = localStore.getCollection<Appointment>(`appointments_${clinicId}`);
    if (all.length > 0) {
      return all.filter(a => a.patientId === patientId);
    }

    try {
      const q = query(
        this.getCollectionRef(clinicId),
        where('patientId', '==', patientId)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        return querySnapshot.docs.map(doc => ({ id: doc.id, clinicId, ...doc.data() } as Appointment));
      }
    } catch {
      // Offline fallback
    }
    return [];
  }

  async getAllAppointments(clinicId: string): Promise<Appointment[]> {
    const all = localStore.getCollection<Appointment>(`appointments_${clinicId}`);
    if (all.length > 0) {
      return all;
    }

    try {
      const q = query(this.getCollectionRef(clinicId));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const items = querySnapshot.docs.map(doc => ({ id: doc.id, clinicId, ...doc.data() } as Appointment));
        localStore.setCollection(`appointments_${clinicId}`, items);
        return items;
      }
    } catch {
      // Offline fallback
    }
    return [];
  }

  async saveAppointment(appointment: Appointment): Promise<void> {
    localStore.saveItem(`appointments_${appointment.clinicId}`, appointment);
    try {
      const docRef = doc(db, 'clinics', appointment.clinicId, 'appointments', appointment.id);
      const { id, clinicId, ...dataToSave } = appointment;
      // No usar await en llamadas Firestore para no bloquear en modo offline
      setDoc(docRef, dataToSave, { merge: true }).catch(() => {});
    } catch (e) {
      console.warn("Firestore saveAppointment queued/offline:", e);
    }
  }

  async updateAppointment(clinicId: string, appointmentId: string, data: Partial<Appointment>): Promise<void> {
    const local = localStore.getItem<Appointment>(`appointments_${clinicId}`, appointmentId);
    if (local) {
      localStore.saveItem(`appointments_${clinicId}`, { ...local, ...data });
    }
    try {
      const docRef = doc(db, 'clinics', clinicId, 'appointments', appointmentId);
      // No usar await en llamadas Firestore para no bloquear en modo offline
      updateDoc(docRef, data).catch(() => {});
    } catch (e) {
      console.warn("Firestore updateAppointment queued/offline:", e);
    }
  }

  async deleteAppointment(clinicId: string, appointmentId: string): Promise<void> {
    localStore.deleteItem(`appointments_${clinicId}`, appointmentId);
    try {
      const docRef = doc(db, 'clinics', clinicId, 'appointments', appointmentId);
      // No usar await en llamadas Firestore para no bloquear en modo offline
      deleteDoc(docRef).catch(() => {});
    } catch (e) {
      console.warn("Firestore deleteAppointment queued/offline:", e);
    }
  }
}
