import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './presentation/store/useAuthStore';
import { AuthService } from './infrastructure/firebase/AuthService';
import { Login } from './presentation/pages/Login';
import { DashboardLayout } from './presentation/components/DashboardLayout';
import { CalendarView } from './presentation/pages/CalendarView';
import { UserRepository } from './infrastructure/firebase/UserRepository';
import type { User as AppUser } from './domain/models/types';

// Code-Splitting: Carga perezosa de rutas secundarias
const HomeDashboard = lazy(() => import('./presentation/pages/HomeDashboard').then(m => ({ default: m.HomeDashboard })));
const PatientList = lazy(() => import('./presentation/pages/PatientList').then(m => ({ default: m.PatientList })));
const PatientDetail = lazy(() => import('./presentation/pages/PatientDetail').then(m => ({ default: m.PatientDetail })));
const GeneralSettings = lazy(() => import('./presentation/pages/settings/GeneralSettings').then(m => ({ default: m.GeneralSettings })));
const RoomsSettings = lazy(() => import('./presentation/pages/settings/RoomsSettings').then(m => ({ default: m.RoomsSettings })));
const SpecialtiesSettings = lazy(() => import('./presentation/pages/settings/SpecialtiesSettings').then(m => ({ default: m.SpecialtiesSettings })));
const ProfessionalsSettings = lazy(() => import('./presentation/pages/settings/ProfessionalsSettings').then(m => ({ default: m.ProfessionalsSettings })));
const ServicesSettings = lazy(() => import('./presentation/pages/settings/ServicesSettings').then(m => ({ default: m.ServicesSettings })));

const RouteLoadingFallback = () => (
  <div className="flex-1 flex items-center justify-center p-16">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const authService = new AuthService();
const userRepo = new UserRepository();

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { firebaseUser, loading } = useAuthStore();
  
  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-bg-light dark:bg-bg-dark"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }
  
  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  const { setAuth, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          let appUser = await userRepo.getUserById(firebaseUser.uid);
          
          if (!appUser) {
            appUser = {
              id: firebaseUser.uid,
              clinicId: 'demo-clinic-id',
              name: 'Demo',
              surname: 'User',
              email: firebaseUser.email || '',
              role: 'admin',
              isActive: true,
              color: '#3B82F6',
              roomIds: []
            };
          }
          localStorage.setItem('logopedia_active_uid', firebaseUser.uid);
          setAuth(firebaseUser, appUser);
        } catch (error) {
          console.error("Error fetching user doc:", error);
          const fallbackUser = {
            id: firebaseUser.uid,
            clinicId: 'demo-clinic-id',
            name: 'Demo',
            surname: 'User',
            email: firebaseUser.email || '',
            role: 'admin',
            isActive: true,
            color: '#3B82F6',
            roomIds: []
          };
          setAuth(firebaseUser, fallbackUser as AppUser);
        }
      } else {
        const storedUid = localStorage.getItem('logopedia_active_uid');
        const isDemoLoginEnabled = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';
        if (isDemoLoginEnabled && storedUid) {
          try {
            let appUser = await userRepo.getUserById(storedUid);
            if (!appUser && storedUid === 'demo-admin-id') {
              appUser = {
                id: 'demo-admin-id',
                clinicId: 'demo-clinic-id',
                name: 'Nicolás',
                surname: 'Tercero',
                email: 'admin@logopedia.com',
                role: 'admin',
                isActive: true,
                color: '#3B82F6',
                roomIds: ['room-1', 'room-2']
              };
              await userRepo.saveUser(appUser).catch(() => {});
            }
            if (appUser) {
              const mockFirebaseUser = {
                uid: appUser.id,
                email: appUser.email,
                displayName: `${appUser.name} ${appUser.surname || ''}`.trim()
              } as any;
              setAuth(mockFirebaseUser, appUser);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.warn("Could not restore local session", e);
          }
        }
        setAuth(null, null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [setAuth, setLoading]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Suspense fallback={<RouteLoadingFallback />}><HomeDashboard /></Suspense>} />
          <Route path="agenda" element={<CalendarView />} />
          <Route path="patients" element={<Suspense fallback={<RouteLoadingFallback />}><PatientList /></Suspense>} />
          <Route path="patients/:id" element={<Suspense fallback={<RouteLoadingFallback />}><PatientDetail /></Suspense>} />
          
          {/* Rutas de Configuración */}
          <Route path="general" element={<Suspense fallback={<RouteLoadingFallback />}><GeneralSettings /></Suspense>} />
          <Route path="specialties" element={<Suspense fallback={<RouteLoadingFallback />}><SpecialtiesSettings /></Suspense>} />
          <Route path="rooms" element={<Suspense fallback={<RouteLoadingFallback />}><RoomsSettings /></Suspense>} />
          <Route path="professionals" element={<Suspense fallback={<RouteLoadingFallback />}><ProfessionalsSettings /></Suspense>} />
          <Route path="services" element={<Suspense fallback={<RouteLoadingFallback />}><ServicesSettings /></Suspense>} />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
