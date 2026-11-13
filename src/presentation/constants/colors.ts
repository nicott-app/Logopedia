/**
 * 10 colores básicos de máximo contraste y diferenciación.
 * Diseñados para distinguir claramente cada profesional en la agenda.
 */
export const BASIC_COLORS: string[] = [
  '#2563EB', // Azul
  '#16A34A', // Verde
  '#DC2626', // Rojo
  '#EA580C', // Naranja
  '#7C3AED', // Morado
  '#06B6D4', // Turquesa
  '#EC4899', // Rosa
  '#F59E0B', // Amarillo / Ámbar
  '#78350F', // Marrón
  '#4B5563', // Gris
];

export interface ClinicalColorOption {
  hex: string;
}

export const CLINICAL_COLOR_PALETTE: ClinicalColorOption[] = BASIC_COLORS.map(hex => ({ hex }));

export const PRESET_COLORS: string[] = BASIC_COLORS;
