import { ComponentProps } from 'react';
import { Platform, StyleSheet, Text as NativeText, useWindowDimensions } from 'react-native';

// Explicit iOS sizes keep measurement and glyph rendering in sync when
// Dynamic Type changes while this Expo/RN runtime is already open.
export function Text({style,allowFontScaling=true,maxFontSizeMultiplier,...props}:ComponentProps<typeof NativeText>) {
  const {fontScale}=useWindowDimensions();
  if(Platform.OS!=='ios')return <NativeText {...props} style={style} allowFontScaling={allowFontScaling} maxFontSizeMultiplier={maxFontSizeMultiplier}/>;
  const base=StyleSheet.flatten(style);
  const multiplier=allowFontScaling?(maxFontSizeMultiplier&&maxFontSizeMultiplier>0?Math.min(fontScale,maxFontSizeMultiplier):fontScale):1;
  const scaled={
    ...(typeof base?.fontSize==='number'?{fontSize:base.fontSize*multiplier}:{}),
    ...(typeof base?.lineHeight==='number'?{lineHeight:base.lineHeight*multiplier}:{}),
  };
  return <NativeText {...props} style={[style,scaled]} allowFontScaling={false}/>;
}
