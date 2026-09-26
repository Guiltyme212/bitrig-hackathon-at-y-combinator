import { useEffect, useRef } from 'react';
import { Image, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import GlassOrb from './GlassOrb';
import { orbOptions } from './options';

const ScrollContainer = Platform.OS === 'web' ? ScrollView : Animated.ScrollView;

type Props = {
  size: number; index: number; interactive: boolean; reduced: boolean; hold?: boolean;
  touching: boolean; onChange: (index: number) => void;
  onTouch: (touching: boolean) => void; onHold: () => void; onTap: () => void;
};

export default function OrbPager({size,index,interactive,reduced,hold=false,touching,onChange,onTouch,onHold,onTap}:Props) {
  const scroll = useRef<ScrollView>(null);
  const current = useRef(index);
  const previous = useRef(index);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offset = useSharedValue(index*size);
  const option = orbOptions[index];
  current.current = index;

  function settle(position:number) {
    if(!interactive)return;
    const next=Math.max(0,Math.min(orbOptions.length-1,Math.round(position/size)));
    onTouch(false);
    if(next!==current.current){previous.current=next;onChange(next);}
  }
  const nativeScroll = useAnimatedScrollHandler({
    onScroll: event => { offset.value=event.contentOffset.x; },
    onMomentumEnd: event => { runOnJS(settle)(event.contentOffset.x); },
  });
  const videoStyle = useAnimatedStyle(()=>({
    transform:[{translateX:interactive?index*size-offset.value:0},{scale:option.scale}],
  }));
  useEffect(()=>()=>{if(settleTimer.current)clearTimeout(settleTimer.current);},[]);

  useEffect(() => {
    if (previous.current !== index) scroll.current?.scrollTo({ x:index*size, animated:!reduced });
    previous.current = index;
  }, [index,size,reduced]);
  useEffect(()=>{
    if(interactive){offset.value=current.current*size;scroll.current?.scrollTo({x:current.current*size,animated:false});}
  },[interactive,size]);

  // Keep the playing material mounted outside the scroll viewport. iOS can
  // adjust that viewport's offset while its parent scales between screens.
  // The selected orb stays centred, with uninterrupted playback, after entry.
  return <View style={{width:size,height:size,overflow:'hidden'}}>
    <ScrollContainer ref={scroll} horizontal pagingEnabled bounces={false}
      scrollEnabled={interactive} showsHorizontalScrollIndicator={false}
      automaticallyAdjustContentInsets={false} contentInsetAdjustmentBehavior="never"
      decelerationRate="fast" snapToInterval={size} disableIntervalMomentum
      style={{width:size,height:size,opacity:interactive?1:0}} contentContainerStyle={{alignItems:'center'}}
      scrollEventThrottle={16}
      onScroll={Platform.OS==='web'?event=>{
        const position=event.nativeEvent.contentOffset.x;
        offset.value=position;
        if(settleTimer.current)clearTimeout(settleTimer.current);
        settleTimer.current=setTimeout(()=>settle(position),160);
      }:nativeScroll}>
      {orbOptions.map((orb,i)=><Pressable key={orb.id} accessible={interactive&&i===index}
        aria-hidden={!interactive||i!==index} importantForAccessibility={interactive&&i===index?'auto':'no-hide-descendants'}
        accessibilityRole="image" accessibilityLabel={orbOptions.length>1?`${orb.name} orb. ${orb.description}. Swipe to explore the other orbs.`:`${orb.name} orb. ${orb.description}.`}
        onPressIn={()=>interactive&&onTouch(true)} onPressOut={()=>onTouch(false)}
        onPress={()=>interactive&&onTap()}
        onLongPress={()=>interactive&&onHold()} delayLongPress={650}
        style={{width:size,height:size,overflow:'hidden'}}>
        <Image source={orb.poster} style={{width:size,height:size,transform:[{scale:orb.scale}]}} resizeMode="contain"/>
      </Pressable>)}
    </ScrollContainer>
    <Animated.View pointerEvents="none" style={[{position:'absolute',top:0,left:0,width:size,height:size},videoStyle]}>
      <GlassOrb size={size} touching={touching} reduced={reduced} hold={hold} mood={0} source={option.video} poster={option.poster}/>
    </Animated.View>
  </View>;
}
