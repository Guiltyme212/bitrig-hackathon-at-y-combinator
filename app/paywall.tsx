import { useEffect } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { billing as purchases, useBilling, type BillingPeriod } from '@/billing/revenuecat';
import { finishFirstRun } from '@/firstRun';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Text } from '@/Text';
import { touch } from '@/haptics';
import { Glass, GlassButton, GlassCircle } from '@/ui/Glass';
import { Icon, type IconName } from '@/ui/Icon';
import LiquidOrb from '@/orb/LiquidOrb';
import { voiceById } from '@/voices/voices';
import { kokoro, useKokoro } from '@/store';
import { k, withAlpha } from '@/theme';
import { rise } from '@/ui/motion';
import { Region, useRegions } from '@/layout/Duo';

const THIN = Platform.select({ ios: 'AvenirNext-UltraLight', default: undefined });

function Benefit({ icon, text, accent }: { icon: IconName; text: string; accent: string }) {
  return <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
    <Icon name={icon} size={20} color={accent} />
    <Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: k.body }}>{text}</Text>
  </View>;
}

function Plan({ id, selected, accent, onPress, appear, height = 116 }: { id: BillingPeriod; selected: boolean; accent: string; onPress: () => void; appear: number; height?: number }) {
  const { packages, busy } = useBilling();
  const product = packages[id]?.product;
  const plan = { name: id === 'yearly' ? 'Yearly' : 'Monthly', price: product?.priceString ?? 'Unavailable', per: id === 'yearly' ? 'a year' : 'a month', note: 'Auto-renews', badge: null };

  return <View style={{ flex: 1 }}>
    <Glass interactive appear={appear} tint={selected ? withAlpha(accent, 0.3) : 'rgba(255,255,255,0.05)'} style={{ borderRadius: 26 }}>
      <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${plan.name}, ${plan.price} ${plan.per}`} onPress={onPress} disabled={busy || !product}
        style={{ height, padding: 16, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: selected ? k.ink : k.secondary }}>{plan.name}</Text>
          <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: selected ? 0 : 1, borderColor: '#727279', backgroundColor: selected ? accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {selected && <Icon name="checkmark" size={11} color={k.mintInk} />}
          </View>
        </View>
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: 24, fontWeight: '600', letterSpacing: -0.5, color: k.ink, fontVariant: ['tabular-nums'] }}>{plan.price}</Text>
          <Text style={{ fontSize: 12, color: k.secondary }}>{plan.per} · {plan.note}</Text>
        </View>
      </Pressable>
    </Glass>
    {plan.badge && <Animated.View entering={FadeIn.delay(appear + 300)} pointerEvents="none" style={{ position: 'absolute', top: -10, right: 14, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 10, backgroundColor: accent }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: k.mintInk }}>{plan.badge}</Text>
    </Animated.View>}
  </View>;
}

// "Listen to the rest." The offer keeps their meditation in view: its name,
// its length, its voice. Price, trial, renewal and cancellation are all on
// screen; closing keeps the free recording and never argues with them.
export default function Paywall() {
  const insets = useSafeAreaInsets();
  const billing = useKokoro(s => s.billing), meditation = useKokoro(s => s.meditation), voiceId = useKokoro(s => s.voiceId);
  const voice = voiceById(voiceId);
  const choose = (value: 'yearly' | 'monthly') => { if (value !== billing) { touch.tick(); kokoro.set({ billing: value }); } };
  const purchaseState = useBilling();
  const R = useRegions();
  useEffect(() => { void purchases.start(); }, []);
  const product = purchaseState.packages[billing]?.product;
  const headline = 'A little space,\nwhenever you need it.';
  const subtitle = 'Keep your first meditation free. Unlock new sessions shaped around what is on your mind.';
  const ctaLabel = purchaseState.busy ? 'One moment...' : purchaseState.hasPro ? 'Continue with Pro' : product ? `Subscribe for ${product.priceString}/${billing === 'yearly' ? 'year' : 'month'}` : 'Plans unavailable';
  const legal = purchaseState.error ?? (product ? `${product.priceString} ${billing === 'yearly' ? 'a year' : 'a month'}, renews automatically. Cancel anytime.${purchaseState.testStore ? '\nRevenueCat test purchase. No charge.' : ''}` : 'Loading subscription plans...');
  const close = () => {
    if (purchaseState.busy) return;
    if (kokoro.get().onboarded) router.replace('/today');
    else finishFirstRun(purchaseState.hasPro ? 'pro' : 'free');
  };
  const unlocked = () => {
    touch.success();
    if (kokoro.get().onboarded) { kokoro.set({ plan: 'pro' }); router.replace('/today'); }
    else finishFirstRun('pro');
  };
  const restore = async () => { if (await purchases.restore()) unlocked(); };
  const subscribe = async () => { if (purchaseState.hasPro || await purchases.purchase(billing)) unlocked(); };
  const disabled = purchaseState.busy || (!purchaseState.hasPro && !product);
  const retry = () => { void purchases.start(); };

  function Benefits() {
    return <View style={{ gap: 12 }}>
      <Benefit accent={voice.accent} icon="sparkles" text="New meditations from your own words, whenever something’s on your mind" />
      <Benefit accent={voice.accent} icon="person.wave.2" text="Every voice, with the music made for it" />
      <Benefit accent={voice.accent} icon="timer" text="One minute or ten, whatever you have" />
    </View>;
  }

  // Today's exact layout: reused as-is on a phone, and inside the closed
  // display's column (a Region makes that column look like a whole phone).
  const phone = <View style={{ flex: 1, backgroundColor: k.bg }}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 18, paddingHorizontal: 24, paddingBottom: 200, gap: 18 }}>
      <View style={{ alignItems: 'center', marginBottom: -40 }}><LiquidOrb size={210} radius={210 * 0.26} look={voice.look} /></View>
      <Animated.View entering={FadeIn.duration(700)} style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 11, letterSpacing: 2.4, color: voice.accent }}>{(meditation?.title ?? 'Your meditation').toUpperCase()} · {voice.name.toUpperCase()}</Text>
        <Text accessibilityRole="header" style={{ fontFamily: THIN, fontSize: 40, lineHeight: 46, letterSpacing: -0.4, color: k.ink, textAlign: 'center', textShadowColor: withAlpha(voice.accent, 0.5), textShadowRadius: 22 }}>
          {headline}
        </Text>
        <Text style={{ fontSize: 15, lineHeight: 22, color: k.secondary, textAlign: 'center', marginTop: 4 }}>{subtitle}</Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(200).duration(600)} style={{ paddingHorizontal: 4 }}><Benefits /></Animated.View>
      <Animated.View entering={rise(320)} accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
        <Plan id="yearly" accent={voice.accent} selected={billing === 'yearly'} appear={320} onPress={() => choose('yearly')} />
        <Plan id="monthly" accent={voice.accent} selected={billing === 'monthly'} appear={400} onPress={() => choose('monthly')} />
      </Animated.View>
    </ScrollView>
    <View style={{ position: 'absolute', top: insets.top + 6, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <GlassCircle icon="xmark" label="Close" color={k.secondary} onPress={close} />
      <Pressable accessibilityRole="button" hitSlop={10} onPress={restore} disabled={purchaseState.busy}>
        <Text style={{ fontSize: 14, color: k.secondary }}>Restore</Text>
      </Pressable>
    </View>
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingTop: 40, paddingBottom: Math.max(insets.bottom, 18) }}>
      <LinearGradient colors={['#00000000', '#000000', '#000000']} locations={[0, 0.34, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <GlassButton label={ctaLabel} tint={withAlpha(voice.accent, 0.9)} onPress={subscribe} disabled={disabled} />
      <Text style={{ marginTop: 12, fontSize: 12, lineHeight: 18, color: '#98989F', textAlign: 'center' }}>{legal}</Text>
      <Pressable accessibilityRole="button" onPress={retry}><Text style={{ marginTop: 8, fontSize: 11, color: k.secondary, textAlign: 'center' }}>Reload plans</Text></Pressable>
    </View>
  </View>;

  if (!R.L.duo) return phone;
  if (!R.split) {
    // Closed: today's composition, but tightened to the shorter 382x658
    // column — orb canvas 168, a smaller headline, 104pt cards — so both
    // prices show without scrolling (Table B row 15).
    const closedLegal = legal;
    return <Region rect={R.orb.rect} insets={R.orb.insets}>
      <View style={{ flex: 1, backgroundColor: k.bg, paddingHorizontal: 24, paddingTop: R.orb.insets.top, paddingBottom: R.orb.insets.bottom, justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <LiquidOrb size={168} radius={168 * 0.26} look={voice.look} />
          <Animated.View entering={FadeIn.duration(700)} style={{ alignItems: 'center', gap: 3, marginTop: -14 }}>
            <Text style={{ fontSize: 10, letterSpacing: 2, color: voice.accent }}>{(meditation?.title ?? 'Your meditation').toUpperCase()} · {voice.name.toUpperCase()}</Text>
            <Text accessibilityRole="header" style={{ fontFamily: THIN, fontSize: 32, lineHeight: 36, letterSpacing: -0.3, color: k.ink, textAlign: 'center', textShadowColor: withAlpha(voice.accent, 0.5), textShadowRadius: 18 }}>
              {headline}
            </Text>
          </Animated.View>
        </View>
        <Animated.View entering={rise(200)} accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 10 }}>
          <Plan id="yearly" height={104} accent={voice.accent} selected={billing === 'yearly'} appear={200} onPress={() => choose('yearly')} />
          <Plan id="monthly" height={104} accent={voice.accent} selected={billing === 'monthly'} appear={260} onPress={() => choose('monthly')} />
        </Animated.View>
        <View style={{ gap: 6 }}>
          <GlassButton compact label={ctaLabel} tint={withAlpha(voice.accent, 0.9)} appear={320} onPress={subscribe} disabled={disabled} />
          <Text style={{ fontSize: 11, lineHeight: 15, color: '#98989F', textAlign: 'center' }}>{closedLegal}</Text>
          {/* One row, Restore included: keeps it off the camera strip that starts right of the column. */}
          <Pressable accessibilityRole="button" hitSlop={10} onPress={restore} disabled={purchaseState.busy} style={{ alignSelf: 'center' }}>
            <Text style={{ fontSize: 11, color: k.faint, textAlign: 'center' }}>Restore purchases</Text>
          </Pressable>
        </View>
      </View>
      <View style={{ position: 'absolute', top: 0, left: 0 }}>
        <GlassCircle icon="xmark" label="Close" color={k.secondary} onPress={close} />
      </View>
    </Region>;
  }

  // Open landscape and portrait: canvas B6. The orb keeps its page (headline
  // and, in landscape, the benefits); the words page holds the plans, the CTA
  // and the legal text, centred vertically. The close circle stays with the orb.
  const isPortrait = R.fold?.axis === 'y';
  return <View style={{ flex: 1, backgroundColor: k.bg }}>
    <Region rect={R.orb.rect} insets={R.orb.insets}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 16 }}>
        <LiquidOrb size={320} radius={320 * 0.26} look={voice.look} />
        <Animated.View entering={FadeIn.duration(700)} style={{ alignItems: 'center', gap: 6, marginTop: -26 }}>
          <Text style={{ fontSize: 11, letterSpacing: 2.4, color: voice.accent }}>{(meditation?.title ?? 'Your meditation').toUpperCase()} · {voice.name.toUpperCase()}</Text>
          <Text accessibilityRole="header" style={{ fontFamily: THIN, fontSize: 40, lineHeight: 46, letterSpacing: -0.4, color: k.ink, textAlign: 'center', width: 330, textShadowColor: withAlpha(voice.accent, 0.5), textShadowRadius: 22 }}>
            {headline}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 22, color: k.secondary, textAlign: 'center', marginTop: 4, width: 330 }}>{subtitle}</Text>
        </Animated.View>
        {!isPortrait && <Animated.View entering={FadeInDown.delay(200).duration(600)} style={{ width: 330, marginTop: 4 }}><Benefits /></Animated.View>}
      </View>
      <View style={{ position: 'absolute', top: 0, left: 0 }}>
        <GlassCircle icon="xmark" label="Close" color={k.secondary} onPress={close} />
      </View>
    </Region>
    <Region rect={R.words.rect} insets={R.words.insets}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 20 }}>
        {isPortrait && <Benefits />}
        <Animated.View entering={rise(160)} accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 10 }}>
          <Plan id="yearly" accent={voice.accent} selected={billing === 'yearly'} appear={160} onPress={() => choose('yearly')} />
          <Plan id="monthly" accent={voice.accent} selected={billing === 'monthly'} appear={220} onPress={() => choose('monthly')} />
        </Animated.View>
        <View style={{ gap: 12 }}>
          <GlassButton label={ctaLabel} tint={withAlpha(voice.accent, 0.9)} appear={280} onPress={subscribe} disabled={disabled} />
          <Text style={{ fontSize: 12, lineHeight: 18, color: '#98989F', textAlign: 'center' }}>{legal}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
            <Pressable accessibilityRole="button" hitSlop={10} onPress={restore} disabled={purchaseState.busy}><Text style={{ fontSize: 13, color: k.secondary }}>Restore</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={retry}><Text style={{ fontSize: 13, color: k.secondary }}>Reload plans</Text></Pressable>
          </View>
        </View>
      </View>
    </Region>
  </View>;
}
