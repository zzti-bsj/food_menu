/** 菜谱库(Tab 2):摘要行 + 底部筛选弹层(维度可扩展,不随取值增多溢出)。
 *  默认只看当令(当前 ±2,§10 口径);筛选切换后列表回顶,避免滚动位置钳制抖动。 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DishCard } from '@/components/content/dish-card';
import { FilterChip } from '@/components/ui/filter-chip';
import { listApprovedDishes } from '@/api/content-api';
import { useAsync } from '@/hooks/use-async';
import { SEASON_TERMS, currentTerm, nearbyTerms } from '@/domain/solar-terms';
import { parseStyle, splitList } from '@/utils/text';
import { colors, functional, seasons, activeSeason } from '@/theme/tokens';
import { pagePad, radius, spacing, type, z } from '@/theme/theme';

const accent = seasons[activeSeason];
const ALL = '全部';
const NOW = '当令';

/** 节气筛选值:null = 当令(默认)| ALL | 节气名 */
type TermFilter = string | null;

export default function RecipesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: dishes, loading, error, reload } = useAsync(listApprovedDishes, []);

  const now = currentTerm();
  const near: string[] = nearbyTerms(now);
  const [termFilter, setTermFilter] = useState<TermFilter>(null);
  const [method, setMethod] = useState<string>(ALL);
  const [sheetOpen, setSheetOpen] = useState(false);

  const listRef = useRef<ScrollViewInstance>(null);
  // 筛选变化 → 列表回顶:内容高度突变时滚动位置被系统钳制会造成页面抖动
  useEffect(() => {
    listRef.current?.scrollTo({ y: 0, animated: false });
  }, [termFilter, method]);

  const methods = useMemo(() => {
    const set = new Set<string>();
    (dishes ?? []).forEach((d) => {
      const m = parseStyle(d.style).method;
      if (m) set.add(m);
    });
    return [ALL, ...set];
  }, [dishes]);

  /** 全年 24 节气(词表序),弹层平铺,不与快捷项重复 */
  const allTerms = useMemo(
    () => [...SEASON_TERMS.spring, ...SEASON_TERMS.summer, ...SEASON_TERMS.autumn, ...SEASON_TERMS.winter],
    [],
  );

  const filtered = (dishes ?? []).filter((d) => {
    const terms = splitList(d.solar_terms);
    if (termFilter === ALL) {
      // 整库,仅再套做法
    } else if (termFilter === null) {
      if (!terms.some((t) => near.includes(t))) return false;
    } else if (!terms.includes(termFilter)) {
      return false;
    }
    const m = parseStyle(d.style).method;
    return method === ALL || m === method;
  });

  const termLabel = termFilter === ALL || termFilter === null ? (termFilter === null ? NOW : ALL) : termFilter;
  const methodActive = method !== ALL;
  const termActive = termFilter !== null;

  function resetFilters() {
    setTermFilter(null);
    setMethod(ALL);
  }

  return (
    <View style={[statics.flex, { paddingTop: insets.top }]}>
      <Text style={[type.serifTitle, statics.title, { color: colors.ink }]}>菜谱库</Text>
      <Text style={[type.caption, statics.subtitle, { color: colors.ink3 }]}>
        默认展示当前当令(±2 节气口径)
      </Text>

      {/* 摘要行:两个维度 chip 即弹层入口(无第三按钮) */}
      <View style={statics.filterBar}>
        <FilterChip label={`节气 · ${termLabel}`} selected={termActive} onPress={() => setSheetOpen(true)} />
        <FilterChip label={`做法 · ${method}`} selected={methodActive} onPress={() => setSheetOpen(true)} />
      </View>

      <ScrollView ref={listRef} contentContainerStyle={[statics.list, { paddingBottom: 122 + insets.bottom }]}>
        {!!error && (
          <Pressable onPress={reload}>
            <Text style={[type.caption, { color: functional.danger }]}>{error}(点按重试)</Text>
          </Pressable>
        )}
        {filtered.map((dish) => (
          <DishCard key={dish.id} dish={dish} onPress={() => router.push(`/dish/${dish.id}`)} />
        ))}
        {!loading && !error && filtered.length === 0 && (
          <Text style={[type.caption, statics.emptyText, { color: colors.ink3 }]}>
            没有符合筛选的菜谱,换个节气或做法试试
          </Text>
        )}
      </ScrollView>

      {/* 底部筛选弹层(§4 z-index 40):快捷两项 + 全年 24 平铺,无重复 */}
      <Modal transparent visible={sheetOpen} animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <View style={statics.sheetRoot}>
          <Pressable accessibilityLabel="关闭筛选" style={statics.scrim} onPress={() => setSheetOpen(false)} />
          <View style={statics.sheet}>
            <View style={statics.sheetHandle} />
            <Text style={[type.sectionLabel, { color: colors.ink3 }, statics.sheetGroup]}>节气</Text>
            <View style={statics.chipWrap}>
              <FilterChip label={NOW} selected={termFilter === null} onPress={() => setTermFilter(null)} />
              <FilterChip label={ALL} selected={termFilter === ALL} onPress={() => setTermFilter(ALL)} />
            </View>
            <Text style={[type.sectionLabel, { color: colors.ink3 }, statics.sheetGroup]}>全年节气</Text>
            <View style={statics.chipWrap}>
              {allTerms.map((t) => (
                <FilterChip
                  key={t}
                  label={`${t}${t === now ? ' · 今' : ''}`}
                  selected={termFilter === t}
                  onPress={() => setTermFilter(t)}
                />
              ))}
            </View>
            <Text style={[type.sectionLabel, { color: colors.ink3 }, statics.sheetGroup]}>做法</Text>
            <View style={statics.chipWrap}>
              {methods.map((m) => (
                <FilterChip key={m} label={m} selected={method === m} onPress={() => setMethod(m)} />
              ))}
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
    </View>
  );
}

const statics = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  title: {
    paddingHorizontal: pagePad,
    marginTop: spacing.s3,
  },
  subtitle: {
    paddingHorizontal: pagePad,
    marginTop: 2,
    marginBottom: spacing.s3,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
    paddingHorizontal: pagePad,
    paddingBottom: spacing.s3,
  },
  list: {
    paddingHorizontal: pagePad,
    gap: spacing.s3,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: spacing.s8,
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
    maxHeight: '78%',
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
