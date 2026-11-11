/** 引文卡(§7 调整版,按用户偏好去除左侧竖线):纸面底 + 「引」字水印 + 出处右对齐。
 *  classic_note 形如「典籍:原文」;无冒号时整体作原文。 */
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { fontDisplay, radius, type } from '@/theme/theme';

export interface QuoteCardProps {
  note: string;
}

export function QuoteCard({ note }: QuoteCardProps) {
  const sep = note.indexOf(':', note.indexOf('《') + 1) >= 0 ? note.indexOf(':', note.indexOf('《') + 1) : note.indexOf(':');
  const hasSource = sep > 0;
  const source = hasSource ? note.slice(0, sep) : null;
  const quote = hasSource ? note.slice(sep + 1).trim() : note;

  return (
    <View style={statics.card}>
      {/* 「引」水印(装饰) */}
      <Text style={statics.watermark} aria-hidden>
        引
      </Text>
      <Text style={statics.quote}>{quote}</Text>
      {source && <Text style={statics.source}>—— {source}</Text>}
    </View>
  );
}

const statics = StyleSheet.create({
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: 16,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    right: 10,
    bottom: -12,
    fontFamily: fontDisplay,
    fontSize: 72,
    lineHeight: 84,
    fontWeight: '700',
    color: 'rgba(38,35,28,0.05)',
  },
  quote: {
    fontFamily: fontDisplay,
    fontSize: 15,
    lineHeight: 26,
    color: colors.ink,
  },
  source: {
    ...type.caption,
    color: colors.ink3,
    textAlign: 'right',
    marginTop: 6,
  },
});
