import { View } from 'react-native';
import { Text } from '../Text';
import { touch } from '../haptics';
import { GlassButton } from '../ui/Glass';
import { TextButton } from '../ui/Buttons';
import { k } from '../theme';

// Kokoro has said what it will make; one tap makes it. "Change something" lets
// them say what to change, and the orb proposes again.
export default function ProposalDock({ title, onMake, onChange }: { title: string; onMake: () => void; onChange: () => void }) {
  return <View style={{ gap: 6 }}>
    <Text style={{ fontSize: 11, letterSpacing: 2.6, color: k.quiet, textAlign: 'center', marginBottom: 6 }}>{title.toUpperCase()}</Text>
    <GlassButton icon="sparkles" label="Make it" appear={120} onPress={() => { touch.medium(); onMake(); }} />
    <TextButton label="Change something" onPress={() => { touch.light(); onChange(); }} />
  </View>;
}
