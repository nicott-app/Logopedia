import React, { useState, useEffect } from 'react';
import { Check, Pipette } from 'lucide-react';
import { BASIC_COLORS } from '../../constants/colors';

interface ColorPickerPaletteProps {
  value?: string;
  onChange: (hex: string) => void;
  label?: string;
  description?: string;
  showPreview?: boolean;
  previewTitle?: string;
}

function getContrastColor(hex: string): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? '#0F172A' : '#FFFFFF';
}

export const ColorPickerPalette: React.FC<ColorPickerPaletteProps> = ({
  value = '#2563EB',
  onChange,
  label = 'Color Representativo (Agenda)',
  description = 'Color para identificar las citas y turnos en la agenda.',
  showPreview = true,
  previewTitle = 'Sesión Clínica'
}) => {
  const [hexInput, setHexInput] = useState(value);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.trim();
    if (!input.startsWith('#') && input.length > 0) {
      input = '#' + input;
    }
    setHexInput(input);
    if (/^#[0-9A-Fa-f]{6}$/.test(input)) {
      onChange(input);
    }
  };

  const handleHexBlur = () => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hexInput)) {
      setHexInput(value);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Etiqueta y descripción */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
          {label}
        </label>
        {description && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {description}
          </p>
        )}
      </div>

      {/* Fila con los 10 Colores Básicos + Apartado de Código Hexadecimal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50/80 dark:bg-slate-900/40 rounded-2xl border border-slate-200/70 dark:border-slate-800">
        
        {/* 10 Muestras de Color Básicas (sin nombres descriptivos) */}
        <div className="flex items-center gap-2 flex-wrap">
          {BASIC_COLORS.map(color => {
            const isSelected = value.toLowerCase() === color.toLowerCase();
            const contrastColor = getContrastColor(color);
            return (
              <button
                type="button"
                key={color}
                onClick={() => onChange(color)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-offset-2 ring-primary scale-110 shadow-sm'
                    : 'hover:scale-110 hover:shadow-2xs'
                }`}
                style={{ backgroundColor: color }}
              >
                {isSelected && (
                  <Check className="w-3.5 h-3.5 stroke-[3]" style={{ color: contrastColor }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Apartado para elegir color mediante Código Hexadecimal y Cuentagotas */}
        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800 sm:pl-3">
          <label 
            className="w-8 h-8 rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-center cursor-pointer shadow-2xs hover:scale-105 transition-transform relative overflow-hidden shrink-0"
            title="Seleccionar color con cuentagotas"
            style={{ backgroundColor: value }}
          >
            <Pipette className="w-3.5 h-3.5" style={{ color: getContrastColor(value) }} />
            <input 
              type="color" 
              value={value} 
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </label>

          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 shadow-2xs focus-within:ring-2 focus-within:ring-primary">
            <span className="text-xs text-slate-400 font-mono select-none">#</span>
            <input
              type="text"
              value={hexInput.replace('#', '')}
              onChange={(e) => handleHexChange({ ...e, target: { ...e.target, value: '#' + e.target.value } })}
              onBlur={handleHexBlur}
              placeholder="2563EB"
              maxLength={6}
              className="w-16 bg-transparent text-xs font-mono font-semibold uppercase text-slate-700 dark:text-slate-200 outline-none pl-1"
              title="Código Hexadecimal"
            />
          </div>
        </div>
      </div>

      {/* Vista previa en la agenda */}
      {showPreview && (
        <div className="flex items-center justify-between text-xs pt-0.5">
          <span className="text-slate-400 dark:text-slate-500 text-2.5xs">
            Vista previa en agenda:
          </span>
          <div 
            className="px-3 py-1 rounded-lg border transition-all flex items-center gap-2 shadow-2xs"
            style={{
              backgroundColor: `${value}14`,
              borderColor: `${value}35`,
              borderLeftColor: value,
              borderLeftWidth: '3.5px'
            }}
          >
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: value }} />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {previewTitle}
            </span>
            <span className="text-slate-400 text-2.5xs">09:30 - 10:15</span>
          </div>
        </div>
      )}
    </div>
  );
};
