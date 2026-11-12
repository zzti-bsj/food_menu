/** 私有食单列表屏(我的菜谱 / 收录食材,单页单类):
 *  名称搜索 + 行卡列表(无左侧签牌,文字优先,对照 my-content.html)。
 *  行卡 = 名称/状态徽章 + #id·日期 + 元数据行(厨师/四气徽章·做法·热量·节气 Tag);
 *  整块点按进详情,右侧竖排两枚弱化图标按钮(编辑/删除,常态 ink3,按压才现色)。
 *  空态 = 占位图 + 引导按钮。聚焦即重拉。路由薄壳:app/my-dishes.tsx / app/my-ingredients.tsx。 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DefaultImage, NatureBadge, ChefBadge } from '@/components/brand';
import { PenIcon, SearchIcon, TrashIcon } from '@/components/icons';
import { deleteDish, deleteIngredient, listDishGroups, listIngredientGroups } from '@/api/content-api';
import { useAsync } from '@/hooks/use-async';
import { useAuth } from '@/auth/auth-context';
import { useToast } from '@/components/ui/toast';
import { parseStyle, splitList } from '@/utils/text';
import { seasonOfTerm } from '@/domain/solar-terms';
import type { ContentStatus, Dish, Ingredient } from '@/api/types';
import { colors, functional, seasons, activeSeason } from '@/theme/tokens';
import { cursorProps, pagePad, radius, shadows, spacing, type } from '@/theme/theme';

const accent = seasons[activeSeason];

/** 状态徽章(§10:待审核/已通过/已驳回;待审核用秋琥珀,与节气 Tag 的季色区分) */
const STATUS_TONE: Record<ContentStatus, { bg: string; fg: string }> = {
  已通过: { bg: seasons.spring.soft, fg: seasons.spring.deep },
  待审核: { bg: seasons.autumn.soft, fg: seasons.autumn.deep },
  已驳回: { bg: functional.dangerSoft, fg: functional.danger },
};

export type MineKind = 'dish' | 'ingredient';

const COPY: Record<MineKind, { title: string; placeholder: string; empty: { kind: 'bowl' | 'leaf'; title: string; sub: string; action: string; route: '/dish-generate' | '/pipeline' } }> = {
  dish: {
    title: '我的菜谱',
    placeholder: '搜索菜谱',
    empty: {
      kind: 'bowl',
      title: '还没有自己的菜谱',
      sub: '用工坊的健康厨师或美食大厨生成一道',
      action: '去工坊生成',
      route: '/dish-generate',
    },
  },
  ingredient: {
    title: '收录食材',
    placeholder: '搜索食材',
    empty: {
      kind: 'leaf',
      title: '还没有收录食材',
      sub: '跑一条食材流水线,批量收录当令食材',
      action: '去工坊跑流水线',
      route: '/pipeline',
    },
  },
};

