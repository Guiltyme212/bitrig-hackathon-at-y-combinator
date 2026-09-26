import { useEffect, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { billing } from './revenuecat';

// Lives above all Duo regions, so folding never resets identity or an in-flight purchase.
export function BillingProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    if (__DEV__) (globalThis as Record<string, unknown>).__billing = billing;
    void billing.start();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void billing.refresh(); });
    return () => subscription.remove();
  }, []);
  return children;
}
