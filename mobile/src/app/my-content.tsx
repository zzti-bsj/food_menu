/** 我的私有食单(登录 push,对照 my-content.html):
 *  本人私有内容(user_id 非空)菜品/食材分段 · 三态徽标 · 查看/删除(DELETE 确认)。
 *  可见性:私有仅本人与 admin;他人访问详情 404 防探测(§10)。
 *  注意:列表端点返回全量三态,本人内容靠 user_id 过滤;后端缺「按用户过滤列表」接口(待补)。 */
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteDish, deleteIngredient, listDishGroups, listIngredientGroups } from '@/api/content-api';
import { useAsync } from '@/hooks/use-async';
import { useAuth } from '@/auth/auth-context';
import { useToast } from '@/components/ui/toast';
import type { ContentStatus, Dish, Ingredient } from '@/api/types';
import { colors, functional, seasons } from '@/theme/tokens';
import { pagePad, radius, shadows, spacing, type } from '@/theme/theme';

const STATUS_TONE: Record<ContentStatus, { bg: string; fg: string }> = {
  已通过: { bg: seasons.spring.soft, fg: seasons.spring.deep },
  待审核: { bg: seasons.autumn.soft, fg: seasons.autumn.deep },
  已驳回: { bg: functional.dangerSoft, fg: functional.danger },
};

export default function MyContentScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  // 删除后本地剔除,避免整页重拉
  const [removed, setRemoved] = useState<{ dishes: Set<number>; ingredients: Set<number> }>({
    dishes: new Set(),
    ingredients: new Set(),
  });

  const { data, loading, error, reload } = useAsync(async () => {
    const [dishGroups, ingredientGroups] = await Promise.all([listDishGroups(), listIngredientGroups()]);
    const mineDishes = [...dishGroups.已通过, ...dishGroups.待审核, ...dishGroups.已驳回].filter(
      (d) => d.user_id === user?.id && !removed.dishes.has(d.id),
    );
    const mineIngredients = [
      ...ingredientGroups.已通过,
      ...ingredientGroups.待审核,
      ...ingredientGroups.已驳回,
    ].filter((i) => i.user_id === user?.id && !removed.ingredients.has(i.id));
    return { dishes: mineDishes, ingredients: mineIngredients };
  }, [user?.id]);

  const content = useMemo(() => data ?? { dishes: [], ingredients: [] }, [data]);

  function confirmRemove(kind: 'dish' | 'ingredient', id: number, name: string) {
    Alert.alert('删除确认', `确定删除「${name}」吗?删除后不可恢复`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          const request = kind === 'dish' ? deleteDish(id) : deleteIngredient(id);
          request
            .then(() => {
              setRemoved((prev) => {
                const next = { dishes: new Set(prev.dishes), ingredients: new Set(prev.ingredients) };
                (kind === 'dish' ? next.dishes : next.ingredients).add(id);
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
        <Text style={[type.serifTitle, { color: colors.ink }]}>我的私有食单</Text>
      </View>
      <Text style={[type.caption, statics.hint, { color: colors.ink3 }]}>
        仅本人与管理员可见;他人访问详情一律 404(防探测)
      </Text>

      {!!error && (
        <Pressable onPress={reload}>
          <Text style={[type.caption, { color: functional.danger }]}>{error}(点按重试)</Text>
        </Pressable>
      )}

      <SectionLabel label={`菜品(${content.dishes.length})`} />
      {content.dishes.map((dish) => (
        <ContentRow
          key={`d-${dish.id}`}
          title={dish.name}
          status={dish.status}
          onView={() => router.push(`/dish/${dish.id}`)}
          onRemove={() => confirmRemove('dish', dish.id, dish.name)}
        />
      ))}
      {content.dishes.length === 0 && !loading && <Empty text="暂无私有菜品(创建接口待补)" />}

      <SectionLabel label={`食材(${content.ingredients.length})`} />
      {content.ingredients.map((item) => (
        <ContentRow
          key={`i-${item.id}`}
          title={item.name}
          status={item.status}
          onView={() => router.push(`/ingredient/${item.id}`)}
          onRemove={() => confirmRemove('ingredient', item.id, item.name)}
        />
      ))}
      {content.ingredients.length === 0 && !loading && <Empty text="暂无私有食材(创建接口待补)" />}
    </ScrollView>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={[type.sectionLabel, statics.sectionLabel, { color: colors.ink3 }]}>{label}</Text>;
}

function Empty({ text }: { text: string }) {
  return (
    <View style={[statics.row, statics.emptyRow]}>
      <Text style={[type.caption, { color: colors.ink3 }]}>{text}</Text>
    </View>
  );
}

function ContentRow({
  title,
  status,
  onView,
  onRemove,
}: {
  title: string;
  status: ContentStatus;
  onView: () => void;
  onRemove: () => void;
}) {
  const tone = STATUS_TONE[status];
  return (
    <View style={[statics.row, shadows.card.android]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`查看 ${title}`} onPress={onView} style={statics.rowGrow}>
        <Text style={statics.rowTitle}>{title}</Text>
      </Pressable>
      <View style={[statics.statusBadge, { backgroundColor: tone.bg }]}>
        <Text style={[statics.statusText, { color: tone.fg }]}>{status}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`删除 ${title}`}
        onPress={onRemove}
        hitSlop={8}
        style={statics.removeBtn}
      >
        <Text style={statics.removeText}>删除</Text>
      </Pressable>
    </View>
  );
}

const statics = StyleSheet.create({
  content: {
    backgroundColor: colors.bg,
    paddingHorizontal: pagePad,
  },
  topBar: {
    height: 44,
    justifyContent: 'center',
    marginBottom: spacing.s1,
  },
  hint: {
    marginBottom: spacing.s4,
  },
  sectionLabel: {
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
  removeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  removeText: {
    ...type.caption,
    fontWeight: '600',
    color: functional.danger,
  },
  emptyRow: {
    justifyContent: 'center',
    paddingVertical: spacing.s5,
  },
});
