/** 食材详情(二级 push,对照 ingredient-detail.html):
 *  默认图 Hero · 性味归经(四气徽章/五味中性 chip/归经行)· 功效徽章 · 当令节气带 ·
 *  食用注意 · 典籍引文卡。 */
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DefaultImage, NatureBadge, OrnDivider, PanelPop, QuoteCard } from '@/components/brand';
import { SectionLabel } from '@/components/ui/section-label';
import { FoodImage } from '@/components/content/food-image';
import { getIngredient } from '@/api/content-api';
import { useAsync } from '@/hooks/use-async';
import { currentTerm, nearbyTerms, seasonOfTerm } from '@/domain/solar-terms';
import { splitList } from '@/utils/text';
import { colors, functional, seasons } from '@/theme/tokens';
import { pagePad, radius, spacing, type } from '@/theme/theme';

const VIEWPORT = 350;

export default function IngredientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: item, loading, error, reload } = useAsync(() => getIngredient(Number(id)), [id]);

  // 聚焦即重拉:编辑保存后返回详情即时生效
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (loading) {
    return <Centered text="加载中…" />;
  }
  if (error || !item) {
    return <Centered text={error ?? '未找到该食材'} onRetry={reload} />;
  }

  const terms = splitList(item.solar_terms);
  const season = seasonOfTerm(terms[0] ?? '');
  const flavors = splitList(item.flavor);
  const benefits = splitList(item.benefits);
  const near: string[] = nearbyTerms(currentTerm());

  return (
    <ScrollView contentContainerStyle={[statics.content, { paddingTop: insets.top + spacing.s2, paddingBottom: spacing.s8 }]}>
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
        <Text style={[type.serifTitle, { color: colors.ink }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={statics.back} />
      </View>

      <PanelPop season={season}>
        <View style={statics.hero}>
          <FoodImage uri={item.image} kind="leaf" width={96} height={96} />
          <View style={statics.heroMeta}>
            <Text style={statics.heroName}>{item.name}</Text>
            {!!item.aliases && (
              <Text style={statics.heroAliases} numberOfLines={1}>
                别名 {splitList(item.aliases).join('、')}
              </Text>
            )}
            <View style={statics.heroBadges}>
              <NatureBadge nature={item.nature} />
              {benefits.map((b) => (
                <View key={b} style={statics.benefitChip}>
                  <Text style={statics.benefitText}>{b}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </PanelPop>

      {/* 性味归经(§2.5:中性枚举统一描边 chip,彩色只留给四气/功效/节气) */}
      <SectionLabel label="性味归经" style={statics.sectionLabel} />
      <View style={statics.card}>
        <View style={statics.infoRow}>
          <Text style={statics.infoKey}>分类</Text>
          <NeutralChips items={splitList(item.category)} />
        </View>
        <View style={statics.infoRow}>
          <Text style={statics.infoKey}>五味</Text>
          <NeutralChips items={flavors} />
        </View>
        <View style={statics.infoRow}>
          <Text style={statics.infoKey}>归经</Text>
          <NeutralChips items={splitList(item.meridian).map((m) => `${m}经`)} />
        </View>
        <View style={[statics.infoRow, statics.infoRowLast]}>
          <Text style={statics.infoKey}>时令</Text>
          <Text style={statics.infoValue}>{item.season_note ?? terms.join('、')}</Text>
        </View>
      </View>

      {/* 当令节气带 */}
      <SectionLabel label="当令节气" style={statics.sectionLabel} />
      <View style={statics.termBand}>
        {terms.map((t) => {
          const isNear = near.includes(t);
          const isCurrent = t === currentTerm();
          return (
            <View
              key={t}
              style={[
                statics.termChip,
                isNear && !isCurrent && { backgroundColor: seasons[season].soft, borderColor: seasons[season].soft },
                isCurrent && { backgroundColor: seasons[season].main, borderColor: seasons[season].main },
              ]}
            >
              <Text
                style={[
                  statics.termText,
                  isNear && !isCurrent && { color: seasons[season].deep },
                  isCurrent && { color: colors.surface },
                ]}
              >
                {t}
              </Text>
            </View>
          );
        })}
      </View>

      {/* 食用注意(warningSoft 圆角盒 + ⚠ 标题,色+符号双编码,无边框) */}
      {item.caution && (
        <>
          <SectionLabel label="食用注意" style={statics.sectionLabel} />
          <View style={statics.cautionBox}>
            <Text style={statics.cautionTitle}>⚠ 食用注意</Text>
            <Text style={statics.cautionText}>{item.caution}</Text>
          </View>
        </>
      )}

      {/* 典籍注脚 */}
      {item.classic_note && (
        <>
          <SectionLabel label="典籍注脚" style={statics.sectionLabel} />
          <QuoteCard note={item.classic_note} />
        </>
      )}

      <View style={statics.orn}>
        <OrnDivider />
      </View>
    </ScrollView>
  );
}

/** 中性描边 chip 组(§2.5 语言,五味/分类/归经共用;层级让位于四气徽章与节气标签) */
function NeutralChips({ items }: { items: string[] }) {
  return (
    <View style={statics.neutralChips}>
      {items.map((label) => (
        <View key={label} style={statics.neutralChip}>
          <Text style={statics.neutralChipText}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function Centered({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const router = useRouter();
  return (
    <View style={statics.centered}>
      <Text style={[type.body, { color: colors.ink2 }]}>{text}</Text>
      <View style={statics.centeredActions}>
        {!!onRetry && (
          <Pressable onPress={onRetry} hitSlop={8}>
            <Text style={[type.caption, { color: colors.ink2, textDecorationLine: 'underline' }]}>重试</Text>
          </Pressable>
        )}
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={[type.caption, { color: colors.ink3, textDecorationLine: 'underline' }]}>返回</Text>
        </Pressable>
      </View>
    </View>
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
    marginBottom: spacing.s3,
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
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s4,
    padding: spacing.s5,
  },
  heroMeta: {
    flex: 1,
    gap: spacing.s2,
  },
  heroName: {
    fontFamily: type.display.fontFamily,
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.ink,
  },
  heroAliases: {
    ...type.caption,
    color: colors.ink2,
  },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  benefitChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.s,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  benefitText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors.ink2,
  },
  sectionLabel: {
    marginTop: spacing.s6,
    marginBottom: spacing.s2,
  },
  card: {
    borderRadius: radius.m,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.s4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    gap: spacing.s3,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoKey: {
    ...type.caption,
    fontWeight: '600',
    color: colors.ink3,
    width: 40,
  },
  infoValue: {
    ...type.body,
    color: colors.ink,
    flex: 1,
  },
  neutralChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s1,
    flex: 1,
  },
  neutralChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  neutralChipText: {
    ...type.caption,
    color: colors.ink2,
  },
  termBand: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  termChip: {
    borderRadius: radius.s,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  termText: {
    ...type.caption,
    color: colors.ink2,
  },
  cautionBox: {
    backgroundColor: functional.warningSoft,
    borderRadius: radius.m,
    padding: spacing.s4,
    gap: spacing.s1,
  },
  cautionTitle: {
    ...type.caption,
    fontWeight: '700',
    color: functional.warning,
  },
  cautionText: {
    ...type.body,
    color: functional.warning,
  },
  orn: {
    marginTop: spacing.s6,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: pagePad,
  },
  centeredActions: {
    flexDirection: 'row',
    gap: spacing.s4,
    marginTop: spacing.s2,
  },
});
