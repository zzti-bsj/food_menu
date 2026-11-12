/** 私有食单列表屏(我的菜谱 / 收录食材两个入口已拆分,单页单类,不再双 Tab):
 *  可见性说明条(春绿渐变卡)+ 名称搜索 + 行卡列表。
 *  行卡 = 封面图/食签牌 + 名称/状态徽章 + #id·日期 + 元数据行(厨师/四气徽章·做法·热量·节气 Tag)+
 *  虚线分隔操作行(查看/编辑/删除胶囊)。空态 = 占位图 + 引导按钮。聚焦即重拉。
 *  路由薄壳:app/my-dishes.tsx 与 app/my-ingredients.tsx。 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChefBadge, DefaultImage, MonoTag, NatureBadge } from '@/components/brand';
import { CheckIcon, EyeIcon, PenIcon, SearchIcon, TrashIcon } from '@/components/icons';
import { FoodImage } from '@/components/content/food-image';
import { deleteDish, deleteIngredient, listDishGroups, listIngredientGroups } from '@/api/content-api';
import { useAsync } from '@/hooks/use-async';
import { useAuth } from '@/auth/auth-context';
import { useToast } from '@/components/ui/toast';
import { parseStyle, splitList } from '@/utils/text';
import { seasonOfTerm } from '@/domain/solar-terms';
import type { ContentStatus, Dish, Ingredient } from '@/api/types';
import { colors, functional, seasons, activeSeason } from '@/theme/tokens';
import { inputText, pagePad, radius, shadows, spacing, tabularNums, type } from '@/theme/theme';

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

const RFC_MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** created_at →「MM-DD」。Flask jsonify 序列化为 RFC 822(如「Sat, 08 Nov 2026 … GMT」),
 *  Hermes 的 Date.parse 仅认 ISO,故手写回退解析;两种都失败返回 null(仅展示 #id)。 */
