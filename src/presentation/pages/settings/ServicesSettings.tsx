import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Briefcase, Clock, Tag } from 'lucide-react';
import type { ClinicalService } from '../../../domain/models/types';
import { serviceRepository } from '../../../infrastructure/firebase/ServiceRepository';
import { useAuthStore } from '../../store/useAuthStore';
import { ServiceModal } from '../../components/modals/ServiceModal';

export const ServicesSettings = () => {
  const { user } = useAuthStore();
  const clinicId = user?.clinicId || "demo-clinic-id"; 
  
  const [services, setServices] = useState<ClinicalService[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState<ClinicalService | null>(null);

  const fetchServices = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const data = await serviceRepository.getServicesByClinic(clinicId, true);
      setServices(data);
    } catch (error) {
      console.error("Error cargando servicios:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [clinicId]);

  const handleAdd = () => {
    setServiceToEdit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (service: ClinicalService) => {
    setServiceToEdit(service);
    setIsModalOpen(true);
  };

  const handleDelete = async (serviceId: string) => {
    if (confirm("¿Estás seguro de desactivar o eliminar este servicio?")) {
      await serviceRepository.deleteService(clinicId, serviceId);
      fetchServices();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" />
            Servicios Clínicos y Tratamientos
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Configura los tipos de sesión y su duración en minutos (30m, 45m, 60m). La agenda adaptará la escala horaria automáticamente.
          </p>
        </div>
        <button 
          onClick={handleAdd}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          Nuevo Servicio
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : services.length === 0 ? (
          <div className="text-center text-gray-500 py-16 flex flex-col items-center">
            <Briefcase className="w-16 h-16 text-gray-300 dark:text-gray-700 mb-4" />
            <p className="text-lg font-medium text-slate-700 dark:text-gray-300">No hay servicios clínicos configurados</p>
            <p className="text-sm">Añade servicios (ej: Terapia infantil 45 min, Foniatría 30 min) para planificar citas en la agenda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map(serv => (
              <div 
                key={serv.id} 
                className={`group flex flex-col justify-between p-5 rounded-2xl border ${
                  !serv.isActive 
                    ? 'border-dashed border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-900/10' 
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark'
                } hover:shadow-md transition-all relative overflow-hidden`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-sm shrink-0"
                        style={{ backgroundColor: serv.color || '#3B82F6' }}
                      >
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className={`text-base font-bold leading-tight ${!serv.isActive ? 'text-gray-500' : 'text-slate-800 dark:text-white'}`}>
                          {serv.name}
                        </h4>
                        {!serv.isActive && (
                          <span className="text-xs text-red-500 font-medium">Inactivo</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {serv.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-4">
                      {serv.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      <Clock className="w-3.5 h-3.5" />
                      {serv.durationMinutes} min
                    </span>

                    {serv.price !== undefined && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                        <Tag className="w-3.5 h-3.5" />
                        {serv.price} €
                      </span>
                    )}
                  </div>

                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleEdit(serv)} 
                      title="Editar servicio"
                      className="p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(serv.id)} 
                      title="Eliminar servicio"
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <ServiceModal 
          clinicId={clinicId}
          service={serviceToEdit}
          onClose={() => setIsModalOpen(false)}
          onSaved={() => {
            setIsModalOpen(false);
            fetchServices();
          }}
        />
      )}
    </div>
  );
};
