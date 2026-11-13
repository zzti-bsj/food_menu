/** 审核台(工坊 push,对照 review.html + v1.2 品牌语言):
 *  夏粉彩 Hero + 状态双卡切换(待审核=琥珀淡底 / 已驳回=红淡底,大数字 + 食材/菜品分项,
 *  点卡切换下方队列)+ 分类分组(着色小节头 + 同色左边条行卡)。
 *  已驳回队列可查看详情/删除释放名称(名称预检为任意状态,不删会令重新生成 duplicate)。
 *  已通过不在此统计——它已进入私有食单与内容库,不是审核待办。 */
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChefBadge, DefaultImage, NatureBadge, PanelPop, Sparkle } from '@/components/brand';
import { ChevronRightIcon, TrashIcon } from '@/components/icons';
import { useAuth } from '@/auth/auth-context';
import { SectionLabel } from '@/components/ui/section-label';
import { useToast } from '@/components/ui/toast';
import { deleteDish, deleteIngredient, listDishGroups, listIngredientGroups } from '@/api/content-api';
import { useAsync } from '@/hooks/use-async';
import { parseStyle, splitList } from '@/utils/text';
import type { Dish, Ingredient } from '@/api/types';
import { colors, functional } from '@/theme/tokens';
import { fontDisplay, pagePad, radius, shadows, spacing, tabularNums, type } from '@/theme/theme';

type StatusTab = 'pending' | 'rejected';

const STATUS_THEME: Record<StatusTab, { label: string; soft: string; tone: string }> = {
  pending: { label: '待审核', soft: functional.warningSoft, tone: functional.warning },
  rejected: { label: '已驳回', soft: functional.dangerSoft, tone: functional.danger },
};

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(async () => {
    const [ing, dish] = await Promise.all([listIngredientGroups(), listDishGroups()]);
    return { ing, dish };
  }, []);
  // 聚焦即重拉:状态变更(审核/删除)后返回本页数据即时生效
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const [statusTab, setStatusTab] = useState<StatusTab>('pending');

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const ing = data?.ing;
  const dish = data?.dish;
  // 审核权 = 归属人或 admin:普通用户只看自己名下;admin 超管看全部
  const mine = <T extends { user_id: number | null }>(rows: T[]): T[] =>
    rows.filter((r) => isAdmin || r.user_id === user?.id);
  const pendingIngredients = mine(ing?.待审核 ?? []);
  const pendingDishes = mine(dish?.待审核 ?? []);
  const rejectedIngredients = mine(ing?.已驳回 ?? []);
  const rejectedDishes = mine(dish?.已驳回 ?? []);

  const theme = STATUS_THEME[statusTab];
  const ingredients = statusTab === 'pending' ? pendingIngredients : rejectedIngredients;
  const dishes = statusTab === 'pending' ? pendingDishes : rejectedDishes;

  /** 删除驳回内容(硬删除,释放名称供重新生成) */
  function confirmRemove(kind: 'dish' | 'ingredient', id: number, name: string) {
    Alert.alert('删除确认', `「${name}」已驳回,删除后该名称可重新生成。删除不可恢复`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          const request = kind === 'dish' ? deleteDish(id) : deleteIngredient(id);
          request
            .then(() => {
              toast.showToast('已删除');
              reload();
            })
            .catch((e: unknown) => {
              toast.showToast(e instanceof Error ? e.message : '删除失败');
            });
        },
      },
    ]);
  }

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
        <Text style={[type.serifTitle, { color: colors.ink }]} numberOfLines={1}>审核台</Text>
        <View style={statics.back} />
      </View>

      {/* 夏粉彩 Hero */}
      <PanelPop season="summer">
        <View style={statics.hero}>
          <View style={statics.heroHead}>
            <View style={statics.heroGrow}>
              <Text style={statics.heroTitle}>道道把关</Text>
              <Text style={statics.heroSub}>通过进入官方库,驳回退回本人;详情页执行通过 / 驳回</Text>
            </View>
            <Sparkle size={20} />
          </View>
        </View>
      </PanelPop>

      {!!error && (
        <Pressable onPress={reload} hitSlop={8}>
          <Text style={[type.caption, { color: functional.danger }]}>{error}(点按重试)</Text>
        </Pressable>
      )}

      {/* 状态双卡:既是大数字概览,也是队列切换 tab(选中 = 描边 + 实色计数) */}
      <View style={statics.statusRow}>
        {(Object.keys(STATUS_THEME) as StatusTab[]).map((key) => {
          const t = STATUS_THEME[key];
          const selected = statusTab === key;
          const ingCount = key === 'pending' ? pendingIngredients.length : rejectedIngredients.length;
          const dishCount = key === 'pending' ? pendingDishes.length : rejectedDishes.length;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setStatusTab(key)}
              style={({ pressed }) => [
                statics.statusCard,
                { backgroundColor: t.soft },
                selected && { borderColor: t.tone, borderWidth: 1.5 },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={[statics.statusLabel, { color: t.tone }]}>{t.label}</Text>
              <Text style={[statics.statusTotal, tabularNums, { color: t.tone }]}>
                {ingCount + dishCount}
              </Text>
              <Text style={[statics.statusBreak, tabularNums, { color: colors.ink2 }]}>
                食材 {ingCount} · 菜品 {dishCount}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 食材队列(统一组标签;状态区分在行卡底色) */}
      <SectionLabel label={`食材 · ${theme.label}(${ingredients.length})`} style={statics.sectionGap} />
      {ingredients.map((item) => (
        <IngredientRow
          key={`i-${statusTab}-${item.id}`}
          item={item}
          soft={theme.soft}
          onPress={() => router.push(`/review-ingredient/${item.id}`)}
          onDelete={statusTab === 'rejected' ? () => confirmRemove('ingredient', item.id, item.name) : undefined}
        />
      ))}
      {ingredients.length === 0 && !loading && <Empty text={statusTab === 'pending' ? '食材队列已清空' : '没有已驳回的食材'} kind="leaf" />}

      {/* 菜品队列 */}
      <SectionLabel label={`菜品 · ${theme.label}(${dishes.length})`} style={statics.sectionGap} />
      {dishes.map((item) => (
        <DishRow
          key={`d-${statusTab}-${item.id}`}
          item={item}
          soft={theme.soft}
          onPress={() => router.push(`/review-dish/${item.id}`)}
          onDelete={statusTab === 'rejected' ? () => confirmRemove('dish', item.id, item.name) : undefined}
        />
      ))}
      {dishes.length === 0 && !loading && <Empty text={statusTab === 'pending' ? '菜品队列已清空' : '没有已驳回的菜品'} kind="bowl" />}
    </ScrollView>
  );
}

function IngredientRow({
  item,
  soft,
  onPress,
  onDelete,
}: {
  item: Ingredient;
  /** 状态底色(待审核琥珀淡底 / 已驳回红淡底,只是轻微一层) */
  soft: string;
  onPress: () => void;
  onDelete?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`复审食材 ${item.name}`}
      onPress={onPress}
      style={({ pressed }) => [statics.row, { backgroundColor: soft }, shadows.card.android, pressed && { opacity: 0.92 }]}
    >
      <View style={statics.rowGrow}>
        {/* 性随名走:徽章紧跟名称,不挂在行尾 */}
        <View style={statics.rowTitleLine}>
          <Text style={statics.rowTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <NatureBadge nature={item.nature} />
        </View>
        <Text style={statics.rowSub} numberOfLines={1}>
          {splitList(item.category).join(' · ')}
        </Text>
      </View>
      {onDelete && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`删除 ${item.name}`}
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => [statics.rowDelBtn, pressed && { backgroundColor: functional.dangerSoft }]}
        >
          <TrashIcon size={16} color={functional.danger} />
        </Pressable>
      )}
      <ChevronRightIcon size={18} color={colors.ink3} />
    </Pressable>
  );
}

