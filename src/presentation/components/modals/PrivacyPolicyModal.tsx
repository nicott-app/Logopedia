import React from 'react';
import { X, ShieldCheck, Scale, FileText, Lock, Clock, Building2, UserCheck } from 'lucide-react';
import type { Clinic } from '../../../domain/models/types';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinic?: Clinic | null;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose, clinic }) => {
  if (!isOpen) return null;

  const clinicName = clinic?.name || 'Centro Sanitario / Titular del Servicio';
  const cif = clinic?.cif || 'Identificado en el registro del centro';
  const address = clinic?.address || 'Dirección registrada del centro';
  const email = clinic?.dpoEmail || clinic?.email || 'contacto@clinica.com';
  const phone = clinic?.phone || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 rounded-3xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-slate-50/50 dark:bg-gray-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                Información Legal y Política de Protección de Datos
              </h3>
              <p className="text-xs text-gray-500">
                Reglamento General de Protección de Datos (RGPD UE 2016/679) y LOPDGDD 3/2018
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-700 dark:text-gray-300 leading-relaxed">
          
          {/* Banner de categoría especial */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl flex items-start gap-3 text-xs text-blue-900 dark:text-blue-300">
            <Scale className="w-5 h-5 flex-shrink-0 text-primary mt-0.5" />
            <div>
              <span className="font-bold">Tratamiento reforzado de datos sanitarios:</span> Los datos relativos a la salud son considerados de categoría especial (Art. 9 del RGPD), por lo que cuentan con las máximas medidas de seguridad, deber de secreto médico y custodia asistencial.
            </div>
          </div>

          {/* 1. Responsable del Tratamiento */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              1. Responsable del Tratamiento
            </h4>
            <div className="bg-gray-50 dark:bg-gray-900/40 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1 text-xs">
              <p><strong className="text-slate-800 dark:text-gray-200">Identidad / Razón Social:</strong> {clinicName}</p>
              <p><strong className="text-slate-800 dark:text-gray-200">NIF / CIF:</strong> {cif}</p>
              <p><strong className="text-slate-800 dark:text-gray-200">Dirección:</strong> {address}</p>
              <p><strong className="text-slate-800 dark:text-gray-200">Contacto de Privacidad:</strong> {email} {phone ? `· Tel: ${phone}` : ''}</p>
            </div>
          </div>

          {/* 2. Finalidad del Tratamiento */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              2. Finalidades del Tratamiento
            </h4>
            <ul className="list-disc pl-5 space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <li><strong>Asistencia terapéutica:</strong> Valoración, diagnóstico, intervención y seguimiento clínico de los pacientes.</li>
              <li><strong>Gestión de la Historia Clínica:</strong> Apertura, registro y custodia del expediente asistencial conforme a la Ley 41/2002 de Autonomía del Paciente.</li>
              <li><strong>Gestión organizativa y administrativa:</strong> Agendamiento de sesiones, recordatorios de citas mediante avisos y gestión de facturación.</li>
            </ul>
          </div>

          {/* 3. Base Jurídica (Legitimación) */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              3. Base Jurídica (Legitimación Legal)
            </h4>
            <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <p>• <strong>Art. 6.1.b) del RGPD:</strong> Ejecución de la relación asistencial y contractual entre el paciente (o su tutor legal) y el centro sanitario.</p>
              <p>• <strong>Art. 9.2.h) del RGPD:</strong> Tratamiento necesario para fines de diagnóstico, prestación de asistencia sanitaria o tratamiento sociosanitario bajo responsabilidad de profesionales sujetos a secreto profesional.</p>
              <p>• <strong>Art. 9.2.a) del RGPD:</strong> Consentimiento explícito del paciente o de su representante/tutor legal para el tratamiento de datos de salud.</p>
              <p>• <strong>Ley 41/2002:</strong> Cumplimiento de la obligación legal de confeccionar y custodiar la historia clínica de los pacientes.</p>
            </div>
          </div>

          {/* 4. Conservación de los Datos */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              4. Plazos de Conservación de la Documentación Clínica
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              En aplicación del <strong>artículo 17 de la Ley 41/2002</strong>, la documentación clínica de cada paciente se conservará de forma bloqueada durante un <strong>mínimo de cinco (5) años</strong> contados desde la fecha de alta del último proceso asistencial. Los datos no se destruirán anticipadamente, asegurando la trazabilidad médica requerida por ley.
            </p>
          </div>

          {/* 5. Destinatarios y Seguridad */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              5. Destinatarios y Seguridad de la Información
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              No se cederán datos a terceros salvo obligación legal. Los proveedores de infraestructura tecnológica operan en centros de datos ubicados en la Unión Europea, con cifrado en tránsito (TLS 1.3/HTTPS), cifrado en reposo (AES-256) y acuerdos de encargo de tratamiento (DPA) conformes al Art. 28 del RGPD.
            </p>
          </div>

          {/* 6. Derechos del Paciente */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              6. Ejercicio de Derechos (ARCO+)
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Usted o su representante legal pueden ejercer en cualquier momento los derechos de <strong>Acceso, Rectificación, Supresión, Limitación del Tratamiento, Portabilidad y Oposición</strong> enviando un escrito acompañado de copia de su documento de identidad a: <strong className="text-primary">{email}</strong>.
            </p>
            <p className="text-xs text-gray-500">
              Si considera que el tratamiento no se ajusta a la normativa vigente, tiene derecho a interponer una reclamación ante la <strong>Agencia Española de Protección de Datos (AEPD)</strong> en <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="text-primary underline">www.aepd.es</a>.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-medium text-xs transition-colors shadow-md shadow-primary/20"
          >
            Entendido y Aceptar
          </button>
        </div>
      </div>
    </div>
  );
};
