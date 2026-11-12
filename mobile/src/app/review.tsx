/** 审核台(工坊 push,对照 review.html):三态计数 + 待审核队列(食材/菜品分段)。
 *  行进详情复审;通过/驳回在详情页操作。大批量作业走桌面审核台。 */
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChefBadge, NatureBadge } from '@/components/brand';
import { ChevronRightIcon } from '@/components/icons';
import { useAuth } from '@/auth/auth-context';
import { SectionLabel } from '@/components/ui/section-label';
import { listDishGroups, listIngredientGroups } from '@/api/content-api';
import { useAsync } from '@/hooks/use-async';
import { parseStyle, splitList } from '@/utils/text';
import type { Dish, Ingredient } from '@/api/types';
import { colors, functional } from '@/theme/tokens';
import { pagePad, radius, shadows, spacing, tabularNums, type } from '@/theme/theme';

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, loading, error, reload } = useAsync(async () => {
    const [ing, dish] = await Promise.all([listIngredientGroups(), listDishGroups()]);
    return { ing, dish };
  }, []);
  // 聚焦即重拉:状态变更(审核/删除)后返回本页数据即时生效
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const ing = data?.ing;
  const dish = data?.dish;
  // 审核权 = 归属人或 admin:普通用户只审自己名下的待审;admin 超管看全部
  const pendingIngredients = (ing?.待审核 ?? []).filter((r) => isAdmin || r.user_id === user?.id);
  const pendingDishes = (dish?.待审核 ?? []).filter((r) => isAdmin || r.user_id === user?.id);

  return (
    <ScrollView contentContainerStyle={[statics.content, { paddingTop: insets.top + spacing.s2, paddingBottom: 60 + insets.bottom }]}>
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
        <Text style={[type.serifTitle, { color: colors.ink }]}>审核台</Text>
        <View style={statics.back} />
      </View>

      {!!error && (
        <Pressable onPress={reload}>
          <Text style={[type.caption, { color: functional.danger }]}>{error}(点按重试)</Text>
        </Pressable>
      )}

      {/* 三态计数 */}
      <View style={statics.countRow}>
        <CountCard label="待审核" ing={ing?.待审核.length ?? 0} dish={dish?.待审核.length ?? 0} tone={functional.warning} />
        <CountCard label="已通过" ing={ing?.已通过.length ?? 0} dish={dish?.已通过.length ?? 0} tone={functional.success} />
        <CountCard label="已驳回" ing={ing?.已驳回.length ?? 0} dish={dish?.已驳回.length ?? 0} tone={functional.danger} />
      </View>

      {/* 食材待审核队列 */}
      <SectionLabel label={`食材 · 待审核(${pendingIngredients.length})`} style={statics.sectionGap} />
      {pendingIngredients.map((item) => (
        <IngredientRow key={item.id} item={item} onPress={() => router.push(`/review-ingredient/${item.id}`)} />
      ))}
      {pendingIngredients.length === 0 && !loading && <Empty text="食材队列已清空" />}

      {/* 菜品待审核队列 */}
      <SectionLabel label={`菜品 · 待审核(${pendingDishes.length})`} style={statics.sectionGap} />
      {pendingDishes.map((item) => (
        <DishRow key={item.id} item={item} onPress={() => router.push(`/review-dish/${item.id}`)} />
      ))}
      {pendingDishes.length === 0 && !loading && <Empty text="菜品队列已清空" />}
    </ScrollView>
  );
}

function CountCard({ label, ing, dish, tone }: { label: string; ing: number; dish: number; tone: string }) {
  return (
    <View style={[statics.countCard, shadows.card.android]}>
      <Text style={[statics.countLabel, { color: tone }]}>{label}</Text>
      <Text style={[statics.countValue, tabularNums, { color: colors.ink }]}>
        {ing}
        <Text style={statics.countSlash}> / </Text>
        {dish}
      </Text>
      <Text style={[type.caption, { color: colors.ink3 }]}>食材 / 菜品</Text>
    </View>
  );
}

function IngredientRow({ item, onPress }: { item: Ingredient; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`复审食材 ${item.name}`}
      onPress={onPress}
      style={({ pressed }) => [statics.row, shadows.card.android, pressed && { opacity: 0.92 }]}
    >
      <View style={statics.rowGrow}>
        <Text style={statics.rowTitle}>{item.name}</Text>
        <Text style={statics.rowSub}>{splitList(item.category).join(' · ')}</Text>
      </View>
      <NatureBadge nature={item.nature} />
      <ChevronRightIcon size={18} color={colors.ink3} />
    </Pressable>
  );
}

function DishRow({ item, onPress }: { item: Dish; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`复审菜品 ${item.name}`}
      onPress={onPress}
      style={({ pressed }) => [statics.row, shadows.card.android, pressed && { opacity: 0.92 }]}
    >
      <View style={statics.rowGrow}>
        <Text style={statics.rowTitle}>{item.name}</Text>
        <Text style={statics.rowSub}>{parseStyle(item.style).method} · {item.calories}</Text>
      </View>
      <ChefBadge category={item.category} />
      <ChevronRightIcon size={18} color={colors.ink3} />
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={[statics.row, statics.emptyRow]}>
      <Text style={[type.caption, { color: colors.ink3 }]}>{text}</Text>
    </View>
  );
}

const statics = StyleSheet.create({
  content: {
    backgroundColor: colors.bg,
    paddingHorizontal: pagePad,
    paddingBottom: 40,
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
  countRow: {
    flexDirection: 'row',
    gap: spacing.s3,
  },
  countCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    alignItems: 'center',
    paddingVertical: spacing.s3,
    gap: 2,
  },
  countLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  countValue: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
  countSlash: {
    fontSize: 14,
    color: colors.ink3,
    fontWeight: '400',
  },
  sectionGap: {
    marginTop: spacing.s5,
    marginBottom: spacing.s2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.s4,
    marginBottom: spacing.s2,
  },
  rowGrow: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...type.body,
    fontWeight: '600',
    color: colors.ink,
  },
  rowSub: {
    ...type.caption,
    color: colors.ink3,
    marginTop: 2,
  },
  emptyRow: {
    justifyContent: 'center',
    paddingVertical: spacing.s4,
  },
});
