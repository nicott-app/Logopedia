/**
 * Configuración específica para el sector de Odontología (Ejemplo).
 */
export const DentistryConfig = {
    id: 'dentistry',
    name: 'Odontología',
    icon: 'dentistry',
    terms: {
        professional: 'Dentista',
        patient: 'Paciente',
        service: 'Tratamiento',
        appointment: 'Cita Dental'
    },
    defaults: {
        services: [
            { id: 1000, name: 'Limpieza Dental', duration: 30, price: 50, color: 'cyan' },
            { id: 1001, name: 'Revisión General', duration: 15, price: 0, color: 'blue' },
            { id: 1002, name: 'Endodoncia', duration: 60, price: 150, color: 'red' },
            { id: 1003, name: 'Ortodoncia', duration: 45, price: 80, color: 'indigo' }
        ],
        rooms: [
            { id: 2000, name: 'Gabinete 1', type: 'clinical', capacity: 1, resources: ['Sillón Dental', 'Rayos X'] },
            { id: 2001, name: 'Gabinete 2', type: 'clinical', capacity: 1, resources: ['Sillón Dental'] },
            { id: 2002, name: 'Recepción', type: 'office', capacity: 5, resources: ['Mostrador'] }
        ]
    }
};
