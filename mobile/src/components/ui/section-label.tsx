/** 分区标签:朱砂短竖线点睛 + 组标签(§7 组标签加视觉锚点,按用户反馈)。
 *  style 透传给整行(调用方自带间距),action 可挂右侧「更多」类链接。 */
import { type ReactNode } from 'react';
import { type StyleProp, type TextStyle, StyleSheet, Text, View } from 'react-native';
import { brand, colors } from '@/theme/tokens';
import { type } from '@/theme/theme';

export interface SectionLabelProps {
  label: string;
  /** 透传给整行的样式(间距/颜色覆盖) */
  style?: StyleProp<TextStyle>;
  /** 右侧动作位(可选) */
  action?: ReactNode;
}

export function SectionLabel({ label, style, action }: SectionLabelProps) {
  return (
    <View style={[statics.row, style]}>
      <View style={statics.bar} aria-hidden />
      <Text style={[statics.text, { color: colors.ink2 }]}>{label}</Text>
      {action && <View style={statics.action}>{action}</View>}
    </View>
  );
}

const statics = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bar: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: brand.seal,
  },
  text: {
    ...type.sectionLabel,
  },
  action: {
    marginLeft: 'auto',
  },
});
