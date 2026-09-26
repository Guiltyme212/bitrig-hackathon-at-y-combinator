import { View } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { k } from '@/theme';
import { useDuo } from '@/layout/Duo';
import DuoTabs from '@/layout/DuoTabs';

// Tabs are peers: native iOS 26 glass tab bar, no sliding between them.
// iPhone Duo, open: the system bar is hidden and DuoTabs draws a rail off the fold.
export default function TabsLayout() {
  const L = useDuo();
  // One tree on the Duo whatever the pose, so folding never resets the tabs.
  if (L.duo) return <View style={{ flex: 1, backgroundColor: k.bg }}>{tabs(!!L.pages)}<DuoTabs /></View>;
  return tabs(false);
}

function tabs(hidden: boolean) {
  return <NativeTabs tintColor={k.mint} minimizeBehavior="onScrollDown" hidden={hidden}>
    <NativeTabs.Trigger name="today">
      <NativeTabs.Trigger.Icon sf={{ default: 'sun.horizon', selected: 'sun.horizon.fill' }} md="wb_twilight" />
      <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="library">
      <NativeTabs.Trigger.Icon sf={{ default: 'books.vertical', selected: 'books.vertical.fill' }} md="library_music" />
      <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="you">
      <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
      <NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
  </NativeTabs>;
}
