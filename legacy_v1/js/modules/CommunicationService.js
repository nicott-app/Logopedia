export class CommunicationService {
    constructor(store) {
        this.store = store;
        this.defaultTemplates = {
            whatsapp: {
                reminder: "Hola {{name}}, recordamos la cita de {{patient}} en LogoPedia el {{date}} a las {{time}}. Por favor, confirma asistencia.",
                cancel: "Hola {{name}}, lamentamos informar que la cita de {{patient}} del {{date}} a las {{time}} ha sido cancelada. Contacta para reprogramar.",
                delay: "Hola {{name}}, llevamos un retraso en la consulta. Atenderemos a {{patient}} sobre las {{new_time}} aprox. Disculpa."
            },
            email: {
                reminder: {
                    subject: "Recordatorio de Cita - LogoPedia",
                    body: "Hola {{name}},\n\nTe recordamos que {{patient}} tiene una cita programada el {{date}} a las {{time}}.\n\nAtentamente,\nEl equipo de LogoPedia."
                }
            }
        };
    }

    getTemplates() {
        return this.store.state.config.templates || this.defaultTemplates;
    }

    async saveTemplates(templates) {
        this.store.state.config.templates = templates;
        await this.store.save();
    }

    // Helper to replace variables
    processTemplate(template, appointment, patient, extras = {}) {
        let text = template;

        // Date/Time Resolution (Appointment vs Today)
        let date, time;
        if (appointment) {
            date = new Date(appointment.start).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
            time = new Date(appointment.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            // Default to Today for Note Templates
            date = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
            time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        // Resolve "Smart Name" (Receiver)
        // If patient has a tutor Name, we address the tutor. If not, the patient.
        let receiverName = patient.name.split(' ')[0];
        if (patient.tutorName && patient.tutorName.trim() !== '') {
            receiverName = patient.tutorName.split(' ')[0];
        }

        text = text.replace(/{{name}}/g, receiverName); // Smart Name (Tutor or Patient)
        text = text.replace(/{{patient}}/g, patient.name); // Full Patient Name (better for reports)
        text = text.replace(/{{tutor}}/g, patient.tutorName ? patient.tutorName.split(' ')[0] : 'Tutor');

        text = text.replace(/{{date}}/g, date);
        text = text.replace(/{{time}}/g, time);

        // Clinical Extras
        text = text.replace(/{{age}}/g, patient.age || '');
        text = text.replace(/{{today}}/g, new Date().toLocaleDateString('es-ES')); // Consistent Today

        // Extras
        if (extras.new_time) text = text.replace(/{{new_time}}/g, extras.new_time);

        return text;
    }

    openWhatsApp(appointment, type = 'reminder', extras = {}) {
        const patient = this.store.state.patients.find(p => p.id === appointment.patientId);
        if (!patient || !patient.phone) {
            alert("Este paciente no tiene teléfono registrado.");
            return;
        }

        const templates = this.getTemplates();
        const template = templates.whatsapp[type] || templates.whatsapp.reminder;
        const message = this.processTemplate(template, appointment, patient, extras);

        // Format phone (Remove spaces, dashes, ensure country code if missing default to ES +34)
        let phone = patient.phone.replace(/\D/g, '');
        if (!phone.startsWith('34') && phone.length === 9) phone = '34' + phone;

        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    }

    openEmail(appointment, type = 'reminder') {
        const patient = this.store.state.patients.find(p => p.id === appointment.patientId);
        if (!patient || !patient.email) {
            alert("Este paciente no tiene email registrado.");
            return;
        }

        const templates = this.getTemplates();
        const tpl = templates.email[type] || templates.email.reminder;

        const subject = tpl.subject;
        const body = this.processTemplate(tpl.body, appointment, patient);

        const url = `mailto:${patient.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(url, '_blank');
    }
}
