import { Canvas, Fill, Shader, Skia, useClock } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { skiaFragment } from './shader';
export type OrbProps = { size: number; touching: boolean; reduced: boolean; mood: number };
const effect=Skia.RuntimeEffect.Make(skiaFragment);
export default function Orb({size,touching,reduced,mood}:OrbProps){
  const clock=useClock();const force=useSharedValue(0);
  useEffect(()=>{force.value=withTiming(touching?1:0,{duration:300});},[touching,force]);
  const uniforms=useDerivedValue(()=>({resolution:[size,size],time:reduced?4:clock.value/1000,touch:force.value,mood}),[size,reduced,mood]);
  if(!effect)return null;
  return <Canvas style={{width:size,height:size}} pointerEvents="none"><Fill><Shader source={effect} uniforms={uniforms}/></Fill></Canvas>;
}
