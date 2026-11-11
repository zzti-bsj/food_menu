/** 食签牌 §6:高饱和季渐变 + 衬线白字(首字/品类字)+ 同色彩影。照片位的视觉锚点,装饰性。
 *  lg 56 · md 44 · sm 36(assets/theme.css .mono-lg/md/sm)。 */
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { seasons, type Season } from '@/theme/tokens';
import { fontDisplay } from '@/theme/theme';

export type MonoSize = 'lg' | 'md' | 'sm';

export interface MonoTagProps {
  /** 牌面单字(食材首字/菜品品类字) */
  char: string;
  /** 季节渐变基调(高饱和主色 → 深档) */
  tone: Season;
  size?: MonoSize;
}

const DIMS: Record<MonoSize, { box: number; font: number; r: number }> = {
  lg: { box: 56, font: 26, r: 18 },
  md: { box: 44, font: 21, r: 16 },
  sm: { box: 36, font: 17, r: 12 },
};

export function MonoTag({ char, tone, size = 'md' }: MonoTagProps) {
  const dim = DIMS[size];
  const palette = seasons[tone];
  return (
    <View aria-hidden>
      <LinearGradient
        colors={[palette.main, palette.deep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[statics.box, colorShadow(tone), { width: dim.box, height: dim.box, borderRadius: dim.r }]}
      >
        <Text style={[statics.char, { fontSize: dim.font }]}>{char}</Text>
      </LinearGradient>
    </View>
  );
}

/** 同色彩影(§6):shadowColor 依季节取深档 */
function colorShadow(tone: Season) {
  return {
    shadowColor: seasons[tone].deep,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  } as const;
}

const statics = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  char: {
    fontFamily: fontDisplay,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