function shortDate(value: string | undefined): string | null {
  if (!value) return null;
  const pad = (n: number) => `${n}`.padStart(2, '0');
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return `${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  }
  const m = /(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})/.exec(value);
  if (m) {
    const month = RFC_MONTHS[m[2]];
    if (month !== undefined) return `${pad(month + 1)}-${pad(Number(m[1]))}`;
  }
  return null;
}

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
    // 待审核不进私有列表:在审核待办里,通过后才展示
    return {
      dishes: scoped([...dishGroups.已通过, ...dishGroups.已驳回]).filter(
        (d) => !removed.dishes.has(d.id),
      ),
      ingredients: scoped([...ingredientGroups.已通过, ...ingredientGroups.已驳回]).filter(
        (i) => !removed.ingredients.has(i.id),
      ),
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

      {/* 可见性说明条(设计 .note-bar):春绿渐变卡,对勾 + 标题 + 释义 */}
      <LinearGradient
        colors={seasons.spring.panel}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={statics.noteBar}
      >
        <View style={statics.noteIcon} aria-hidden>
          <CheckIcon size={18} color={seasons.spring.deep} />
        </View>
        <View style={statics.noteBody}>
          <Text style={statics.noteTitle}>仅本人与管理员可见</Text>
          <Text style={statics.noteText}>
            他人(含未登录)访问你的私有内容会得到 404,不暴露存在性。官方库内容不在此列,由管理员在审核台管理。
          </Text>
        </View>
      </LinearGradient>

      {/* 搜索框(§7:高 44 · radius 14) */}
      <View style={statics.searchBox}>
        <SearchIcon size={18} color={colors.ink3} />
        <TextInput
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

/** 行卡头部公共段:封面图(有图)/食签牌(无图)+ 名称/状态徽章 + #id·日期 */
function RowHead({
  id,
  name,
  status,
  image,
  createdAt,
  termSeason,
  placeholderKind,
}: {
  id: number;
  name: string;
  status: ContentStatus;
  image: string | null;
  createdAt?: string;
  termSeason: ReturnType<typeof seasonOfTerm>;
  placeholderKind: 'leaf' | 'bowl';
}) {
  const tone = STATUS_TONE[status];
  const date = shortDate(createdAt);
  return (
    <View style={statics.rowTop}>
      {image ? (
        <FoodImage uri={image} kind={placeholderKind} width={44} height={44} />
      ) : (
        <MonoTag char={name.slice(0, 1)} tone={termSeason} size="md" />
      )}
      <View style={statics.rowGrow}>
        <View style={statics.titleLine}>
          <Text style={statics.rowTitle} numberOfLines={1}>
            {name}
          </Text>
          <View style={[statics.statusBadge, { backgroundColor: tone.bg }]}>
            <Text style={[statics.statusText, { color: tone.fg }]}>{status}</Text>
          </View>
        </View>
      </View>
      <Text style={statics.idno}>{date ? `#${id} · ${date}` : `#${id}`}</Text>
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

/** 操作行(设计 .ops):虚线上分隔 + 查看/编辑/删除胶囊 */
function RowOps({
  name,
  onView,
  onEdit,
  onRemove,
}: {
  name: string;
  onView: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={statics.ops}>
      <OpButton label="查看" onPress={onView} accessibilityLabel={`查看 ${name}`}>
        <EyeIcon size={14} color={colors.ink2} />
      </OpButton>
      <OpButton label="编辑" onPress={onEdit} accessibilityLabel={`编辑 ${name}`}>
        <PenIcon size={14} color={colors.ink2} />
      </OpButton>
      <OpButton label="删除" danger onPress={onRemove} accessibilityLabel={`删除 ${name}`}>
        <TrashIcon size={14} color={functional.danger} />
      </OpButton>
    </View>
  );
}

function OpButton({
  label,
  danger = false,
  children,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  danger?: boolean;
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        statics.op,
        danger && statics.opDel,
        pressed && { opacity: 0.8 },
      ]}
    >
      {children}
      <Text style={[statics.opText, danger && statics.opTextDel]}>{label}</Text>
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
  const dishSeason = seasonOfTerm(terms[0] ?? '');
  const { method } = parseStyle(dish.style);
  return (
    <View style={[statics.row, shadows.card.android]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`查看 ${dish.name}`}
        onPress={onView}
        style={statics.rowMain}
      >
        <RowHead
          id={dish.id}
          name={dish.name}
          status={dish.status}
          image={dish.image}
          createdAt={dish.created_at}
          termSeason={dishSeason}
          placeholderKind="bowl"
        />
        <View style={statics.metaLine}>
          <ChefBadge category={dish.category} />
          <Text style={statics.metaText} numberOfLines={1}>
            {[method, dish.calories].filter(Boolean).join(' · ')}
          </Text>
          <View style={statics.metaSpring} />
          <TermTags terms={terms} />
        </View>
      </Pressable>
      <RowOps name={dish.name} onView={onView} onEdit={onEdit} onRemove={onRemove} />
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
  const itemSeason = seasonOfTerm(terms[0] ?? '');
  return (
    <View style={[statics.row, shadows.card.android]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`查看 ${item.name}`}
        onPress={onView}
        style={statics.rowMain}
      >
        <RowHead
          id={item.id}
          name={item.name}
          status={item.status}
          image={item.image}
          createdAt={item.created_at}
          termSeason={itemSeason}
          placeholderKind="leaf"
        />
        <View style={statics.metaLine}>
          <NatureBadge nature={item.nature} />
          <Text style={statics.metaText} numberOfLines={1}>
            {splitList(item.category).join(' · ')}
          </Text>
          <View style={statics.metaSpring} />
          <TermTags terms={terms} />
        </View>
      </Pressable>
      <RowOps name={item.name} onView={onView} onEdit={onEdit} onRemove={onRemove} />
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
  noteBar: {
    flexDirection: 'row',
    gap: spacing.s3,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: seasons.spring.soft,
    padding: spacing.s4,
    marginBottom: spacing.s3,
  },
  noteIcon: {
    marginTop: 2,
  },
  noteBody: {
    flex: 1,
  },
  noteTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: seasons.spring.deep,
  },
  noteText: {
    ...type.caption,
    lineHeight: 19,
    color: colors.ink2,
    marginTop: 3,
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
  searchInput: {
    flex: 1,
    ...inputText,
    color: colors.ink,
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
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: spacing.s4,
    paddingTop: 13,
    paddingBottom: 10,
  },
  rowMain: {
    gap: 7,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
  },
  rowGrow: {
    flex: 1,
    minWidth: 0,
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
  idno: {
    ...type.caption,
    ...tabularNums,
    color: colors.ink3,
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
  ops: {
    flexDirection: 'row',
    gap: spacing.s2,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    borderStyle: 'dashed',
  },
  op: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
  },
  opDel: {
    backgroundColor: functional.dangerSoft,
    borderColor: functional.dangerLine,
  },
  opText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: colors.ink2,
  },
  opTextDel: {
    color: functional.danger,
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
