import { create } from 'zustand';
import type { User as FirebaseUser } from 'firebase/auth';
import type { User as AppUser } from '../../domain/models/types';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: AppUser | null;
  loading: boolean;
  setAuth: (firebaseUser: FirebaseUser | null, appUser: AppUser | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  user: null,
  loading: true,
  setAuth: (firebaseUser, appUser) => set({ firebaseUser, user: appUser }),
  setLoading: (loading) => set({ loading }),
}));

