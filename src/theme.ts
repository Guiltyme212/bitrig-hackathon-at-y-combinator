import { Platform } from 'react-native';

// One palette for the whole app: black canvas, one grey family, one accent (pearl).
export const k = {
  bg: '#000000',
  ink: '#FFFFFF',
  body: '#E4E4E8',
  secondary: '#BCBBC0',
  quiet: '#929298',
  faint: '#6E6E75',
  surface: '#111113',
  line: '#28282D',
  hairline: '#1E1E22',
  // Pearl, not mint: Dan found the green off-key. The name stays for now.
  mint: '#ECE9E2',
  mintInk: '#121212',
  echo: '#D9C4A2',        // your own words, echoed back in champagne
  selectedLine: '#CFCAC0',
  selectedFill: '#1D1C1A',
  pill: '#ECE9E2',
  pillInk: '#121212',
  sheet: '#151517',
};

// Shape rule: actions are pills, cards 22, rows 18, chips 16.
export const r = { pill: 30, card: 22, row: 18, chip: 16 };

export const wordmarkFont = Platform.select({ ios: 'AvenirNext-Regular', default: "'Avenir Next', Avenir, -apple-system, BlinkMacSystemFont, sans-serif" });

// Liquid Glass tints need rgba(); 8-digit hex is ignored by the native view.
export function withAlpha(hex: string, alpha: number) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}
