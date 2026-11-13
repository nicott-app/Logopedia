import { useState, useEffect, useMemo } from 'react';
import { Search, UserPlus, FileText, MoreVertical, ShieldAlert, ShieldCheck, Phone, Mail, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PatientRepository } from '../../infrastructure/firebase/PatientRepository';
import type { Patient } from '../../domain/models/types';
import { useAuthStore } from '../store/useAuthStore';

const patientRepo = new PatientRepository();

export const PatientList = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const clinicId = user?.clinicId || "";
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Debounce search input to avoid heavy re-filtering on rapid keystrokes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 180);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchPatients = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const data = await patientRepo.getPatientsByClinic(clinicId);
      setPatients(data);
    } catch (error) {
      console.error("Error fetching patients:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [clinicId]);

  const filteredPatients = useMemo(() => {
    if (!debouncedSearch.trim()) return patients;
    const term = debouncedSearch.toLowerCase().trim();
    return patients.filter(p => {
      const fullName = `${p.name} ${p.surname || ''}`.toLowerCase();
      const hasContact = p.contacts?.some(c => c.value.toLowerCase().includes(term));
      const dni = p.dni?.toLowerCase() || '';
      return fullName.includes(term) || hasContact || dni.includes(term);
    });
  }, [patients, debouncedSearch]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
      
      {/* Header */}
      <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Directorio de Pacientes</h2>
          <p className="text-sm text-gray-500 mt-1">Gestiona los expedientes clínicos y el estado legal</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar paciente (nombre, DNI, contacto)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
            />
            {searchInput && (
              <button 
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button 
            onClick={() => navigate('/dashboard/patients/new')}
            className="flex-shrink-0 flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-primary/20"
          >
            <UserPlus className="w-5 h-5" />
            <span className="hidden sm:inline">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50/30 dark:bg-transparent">
        {loading ? (
          <div className="flex justify-center py-16">
             <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredPatients.length === 0 ? (
              <div className="col-span-full py-16 text-center flex flex-col items-center">
                <FileText className="w-16 h-16 text-gray-300 dark:text-gray-700 mb-4" />
                <p className="text-lg font-medium text-slate-700 dark:text-gray-300">No se encontraron pacientes</p>
                <p className="text-sm text-gray-500">Prueba con otra búsqueda o añade uno nuevo.</p>
              </div>
            ) : (
              filteredPatients.map(patient => (
                <div 
                  key={patient.id} 
                  onClick={() => navigate(`/dashboard/patients/${patient.id}`)}
                  className="group flex flex-col p-5 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:shadow-md bg-white dark:bg-surface-dark transition-all cursor-pointer relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-primary/20 text-primary dark:from-indigo-900/40 dark:to-primary/30 flex items-center justify-center font-bold text-xl shadow-sm">
                        {patient.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white truncate max-w-[200px] sm:max-w-[250px]">
                          {patient.name} {patient.surname}
                        </h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                          ID: <span className="font-mono text-xs">{patient.id?.split('-')[0]}</span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-gray-400 hover:text-primary bg-gray-50 hover:bg-primary/10 rounded-lg dark:bg-gray-800 dark:hover:bg-primary/20">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg truncate">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{patient.contacts?.find(c => c.type === 'phone')?.value || 'Sin teléfono'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg truncate">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{patient.contacts?.find(c => c.type === 'email')?.value || 'Sin email'}</span>
                    </div>
                  </div>
                  
                  <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      patient.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      patient.status === 'waiting' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {patient.status === 'active' ? 'En Tratamiento' : patient.status === 'waiting' ? 'Lista de Espera' : 'Archivado'}
                    </span>
                    
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      {patient.consentSigned ? (
                        <span className="text-green-600 flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> RGPD OK</span>
                      ) : (
                        <span className="text-amber-600 flex items-center gap-1"><ShieldAlert className="w-4 h-4" /> Firma Pdte.</span>
                      )}
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
