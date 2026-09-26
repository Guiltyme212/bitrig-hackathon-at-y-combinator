import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { DarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { kokoro, useKokoro } from '@/store';
import { finishFirstRun } from '@/firstRun';
import { k } from '@/theme';
import { DuoProvider, useDuo } from '@/layout/Duo';
import { BillingProvider } from '@/billing/Provider';

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: k.bg, card: k.bg, primary: k.mint } };

// Sheets use the app's own dark surface: system glass follows the device's light/dark
// setting (Expo Go ignores userInterfaceStyle), and light glass hides white text.
// First run is a one-way door: onboarding, the preview, the paywall and sign-in live behind
// `!onboarded`; the everyday app behind `onboarded`. Talking, making and choosing
// a voice belong to both.
export default function RootLayout() {
  const onboarded = useKokoro(s => s.onboarded);

  // Development-only QA hook: navigate and seed state from the debugger while
  // the simulator can't inject touches on this Mac.
  useEffect(() => {
    if (!__DEV__) return;
    (globalThis as Record<string, unknown>).__kokoro = { router, store: kokoro, finish: finishFirstRun };
  }, []);

  return <GestureHandlerRootView style={{ flex: 1, backgroundColor: k.bg }}>
    <SafeAreaProvider>
      <BillingProvider>
      <DuoProvider>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <RootStack onboarded={onboarded} />
      </ThemeProvider>
      </DuoProvider>
      </BillingProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>;
}

// On the iPhone Duo a system form sheet would float centred on the fold (open) or cover
// the strip (closed), so sign-in and the sound mix arrive as see-through overlays whose
// panel sits on the words page while the orb stays in view on its own.
const overlay = { presentation: 'transparentModal' as const, animation: 'fade' as const, contentStyle: { backgroundColor: 'transparent' } };
function RootStack({ onboarded }: { onboarded: boolean }) {
  const duo = useDuo().duo;
  return <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: k.bg } }}>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="index" />
          <Stack.Screen name="preview" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="offer" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="sign-in" options={duo ? overlay : { presentation: 'formSheet', sheetAllowedDetents: [0.5], sheetGrabberVisible: true, contentStyle: { backgroundColor: k.sheet } }} />
        </Stack.Protected>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="player" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="sound" options={duo ? overlay : { presentation: 'formSheet', sheetAllowedDetents: [0.7], sheetGrabberVisible: true, contentStyle: { backgroundColor: k.sheet } }} />
          <Stack.Screen name="complete" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Screen name="paywall" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="chat" options={{ animation: 'fade' }} />
        <Stack.Screen name="making" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="voice" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      </Stack>
  </>;
}
