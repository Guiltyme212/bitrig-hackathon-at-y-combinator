import { StyleSheet } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

// Content dissolves into transparency over the top `fade` of its height.
export default function FadeMask({ fade, children }: { fade: number; children: React.ReactNode }) {
  return <MaskedView style={{ flex: 1 }} maskElement={<LinearGradient colors={['#00000000', '#000000']} locations={[0, fade]} style={StyleSheet.absoluteFill} />}>
    {children}
  </MaskedView>;
}
