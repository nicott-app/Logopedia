import React, { useState, useEffect } from 'react';
import { X, Save, XCircle } from 'lucide-react';
import type { Room, User } from '../../../domain/models/types';
import { RoomRepository } from '../../../infrastructure/firebase/RoomRepository';
import { UserRepository } from '../../../infrastructure/firebase/UserRepository';

interface RoomModalProps {
  clinicId: string;
  room?: Room | null;
  onClose: () => void;
  onSaved: () => void;
}

const roomRepo = new RoomRepository();
const userRepo = new UserRepository();

export const RoomModal: React.FC<RoomModalProps> = ({ clinicId, room, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [formData, setFormData] = useState<Partial<Room>>({
    name: '',
    type: 'Consulta',
    capacity: 1,
    materials: [],
    professionalIds: [],
    isActive: true,
  });

  useEffect(() => {
    if (room) {
      setFormData(room);
    }
    
    // Cargar profesionales para asignar a la sala
    const fetchProfessionals = async () => {
      try {
        const users = await userRepo.getUsersByClinic(clinicId);
        setProfessionals(users.filter(u => u.isActive));
      } catch (err) {
        console.error('Error fetching professionals:', err);
      }
    };
    fetchProfessionals();
  }, [room, clinicId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'capacity' ? parseInt(value) || 1 : value
    }));
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!formData.materials?.includes(tagInput.trim())) {
        setFormData(prev => ({
          ...prev,
          materials: [...(prev.materials || []), tagInput.trim()]
        }));
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      materials: prev.materials?.filter(tag => tag !== tagToRemove)
    }));
  };

  const toggleProfessional = (profId: string) => {
    setFormData(prev => {
      const current = prev.professionalIds || [];
      if (current.includes(profId)) {
        return { ...prev, professionalIds: current.filter(id => id !== profId) };
      } else {
        return { ...prev, professionalIds: [...current, profId] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    setLoading(true);
    try {
      const roomToSave: Room = {
        ...(formData as Room),
        id: room?.id || crypto.randomUUID(),
        clinicId,
        materials: formData.materials || [],
        professionalIds: formData.professionalIds || [],
      };
      
      await roomRepo.saveRoom(roomToSave);
      onSaved();
    } catch (error) {
      console.error("Error guardando la sala:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            {room ? 'Editar Sala' : 'Crear Nueva Sala'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form id="room-form" onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Nombre de la Sala *</label>
                <input required type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Ej: Consulta de Logopedia 1" className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Tipo / Uso</label>
                <input type="text" name="type" value={formData.type} onChange={handleChange} placeholder="Ej: Multisensorial" className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Capacidad (Pacientes)</label>
                <input type="number" min="1" name="capacity" value={formData.capacity} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Materiales Disponibles (Presiona Enter para añadir)</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.materials?.map(tag => (
                  <span key={tag} className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg text-sm font-medium border border-indigo-100 dark:border-indigo-800">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-100 ml-1">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
              <input 
                type="text" 
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Ej: Camilla, Espejo de pared, Material fonético..." 
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Profesionales Habituales</label>
              {professionals.length === 0 ? (
                <p className="text-sm text-gray-500">No hay profesionales registrados aún.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-40 overflow-y-auto pr-2 border border-gray-100 dark:border-gray-800 rounded-xl p-3 bg-gray-50/50 dark:bg-gray-900/20">
                  {professionals.map(prof => (
                    <label key={prof.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700 shadow-sm">
                      <input 
                        type="checkbox" 
                        checked={formData.professionalIds?.includes(prof.id) || false}
                        onChange={() => toggleProfessional(prof.id)}
                        className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-gray-300">{prof.name} {prof.surname || ''}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {room && (
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 mt-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">Estado de la sala</h4>
                  <p className="text-xs text-gray-500">Las salas inactivas no aparecerán en la agenda para ser reservadas.</p>
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
          <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
            Cancelar
          </button>
          <button form="room-form" type="submit" disabled={loading} className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-primary/20 disabled:opacity-50">
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
            {room ? 'Guardar Cambios' : 'Crear Sala'}
          </button>
        </div>
      </div>
    </div>
  );
};
