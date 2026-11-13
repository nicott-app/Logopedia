import { db } from './config';
import { doc, setDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import type { LegalConsent } from '../../domain/models/types';
import { localStore } from '../storage/localStore';

export class ConsentRepository {
  private getCollectionRef(clinicId: string) {
    return collection(db, 'clinics', clinicId, 'consents');
  }

  async saveConsent(consent: LegalConsent): Promise<void> {
    localStore.saveItem(`consents_${consent.clinicId}`, consent);
    try {
      const docRef = doc(db, 'clinics', consent.clinicId, 'consents', consent.id);
      setDoc(docRef, consent).catch(() => {});
    } catch (e) {
      console.warn("Firestore saveConsent queued/offline:", e);
    }
  }

  async getPatientConsents(clinicId: string, patientId: string): Promise<LegalConsent[]> {
    const local = localStore.getCollection<LegalConsent>(`consents_${clinicId}`);
    const filtered = local.filter(c => c.patientId === patientId).sort((a, b) => b.signedAt - a.signedAt);
    if (filtered.length > 0) return filtered;

    try {
      const q = query(
        this.getCollectionRef(clinicId), 
        where('patientId', '==', patientId),
        orderBy('signedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        return querySnapshot.docs.map(doc => doc.data() as LegalConsent);
      }
    } catch {
      // Offline fallback
    }
    return [];
  }
}
