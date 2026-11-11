/** 星光涂鸦 §6:四角星填充 SVG,3.2s 缓浮(reduced-motion 停用)。装饰性 aria-hidden。 */
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { brand } from '@/theme/tokens';

export interface SparkleProps {
  size?: number;
  /** 琥珀(默认)/ 绿 双色组合 */
  color?: string;
}

export function Sparkle({ size = 18, color = brand.amber }: SparkleProps) {
  const floatY = useRef(new Animated.Value(0)).current;
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotion.current = enabled;
      if (!enabled) startFloat();
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      reduceMotion.current = enabled;
      if (enabled) floatY.setValue(0);
      else startFloat();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startFloat() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -4, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }

  return (
    <Animated.View style={[statics.wrap, { transform: [{ translateY: floatY }] }]} aria-hidden>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M12 0 Q13.6 10.4 24 12 Q13.6 13.6 12 24 Q10.4 13.6 0 12 Q10.4 10.4 12 0 Z" />
      </Svg>
    </Animated.View>
  );
}

const statics = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
