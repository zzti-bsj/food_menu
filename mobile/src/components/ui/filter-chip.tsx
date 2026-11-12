/** 筛选 chip(§7):高 36 · radius 999。
 *  两种用法:
 *  - 选项态(sheet 内):selected = 朱砂实底白字;未选中 = 白底浅描边。
 *  - 摘要态(摘要行):variant 'warm' = 默认值展示琥珀暖底;'seal' = 已选非默认值朱砂实底。 */
import { Pressable, StyleSheet, Text } from 'react-native';
import { brand, colors, seasons } from '@/theme/tokens';
import { type } from '@/theme/theme';

export interface FilterChipProps {
  label: string;
  /** 选项态选中标记(sheet 内使用) */
  selected?: boolean;
  /** 摘要态配色:'warm' 默认值 / 'seal' 非默认值(传入时优先生效) */
  variant?: 'warm' | 'seal';
  onPress: () => void;
}

export function FilterChip({ label, selected = false, variant, onPress }: FilterChipProps) {
  const warm = variant === 'warm';
  const seal = variant === 'seal' || (variant === undefined && selected);
  const bg = warm ? seasons.autumn.soft : seal ? brand.seal : colors.surface;
  const fg = warm ? seasons.autumn.deep : seal ? colors.surface : colors.ink2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: seal || selected }}
      onPress={onPress}
      style={({ pressed }) => [
        statics.chip,
        { backgroundColor: bg, borderColor: warm ? seasons.autumn.soft : colors.lineStrong },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[statics.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const statics = StyleSheet.create({
  chip: {
    height: 36,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...type.caption,
    fontWeight: '600',
    color: colors.ink2,
  },
});
