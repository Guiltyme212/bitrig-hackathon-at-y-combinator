import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassContainer, GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable, type GlassViewProps } from 'expo-glass-effect';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Text } from '../Text';
import { Icon, type IconName } from './Icon';
import { k, withAlpha } from '../theme';

// Real Liquid Glass on iOS 26; a quiet translucent surface everywhere else.
let available: boolean | null = null;
export function canUseGlass() {
  if (available === null) {
    try { available = process.env.EXPO_OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable(); }
    catch { available = false; }
  }
  return available;
}

const fallback: ViewStyle = { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' };
const EASE = Easing.bezier(0.23, 1, 0.32, 1);

// Glass must never sit inside a view whose opacity animates: UIKit drops its
// material (tint included) and it stays dropped. So glass arrives on its own:
// it materialises natively after `appear` ms while its contents fade in, and
// any surrounding motion is translation only (see `rise` in ui/motion).
function useMaterialise(appear: number | undefined, hidden: boolean) {
  const managed = appear !== undefined;
  const [ready, setReady] = useState(!managed);
  const content = useSharedValue(managed ? 0 : 1);
  useEffect(() => {
    if (!managed) return;
    const t = setTimeout(() => setReady(true), appear);
    return () => clearTimeout(t);
  }, [appear, managed]);
  const on = ready && !hidden;
  useEffect(() => {
    if (managed) content.set(withDelay(on ? 120 : 0, withTiming(on ? 1 : 0, { duration: on ? 480 : 240, easing: EASE })));
  }, [on, managed, content]);
  const fade = useAnimatedStyle(() => ({ opacity: content.get() }));
  const style: GlassViewProps['glassEffectStyle'] = managed ? { style: on ? 'regular' : 'none', animate: true, animationDuration: on ? 0.55 : 0.3 } : undefined;
  return { style, fade };
}

// When contents fade inside the glass, the layout moves onto the fading view.
const layoutKeys = new Set(['flexDirection', 'flexWrap', 'alignItems', 'justifyContent', 'gap', 'rowGap', 'columnGap', 'padding', 'paddingHorizontal', 'paddingVertical', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom']);
function split(style: StyleProp<ViewStyle>) {
  const outer: Record<string, unknown> = {}, inner: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(StyleSheet.flatten(style) ?? {})) (layoutKeys.has(key) ? inner : outer)[key] = value;
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

// `appear`: materialise after this many ms. `hidden`: dematerialise (needs `appear`).
type GlassProps = { style?: StyleProp<ViewStyle>; interactive?: boolean; tint?: string; clear?: boolean; appear?: number; hidden?: boolean; children?: React.ReactNode };
export function Glass({ style, interactive = false, tint, clear = false, appear, hidden = false, children }: GlassProps) {
  const m = useMaterialise(appear, hidden);
  if (canUseGlass()) {
    if (appear === undefined) return <GlassView glassEffectStyle={clear ? 'clear' : 'regular'} colorScheme="dark" isInteractive={interactive} tintColor={tint} style={style}>{children}</GlassView>;
    const { outer, inner } = split(style);
    return <GlassView glassEffectStyle={m.style} colorScheme="dark" isInteractive={interactive} tintColor={tint} style={outer}>
      <Animated.View style={[{ flexGrow: 1 }, inner, m.fade]}>{children}</Animated.View>
    </GlassView>;
  }
  return <Animated.View style={[fallback, tint ? { backgroundColor: tint } : null, style, appear === undefined ? null : m.fade]}>{children}</Animated.View>;
}

// Glass shapes inside merge and part like drops of the same material.
export function GlassGroup({ spacing = 10, style, children }: { spacing?: number; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  if (canUseGlass()) return <GlassContainer spacing={spacing} style={style}>{children}</GlassContainer>;
  return <View style={style}>{children}</View>;
}

export function GlassCircle({ icon, label, onPress, size = 44, iconSize = 18, color = k.ink, tint, appear, hidden }: { icon: IconName; label: string; onPress: () => void; size?: number; iconSize?: number; color?: string; tint?: string; appear?: number; hidden?: boolean }) {
  return <Glass interactive tint={tint} appear={appear} hidden={hidden} style={{ width: size, height: size, borderRadius: size / 2 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={iconSize} color={color} />
    </Pressable>
  </Glass>;
}

// The main action: tinted glass with dark ink, or quiet glass for a second choice.
export function GlassButton({ label, onPress, icon, secondary = false, disabled = false, tint = 'rgba(236,233,226,0.86)', compact = false, appear, hidden }: { label: string; onPress: () => void; icon?: IconName; secondary?: boolean; disabled?: boolean; tint?: string; compact?: boolean; appear?: number; hidden?: boolean }) {
  const glass = canUseGlass();
  const ink = secondary ? k.ink : k.mintInk;
  const height = compact ? 48 : 58;
  const shape: ViewStyle = { height, borderRadius: height / 2, alignSelf: compact ? 'center' : 'stretch' };
  return <Glass interactive={!disabled} tint={secondary ? (glass ? undefined : 'rgba(255,255,255,0.07)') : (glass ? tint : k.pill)} appear={appear} hidden={hidden} style={shape}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [{ height, paddingHorizontal: compact ? 22 : 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: disabled ? 0.4 : 1 }, !glass && pressed && { transform: [{ scale: 0.975 }], opacity: 0.88 }]}>
      {icon && <Icon name={icon} size={compact ? 17 : 19} color={ink} />}
      <Text style={{ fontSize: compact ? 15 : 16, lineHeight: 21, fontWeight: '600', letterSpacing: -0.1, color: ink }}>{label}</Text>
    </Pressable>
  </Glass>;
}

// A small glass capsule: shortcuts, correction chips, player controls. A faint
// tint keeps the capsule readable on pure black, where glass has little to bend.
export function GlassPill({ label, onPress, icon, selected = false, accent = k.mint, disabled = false, appear, hidden }: { label: string; onPress: () => void; icon?: IconName; selected?: boolean; accent?: string; disabled?: boolean; appear?: number; hidden?: boolean }) {
  return <Glass interactive={!disabled} appear={appear} hidden={hidden} tint={selected ? withAlpha(accent, 0.34) : 'rgba(255,255,255,0.05)'} style={{ borderRadius: 21 }}>
    <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={{ minHeight: 42, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: disabled ? 0.45 : 1 }}>
      {icon && <Icon name={icon} size={15} color={selected ? accent : k.secondary} />}
      <Text style={{ fontSize: 14, color: selected ? k.ink : k.body }}>{label}</Text>
    </Pressable>
  </Glass>;
}
