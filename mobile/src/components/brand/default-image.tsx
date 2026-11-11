/** 默认占位图(§6/v1.3.1):中性纸底圆盘 + 虚线描边 + 叶形/碗形 glyph;菜品用碗形。装饰性。 */
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme/tokens';
import { radius } from '@/theme/theme';

export type PlaceholderKind = 'leaf' | 'bowl';

export interface DefaultImageProps {
  kind?: PlaceholderKind;
  /** 圆盘直径 */
  size?: number;
}

export function DefaultImage({ kind = 'leaf', size = 56 }: DefaultImageProps) {
  return (
    <View
      style={[statics.disc, { width: size, height: size, borderRadius: size / 2 }]}
      aria-hidden
    >
      {kind === 'leaf' ? <LeafGlyph size={size * 0.42} /> : <BowlGlyph size={size * 0.44} />}
    </View>
  );
}

function LeafGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5.5 18.5C5.5 10.5 11 5 19.5 4.5c.4 8.5-5 14-14 14zM5.5 18.5c2.6-4.6 6-8 10.5-10.4"
        stroke={colors.ink3}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function BowlGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 11h16v2.5a6.5 6.5 0 0 1-6.5 6.5h-3A6.5 6.5 0 0 1 4 13.5V11zM2.5 11h19"
        stroke={colors.ink3}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const statics = StyleSheet.create({
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderStyle: 'dashed',
    // 圆盘场景下不使用整体圆角变量(§4 r-* 均非圆形)
    borderRadius: radius.l,
  },
});
