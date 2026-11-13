/**
 * Configuración específica para el sector de Logopedia.
 * Extraído de la lógica original de LogoPedia.
 */
export const LogopediaConfig = {
    id: 'logopedia',
    name: 'Logopedia',
    icon: 'hearing',
    terms: {
        professional: 'Logopeda',
        patient: 'Paciente',
        service: 'Servicio',
        appointment: 'Cita'
    },
    defaults: {
        services: [
            { id: 1000, name: 'Logopedia', duration: 45, price: 45, color: 'blue' },
            { id: 1001, name: 'Psicología', duration: 60, price: 50, color: 'green' },
            { id: 1002, name: 'Neuropsicología', duration: 45, price: 60, color: 'purple' },
            { id: 1003, name: 'Fisioterapia', duration: 60, price: 45, color: 'orange' }
        ],
        rooms: [
            { id: 2000, name: 'Sala 1', type: 'standard', capacity: 1, resources: ['Mesa', 'Espejo'] },
            { id: 2001, name: 'Sala 2', type: 'standard', capacity: 1, resources: ['Mesa', 'Ordenador'] },
            { id: 2002, name: 'Despacho', type: 'office', capacity: 2, resources: ['Escritorio', 'Pantalla'] }
        ]
    }
};
