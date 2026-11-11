/** 筛选 chip(§7):高 36 · radius 999 · 选中 = accent 实底白字 + 同色投影;未选中白底灰描边。
 *  取值即词表值,不自造(§10)。 */
import { Pressable, StyleSheet, Text } from 'react-native';
import { seasons, activeSeason, colors } from '@/theme/tokens';
import { type } from '@/theme/theme';

const accent = seasons[activeSeason];

export interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function FilterChip({ label, selected, onPress }: FilterChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        statics.chip,
        selected && { backgroundColor: accent.main },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[statics.label, selected && { color: colors.surface }]}>{label}</Text>
    </Pressable>
  );
}

const statics = StyleSheet.create({
  chip: {
    height: 36,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
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
