/** 食材百科(Tab 3):摘要行 + 底部筛选弹窗(同菜谱库模式)。
 *  档案卡固定宽(48%)固定高(舞台 104 + 文字区 96),溢出内容截断,完整信息进详情。
 *  布局对齐全部显式声明,条目永远从左上排起。 */
import { useMemo, useState, useCallback } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DefaultImage, NatureBadge, Seal } from '@/components/brand';
import { FoodImage } from '@/components/content/food-image';
import { FilterChip } from '@/components/ui/filter-chip';
import { listApprovedIngredients } from '@/api/content-api';
import { useAsync } from '@/hooks/use-async';
import { currentTerm, nearbyTerms } from '@/domain/solar-terms';
import { splitList } from '@/utils/text';
import type { Ingredient } from '@/api/types';
import { colors, functional, seasons, activeSeason } from '@/theme/tokens';
import { fontDisplay, pagePad, radius, shadows, spacing, type, z } from '@/theme/theme';

const accent = seasons[activeSeason];
const ALL = '全部';
const ON = '只看当令';

export default function IngredientsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: ingredients, loading, error, reload } = useAsync(listApprovedIngredients, []);
  // 聚焦即重拉:审核/生成后返回本页数据即时生效
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const near: string[] = nearbyTerms(currentTerm());
  const [category, setCategory] = useState<string>(ALL);
  const [seasonalOnly, setSeasonalOnly] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (ingredients ?? []).forEach((i) => splitList(i.category).forEach((c) => set.add(c)));
    return [ALL, ...set];
  }, [ingredients]);

  const filtered = (ingredients ?? []).filter((i) => {
    if (category !== ALL && !splitList(i.category).includes(category)) return false;
    if (seasonalOnly && !splitList(i.solar_terms).some((t) => near.includes(t))) return false;
    return true;
  });

  function resetFilters() {
    setCategory(ALL);
    setSeasonalOnly(false);
  }

  return (
    <View style={[statics.flex, { paddingTop: insets.top }]}>
      <View style={statics.titleRow}>
        <Seal char="材" small />
        <Text style={statics.pageTitle}>食材百科</Text>
      </View>
      {/* 摘要行:两个维度 chip 即弹窗入口(独立成行,避免与标题挤压溢出) */}
      <View style={statics.filterBar}>
        <FilterChip
          label={`分类 · ${category}`}
          variant={category !== ALL ? 'seal' : 'warm'}
          onPress={() => setSheetOpen(true)}
        />
        <FilterChip
          label={`当令 · ${seasonalOnly ? '开' : '关'}`}
          variant={seasonalOnly ? 'seal' : 'warm'}
          onPress={() => setSheetOpen(true)}
        />
      </View>

      {/* 底部筛选弹窗(同菜谱库) */}
      <Modal transparent visible={sheetOpen} animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <View style={statics.sheetRoot}>
          <Pressable accessibilityLabel="关闭筛选" style={statics.scrim} onPress={() => setSheetOpen(false)} />
          <View style={statics.sheet}>
            <View style={statics.sheetHandle} />
            <Text style={[type.sectionLabel, { color: colors.ink3 }, statics.sheetGroup]}>分类</Text>
            <View style={statics.chipWrap}>
              {categories.map((c) => (
                <FilterChip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
              ))}
            </View>
            <Text style={[type.sectionLabel, { color: colors.ink3 }, statics.sheetGroup]}>当令</Text>
            <View style={[statics.chipWrap, statics.seasonalRow]}>
              <FilterChip
                label={ON}
                selected={seasonalOnly}
                onPress={() => setSeasonalOnly((s) => !s)}
              />
              <Text style={[type.caption, { color: colors.ink3 }]}>
                只看当前节气 ±2 内的食材
              </Text>
            </View>
            <View style={statics.sheetActions}>
              <Pressable accessibilityRole="button" onPress={resetFilters} style={statics.resetBtn}>
                <Text style={statics.resetText}>重置</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setSheetOpen(false)} style={statics.doneBtn}>
                <Text style={statics.doneText}>完成</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 双列网格:对齐全显式声明,条目永远从左上排起 */}
      <ScrollView contentContainerStyle={[statics.grid, { paddingBottom: 122 + insets.bottom }]}>
        {!!error && (
          <Pressable onPress={reload}>
            <Text style={[type.caption, statics.fullRow, { color: functional.danger }]}>{error}(点按重试)</Text>
          </Pressable>
        )}
        {filtered.map((item) => (
          <IngredientCard key={item.id} item={item} onPress={() => router.push(`/ingredient/${item.id}`)} />
        ))}
        {!loading && !error && filtered.length === 0 && (
          <Text style={[type.caption, statics.fullRow, { color: colors.ink3 }]}>
            没有符合筛选的食材
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

/** 食材档案卡:固定宽 48% · 固定高(舞台 104 + 文字区 88),溢出截断,完整信息进详情。 */
function IngredientCard({ item, onPress }: { item: Ingredient; onPress: () => void }) {
  const benefits = splitList(item.benefits);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看食材 ${item.name}`}
      onPress={onPress}
      style={({ pressed }) => [statics.card, shadows.card.android, pressed && { opacity: 0.92 }]}
    >
        {/* 图区舞台(设计稿 .stage):有图用真实图,无图落默认占位 */}
        <LinearGradient
          colors={[colors.surface2, colors.paperTint]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={statics.stage}
        >
          {item.image ? (
            <FoodImage uri={item.image} kind="leaf" width={56} height={56} />
          ) : (
            <DefaultImage kind="leaf" size={56} />
          )}
        </LinearGradient>
      <View style={statics.cardBody}>
        <Text style={statics.name} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={statics.badgeRow}>
          <NatureBadge nature={item.nature} />
          <View style={statics.flavorChip}>
            <Text style={statics.flavorText} numberOfLines={1}>
              {splitList(item.flavor).join('·')}
            </Text>
          </View>
        </View>
        {benefits.length > 0 ? (
          <Text style={statics.benefitLine} numberOfLines={1}>
            {benefits.join('、')}
          </Text>
        ) : (
          <Text style={statics.benefitLine} numberOfLines={1}>
            {item.season_note ?? ''}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const statics = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    paddingHorizontal: pagePad,
    marginTop: spacing.s3,
    marginBottom: spacing.s5,
  },
  pageTitle: {
    fontFamily: fontDisplay,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: 1,
    color: colors.ink,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.s2,
    paddingHorizontal: pagePad,
    marginBottom: spacing.s3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignContent: 'flex-start',
    alignItems: 'flex-start',
    paddingHorizontal: pagePad,
    gap: spacing.s3,
  },
  /** 错误/空态独占整行(wrap 布局下的行宽) */
  fullRow: {
    width: '100%',
    textAlign: 'left',
  },
  card: {
    width: '48%',
    borderRadius: radius.m,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  /** 舞台固定高 104(设计稿 .stage) */
  stage: {
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  /** 文字区固定高 112:内边距 14/12,底部留白由固定高兜出;超出截断进详情 */
  cardBody: {
    height: 112,
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 6,
    alignItems: 'flex-start',
    overflow: 'hidden',
  },
  name: {
    fontFamily: type.display.fontFamily,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: 1,
    color: colors.ink,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  flavorChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  flavorText: {
    ...type.caption,
    color: colors.ink2,
  },
  /** 功效行(设计稿 .ben):虚线分隔 + 1.6 行距,沉底;超出截断进详情 */
  benefitLine: {
    fontSize: 12,
    lineHeight: 19,
    color: colors.ink2,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderStyle: 'dashed',
    paddingTop: 8,
    marginBottom: 4,
    marginTop: 'auto',
    width: '100%',
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(38,35,28,0.4)',
    zIndex: z.overlay,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.l,
    borderTopRightRadius: radius.l,
    paddingHorizontal: pagePad,
    paddingTop: spacing.s2,
    paddingBottom: spacing.s8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
    marginBottom: spacing.s4,
  },
  sheetGroup: {
    marginBottom: spacing.s2,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
    marginBottom: spacing.s4,
  },
  seasonalRow: {
    alignItems: 'center',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.s3,
    marginTop: spacing.s2,
  },
  resetBtn: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  resetText: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  doneBtn: {
    flex: 2,
    height: 48,
    borderRadius: 15,
    backgroundColor: accent.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    ...type.bodyStrong,
    color: colors.surface,
  },
});
