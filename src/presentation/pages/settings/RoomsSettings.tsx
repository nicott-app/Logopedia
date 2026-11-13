import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Box, Users as UsersIcon } from 'lucide-react';
import type { Room } from '../../../domain/models/types';
import { RoomRepository } from '../../../infrastructure/firebase/RoomRepository';
import { useAuthStore } from '../../store/useAuthStore';
import { RoomModal } from '../../components/modals/RoomModal';

const roomRepo = new RoomRepository();

export const RoomsSettings = () => {
  const { user } = useAuthStore();
  const clinicId = user?.clinicId || ""; 
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roomToEdit, setRoomToEdit] = useState<Room | null>(null);

  const fetchRooms = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      // Incluimos inactivas si queremos mostrarlas, pero para este caso mostraremos solo activas, o todas con indicativo
      const data = await roomRepo.getRoomsByClinic(clinicId, true);
      setRooms(data);
    } catch (error) {
      console.error("Error cargando salas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [clinicId]);

  const handleAddRoom = () => {
    setRoomToEdit(null);
    setIsModalOpen(true);
  };

  const handleEditRoom = (room: Room) => {
    setRoomToEdit(room);
    setIsModalOpen(true);
  };

  const handleDelete = async (roomId: string) => {
    if (confirm("¿Estás seguro de eliminar esta sala? Ya no estará disponible para nuevas citas.")) {
      await roomRepo.deleteRoom(clinicId, roomId);
      fetchRooms();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">Salas y Gabinetes</h3>
          <p className="text-sm text-gray-500">Configura los espacios físicos y su inventario de material</p>
        </div>
        <button 
          onClick={handleAddRoom}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          Nueva Sala
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
           <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
        ) : rooms.length === 0 ? (
           <div className="text-center text-gray-500 py-16 flex flex-col items-center">
             <Box className="w-16 h-16 text-gray-300 dark:text-gray-700 mb-4" />
             <p className="text-lg font-medium text-slate-700 dark:text-gray-300">No hay salas configuradas</p>
             <p className="text-sm">Añade la primera sala para poder agendar citas en ella.</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {rooms.map(room => (
              <div key={room.id} className={`group flex flex-col p-6 rounded-2xl border ${!room.isActive ? 'border-dashed border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 opacity-75' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark'} hover:shadow-md hover:border-primary/50 transition-all relative overflow-hidden`}>
                
                {/* Indicador de inactividad */}
                {!room.isActive && (
                  <div className="absolute top-0 right-0 bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 text-xs font-bold px-3 py-1 rounded-bl-xl">
                    Inactiva
                  </div>
                )}

                <div className="flex justify-between items-start mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl shadow-sm ${!room.isActive ? 'bg-red-100 text-red-600' : 'bg-gradient-to-br from-indigo-100 to-primary/20 text-primary dark:from-indigo-900/40 dark:to-primary/30'}`}>
                    {room.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEditRoom(room)} className="p-2 text-gray-500 hover:text-primary rounded-lg hover:bg-primary/10 transition-colors shadow-sm bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"><Edit2 className="w-4 h-4" /></button>
                    {room.isActive && (
                      <button onClick={() => handleDelete(room.id)} className="p-2 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shadow-sm bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
                
                <h4 className="text-lg font-bold text-slate-800 dark:text-white truncate">{room.name}</h4>
                <p className="text-sm text-gray-500 mt-1 mb-4">{room.type || 'Sala polivalente'} • Max {room.capacity} pax</p>
                
                <div className="mt-auto">
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Box className="w-3.5 h-3.5" /> Inventario y Materiales</p>
                    <div className="flex flex-wrap gap-1.5">
                      {room.materials && room.materials.length > 0 ? (
                        room.materials.slice(0, 4).map((m, i) => (
                          <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded text-xs truncate max-w-[120px]">{m}</span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 italic">No hay inventario registrado</span>
                      )}
                      {(room.materials?.length || 0) > 4 && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded text-xs">+{room.materials.length - 4}</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800/60">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><UsersIcon className="w-3.5 h-3.5" /> Profesionales Asignados</p>
                    <p className="text-sm font-medium mt-1.5 text-slate-700 dark:text-gray-300">
                      {room.professionalIds?.length || 0} profesionales habituales
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <RoomModal 
          clinicId={clinicId}
          room={roomToEdit}
          onClose={() => setIsModalOpen(false)}
          onSaved={() => {
            setIsModalOpen(false);
            fetchRooms();
          }}
        />
      )}
    </div>
  );
};
