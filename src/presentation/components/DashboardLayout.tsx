import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Calendar, Users, LayoutDashboard, Building2, UserCog, Briefcase, Settings2, LogOut, Activity, Stethoscope, Sparkles } from 'lucide-react';
import { AuthService } from '../../infrastructure/firebase/AuthService';
import { SeedService } from '../../application/services/SeedService';
import { clinicRepository } from '../../infrastructure/firebase/ClinicRepository';
import { localStore } from '../../infrastructure/storage/localStore';
import { useAuthStore } from '../store/useAuthStore';
import { CLINIC_SECTORS } from '../../domain/models/types';
import type { Clinic } from '../../domain/models/types';

const authService = new AuthService();
const seedService = new SeedService();

export const DashboardLayout = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [currentClinic, setCurrentClinic] = useState<Clinic | null>(null);
  const [seeding, setSeeding] = useState(false);

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  useEffect(() => {
    if (user?.clinicId) {
      clinicRepository.getClinic(user.clinicId).then(c => {
        if (c) setCurrentClinic(c);
      });
    }

    const handleClinicUpdated = (e: any) => {
      if (e.detail) {
        setCurrentClinic(e.detail);
      }
    };
    window.addEventListener('clinicUpdated', handleClinicUpdated);
    return () => window.removeEventListener('clinicUpdated', handleClinicUpdated);
  }, [user?.clinicId]);

  // Auto-seed EXCLUSIVAMENTE para la clínica demo de pruebas. 
  // Las clínicas creadas por nuevos usuarios empiezan totalmente limpias y sin datos precargados.
  useEffect(() => {
    if (!user || user.clinicId !== 'demo-clinic-id') return;

    const existing = localStore.getCollection<{ id: string; medicalHistory?: string }>('patients_demo-clinic-id');
    const existingServices = localStore.getCollection('services_demo-clinic-id');
    const existingClinic = localStore.getItem('clinics', 'demo-clinic-id');
    const existingUsers = localStore.getCollection<{ schedule?: any }>('users_demo-clinic-id');
    const hasSchedules = existingUsers.some(u => !!u.schedule);
    const hasCarla = existing.some(p => p.id === 'pat-11');
    const hasMedicalHistory = existing.some(p => !!p.medicalHistory);
    const hasClinicLegal = !!(existingClinic as any)?.cif;
    if (existing.length === 0 || !hasCarla || !hasMedicalHistory || existingServices.length === 0 || !existingClinic || !hasSchedules || !hasClinicLegal) {
      seedService.generateMockData('demo-clinic-id').then(() => {
        window.location.reload();
      });
    }
  }, [user]);

  const handleGenerateDummyData = async () => {
    setSeeding(true);
    try {
      await seedService.generateMockData('demo-clinic-id');
      window.location.reload();
    } catch (e) {
      console.error("Error generating dummy data", e);
    } finally {
      setSeeding(false);
    }
  };

  const mainNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
    { path: '/dashboard/agenda', icon: Calendar, label: 'Agenda' },
    { path: '/dashboard/patients', icon: Users, label: 'Pacientes' },
  ];

  const configNavItems = [
    { path: '/dashboard/general', icon: Settings2, label: 'General' },
    { path: '/dashboard/specialties', icon: Stethoscope, label: 'Especialidades' },
    { path: '/dashboard/rooms', icon: Building2, label: 'Salas Físicas' },
    { path: '/dashboard/professionals', icon: UserCog, label: 'Equipo Médico' },
    { path: '/dashboard/services', icon: Briefcase, label: 'Servicios' },
  ];

  const sectorInfo = CLINIC_SECTORS.find(s => s.id === currentClinic?.sector);
  const initials = ((user?.name?.[0] || 'U') + (user?.surname?.[0] || '')).toUpperCase();
  const isDemo = user?.clinicId === 'demo-clinic-id';

  return (
    <div className="flex h-screen bg-bg-light dark:bg-bg-dark overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-light dark:bg-surface-dark border-r border-gray-200 dark:border-gray-800 flex flex-col transition-colors">
        <div className="h-16 flex items-center px-5 border-b border-gray-200 dark:border-gray-800 gap-3">
          {currentClinic?.logoUrl ? (
            <div className="h-9 max-w-[130px] flex items-center shrink-0">
              <img
                src={currentClinic.logoUrl}
                alt={currentClinic.name}
                className="max-h-8 max-w-full object-contain"
              />
            </div>
          ) : (
            <Activity className="w-6 h-6 text-primary flex-shrink-0" />
          )}
          <span className="text-lg font-bold text-slate-800 dark:text-white truncate">
            {currentClinic ? currentClinic.name.split(' — ')[0] : 'LogoPedia'}
          </span>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 hide-scrollbar">
          <div className="mb-6">
            <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Principal</p>
            {mainNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/dashboard'}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-1 ${
                    isActive
                      ? 'bg-blue-50/90 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={`w-5 h-5 mr-3 flex-shrink-0 transition-colors ${
                      isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
                    }`} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>

          <div>
            <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Configuración</p>
            {configNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-1 ${
                    isActive
                      ? 'bg-blue-50/90 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={`w-5 h-5 mr-3 flex-shrink-0 transition-colors ${
                      isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
                    }`} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-3 flex-shrink-0 text-slate-400" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 bg-surface-light dark:bg-surface-dark border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8 shadow-xs z-10">
          <div className="flex items-center gap-3">
            {currentClinic?.logoUrl && (
              <img
                src={currentClinic.logoUrl}
                alt="Logo"
                className="h-8 max-w-[120px] object-contain rounded hidden sm:block"
              />
            )}
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white truncate max-w-md">
              {currentClinic?.name || 'LogoPedia'}
            </h2>
            {isDemo ? (
              <span className="text-xs bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                Demo Clinic
              </span>
            ) : sectorInfo ? (
              <span className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 whitespace-nowrap">
                <span>{sectorInfo.icon}</span>
                <span>{sectorInfo.name}</span>
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-4">
            {isDemo && (
              <button
                onClick={handleGenerateDummyData}
                disabled={seeding}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-xs disabled:opacity-50"
                title="Genera pacientes, citas para esta semana, salas y profesionales para pruebas reales"
              >
                <Sparkles className={`w-3.5 h-3.5 text-slate-400 ${seeding ? 'animate-spin' : ''}`} />
                <span>{seeding ? 'Generando...' : 'Recargar Datos Demo'}</span>
              </button>
            )}

            <div className="flex items-center gap-2.5 pl-2 border-l border-gray-200 dark:border-gray-800">
              <div 
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-sm"
                style={{ backgroundColor: user?.color || '#3B82F6' }}
                title={`${user?.name} ${user?.surname || ''} (${user?.role === 'admin' ? 'Administrador' : 'Empleado'})`}
              >
                {initials}
              </div>
              <div className="hidden md:block text-left text-xs">
                <div className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                  {user?.name} {user?.surname || ''}
                </div>
                <div className="text-gray-400 capitalize">
                  {user?.role === 'admin' ? 'Administrador' : 'Profesional'}
                </div>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 hide-scrollbar">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
