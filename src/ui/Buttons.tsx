import { Pressable, View } from 'react-native';
import { Text } from '../Text';
import { k, r } from '../theme';
import { Icon, type IconName } from './Icon';

// Press feedback lands on press-in: scale .979 and a little dimming, like the onboarding.
export function PrimaryButton({ label, onPress, disabled = false, icon, compact = false }: { label: string; onPress: () => void; disabled?: boolean; icon?: IconName; compact?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [{
      minHeight: compact ? 48 : 58, paddingVertical: compact ? 12 : 16, paddingHorizontal: compact ? 22 : 24,
      borderRadius: r.pill, borderCurve: 'continuous', backgroundColor: k.pill,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      alignSelf: compact ? 'center' : 'stretch',
    }, pressed && { transform: [{ scale: 0.979 }], opacity: 0.88 }, disabled && { opacity: 0.36 }]}>
    {icon && <Icon name={icon} size={compact ? 18 : 20} color={k.pillInk} />}
    <Text style={{ fontSize: compact ? 15 : 16, lineHeight: 22, fontWeight: '600', color: k.pillInk, letterSpacing: -0.1 }}>{label}</Text>
  </Pressable>;
}

export function TextButton({ label, onPress, color = k.secondary, size = 13 }: { label: string; onPress: () => void; color?: string; size?: number }) {
  return <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6} style={({ pressed }) => [{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.6 }]}>
    <Text style={{ fontSize: size, color }}>{label}</Text>
  </Pressable>;
}

export function Selectable({ selected, onPress, children, style, role = 'radio' }: { selected: boolean; onPress: () => void; children: React.ReactNode; style?: object; role?: 'radio' | 'checkbox' }) {
  return <Pressable accessibilityRole={role} accessibilityState={{ checked: selected }} onPress={onPress}
    style={({ pressed }) => [{ borderRadius: r.row, borderCurve: 'continuous', borderWidth: 1, borderColor: selected ? k.selectedLine : k.line, backgroundColor: pressed ? '#242427' : selected ? k.selectedFill : k.surface }, style]}>
    {children}
  </Pressable>;
}

export function CheckBadge({ size = 22 }: { size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: k.mint, alignItems: 'center', justifyContent: 'center' }}>
    <Icon name="checkmark" size={size * 0.55} color="#050A08" />
  </View>;
}
