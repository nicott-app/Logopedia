import { auth } from './config';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { UserRepository } from './UserRepository';

const userRepo = new UserRepository();

export class AuthService {
  /**
   * Login contra Firebase Auth con fallback local
   */
  async login(email: string, password: string): Promise<FirebaseUser | null> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        localStorage.setItem('logopedia_active_uid', userCredential.user.uid);
      }
      return userCredential.user;
    } catch {
      // Intentar fallback con usuario guardado localmente
      const localUser = await userRepo.getUserByEmail(email);
      if (localUser) {
        localStorage.setItem('logopedia_active_uid', localUser.id);
        const mockFirebaseUser = {
          uid: localUser.id,
          email: localUser.email,
          displayName: `${localUser.name} ${localUser.surname || ''}`.trim()
        } as unknown as FirebaseUser;
        return mockFirebaseUser;
      }
      throw new Error("Credenciales incorrectas o usuario no encontrado");
    }
  }

  /**
   * Registro en Firebase Auth con fallback offline
   */
  async register(email: string, password: string): Promise<{ uid: string; email: string }> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      localStorage.setItem('logopedia_active_uid', uid);
      return { uid, email: userCredential.user.email || email };
    } catch {
      // Fallback offline / local
      const fallbackUid = 'usr-' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      localStorage.setItem('logopedia_active_uid', fallbackUid);
      return { uid: fallbackUid, email };
    }
  }

  async logout(): Promise<void> {
    localStorage.removeItem('logopedia_active_uid');
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error cerrando sesión:", error);
    }
  }

  onAuthStateChange(callback: (user: FirebaseUser | null) => void): () => void {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      callback(user);
    });
    return unsubscribe;
  }
}