export function MineContentScreen({ kind }: { kind: MineKind }) {
  const copy = COPY[kind];
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [removed, setRemoved] = useState<{ dishes: Set<number>; ingredients: Set<number> }>({
    dishes: new Set(),
    ingredients: new Set(),
  });

  const { data, loading, error, reload } = useAsync(async () => {
    const [dishGroups, ingredientGroups] = await Promise.all([listDishGroups(), listIngredientGroups()]);
    const scoped = <T extends { user_id: number | null }>(rows: T[]) =>
      rows.filter((r) => r.user_id === user?.id);
    // 私有食单只放「已通过」;待审核与已驳回都在工坊审核台(驳回可查看/删除,释放名称供重新生成)
    return {
      dishes: scoped(dishGroups.已通过).filter((d) => !removed.dishes.has(d.id)),
      ingredients: scoped(ingredientGroups.已通过).filter((i) => !removed.ingredients.has(i.id)),
    };
  }, [user?.id, removed]);

  // 聚焦即重拉:审核/删除/编辑后返回本页数据即时生效
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const content = useMemo(() => data ?? { dishes: [] as Dish[], ingredients: [] as Ingredient[] }, [data]);

  const q = query.trim();
  const searching = q.length > 0;
  const shownDishes = content.dishes.filter((d) => !q || d.name.includes(q));
  const shownIngredients = content.ingredients.filter((i) => !q || i.name.includes(q));
  const shownCount = kind === 'dish' ? shownDishes.length : shownIngredients.length;

  function confirmRemove(item: { kind: 'dish' | 'ingredient'; id: number; name: string }) {
    Alert.alert('删除确认', `确定删除「${item.name}」吗?删除后不可恢复`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          const request =
            item.kind === 'dish' ? deleteDish(item.id) : deleteIngredient(item.id);
          request
            .then(() => {
              setRemoved((prev) => {
                const next = { dishes: new Set(prev.dishes), ingredients: new Set(prev.ingredients) };
                (item.kind === 'dish' ? next.dishes : next.ingredients).add(item.id);
                return next;
              });
              toast.showToast('已删除');
            })
            .catch((e: unknown) => {
              toast.showToast(e instanceof Error ? e.message : '删除失败');
            });
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={[statics.content, { paddingTop: insets.top + spacing.s2, paddingBottom: 122 + insets.bottom }]}>
      <View style={statics.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          hitSlop={8}
          onPress={() => (router.canDismiss() ? router.back() : router.replace('/(tabs)/mine'))}
          style={statics.back}
        >
          <Text style={statics.backIcon}>‹</Text>
        </Pressable>
        <Text style={[type.serifTitle, { color: colors.ink }]}>{copy.title}</Text>
        <View style={statics.back} />
      </View>

      {/* 搜索框(§7:高 44 · radius 14) */}
      <View style={statics.searchBox}>
        <SearchIcon size={18} color={colors.ink3} />
        <TextInput {...cursorProps}
          style={statics.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={copy.placeholder}
          placeholderTextColor={colors.ink3}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="清空搜索" onPress={() => setQuery('')} hitSlop={6}>
            <Text style={statics.clearText}>✕</Text>
          </Pressable>
        )}
      </View>

      {!!error && (
        <Pressable onPress={reload} hitSlop={8}>
          <Text style={[type.caption, { color: functional.danger }]}>{error}(点按重试)</Text>
        </Pressable>
      )}

      <View style={statics.list}>
        {kind === 'dish'
          ? shownDishes.map((dish) => (
              <DishRow
                key={`d-${dish.id}`}
                dish={dish}
                onView={() => router.push(`/dish/${dish.id}`)}
                onEdit={() => router.push(`/edit-dish/${dish.id}`)}
                onRemove={() => confirmRemove({ kind: 'dish', id: dish.id, name: dish.name })}
              />
            ))
          : shownIngredients.map((item) => (
              <IngredientRow
                key={`i-${item.id}`}
                item={item}
                onView={() => router.push(`/ingredient/${item.id}`)}
                onEdit={() => router.push(`/edit-ingredient/${item.id}`)}
                onRemove={() => confirmRemove({ kind: 'ingredient', id: item.id, name: item.name })}
              />
            ))}
        {!loading && shownCount === 0 && (
          <Empty
            kind={copy.empty.kind}
            title={searching ? `没有匹配「${q}」的${kind === 'dish' ? '菜谱' : '食材'}` : copy.empty.title}
            sub={searching ? '换个关键词试试' : copy.empty.sub}
            actionLabel={searching ? undefined : copy.empty.action}
            onAction={searching ? undefined : () => router.push(copy.empty.route)}
          />
        )}
      </View>
    </ScrollView>
  );
}

/** 行卡标题行:名称 + 状态徽章(仅异常状态显示) */
function RowHead({ name, status }: { name: string; status: ContentStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <View style={statics.titleLine}>
      <Text style={statics.rowTitle} numberOfLines={1}>
        {name}
      </Text>
      {/* 「已通过」是默认态不标注;仅异常状态(已驳回/待审核)出徽章 */}
      {status !== '已通过' && (
        <View style={[statics.statusBadge, { backgroundColor: tone.bg }]}>
          <Text style={[statics.statusText, { color: tone.fg }]}>{status}</Text>
        </View>
      )}
    </View>
  );
}

/** 节气 Tag 行(§7:12px 淡季底 + 季深档字 radius 6),最多 2 个 + 「+n」 */
function TermTags({ terms }: { terms: string[] }) {
  const shown = terms.slice(0, 2);
  const rest = terms.length - shown.length;
  return (
    <View style={statics.termLine}>
      {shown.map((t) => {
        const s = seasons[seasonOfTerm(t)];
        return (
          <View key={t} style={[statics.termTag, { backgroundColor: s.soft }]}>
            <Text style={[statics.termTagText, { color: s.deep }]}>{t}</Text>
          </View>
        );
      })}
      {rest > 0 && (
        <View style={[statics.termTag, { backgroundColor: colors.surface2 }]}>
          <Text style={[statics.termTagText, { color: colors.ink3 }]}>+{rest}</Text>
        </View>
      )}
    </View>
  );
}

/** 行尾弱化图标按钮:28×28 视觉 + hitSlop 补足热区;常态 ink3 灰线无边框,按压才浮现淡底 */
function GhostIcon({
  onPress,
  accessibilityLabel,
  pressedStyle,
  children,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  pressedStyle?: { backgroundColor: string };
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [statics.ghostBtn, pressed && statics.ghostBtnPressed, pressed && pressedStyle]}
    >
      {children}
    </Pressable>
  );
}

