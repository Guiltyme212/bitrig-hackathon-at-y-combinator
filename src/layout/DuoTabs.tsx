import { useEffect } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Text } from '../Text';
import { Glass } from '../ui/Glass';
import { touch } from '../haptics';
import { k } from '../theme';
import { useDuo } from './Duo';

// iPhone Duo, open: the system tab bar would float centred on the fold, so the tabs become
// a glass rail. Landscape: upright in the strip beside the words page (below its status
// block), where the Duo keeps its own bars. Portrait: a capsule at the foot of the bottom
// half, the flat half your hand is on.
const TABS = [
  { name: 'today', label: 'Today', href: '/today' as const },
  { name: 'library', label: 'Library', href: '/library' as const },
  { name: 'you', label: 'You', href: '/you' as const },
];

function TabIcon({ name, color }: { name: string; color: string }) {
  const p = { stroke: color, strokeWidth: 1.7, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return <Svg width={22} height={22} viewBox="0 0 24 24">
    {name === 'today' && <><Path d="M3.8 18.6h16.4" {...p} /><Path d="M7.4 18.6a4.6 4.6 0 0 1 9.2 0" {...p} /><Path d="M12 6.4v2.3M5.9 9.1l1.6 1.6M18.1 9.1l-1.6 1.6M3.4 14.3h2.1M18.5 14.3h2.1" {...p} /></>}
    {name === 'library' && <><Rect x={3.6} y={4.4} width={4.2} height={15.2} rx={1.1} {...p} /><Rect x={9.5} y={4.4} width={4.2} height={15.2} rx={1.1} {...p} /><Path d="M15.6 5.7l3.8-.9 2.9 14.4-3.8.9z" {...p} /></>}
    {name === 'you' && <><Circle cx={12} cy={8.6} r={3.6} {...p} /><Path d="M5 19.8c1.2-3.5 3.9-5.3 7-5.3s5.8 1.8 7 5.3" {...p} /></>}
  </Svg>;
}

export default function DuoTabs() {
  const L = useDuo();
  const path = usePathname();
  // The web build of NativeTabs ignores `hidden`: hide its bar in the Duo sandbox too, so
  // review shots match the native app.
  useEffect(() => {
    if (Platform.OS !== 'web' || !L.pages || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.textContent = '[role="tablist"][aria-label="Main"]{display:none!important}';
    document.head.appendChild(style);
    return () => style.remove();
  }, [L.pages]);
  if (!L.pages) return null;
  const upright = L.geometry === 'openLandscape';
  const strip = Math.max(L.insets.right, L.insets.left);
  const item = { w: upright ? 56 : 88, h: upright ? 58 : 50 };
  const rail = upright
    ? { w: 64, h: item.h * 3 + 2 * 2 + 8 }
    : { w: item.w * 3 + 2 * 2 + 8, h: item.h + 8 };
  const left = upright
    ? (L.insets.right >= L.insets.left ? L.window.w - strip + (strip - rail.w) / 2 : (strip - rail.w) / 2)
    : (L.window.w - rail.w) / 2;
  const top = upright ? Math.max(140, (L.window.h - rail.h) / 2) : L.window.h - Math.max(L.insets.bottom, 16) - rail.h - 4;
  return <View pointerEvents="box-none" style={{ position: 'absolute', left, top, width: rail.w, height: rail.h }}>
    <Glass style={{ flex: 1, borderRadius: upright ? 32 : rail.h / 2, padding: 4, flexDirection: upright ? 'column' : 'row', gap: 2 }}>
      {TABS.map(t => {
        const on = path === t.href || path.startsWith(`${t.href}/`);
        return <Pressable key={t.name} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: on }}
          onPress={() => { if (!on) { touch.light(); router.navigate(t.href); } }}
          style={{ width: item.w, height: item.h, borderRadius: item.h / 2, alignItems: 'center', justifyContent: 'center', gap: 3, flexDirection: upright ? 'column' : 'row',
            backgroundColor: on ? 'rgba(255,255,255,0.16)' : 'transparent' }}>
          <TabIcon name={t.name} color={on ? k.ink : k.secondary} />
          <Text style={{ fontSize: upright ? 10 : 13, fontWeight: on ? '600' : '500', color: on ? k.ink : k.secondary }}>{t.label}</Text>
        </Pressable>;
      })}
    </Glass>
  </View>;
}
