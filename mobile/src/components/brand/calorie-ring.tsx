/** 热量环 §6:84 白托盘圆 + 7px 弧(轨道 #EDE7D8 · 进度 #C25E2A · round cap),
 *  中心 tabular 墨字数字 + 「千卡/份」,下标参考餐说明(500 千卡 → 约一餐七成)。 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, brand } from '@/theme/tokens';
import { shadows, tabularNums } from '@/theme/theme';

const SIZE = 84;
const STROKE = 7;
const R = 36;
const CIRC = 2 * Math.PI * R;
/** 参考餐 500 千卡(§6 下标口径) */
const REFERENCE = 500;

export interface CalorieRingProps {
  /** 每份热量(千卡) */
  calories: number;
}

export function CalorieRing({ calories }: CalorieRingProps) {
  const ratio = Math.min(calories / REFERENCE, 1);
  return (
    <View
      style={[statics.tray, shadows.card.android]}
      accessibilityLabel={`约 ${calories} 千卡每份`}
      accessibilityRole="text"
    >
      <Svg width={SIZE} height={SIZE}>
        {/* 白托盘由外层 View 呈现,弧绘于其上 */}
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="#EDE7D8" strokeWidth={STROKE} fill="none" />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={brand.calorieArc}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRC * ratio} ${CIRC}`}
          // 起点 12 点钟:逆时针旋转 -90°
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={statics.center}>
        <Text style={statics.number}>{calories}</Text>
        <Text style={statics.unit}>千卡/份</Text>
      </View>
    </View>
  );
}

const statics = StyleSheet.create({
  tray: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
  },
  number: {
    ...tabularNums,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.ink,
  },
  unit: {
    fontSize: 10,
    lineHeight: 13,
    color: colors.ink2,
  },
});
