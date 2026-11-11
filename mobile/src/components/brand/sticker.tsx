/** 贴纸 §6:斜贴 -4° 圆角 8 琥珀渐变底 + 墨字 800 + 投影;每屏 ≤1-2 枚(使用方克制)。
 *  Web 分支用纯色:expo-linear-gradient 的 web 实现默认撑满父宽,会把贴纸挤出卡片。 */
import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, brand } from '@/theme/tokens';

export interface StickerProps {
  /** 短语(如「低卡优选」) */
  label: string;
}

export function Sticker({ label }: StickerProps) {
  const box = (
    <View style={[statics.box, Platform.OS === 'web' && { backgroundColor: '#F3A93B' }]}>
      <Text style={statics.label}>{label}</Text>
    </View>
  );
  return (
    <View style={statics.wrap} aria-hidden>
      {Platform.OS === 'web' ? (
        box
      ) : (
        <LinearGradient
          colors={['#FFD871', brand.amber]}
          locations={[0, 0.77]} // CSS 130% 截断 → 归一化
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={statics.box}
        >
          <Text style={statics.label}>{label}</Text>
        </LinearGradient>
      )}
    </View>
  );
}

const statics = StyleSheet.create({
  wrap: {
    transform: [{ rotate: '-4deg' }],
    shadowColor: 'rgba(169,108,16,0.28)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  box: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
  },
});
