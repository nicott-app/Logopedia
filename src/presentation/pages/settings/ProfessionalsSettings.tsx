import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, UserCog, Mail, Clock, Coffee } from 'lucide-react';
import type { User, Specialty } from '../../../domain/models/types';
import { UserRepository } from '../../../infrastructure/firebase/UserRepository';
import { SpecialtyRepository } from '../../../infrastructure/firebase/SpecialtyRepository';
import { useAuthStore } from '../../store/useAuthStore';
import { ProfessionalModal } from '../../components/modals/ProfessionalModal';

const userRepo = new UserRepository();
const specialtyRepo = new SpecialtyRepository();

export const ProfessionalsSettings = () => {
  const { user: currentUser } = useAuthStore();
  const clinicId = currentUser?.clinicId || ""; 
  
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [specialties, setSpecialties] = useState<Record<string, Specialty>>({});
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [professionalToEdit, setProfessionalToEdit] = useState<User | null>(null);

  const fetchData = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const [users, specs] = await Promise.all([
        userRepo.getUsersByClinic(clinicId, true),
        specialtyRepo.getSpecialtiesByClinic(clinicId, true)
      ]);
      
      const specMap: Record<string, Specialty> = {};
      specs.forEach(s => specMap[s.id] = s);
      
      setSpecialties(specMap);
      setProfessionals(users);
    } catch (error) {
      console.error("Error cargando profesionales:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clinicId]);

  const handleAdd = () => {
    setProfessionalToEdit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (prof: User) => {
    setProfessionalToEdit(prof);
    setIsModalOpen(true);
  };

  const handleDelete = async (profId: string) => {
    if (profId === currentUser?.id) {
      alert("No puedes desactivar tu propia cuenta.");
      return;
    }
    if (confirm("¿Estás seguro de desactivar a este profesional? Ya no podrá acceder al sistema.")) {
      await userRepo.deleteUser(profId);
      fetchData();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">Equipo Médico</h3>
          <p className="text-sm text-gray-500">Gestiona los profesionales, sus accesos y especialidades</p>
        </div>
        <button 
          onClick={handleAdd}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          Añadir Profesional
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
           <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
        ) : professionals.length === 0 ? (
           <div className="text-center text-gray-500 py-16 flex flex-col items-center">
             <UserCog className="w-16 h-16 text-gray-300 dark:text-gray-700 mb-4" />
             <p className="text-lg font-medium text-slate-700 dark:text-gray-300">No hay profesionales registrados</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {professionals.map(prof => (
              <div key={prof.id} className={`group flex flex-col p-6 rounded-2xl border ${!prof.isActive ? 'border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-75' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark'} hover:shadow-md transition-all relative overflow-hidden`}>
                
                {!prof.isActive && (
                  <div className="absolute top-0 right-0 bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-xs font-bold px-3 py-1 rounded-bl-xl">
                    Inactivo
                  </div>
                )}

                <div className="flex items-start gap-4 mb-4">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-2xl text-white shadow-sm shrink-0"
                    style={{ backgroundColor: prof.isActive ? (prof.color || '#8B5CF6') : '#9CA3AF' }}
                  >
                    {prof.name.charAt(0).toUpperCase()}
                  </div>
                  
                  <div className="flex-1 min-w-0 pt-1">
                    <h4 className="text-lg font-bold text-slate-800 dark:text-white truncate">{prof.name} {prof.surname}</h4>
                    <p className="text-sm text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                      <Mail className="w-3.5 h-3.5" /> {prof.email}
                    </p>
                    {prof.role === 'admin' && (
                      <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-semibold rounded mt-1.5">
                        Administrador
                      </span>
                    )}
                  </div>
                </div>

                {/* Resumen de Turno y Descansos */}
                {prof.schedule && (
                  <div className="mb-3 py-2 px-3 bg-gray-50/80 dark:bg-gray-800/40 rounded-xl text-xs space-y-1 border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-gray-300 font-medium">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span>Turno: {prof.schedule.monday?.isWorking ? `${prof.schedule.monday.start} - ${prof.schedule.monday.end}` : 'Sin turno L-V'}</span>
                    </div>
                    {prof.schedule.monday?.breaks && prof.schedule.monday.breaks.length > 0 && (
                      <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                        <Coffee className="w-3.5 h-3.5 text-amber-500" />
                        <span>{prof.schedule.monday.breaks[0].name}: {prof.schedule.monday.breaks[0].start} - {prof.schedule.monday.breaks[0].end}</span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mt-auto border-t border-gray-100 dark:border-gray-800/60 pt-4 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Especialidad</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-gray-300">
                      {prof.specialtyId && specialties[prof.specialtyId] ? specialties[prof.specialtyId].name : 'General / Sin asignar'}
                    </span>
                  </div>
                  
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(prof)} className="p-2 text-gray-500 hover:text-primary rounded-lg hover:bg-primary/10 transition-colors shadow-sm bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"><Edit2 className="w-4 h-4" /></button>
                    {prof.isActive && prof.id !== currentUser?.id && (
                      <button onClick={() => handleDelete(prof.id)} className="p-2 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shadow-sm bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <ProfessionalModal 
          clinicId={clinicId}
          professional={professionalToEdit}
          onClose={() => setIsModalOpen(false)}
          onSaved={() => {
            setIsModalOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
};
