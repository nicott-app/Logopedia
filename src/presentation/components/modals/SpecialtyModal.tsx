import React, { useState, useEffect } from 'react';
import { X, Save, Stethoscope } from 'lucide-react';
import type { Specialty } from '../../../domain/models/types';
import { SpecialtyRepository } from '../../../infrastructure/firebase/SpecialtyRepository';
import { ColorPickerPalette } from '../common/ColorPickerPalette';

interface SpecialtyModalProps {
  clinicId: string;
  specialty?: Specialty | null;
  onClose: () => void;
  onSaved: () => void;
}

const specialtyRepo = new SpecialtyRepository();

export const SpecialtyModal: React.FC<SpecialtyModalProps> = ({ clinicId, specialty, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Specialty>>({
    name: '',
    color: '#3B82F6', // Blue by default
    description: '',
    isActive: true,
  });

  useEffect(() => {
    if (specialty) setFormData(specialty);
  }, [specialty]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    setLoading(true);
    try {
      const specToSave: Specialty = {
        ...(formData as Specialty),
        id: specialty?.id || crypto.randomUUID(),
        clinicId,
      };
      
      await specialtyRepo.saveSpecialty(specToSave);
      onSaved();
    } catch (error) {
      console.error("Error guardando la especialidad:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary" />
            {specialty ? 'Editar Especialidad' : 'Nueva Especialidad'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <form id="spec-form" onSubmit={handleSubmit} className="space-y-6">
            
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Nombre de la Especialidad *</label>
              <input required type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Ej: Logopedia" className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
            </div>

            <ColorPickerPalette
              value={formData.color || '#3B82F6'}
              onChange={(color) => setFormData(prev => ({ ...prev, color }))}
              label="Color Representativo"
              description="Color distintivo para clasificar esta área médica."
              showPreview={false}
            />

            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Descripción Corta</label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows={2} placeholder="Opcional..." className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none resize-none" />
            </div>

            {specialty && (
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">Estado</h4>
                  <p className="text-xs text-gray-500">Activa o inactiva</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData(prev => ({...prev, isActive: e.target.checked}))} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/10 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                </label>
              </div>
            )}

          </form>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/30">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
            Cancelar
          </button>
          <button form="spec-form" type="submit" disabled={loading} className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-primary/20 disabled:opacity-50">
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
            {specialty ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
};
