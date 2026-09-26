import { useCallback, useEffect, useRef, useState } from 'react';
import Animated from 'react-native-reanimated';
import { Text } from '../Text';
import { Glass } from './Glass';
import { Icon, type IconName } from './Icon';
import { k } from '../theme';
import { rise } from './motion';

type Note = { id: number; text: string; icon?: IconName };

// A quiet confirmation: a glass capsule that materialises, holds for a moment
// and dissolves. Render `node` wherever it should appear.
export function useToast() {
  const [note, setNote] = useState<Note | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);
  const show = useCallback((text: string, icon?: IconName) => {
    clear();
    setLeaving(false);
    setNote({ id: Date.now(), text, icon });
    timers.current.push(setTimeout(() => setLeaving(true), 2100));
    timers.current.push(setTimeout(() => setNote(null), 2600));
  }, []);
  const node = note ? <Animated.View key={note.id} entering={rise(0, -10, 420)} pointerEvents="none" style={{ alignItems: 'center' }}>
    <Glass appear={0} hidden={leaving} tint="rgba(255,255,255,0.06)" style={{ height: 42, borderRadius: 21, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {note.icon && <Icon name={note.icon} size={14} color={k.ink} />}
      <Text style={{ fontSize: 14, color: k.ink }}>{note.text}</Text>
    </Glass>
  </Animated.View> : null;
  return { show, node };
}
