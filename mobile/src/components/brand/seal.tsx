/** 朱砂印章 §6:34×34(页头 26-30)· radius 8 · 朱砂渐变白衬线字 · 斜贴 -3° · 投影。装饰性。 */
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { brand } from '@/theme/tokens';
import { fontDisplay, radius, shadows } from '@/theme/theme';

export interface SealProps {
  /** 印面单字(如「食」「引」) */
  char: string;
  /** 页头用小号 */
  small?: boolean;
}

export function Seal({ char, small = false }: SealProps) {
  const size = small ? 28 : 34;
  return (
    <View style={[statics.wrap, shadows.card.android, { width: size, height: size }]} aria-hidden>
      <LinearGradient
        colors={[brand.sealLight, brand.seal]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[statics.box, { borderRadius: radius.seal, ...shadows.card.ios }]}
      >
        <Text style={[statics.char, small && statics.charSmall]}>{char}</Text>
      </LinearGradient>
    </View>
  );
}

const statics = StyleSheet.create({
  wrap: {
    transform: [{ rotate: '-3deg' }],
  },
  box: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  char: {
    fontFamily: fontDisplay,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  charSmall: {
    fontSize: 14,
  },
});
