import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Stethoscope } from 'lucide-react';
import type { Specialty } from '../../../domain/models/types';
import { SpecialtyRepository } from '../../../infrastructure/firebase/SpecialtyRepository';
import { useAuthStore } from '../../store/useAuthStore';
import { SpecialtyModal } from '../../components/modals/SpecialtyModal';

const specialtyRepo = new SpecialtyRepository();

export const SpecialtiesSettings = () => {
  const { user } = useAuthStore();
  const clinicId = user?.clinicId || ""; 
  
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [specialtyToEdit, setSpecialtyToEdit] = useState<Specialty | null>(null);

  const fetchSpecialties = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const data = await specialtyRepo.getSpecialtiesByClinic(clinicId, true);
      setSpecialties(data);
    } catch (error) {
      console.error("Error cargando especialidades:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecialties();
  }, [clinicId]);

  const handleAdd = () => {
    setSpecialtyToEdit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (spec: Specialty) => {
    setSpecialtyToEdit(spec);
    setIsModalOpen(true);
  };

  const handleDelete = async (specId: string) => {
    if (confirm("¿Estás seguro de desactivar esta especialidad? Los profesionales vinculados la mantendrán, pero no se podrá asignar a nuevos.")) {
      await specialtyRepo.deleteSpecialty(clinicId, specId);
      fetchSpecialties();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">Especialidades</h3>
          <p className="text-sm text-gray-500">Configura las áreas médicas que cubre tu clínica (ej: Logopedia, Psicología)</p>
        </div>
        <button 
          onClick={handleAdd}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          Nueva Especialidad
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
           <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
        ) : specialties.length === 0 ? (
           <div className="text-center text-gray-500 py-16 flex flex-col items-center">
             <Stethoscope className="w-16 h-16 text-gray-300 dark:text-gray-700 mb-4" />
             <p className="text-lg font-medium text-slate-700 dark:text-gray-300">No hay especialidades</p>
             <p className="text-sm">Añade especialidades para poder clasificarlas en el equipo médico.</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {specialties.map(spec => (
              <div key={spec.id} className={`group flex items-start gap-4 p-5 rounded-2xl border ${!spec.isActive ? 'border-dashed border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark'} hover:shadow-md transition-all relative overflow-hidden`}>
                
                <div 
                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl shadow-sm text-white shrink-0 ${!spec.isActive && 'grayscale opacity-50'}`} 
                  style={{ backgroundColor: spec.color || '#3B82F6' }}
                >
                  {spec.name.charAt(0).toUpperCase()}
                </div>
                
                <div className="flex-1 min-w-0 pt-1">
                  <h4 className={`text-lg font-bold truncate ${!spec.isActive ? 'text-gray-500' : 'text-slate-800 dark:text-white'}`}>
                    {spec.name} {(!spec.isActive) && <span className="text-xs font-normal text-red-500 ml-1">(Inactiva)</span>}
                  </h4>
                  {spec.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{spec.description}</p>}
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-lg p-1">
                  <button onClick={() => handleEdit(spec)} className="p-1.5 text-gray-500 hover:text-primary rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><Edit2 className="w-4 h-4" /></button>
                  {spec.isActive && (
                    <button onClick={() => handleDelete(spec.id)} className="p-1.5 text-gray-500 hover:text-red-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <SpecialtyModal 
          clinicId={clinicId}
          specialty={specialtyToEdit}
          onClose={() => setIsModalOpen(false)}
          onSaved={() => {
            setIsModalOpen(false);
            fetchSpecialties();
          }}
        />
      )}
    </div>
  );
};
