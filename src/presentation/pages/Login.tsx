import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthService } from '../../infrastructure/firebase/AuthService';
import { clinicRepository } from '../../infrastructure/firebase/ClinicRepository';
import { UserRepository } from '../../infrastructure/firebase/UserRepository';
import { useAuthStore } from '../store/useAuthStore';
import { CLINIC_SECTORS } from '../../domain/models/types';
import type { Clinic, User as AppUser } from '../../domain/models/types';
import { 
  Lock, Mail, Activity, Building2, Users, ArrowRight, ArrowLeft, 
  Check, AlertCircle, CheckCircle2, Phone, MapPin, User, Stethoscope, Sparkles, Upload, ShieldCheck
} from 'lucide-react';
import { processLogoImage } from '../utils/imageUtils';
import { PrivacyPolicyModal } from '../components/modals/PrivacyPolicyModal';

const authService = new AuthService();
const userRepo = new UserRepository();

const PRESET_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#6366F1'];
const isDemoLoginEnabled = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

export const Login = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Mode: 'login' | 'register'
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register multi-step state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  // Step 1: User credentials
  const [userName, setUserName] = useState('');
  const [userSurname, setUserSurname] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Step 2: Intent
  const [intent, setIntent] = useState<'create_clinic' | 'join_clinic' | null>(null);

  // Step 3A: Create Clinic
  const [clinicName, setClinicName] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('logopedia');
  const [clinicPhone, setClinicPhone] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicLogo, setClinicLogo] = useState('');

  // Step 3B: Join Clinic
  const [inviteCode, setInviteCode] = useState('');
  const [verifiedClinic, setVerifiedClinic] = useState<Clinic | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [employeeColor, setEmployeeColor] = useState(PRESET_COLORS[0]);

  // Handle standard Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const fbUser = await authService.login(loginEmail, loginPassword);
      if (fbUser) {
        const appUser = await userRepo.getUserById(fbUser.uid);
        if (appUser) {
          setAuth(fbUser, appUser);
        }
      }
      navigate('/dashboard');
    } catch (err: any) {
      setLoginError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoginLoading(false);
    }
  };

  // Demo Login Quick Access
  const handleDemoLogin = async () => {
    const demoUser: AppUser = {
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
    try {
      await userRepo.saveUser(demoUser);
    } catch (e) {
      console.warn("Could not save demo user", e);
    }
    localStorage.setItem('logopedia_active_uid', demoUser.id);
    setAuth(
      { uid: demoUser.id, email: demoUser.email, displayName: 'Nicolás (Admin Demo)' } as any,
      demoUser
    );
    navigate('/dashboard');
  };

  // Verify invite code when joining
  const handleVerifyCode = async (codeToVerify: string) => {
    const code = codeToVerify.trim().toUpperCase();
    if (!code) {
      setVerifiedClinic(null);
      return;
    }
    setVerifyingCode(true);
    setRegError('');
    try {
      const clinic = await clinicRepository.getClinicByInviteCode(code);
      setVerifiedClinic(clinic);
      if (!clinic) {
        setRegError('No encontramos ninguna clínica con ese código. Pídeselo al administrador de tu centro.');
      }
    } catch {
      setRegError('Error al validar el código.');
    } finally {
      setVerifyingCode(false);
    }
  };

  // Step 1 Validation
  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (!userName.trim()) {
      setRegError('Introduce tu nombre.');
      return;
    }
    if (!regEmail.trim()) {
      setRegError('Introduce un correo electrónico válido.');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setStep(2);
  };

  // Step 2 Proceed
  const handleStep2Next = () => {
    if (!intent) {
      setRegError('Por favor selecciona una de las dos opciones para continuar.');
      return;
    }
    setRegError('');
    setStep(3);
  };

  // Complete Registration for Step 3A: Create Clinic
  const handleCreateClinicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (!clinicName.trim()) {
      setRegError('El nombre de la clínica es obligatorio.');
      return;
    }

    setRegLoading(true);
    try {
      // 1. Create the new clean clinic (WITHOUT any preloaded dummy services/rooms)
      const newClinic = await clinicRepository.createClinic({
        name: clinicName.trim(),
        sector: selectedSector,
        phone: clinicPhone.trim(),
        address: clinicAddress.trim(),
        logoUrl: clinicLogo
      });

      // 2. Register user account
      const authUser = await authService.register(regEmail, regPassword);

      // 3. Create Admin user
      const appUser: AppUser = {
        id: authUser.uid,
        clinicId: newClinic.id,
        name: userName.trim(),
        surname: userSurname.trim(),
        email: regEmail.trim(),
        role: 'admin',
        isActive: true,
        color: '#3B82F6',
        roomIds: []
      };
      await userRepo.saveUser(appUser);

      // 4. Update auth state and navigate
      setAuth(
        { uid: authUser.uid, email: appUser.email, displayName: `${appUser.name} ${appUser.surname || ''}`.trim() } as any,
        appUser
      );
      navigate('/dashboard');
    } catch (err: any) {
      console.error("Error al registrar clínica:", err);
      setRegError(err.message || 'Error al crear la clínica y el usuario');
    } finally {
      setRegLoading(false);
    }
  };

  // Complete Registration for Step 3B: Join Clinic
  const handleJoinClinicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!verifiedClinic) {
      setRegError('Debes validar primero el código de invitación de la clínica.');
      return;
    }

    setRegLoading(true);
    try {
      // 1. Register user
      const authUser = await authService.register(regEmail, regPassword);

      // 2. Create Employee user linked to existing clinic
      const appUser: AppUser = {
        id: authUser.uid,
        clinicId: verifiedClinic.id,
        name: userName.trim(),
        surname: userSurname.trim(),
        email: regEmail.trim(),
        role: 'employee',
        isActive: true,
        color: employeeColor,
        roomIds: []
      };
      await userRepo.saveUser(appUser);

      // 3. Update auth state and navigate
      setAuth(
        { uid: authUser.uid, email: appUser.email, displayName: `${appUser.name} ${appUser.surname || ''}`.trim() } as any,
        appUser
      );
      navigate('/dashboard');
    } catch (err: any) {
      console.error("Error al unirse a la clínica:", err);
      setRegError(err.message || 'Error al completar el registro');
    } finally {
      setRegLoading(false);
    }
  };

  const selectedSectorDef = CLINIC_SECTORS.find(s => s.id === selectedSector);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-bg-dark text-slate-800 dark:text-gray-200">
      
      {/* Lateral Hero Banner */}
      <div className="hidden lg:flex w-2/5 h-full bg-gradient-to-br from-primary via-blue-700 to-indigo-800 items-center justify-center text-white p-12 relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-pattern opacity-10 pointer-events-none" />
        <div className="max-w-md relative z-10 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl">
            <Activity className="w-10 h-10 text-white" />
          </div>

          <div>
            <span className="text-xs uppercase font-extrabold tracking-widest text-blue-200 bg-white/10 px-3 py-1 rounded-full">
              SaaS Multidisciplinar de Salud
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight text-white mt-4 leading-tight">
              Gestión Integral para Clínicas y Consultorios
            </h1>
          </div>

          <p className="text-blue-100 text-sm leading-relaxed">
            Plataforma adaptada para logopedas, dentistas, psicólogos, fisioterapeutas, podólogos, nutricionistas y más. Centraliza citas, salas, equipo profesional e historiales con total seguridad y sencillez.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/15 text-xs text-blue-100">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Agenda Inteligente</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Horarios y Descansos</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Radar de Huecos</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Multicentro y Roles</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Form Container */}
      <div className="w-full lg:w-3/5 h-full overflow-y-auto p-4 sm:p-6 md:p-10 pb-16 flex flex-col justify-start">
        <div className={`w-full mx-auto my-auto ${mode === 'register' && step === 3 && intent === 'create_clinic' ? 'max-w-3xl' : 'max-w-lg'} bg-surface-light dark:bg-surface-dark p-6 sm:p-8 md:p-10 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 transition-all`}>
          
          {/* Logo Mobile */}
          <div className="lg:hidden flex items-center gap-2.5 mb-6 text-primary">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <span className="text-2xl font-bold">LogoPedia</span>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-gray-100 dark:bg-gray-800/80 p-1 rounded-2xl mb-8">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setLoginError('');
              }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                mode === 'login'
                  ? 'bg-white dark:bg-surface-dark text-slate-800 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setRegError('');
                setStep(1);
              }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                mode === 'register'
                  ? 'bg-white dark:bg-surface-dark text-slate-800 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          {/* ============================================================== */}
          {/* INICIAR SESIÓN                                                */}
          {/* ============================================================== */}
          {mode === 'login' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Iniciar Sesión</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                  Ingresa tus credenciales profesionales para acceder a tu clínica
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Mail className="w-5 h-5" />
                    </div>
                    <input 
                      type="email" 
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 outline-none transition-all text-sm"
                      placeholder="ejemplo@clinica.com"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Lock className="w-5 h-5" />
                    </div>
                    <input 
                      type="password" 
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 outline-none transition-all text-sm"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                {loginError && (
                  <div className="p-3.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loginLoading}
                  className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-primary/25 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm mt-2"
                >
                  {loginLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Acceder al Panel'
                  )}
                </button>
              </form>

              {isDemoLoginEnabled && (
                <>
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200 dark:border-gray-800" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-surface-light dark:bg-surface-dark px-3 text-gray-400 font-medium">
                        o probar directamente
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 font-semibold py-3 rounded-xl border border-emerald-300 dark:border-emerald-800 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Acceso Rápido / Modo Demo (LogoPedia)</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* CREAR CUENTA (ONBOARDING MULTIPASO)                            */}
          {/* ============================================================== */}
          {mode === 'register' && (
            <div className="space-y-6">
              
              {/* Stepper Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 1 ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                    1
                  </span>
                  <span className={`text-xs font-semibold ${step === 1 ? 'text-primary' : 'text-gray-400'}`}>
                    Datos
                  </span>
                </div>
                <div className="w-8 h-0.5 bg-gray-200 dark:bg-gray-700" />
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 2 ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                    2
                  </span>
                  <span className={`text-xs font-semibold ${step === 2 ? 'text-primary' : 'text-gray-400'}`}>
                    Modalidad
                  </span>
                </div>
                <div className="w-8 h-0.5 bg-gray-200 dark:bg-gray-700" />
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 3 ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                    3
                  </span>
                  <span className={`text-xs font-semibold ${step === 3 ? 'text-primary' : 'text-gray-400'}`}>
                    {intent === 'create_clinic' ? 'Tu Clínica' : 'Vincular'}
                  </span>
                </div>
              </div>

              {regError && (
                <div className="p-3.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              {/* ---------------------------------------------------------- */}
              {/* PASO 1: DATOS PERSONALES                                   */}
              {/* ---------------------------------------------------------- */}
              {step === 1 && (
                <form onSubmit={handleStep1Next} className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Crea tu cuenta profesional</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                      Comencemos con tus datos identificativos de acceso
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                        Nombre
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          required
                          type="text"
                          value={userName}
                          onChange={(e) => setUserName(e.target.value)}
                          placeholder="María"
                          className="w-full pl-9 pr-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 outline-none text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                        Apellidos
                      </label>
                      <input
                        type="text"
                        value={userSurname}
                        onChange={(e) => setUserSurname(e.target.value)}
                        placeholder="García López"
                        className="w-full px-3.5 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 outline-none text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                      Correo Electrónico Profesional
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input 
                        type="email" 
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 outline-none text-sm"
                        placeholder="maria.garcia@clinica.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                      Contraseña de Acceso
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input 
                        type="password" 
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 outline-none text-sm"
                        placeholder="Mínimo 6 caracteres"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-primary/25 flex justify-center items-center gap-2 text-sm mt-3"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* ---------------------------------------------------------- */}
              {/* PASO 2: SELECCIÓN DE MODALIDAD (CREAR O UNIRSE)            */}
              {/* ---------------------------------------------------------- */}
              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">¿Cómo vas a usar la herramienta?</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                      Elige si vas a inaugurar tu propio negocio o te incorporas al equipo de una clínica ya registrada
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Opción A: Crear negocio */}
                    <div
                      onClick={() => setIntent('create_clinic')}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                        intent === 'create_clinic'
                          ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-md ring-2 ring-primary/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-2xl ${intent === 'create_clinic' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-slate-900 dark:text-white text-base">
                              Crear mi propio negocio
                            </h4>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              Admin
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                            Soy el propietario o director del centro. Podrás configurar tus salas, horarios de apertura, especialidades y agregar a tu equipo de profesionales.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Opción B: Unirme a negocio ya iniciado */}
                    <div
                      onClick={() => setIntent('join_clinic')}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                        intent === 'join_clinic'
                          ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-md ring-2 ring-primary/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-2xl ${intent === 'join_clinic' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                          <Users className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-slate-900 dark:text-white text-base">
                              Unirme a un negocio ya iniciado
                            </h4>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                              Empleado / Profesional
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                            Soy empleado, terapeuta o profesional que se incorpora a una clínica existente. Necesitarás el código de invitación que te proporcionó el centro.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-5 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Atrás</span>
                    </button>
                    <button
                      type="button"
                      disabled={!intent}
                      onClick={handleStep2Next}
                      className="flex-1 bg-primary hover:bg-primary-dark text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-primary/25 flex justify-center items-center gap-2 text-sm disabled:opacity-50"
                    >
                      <span>Siguiente Paso</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ---------------------------------------------------------- */}
              {/* PASO 3A: CREAR CLÍNICA + SELECCIÓN DE SECTOR               */}
              {/* ---------------------------------------------------------- */}
              {step === 3 && intent === 'create_clinic' && (
                <form onSubmit={handleCreateClinicSubmit} className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Configura tu nuevo negocio</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                      Elige el sector de actividad y los datos básicos de tu centro médico
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                      Nombre Comercial del Centro / Clínica *
                    </label>
                    <input
                      required
                      type="text"
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      placeholder="Ej. Clínica Dental Sonrisas / Fisioterapia Avanzada"
                      className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 outline-none text-sm font-medium"
                    />
                  </div>

                  {/* Selector visual de Sectores acordados */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300 flex items-center justify-between">
                      <span>Disciplina o Sector Principal *</span>
                      <span className="text-xs text-primary font-semibold">
                        {selectedSectorDef?.name}
                      </span>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto overscroll-contain pr-1">
                      {CLINIC_SECTORS.map((sec) => {
                        const isSelected = selectedSector === sec.id;
                        return (
                          <div
                            key={sec.id}
                            onClick={() => setSelectedSector(sec.id)}
                            className={`p-3 rounded-xl border-2 cursor-pointer transition-all text-left ${
                              isSelected
                                ? 'border-primary bg-primary/10 dark:bg-primary/20 shadow-sm ring-1 ring-primary'
                                : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 bg-white dark:bg-gray-900/60'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{sec.icon}</span>
                              <span className="text-xs font-bold text-slate-800 dark:text-white leading-tight">
                                {sec.name}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {sec.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-primary" />
                        Teléfono del centro (opcional)
                      </label>
                      <input
                        type="text"
                        value={clinicPhone}
                        onChange={(e) => setClinicPhone(e.target.value)}
                        placeholder="+34 912 000 000"
                        className="w-full px-3.5 py-2 border rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 outline-none text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        Dirección (opcional)
                      </label>
                      <input
                        type="text"
                        value={clinicAddress}
                        onChange={(e) => setClinicAddress(e.target.value)}
                        placeholder="Calle Mayor 12, Ciudad"
                        className="w-full px-3.5 py-2 border rounded-xl focus:ring-2 focus:ring-primary bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 outline-none text-xs"
                      />
                    </div>
                  </div>

                  {/* Logotipo del Centro (opcional) */}
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-primary" />
                        Logotipo del Centro (opcional)
                      </span>
                      {clinicLogo && (
                        <button
                          type="button"
                          onClick={() => setClinicLogo('')}
                          className="text-xs text-rose-500 hover:underline font-medium"
                        >
                          Eliminar logo
                        </button>
                      )}
                    </label>

                    {clinicLogo ? (
                      <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center gap-4">
                        <div className="h-12 w-28 bg-gray-50 dark:bg-gray-800 p-1.5 rounded-lg border border-gray-100 dark:border-gray-700 flex items-center justify-center">
                          <img 
                            src={clinicLogo} 
                            alt="Logo preview" 
                            className="max-h-full max-w-full object-contain" 
                          />
                        </div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-500" />
                          <span>Logotipo añadido correctamente</span>
                        </div>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-primary rounded-xl p-3.5 flex items-center justify-center gap-3 cursor-pointer bg-white dark:bg-gray-900/40 transition-colors">
                        <Upload className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                          Haz clic para subir el logotipo (PNG, SVG, JPG o WEBP)
                        </span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/webp, image/svg+xml"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const dataUrl = await processLogoImage(file);
                                setClinicLogo(dataUrl);
                              } catch (err: any) {
                                setRegError(err.message || 'Error al procesar la imagen');
                              }
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>
                      Tu clínica se creará con una <strong>base de datos limpia y sin servicios precargados</strong> para que configures únicamente los que aplican a tu negocio real.
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-3 pb-1 border-t border-gray-100 dark:border-gray-800 sticky bottom-0 bg-surface-light dark:bg-surface-dark z-20">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-5 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Atrás</span>
                    </button>
                    <button
                      type="submit"
                      disabled={regLoading}
                      className="flex-1 bg-primary hover:bg-primary-dark text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-primary/25 flex justify-center items-center gap-2 text-sm disabled:opacity-50"
                    >
                      {regLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Crear Negocio y Empezar</span>
                          <Check className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* ---------------------------------------------------------- */}
              {/* PASO 3B: UNIRSE A CLÍNICA YA INICIADA CON CÓDIGO          */}
              {/* ---------------------------------------------------------- */}
              {step === 3 && intent === 'join_clinic' && (
                <form onSubmit={handleJoinClinicSubmit} className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Únete a tu centro de trabajo</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                      Introduce el código de invitación que te ha facilitado el administrador de tu clínica
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                      Código de Invitación de la Clínica *
                    </label>
                    <div className="flex gap-2">
                      <input
                        required
                        type="text"
                        value={inviteCode}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setInviteCode(val);
                          handleVerifyCode(val);
                        }}
                        placeholder="Ej. DENT-4821, LOGO-1001, DEMO-2026"
                        className="flex-1 uppercase font-mono tracking-widest px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 outline-none text-sm font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => handleVerifyCode(inviteCode)}
                        disabled={verifyingCode || !inviteCode.trim()}
                        className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-800 dark:text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {verifyingCode ? 'Comprobando...' : 'Comprobar'}
                      </button>
                    </div>
                  </div>

                  {/* Card de clínica detectada */}
                  {verifiedClinic && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3.5 animate-fadeIn">
                      {verifiedClinic.logoUrl ? (
                        <div className="w-12 h-12 rounded-xl bg-white p-1 border border-emerald-200 flex items-center justify-center shadow-sm shrink-0">
                          <img
                            src={verifiedClinic.logoUrl}
                            alt={verifiedClinic.name}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                          Centro de trabajo detectado
                        </span>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                          {verifiedClinic.name}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {verifiedClinic.address || 'Ubicación registrada'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Selector de color representativo */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                      Color para tu perfil en la Agenda
                    </label>
                    <div className="flex items-center gap-2">
                      {PRESET_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setEmployeeColor(color)}
                          style={{ backgroundColor: color }}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${
                            employeeColor === color
                              ? 'scale-110 border-slate-900 dark:border-white shadow-md'
                              : 'border-transparent hover:scale-105'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
                    <Stethoscope className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>
                      Al registrarte como empleado, podrás ver tu propia agenda de trabajo personalizada y atender a tus pacientes asignados.
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-3 pb-1 border-t border-gray-100 dark:border-gray-800 sticky bottom-0 bg-surface-light dark:bg-surface-dark z-20">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-5 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Atrás</span>
                    </button>
                    <button
                      type="submit"
                      disabled={regLoading || !verifiedClinic}
                      className="flex-1 bg-primary hover:bg-primary-dark text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-primary/25 flex justify-center items-center gap-2 text-sm disabled:opacity-50"
                    >
                      {regLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Unirme a la Clínica</span>
                          <Check className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

            </div>
          )}

          {/* Pie de página legal y protección de datos */}
          <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary transition-colors select-none"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Aviso Legal, Bases Jurídicas y Protección de Datos (RGPD)</span>
            </button>
          </div>

        </div>
      </div>

      {/* Modal Informativo RGPD */}
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />

    </div>
  );
};
