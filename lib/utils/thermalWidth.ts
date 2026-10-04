/**
 * Thermal Paper Width Utilities & Types
 * Supports standard thermal sizes (58mm, 80mm, 76mm, 72mm, 57.5mm) and custom widths (40mm - 120mm).
 */

export type ThermalPaperWidth = '58mm' | '80mm' | '76mm' | '72mm' | '57.5mm' | 'custom';

export interface ResolvedThermalWidth {
  /** CSS dimension string, e.g. '58mm', '80mm', '57.5mm', '90mm' */
  widthCss: string;
  /** Width in millimeters as a numeric value, e.g. 58, 80, 57.5, 90 */
  widthMm: number;
  /** Whether the width is compact / narrow (< 68mm), requiring stacked product row */
  isNarrow: boolean;
  /** Selected paper width option key */
  paperWidth: ThermalPaperWidth;
  /** Custom width in mm if custom is selected */
  customWidth: number;
}

export const THERMAL_WIDTH_OPTIONS: { label: string; value: ThermalPaperWidth; description: string }[] = [
  { label: '58 mm', value: '58mm', description: 'Standard small POS thermal receipt' },
  { label: '80 mm', value: '80mm', description: 'Standard wide POS thermal receipt (Default)' },
  { label: '76 mm', value: '76mm', description: 'Mid-size 3-inch thermal printer' },
  { label: '72 mm', value: '72mm', description: 'Compact 3-inch thermal printer' },
  { label: '57.5 mm', value: '57.5mm', description: 'Compact mini thermal printer' },
  { label: 'Custom', value: 'custom', description: 'User-specified width between 40mm and 120mm' },
];

export const MIN_CUSTOM_WIDTH = 40;
export const MAX_CUSTOM_WIDTH = 120;
export const DEFAULT_THERMAL_WIDTH: ThermalPaperWidth = '80mm';
export const DEFAULT_CUSTOM_WIDTH = 80;

/**
 * Safely resolves thermal paper width from settings, ensuring valid ranges and fallback defaults.
 */
export function resolveThermalWidth(
  paperWidth?: string | null,
  customWidth?: number | string | null
): ResolvedThermalWidth {
  let width: ThermalPaperWidth = DEFAULT_THERMAL_WIDTH;

  if (
    paperWidth === '58mm' ||
    paperWidth === '80mm' ||
    paperWidth === '76mm' ||
    paperWidth === '72mm' ||
    paperWidth === '57.5mm' ||
    paperWidth === 'custom'
  ) {
    width = paperWidth;
  }

  // Parse and clamp custom width between 40mm and 120mm
  let parsedCustom = typeof customWidth === 'number' ? customWidth : Number(customWidth);
  if (isNaN(parsedCustom) || parsedCustom <= 0) {
    parsedCustom = DEFAULT_CUSTOM_WIDTH;
  }
  const clampedCustom = Math.min(MAX_CUSTOM_WIDTH, Math.max(MIN_CUSTOM_WIDTH, Math.round(parsedCustom)));

  let widthMm: number;
  let widthCss: string;

  switch (width) {
    case '58mm':
      widthMm = 58;
      widthCss = '58mm';
      break;
    case '57.5mm':
      widthMm = 57.5;
      widthCss = '57.5mm';
      break;
    case '72mm':
      widthMm = 72;
      widthCss = '72mm';
      break;
    case '76mm':
      widthMm = 76;
      widthCss = '76mm';
      break;
    case 'custom':
      widthMm = clampedCustom;
      widthCss = `${clampedCustom}mm`;
      break;
    case '80mm':
    default:
      width = '80mm';
      widthMm = 80;
      widthCss = '80mm';
      break;
  }

  return {
    widthCss,
    widthMm,
    isNarrow: widthMm < 68,
    paperWidth: width,
    customWidth: clampedCustom,
  };
}
