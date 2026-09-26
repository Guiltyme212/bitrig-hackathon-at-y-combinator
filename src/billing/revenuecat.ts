import { useSyncExternalStore } from 'react';
import { NativeModules, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import { accessFrom, configurationProblem } from './policy';

export type BillingPeriod = 'yearly' | 'monthly';
type BillingState = {
  status: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
  busy: boolean;
  hasPro: boolean;
  isTrial: boolean;
  isSandbox: boolean;
  testStore: boolean;
  error: string | null;
  packages: Partial<Record<BillingPeriod, PurchasesPackage>>;
  appUserId: string | null;
};
let state: BillingState = { status: 'idle', busy: false, hasPro: false, isTrial: false, isSandbox: false, testStore: false, error: null, packages: {}, appUserId: null };
const listeners = new Set<() => void>();
const update = (patch: Partial<BillingState>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
let starting: Promise<void> | null = null;
let listening = false;
const customerChanged = (info: CustomerInfo) => update(accessFrom(info));
const message = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'userCancelled' in error && error.userCancelled) return null;
  // Do not log provider errors or keys. Preserve a useful, safe message for retry.
  return 'The purchase could not be completed. Check your connection and try again.';
};

export const billing = {
  get: () => state,
  async start(): Promise<void> {
    if (state.status === 'ready' || state.status === 'unavailable') return;
    if (starting) return starting;
    starting = (async () => {
      const key: string = Constants.expoConfig?.extra?.revenueCat?.apiKey ?? '';
      const problem = configurationProblem(Platform.OS, Constants.executionEnvironment === ExecutionEnvironment.StoreClient, __DEV__, key);
      if (problem) { update({ status: 'unavailable', error: problem }); return; }
      if (!NativeModules.RNPurchases) { update({ status: 'unavailable', error: 'Purchases need the updated native Kokoro build.' }); return; }
      update({ status: 'loading', error: null, testStore: key.startsWith('test_') });
      try {
        await Purchases.setLogLevel(LOG_LEVEL.ERROR);
        if (!await Purchases.isConfigured()) Purchases.configure({ apiKey: key });
        if (!listening) { Purchases.addCustomerInfoUpdateListener(customerChanged); listening = true; }
        const info = await Purchases.getCustomerInfo();
        customerChanged(info);
        const [offerings, appUserId] = await Promise.all([Purchases.getOfferings(), Purchases.getAppUserID()]);
        const current = offerings.current;
        update({ status: 'ready', appUserId, packages: { yearly: current?.annual ?? undefined, monthly: current?.monthly ?? undefined }, error: current ? null : 'No subscription plans are available yet.' });
      } catch {
        update({ status: 'error', error: 'Subscriptions could not load. Check your connection and try again.' });
      }
    })();
    try { await starting; } finally { starting = null; }
  },
  async refresh(): Promise<void> {
    if (state.status !== 'ready') { await billing.start(); return; }
    try { customerChanged(await Purchases.getCustomerInfo()); } catch { /* SDK caches verified access for offline use. */ }
  },
  async purchase(period: BillingPeriod): Promise<boolean> {
    if (state.busy) return false;
    const product = state.packages[period];
    if (state.status !== 'ready' || !product) return false;
    update({ busy: true, error: null });
    try {
      const { customerInfo } = await Purchases.purchasePackage(product);
      customerChanged(customerInfo);
      if (!state.hasPro) update({ error: 'The purchase has not unlocked Kokoro Pro yet. Try Restore before purchasing again.' });
      return state.hasPro;
    } catch (error) { update({ error: message(error) }); return false; }
    finally { update({ busy: false }); }
  },
  async restore(): Promise<boolean> {
    if (state.busy) return false;
    await billing.start();
    if (state.status !== 'ready' || state.busy) return false;
    update({ busy: true, error: null });
    try {
      customerChanged(await Purchases.restorePurchases());
      if (!state.hasPro) update({ error: 'No active Kokoro Pro subscription was found.' });
      return state.hasPro;
    } catch { update({ error: 'Purchases could not be restored. Check your connection and try again.' }); return false; }
    finally { update({ busy: false }); }
  },
};
export const useBilling = () => useSyncExternalStore(subscribe, billing.get, billing.get);
