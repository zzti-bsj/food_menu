/** 花饰分隔 §6:渐隐细线 + 中央 45° 朱砂菱点。装饰性 aria-hidden。 */
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { brand, colors } from '@/theme/tokens';

export function OrnDivider() {
  return (
    <View style={statics.row} aria-hidden>
      <LinearGradient
        colors={['transparent', colors.lineStrong]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={statics.line}
      />
      <View style={statics.dot} />
      <LinearGradient
        colors={[colors.lineStrong, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={statics.line}
      />
    </View>
  );
}

const statics = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dot: {
    width: 6,
    height: 6,
    marginHorizontal: 10,
    backgroundColor: brand.seal,
    transform: [{ rotate: '45deg' }],
  },
});
