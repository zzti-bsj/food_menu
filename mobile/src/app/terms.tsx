/** 全年节气(二级 push,对照 terms.html):四季粉彩横幅 + 节气格,当前节气唯一深色焦点 + 「今」徽标。 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SEASON_TERMS, currentTerm, type SeasonKey } from '@/domain/solar-terms';
import { colors, seasons } from '@/theme/tokens';
import { pagePad, radius, spacing, type } from '@/theme/theme';

const SEASON_META: { key: SeasonKey; label: string; months: string }[] = [
  { key: 'spring', label: '春 · 生发', months: '2月 - 4月' },
  { key: 'summer', label: '夏 · 茂盛', months: '5月 - 7月' },
  { key: 'autumn', label: '秋 · 收敛', months: '8月 - 10月' },
  { key: 'winter', label: '冬 · 藏养', months: '11月 - 1月' },
];

export default function TermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const current = currentTerm();

  return (
    <ScrollView
      contentContainerStyle={[statics.content, { paddingTop: insets.top + spacing.s2, paddingBottom: spacing.s8 }]}
    >
      <View style={statics.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          hitSlop={8}
          onPress={() => (router.canDismiss() ? router.back() : router.replace('/'))}
          style={statics.back}
        >
          <Text style={statics.backIcon}>‹</Text>
        </Pressable>
        <Text style={[type.serifTitle, { color: colors.ink }]} numberOfLines={1}>全年节气</Text>
        <View style={statics.back} />
      </View>

      {SEASON_META.map(({ key, label, months }) => {
        const palette = seasons[key];
        return (
          <View key={key} style={statics.seasonBlock}>
            {/* 四季横幅(§7):季粉彩渐变 + 季深档字 + 白底月份胶囊 */}
            <View style={[statics.seasonBanner, { backgroundColor: palette.soft }]}>
              <Text style={[statics.seasonLabel, { color: palette.deep }]}>{label}</Text>
              <View style={statics.monthChip}>
                <Text style={statics.monthText}>{months}</Text>
              </View>
            </View>
            <View style={statics.termGrid}>
              {SEASON_TERMS[key].map((t) => {
                const isCurrent = t === current;
                return (
                  <View
                    key={t}
                    style={[
                      statics.termCell,
                      isCurrent && { backgroundColor: palette.main, borderColor: palette.main },
                    ]}
                  >
                    <Text style={[statics.termName, isCurrent && { color: colors.surface }]}>{t}</Text>
                    {isCurrent && (
                      <View style={statics.nowBadge}>
                        <Text style={statics.nowText}>今</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const statics = StyleSheet.create({
  content: {
    backgroundColor: colors.bg,
    paddingHorizontal: pagePad,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    marginBottom: spacing.s4,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 28,
    lineHeight: 34,
    color: colors.ink,
  },
  seasonBlock: {
    marginBottom: spacing.s6,
    gap: spacing.s2,
  },
  seasonBanner: {
    borderRadius: radius.m,
    padding: spacing.s4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seasonLabel: {
    ...type.bodyStrong,
  },
  monthChip: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  monthText: {
    ...type.caption,
    color: colors.ink2,
  },
  termGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  termCell: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 44,
    borderRadius: radius.s,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  termName: {
    ...type.body,
    fontWeight: '500',
    color: colors.ink,
  },
  nowBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999,
    paddingHorizontal: 4,
  },
  nowText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    color: colors.surface,
  },
});
