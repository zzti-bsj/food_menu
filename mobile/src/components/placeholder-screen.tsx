/** 占位屏(Phase 3-5 逐页实现,对照 design/shike-app/ 对应原型验收) */
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';
import { pagePad, spacing, type } from '@/theme/theme';

export interface PlaceholderScreenProps {
  title: string;
  hint: string;
}

export function PlaceholderScreen({ title, hint }: PlaceholderScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[statics.wrap, { paddingTop: insets.top + spacing.s6 }]}>
      <Text style={[type.serifTitle, statics.pad, { color: colors.ink }]}>{title}</Text>
      <Text style={[type.caption, statics.pad, { color: colors.ink3, marginTop: spacing.s2 }]}>{hint}</Text>
    </View>
  );
}

const statics = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  pad: {
    paddingHorizontal: pagePad,
  },
});
