import { db } from './config';
import { doc, getDoc, setDoc, updateDoc, collection, query, getDocs, where } from 'firebase/firestore';
import type { Room } from '../../domain/models/types';
import { localStore } from '../storage/localStore';

export class RoomRepository {
  private getCollectionRef(clinicId: string) {
    return collection(db, 'clinics', clinicId, 'rooms');
  }

  async getRoom(clinicId: string, roomId: string): Promise<Room | null> {
    const local = localStore.getItem<Room>(`rooms_${clinicId}`, roomId);
    if (local) return local;

    try {
      const docRef = doc(db, 'clinics', clinicId, 'rooms', roomId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const item = { id: docSnap.id, clinicId, ...docSnap.data() } as Room;
        localStore.saveItem(`rooms_${clinicId}`, item);
        return item;
      }
    } catch {
      // Offline fallback
    }
    return null;
  }

  async getRoomsByClinic(clinicId: string, includeInactive: boolean = false): Promise<Room[]> {
    const local = localStore.getCollection<Room>(`rooms_${clinicId}`);
    if (local.length > 0) {
      return includeInactive ? local : local.filter(r => r.isActive);
    }

    try {
      const conditions = [];
      if (!includeInactive) {
        conditions.push(where('isActive', '==', true));
      }
      
      const q = query(this.getCollectionRef(clinicId), ...conditions);
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const rooms = querySnapshot.docs.map(doc => ({ id: doc.id, clinicId, ...doc.data() } as Room));
        localStore.setCollection(`rooms_${clinicId}`, rooms);
        return rooms;
      }
    } catch {
      // Offline fallback
    }
    return [];
  }

  async saveRoom(room: Room): Promise<void> {
    localStore.saveItem(`rooms_${room.clinicId}`, room);
    try {
      const docRef = doc(db, 'clinics', room.clinicId, 'rooms', room.id);
      const { id, clinicId, ...dataToSave } = room;
      setDoc(docRef, dataToSave, { merge: true }).catch(() => {});
    } catch (e) {
      console.warn("Firestore saveRoom queued/offline:", e);
    }
  }

  async updateRoom(clinicId: string, roomId: string, data: Partial<Room>): Promise<void> {
    const existing = localStore.getItem<Room>(`rooms_${clinicId}`, roomId);
    if (existing) {
      localStore.saveItem(`rooms_${clinicId}`, { ...existing, ...data });
    }
    try {
      const docRef = doc(db, 'clinics', clinicId, 'rooms', roomId);
      updateDoc(docRef, data).catch(() => {});
    } catch (e) {
      console.warn("Firestore updateRoom queued/offline:", e);
    }
  }

  async deleteRoom(clinicId: string, roomId: string): Promise<void> {
    const existing = localStore.getItem<Room>(`rooms_${clinicId}`, roomId);
    if (existing) {
      localStore.saveItem(`rooms_${clinicId}`, { ...existing, isActive: false });
    }
    try {
      const docRef = doc(db, 'clinics', clinicId, 'rooms', roomId);
      updateDoc(docRef, { isActive: false }).catch(() => {});
    } catch (e) {
      console.warn("Firestore deleteRoom queued/offline:", e);
    }
  }
}
