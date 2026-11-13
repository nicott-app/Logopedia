import { db } from './config';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import type { User } from '../../domain/models/types';
import { localStore } from '../storage/localStore';

export class UserRepository {
  private collectionName = 'users';

  async getUserById(userId: string): Promise<User | null> {
    // 1. Check users_all
    const fromAll = localStore.getItem<User>('users_all', userId);
    if (fromAll) return fromAll;

    // 2. Check demo clinic collection
    const demo = localStore.getItem<User>('users_demo-clinic-id', userId);
    if (demo) return demo;

    // 3. Scan all localStorage keys starting with logopedia_users_
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('logopedia_users_')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const list: User[] = JSON.parse(raw);
            const found = list.find(u => u.id === userId);
            if (found) {
              localStore.saveItem('users_all', found);
              return found;
            }
          }
        }
      }
    } catch {
      // LocalStorage scan error
    }

    // 4. Firestore
    try {
      const docRef = doc(db, this.collectionName, userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const u = { id: docSnap.id, ...docSnap.data() } as User;
        localStore.saveItem(`users_${u.clinicId}`, u);
        localStore.saveItem('users_all', u);
        return u;
      }
    } catch {
      // Offline fallback
    }
    return null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const norm = email.trim().toLowerCase();
    
    // 1. Check users_all
    const all = localStore.getCollection<User>('users_all');
    const foundAll = all.find(u => u.email.toLowerCase() === norm);
    if (foundAll) return foundAll;

    // 2. Scan localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('logopedia_users_')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const list: User[] = JSON.parse(raw);
            const found = list.find(u => u.email.toLowerCase() === norm);
            if (found) {
              localStore.saveItem('users_all', found);
              return found;
            }
          }
        }
      }
    } catch {
      // Scan fallback
    }

    // 3. Firestore
    try {
      const q = query(collection(db, this.collectionName), where('email', '==', norm));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const u = { id: docSnap.id, ...docSnap.data() } as User;
        localStore.saveItem(`users_${u.clinicId}`, u);
        localStore.saveItem('users_all', u);
        return u;
      }
    } catch {
      // Offline fallback
    }

    return null;
  }

  async getUsersByClinic(clinicId: string, includeInactive: boolean = false): Promise<User[]> {
    const local = localStore.getCollection<User>(`users_${clinicId}`);
    if (local.length > 0) {
      return includeInactive ? local : local.filter(u => u.isActive);
    }

    try {
      const conditions: any[] = [where('clinicId', '==', clinicId)];
      
      if (!includeInactive) {
        conditions.push(where('isActive', '==', true));
      }
      
      const q = query(collection(db, this.collectionName), ...conditions);
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        localStore.setCollection(`users_${clinicId}`, users);
        return users;
      }
    } catch {
      // Offline fallback
    }
    return [];
  }

  async saveUser(user: User): Promise<void> {
    localStore.saveItem(`users_${user.clinicId}`, user);
    localStore.saveItem('users_all', user);
    try {
      const docRef = doc(db, this.collectionName, user.id);
      setDoc(docRef, user, { merge: true }).catch(() => {});
    } catch (e) {
      console.warn("Firestore saveUser queued/offline:", e);
    }
  }

  async updateUser(userId: string, data: Partial<User>): Promise<void> {
    const existing = await this.getUserById(userId);
    const clinicId = data.clinicId || existing?.clinicId || 'demo-clinic-id';
    if (existing) {
      const updated = { ...existing, ...data };
      localStore.saveItem(`users_${clinicId}`, updated);
      localStore.saveItem('users_all', updated);
    }
    try {
      const docRef = doc(db, this.collectionName, userId);
      updateDoc(docRef, data).catch(() => {});
    } catch (e) {
      console.warn("Firestore updateUser queued/offline:", e);
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const existing = await this.getUserById(userId);
    if (existing) {
      const deactivated = { ...existing, isActive: false };
      localStore.saveItem(`users_${existing.clinicId}`, deactivated);
      localStore.saveItem('users_all', deactivated);
    }
    try {
      const docRef = doc(db, this.collectionName, userId);
      updateDoc(docRef, { isActive: false }).catch(() => {});
    } catch (e) {
      console.warn("Firestore deleteUser queued/offline:", e);
    }
  }
}
