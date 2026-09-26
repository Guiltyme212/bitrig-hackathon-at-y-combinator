import { View } from 'react-native';

// The web MaskedView drops its children, so the browser gets a CSS mask instead.
export default function FadeMask({ fade, children }: { fade: number; children: React.ReactNode }) {
  const mask = `linear-gradient(to bottom, transparent 0%, black ${Math.round(fade * 100)}%)`;
  return <View style={{ flex: 1, maskImage: mask, WebkitMaskImage: mask } as object}>{children}</View>;
}
