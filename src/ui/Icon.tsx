import { SymbolView, type SFSymbol } from 'expo-symbols';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { k } from '../theme';

// SF Symbols on iOS; the same glyphs drawn in one 1.5px stroke family elsewhere.
const drawn: Record<string, (c: string) => React.ReactNode> = {
  'chevron.left': () => <Path d="m14 6-6 6 6 6" />,
  'chevron.down': () => <Path d="m6 9 6 6 6-6" />,
  'chevron.right': () => <Path d="m10 6 6 6-6 6" />,
  xmark: () => <Path d="m6 6 12 12M18 6 6 18" />,
  checkmark: () => <Path d="m5 12 4 4L19 6" />,
  'mic.fill': () => <><Rect x={9} y={3} width={6} height={12} rx={3} /><Path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></>,
  plus: () => <Path d="M12 5v14M5 12h14" />,
  'arrow.up': () => <Path d="M12 19V5M6 11l6-6 6 6" />,
  'cloud.rain': () => <><Path d="M7 15h10a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 6.6 9 3 3 0 0 0 7 15Z" /><Path d="M9 18.5 8.3 20M13 18.5l-.7 1.5M17 18.5l-.7 1.5" /></>,
  'water.waves': () => <><Path d="M3 10c2.5-2.4 4.5-2.4 7 0s4.5 2.4 7 0c1.2-1.1 2.4-1.6 4-1.6" /><Path d="M3 16c2.5-2.4 4.5-2.4 7 0s4.5 2.4 7 0c1.2-1.1 2.4-1.6 4-1.6" /></>,
  pianokeys: () => <><Rect x={3.5} y={5} width={17} height={14} rx={2} /><Path d="M9 5v14M15 5v14M7.5 5v8M13 5v8M18 5v8" /></>,
  sparkles: () => <Path d="M12 3.5 13.7 9l5.3 1.8-5.3 1.7L12 18l-1.7-5.5L5 10.8 10.3 9Z" />,
  leaf: () => <><Path d="M5 19c0-7.5 5-12.5 14-14 0 8.5-5 13.5-13 14Z" /><Path d="M5 19l7.5-7.5" /></>,
  waveform: () => <Path d="M4 12h1.5M7.5 8.5v7M11 5.5v13M14.5 8v8M18 10.5v3" />,
  moon: () => <Path d="M19.5 14.2A7.8 7.8 0 1 1 9.8 4.5a6.2 6.2 0 0 0 9.7 9.7Z" />,
  'arrow.triangle.2.circlepath': () => <><Path d="M4.5 12a7.5 7.5 0 0 1 13.1-5M19.5 12a7.5 7.5 0 0 1-13.1 5" /><Path d="M17.8 3.5V7h-3.5M6.2 20.5V17h3.5" /></>,
  scope: () => <><Circle cx={12} cy={12} r={7.5} /><Circle cx={12} cy={12} r={3} /></>,
  'slider.horizontal.3': () => <><Path d="M4 8h9M17 8h3M4 16h3M11 16h9" /><Circle cx={15} cy={8} r={2} /><Circle cx={9} cy={16} r={2} /></>,
  timer: () => <><Circle cx={12} cy={13} r={7.5} /><Path d="M12 9v4l2.5 2M9.5 3h5" /></>,
  'captions.bubble': () => <><Rect x={3.5} y={5.5} width={17} height={13} rx={2.5} /><Path d="M10.5 10.3a2.2 2.2 0 1 0 0 3.4M16.5 10.3a2.2 2.2 0 1 0 0 3.4" /></>,
  headphones: () => <><Path d="M4 15.5V12a8 8 0 0 1 16 0v3.5" /><Rect x={3.5} y={14.5} width={4} height={5.5} rx={1.5} /><Rect x={16.5} y={14.5} width={4} height={5.5} rx={1.5} /></>,
  'quote.opening': () => <Path d="M6.5 7.5h4v4c0 3-1.3 4.7-4 5.5M13.5 7.5h4v4c0 3-1.3 4.7-4 5.5" />,
  heart: () => <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />,
  'gobackward.15': () => <><Path d="M5 12a7 7 0 1 0 2.1-5" /><Path d="M5 4.5V8h3.5" /></>,
  'goforward.15': () => <><Path d="M19 12a7 7 0 1 1-2.1-5" /><Path d="M19 4.5V8h-3.5" /></>,
  'arrow.counterclockwise': () => <><Path d="M5 12a7 7 0 1 0 2.1-5" /><Path d="M5 4.5V8h3.5" /></>,
  bell: () => <><Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15Z" /><Path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>,
  'lock.shield': () => <Path d="M12 3.5 19 6v5.5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6Z" />,
  'arrow.right': () => <Path d="M5 12h14M13 6l6 6-6 6" />,
  'stop.fill': c => <Rect x={6.5} y={6.5} width={11} height={11} rx={2} fill={c} stroke="none" />,
  'speaker.wave.2': () => <><Path d="M11 5 6 9H3v6h3l5 4V5Z" /><Path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></>,
  'speaker.slash': () => <><Path d="M11 5 6 9H3v6h3l5 4V5Z" /><Path d="m16 9 5 6m0-6-5 6" /></>,
  pencil: () => <><Path d="M4 20h4L19 9l-4-4L4 16v4Z" /><Path d="m13.5 6.5 4 4" /></>,
  'arrow.clockwise': () => <><Path d="M19 12a7 7 0 1 1-2.1-5" /><Path d="M19 4.5V8h-3.5" /></>,
  'person.wave.2': () => <><Circle cx={12} cy={8} r={3.2} /><Path d="M6 19c.8-3.2 3.1-5 6-5s5.2 1.8 6 5" /><Path d="M3.5 6.5a8 8 0 0 0 0 5M20.5 6.5a8 8 0 0 1 0 5" /></>,
  'music.note': () => <><Path d="M9 18V6l10-2v12" /><Circle cx={7} cy={18} r={2} /><Circle cx={17} cy={16} r={2} /></>,
  'text.quote': () => <Path d="M4 6h16M4 11h16M4 16h10" />,
  'play.fill': c => <Path d="M8.5 5.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2a.8.8 0 0 0-1.2.7Z" fill={c} stroke="none" />,
  'pause.fill': c => <><Rect x={6.5} y={5} width={4} height={14} rx={1.3} fill={c} stroke="none" /><Rect x={13.5} y={5} width={4} height={14} rx={1.3} fill={c} stroke="none" /></>,
  bookmark: () => <Path d="M7 4.5h10v15.5l-5-3.6-5 3.6Z" />,
  keyboard: () => <><Rect x={2.5} y={6} width={19} height={12} rx={2} /><Path d="M6 9.5h.01M9 9.5h.01M12 9.5h.01M15 9.5h.01M18 9.5h.01M6 12.5h.01M9 12.5h.01M12 12.5h.01M15 12.5h.01M18 12.5h.01M8 15.5h8" /></>,
  'bookmark.fill': c => <Path d="M7 4.5h10v15.5l-5-3.6-5 3.6Z" fill={c} />,
  'books.vertical': () => <><Rect x={4} y={5} width={4.5} height={14} rx={1} /><Rect x={10} y={5} width={4.5} height={14} rx={1} /><Path d="m16.2 6.2 3.8-1 2.6 13.4-3.8 1Z" /></>,
  'quote.bubble': () => <><Path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-7l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5Z" /><Path d="M8.5 10h2.2v2.2c0 1-.5 1.7-1.6 2M13.3 10h2.2v2.2c0 1-.5 1.7-1.6 2" /></>,
  'quote.bubble.fill': c => <Path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-7l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5Z" fill={c} />,
  'music.note.list': () => <><Path d="M4 6h10M4 10.5h10M4 15h6" /><Path d="M17 17.5V7l3.5-1" /><Circle cx={15.5} cy={17.5} r={1.8} /></>,
  'mic': () => <><Rect x={9} y={3} width={6} height={12} rx={3} /><Path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3" /></>,
};

export type IconName = keyof typeof drawn;

export function Icon({ name, size = 22, color = k.ink }: { name: IconName; size?: number; color?: string }) {
  const svg = <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">{drawn[name](color)}</Svg>;
  if (process.env.EXPO_OS !== 'ios') return svg;
  return <SymbolView name={name as SFSymbol} size={size} tintColor={color} weight="regular" fallback={svg} />;
}
