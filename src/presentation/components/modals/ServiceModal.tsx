import React, { useState, useEffect } from 'react';
import { X, Save, Clock, Briefcase } from 'lucide-react';
import type { ClinicalService } from '../../../domain/models/types';
import { serviceRepository } from '../../../infrastructure/firebase/ServiceRepository';
import { ColorPickerPalette } from '../common/ColorPickerPalette';

interface ServiceModalProps {
  clinicId: string;
  service?: ClinicalService | null;
  onClose: () => void;
  onSaved: () => void;
}

export const ServiceModal: React.FC<ServiceModalProps> = ({ clinicId, service, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<ClinicalService>>({
    name: '',
    durationMinutes: 30,
    price: 35,
    color: '#3B82F6',
    description: '',
    isActive: true,
  });

  useEffect(() => {
    if (service) setFormData(service);
  }, [service]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: Number(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSetDuration = (duration: number) => {
    setFormData(prev => ({ ...prev, durationMinutes: duration }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    setLoading(true);
    try {
      const serviceToSave: ClinicalService = {
        name: formData.name.trim(),
        durationMinutes: formData.durationMinutes || 30,
        price: formData.price !== undefined ? Number(formData.price) : undefined,
        description: formData.description?.trim() || '',
        color: formData.color || '#3B82F6',
        isActive: formData.isActive ?? true,
        id: service?.id || crypto.randomUUID(),
        clinicId,
      };

      await serviceRepository.saveService(serviceToSave);
      onSaved();
    } catch (error) {
      console.error("Error guardando el servicio:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            {service ? 'Editar Servicio Clínico' : 'Nuevo Servicio Clínico'}
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <form id="service-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                Nombre del Servicio o Tratamiento *
              </label>
              <input 
                required 
                type="text" 
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                placeholder="Ej: Terapia de Articulación y Habla" 
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none" 
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary" />
                  Duración de la Cita (Minutos) *
                </label>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {formData.durationMinutes} min
                </span>
              </div>
              <input 
                required 
                type="number" 
                name="durationMinutes" 
                min={10} 
                max={240} 
                step={5} 
                value={formData.durationMinutes} 
                onChange={handleChange} 
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none font-semibold text-slate-800 dark:text-white" 
              />
              <div className="flex gap-2 mt-2">
                {[30, 45, 60, 90].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleSetDuration(mins)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      formData.durationMinutes === mins
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                La agenda adaptará automáticamente la escala y la altura del bloque según esta duración.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                Precio Estándar (€)
              </label>
              <input 
                type="number" 
                name="price" 
                min={0} 
                step={1} 
                value={formData.price ?? ''} 
                onChange={handleChange} 
                placeholder="Ej: 35" 
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none" 
              />
            </div>

            <ColorPickerPalette
              value={formData.color || '#3B82F6'}
              onChange={(color) => setFormData(prev => ({ ...prev, color }))}
              label="Color de Etiqueta (Agenda)"
              description="Color identificativo para este servicio en los bloques de la agenda."
              showPreview={true}
              previewTitle={formData.name || 'Servicio Clínico'}
            />

            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                Descripción / Objetivos Clínicos
              </label>
              <textarea 
                name="description" 
                value={formData.description} 
                onChange={handleChange} 
                rows={2} 
                placeholder="Breve detalle de la intervención o público objetivo..." 
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none resize-none text-sm" 
              />
            </div>

            {service && (
              <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                <div>
                  <span className="block text-sm font-medium text-gray-800 dark:text-gray-200">Servicio Activo</span>
                  <span className="block text-xs text-gray-500">Disponible para asignación en citas</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.isActive} 
                    onChange={e => setFormData(p => ({ ...p, isActive: e.target.checked }))} 
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                </label>
              </div>
            )}
          </form>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-gray-900/20">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-colors"
          >
            Cancelar
          </button>
          <button 
            form="service-form" 
            type="submit" 
            disabled={loading} 
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : 'Guardar Servicio'}
          </button>
        </div>
      </div>
    </div>
  );
};