function DishRow({
  item,
  soft,
  onPress,
  onDelete,
}: {
  item: Dish;
  soft: string;
  onPress: () => void;
  onDelete?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`复审菜品 ${item.name}`}
      onPress={onPress}
      style={({ pressed }) => [statics.row, { backgroundColor: soft }, shadows.card.android, pressed && { opacity: 0.92 }]}
    >
      <View style={statics.rowGrow}>
        <View style={statics.rowTitleLine}>
          <Text style={statics.rowTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <ChefBadge category={item.category} />
        </View>
        <Text style={statics.rowSub} numberOfLines={1}>
          {parseStyle(item.style).method} · {item.calories}
        </Text>
      </View>
      {onDelete && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`删除 ${item.name}`}
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => [statics.rowDelBtn, pressed && { backgroundColor: functional.dangerSoft }]}
        >
          <TrashIcon size={16} color={functional.danger} />
        </Pressable>
      )}
      <ChevronRightIcon size={18} color={colors.ink3} />
    </Pressable>
  );
}

/** 空队列:占位图 + 文案(比一行灰字更有「清空」的完成感) */
function Empty({ text, kind }: { text: string; kind: 'leaf' | 'bowl' }) {
  return (
    <View style={statics.emptyWrap}>
      <DefaultImage kind={kind} size={44} />
      <Text style={[type.caption, { color: colors.ink3, marginTop: spacing.s2 }]}>{text}</Text>
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
  hero: {
    padding: spacing.s5,
  },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.s3,
  },
  heroGrow: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  heroTitle: {
    fontFamily: fontDisplay,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.ink,
  },
  heroSub: {
    ...type.caption,
    lineHeight: 18,
    color: colors.ink2,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.s3,
    marginTop: spacing.s4,
  },
  statusCard: {
    flex: 1,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    alignItems: 'center',
    paddingVertical: spacing.s3,
    gap: 2,
  },
  statusLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  statusTotal: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
  statusBreak: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
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
    gap: 3,
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
  },
  rowTitle: {
    ...type.body,
    fontWeight: '600',
    color: colors.ink,
    flexShrink: 1,
  },
  rowSub: {
    ...type.caption,
    color: colors.ink3,
    marginTop: 2,
  },
  /** 已驳回行删除按钮:32×32 幽灵热区,按压浮现 dangerSoft */
  rowDelBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderStyle: 'dashed',
    paddingVertical: spacing.s5,
  },
});