/** 菜谱行卡 */
function DishRow({
  dish,
  onView,
  onEdit,
  onRemove,
}: {
  dish: Dish;
  onView: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const terms = splitList(dish.solar_terms);
  const { method } = parseStyle(dish.style);
  return (
    <View style={[statics.row, shadows.card.android]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`查看 ${dish.name}`}
        onPress={onView}
        style={statics.rowMain}
      >
        <RowHead name={dish.name} status={dish.status} />
        <View style={statics.metaLine}>
          <ChefBadge category={dish.category} />
          <Text style={statics.metaText} numberOfLines={1}>
            {[method, dish.calories].filter(Boolean).join(' · ')}
          </Text>
          <View style={statics.metaSpring} />
          <TermTags terms={terms} />
        </View>
      </Pressable>
      {/* 与标题同行的右上角操作位 */}
      <View style={statics.trail}>
        <GhostIcon onPress={onEdit} accessibilityLabel={`编辑 ${dish.name}`}>
          <PenIcon size={15} color={colors.ink3} />
        </GhostIcon>
        <GhostIcon
          onPress={onRemove}
          accessibilityLabel={`删除 ${dish.name}`}
          pressedStyle={{ backgroundColor: functional.dangerSoft }}
        >
          <TrashIcon size={15} color={colors.ink3} />
        </GhostIcon>
      </View>
    </View>
  );
}

/** 食材行卡 */
function IngredientRow({
  item,
  onView,
  onEdit,
  onRemove,
}: {
  item: Ingredient;
  onView: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const terms = splitList(item.solar_terms);
  return (
    <View style={[statics.row, shadows.card.android]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`查看 ${item.name}`}
        onPress={onView}
        style={statics.rowMain}
      >
        <RowHead name={item.name} status={item.status} />
        <View style={statics.metaLine}>
          <NatureBadge nature={item.nature} />
          <Text style={statics.metaText} numberOfLines={1}>
            {splitList(item.category).join(' · ')}
          </Text>
          <View style={statics.metaSpring} />
          <TermTags terms={terms} />
        </View>
      </Pressable>
      <View style={statics.trail}>
        <GhostIcon onPress={onEdit} accessibilityLabel={`编辑 ${item.name}`}>
          <PenIcon size={15} color={colors.ink3} />
        </GhostIcon>
        <GhostIcon
          onPress={onRemove}
          accessibilityLabel={`删除 ${item.name}`}
          pressedStyle={{ backgroundColor: functional.dangerSoft }}
        >
          <TrashIcon size={15} color={colors.ink3} />
        </GhostIcon>
      </View>
    </View>
  );
}

/** 空态:占位图 + 主文案 + 引导按钮(UX 准则:icon + message + action) */
function Empty({
  kind,
  title,
  sub,
  actionLabel,
  onAction,
}: {
  kind: 'bowl' | 'leaf';
  title: string;
  sub: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={statics.emptyWrap}>
      <DefaultImage kind={kind} size={56} />
      <Text style={[type.bodyStrong, { color: colors.ink, marginTop: spacing.s3 }]}>{title}</Text>
      <Text style={[type.caption, { color: colors.ink3, marginTop: spacing.s1, textAlign: 'center', lineHeight: 18 }]}>
        {sub}
      </Text>
      {actionLabel && onAction && (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [statics.emptyBtn, pressed && { opacity: 0.88 }]}
        >
          <Text style={statics.emptyBtnText}>{actionLabel}</Text>
        </Pressable>
      )}
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    marginBottom: spacing.s4,
  },
  /** 固定高(=容器 44)+ 无行高 + textAlignVertical 居中(theme.ts 验证过的模式)。
   *  paddingTop 6 与 inputText 同源的 CJK 视觉配重(字形在 em 框内偏上,净下压 ~3px) */
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: colors.ink,
    paddingTop: 6,
    paddingBottom: 0,
    textAlignVertical: 'center',
  },
  clearText: {
    ...type.caption,
    color: colors.ink3,
    paddingHorizontal: 4,
  },
  list: {
    gap: spacing.s2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingVertical: spacing.s3,
    paddingLeft: spacing.s4,
    paddingRight: spacing.s2,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
  },
  rowTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.ink,
    flexShrink: 1,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
  },
  metaSpring: {
    flex: 1,
  },
  metaText: {
    ...type.caption,
    color: colors.ink3,
    flexShrink: 1,
  },
  termLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  termTag: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  termTagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  /** 右上角操作位:横排两枚,与标题行对齐(不随内容垂直居中下沉) */
  trail: {
    flexDirection: 'row',
    gap: 2,
    alignSelf: 'flex-start',
  },
  /** 幽灵弱化:28×28 视觉 + hitSlop 8 = 44 热区;常态无底色 */
  ghostBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnPressed: {
    backgroundColor: colors.surface2,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.s8,
  },
  emptyBtn: {
    marginTop: spacing.s4,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: accent.main,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: {
    ...type.caption,
    fontWeight: '700',
    color: accent.main,
  },
});
