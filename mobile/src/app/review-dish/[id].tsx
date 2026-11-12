/** 菜品审核详情(工坊 push,对照 review-dish.html):
 *  全字段(含 story / remark 存疑 / 图片行)+ 吸底「驳回 / 通过」(POST /api/dish/status)。 */
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChefBadge } from '@/components/brand';
import { FoodImage } from '@/components/content/food-image';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useToast } from '@/components/ui/toast';
import { getDish } from '@/api/content-api';
import { setDishStatus } from '@/api/workshop-api';
import { useAsync } from '@/hooks/use-async';
import { parseIngredients, parseSteps, parseStyle, splitList } from '@/utils/text';
import { ApiError } from '@/api/client';
import { colors, functional } from '@/theme/tokens';
import { pagePad, radius, shadows, spacing, tabularNums, type } from '@/theme/theme';

const VIEWPORT = 350;

export default function ReviewDishScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { data: dish, loading, error, reload } = useAsync(() => getDish(Number(id)), [id]);
  const [acting, setActing] = useState(false);

  if (loading) return <Centered text="加载中…" />;
  if (error || !dish) return <Centered text={error ?? '未找到该菜品'} onRetry={reload} />;

  async function act(status: '已通过' | '已驳回') {
    setActing(true);
    try {
      await setDishStatus(dish!.name, status);
      toast.showToast(`「${dish!.name}」${status}`);
      router.back();
    } catch (e) {
      toast.showToast(e instanceof ApiError ? e.message : '操作失败');
    } finally {
      setActing(false);
    }
  }

  const steps = parseSteps(dish.steps);
  const { cuisine, method } = parseStyle(dish.style);

  return (
    <View style={statics.flex}>
      <ScrollView contentContainerStyle={[statics.content, { paddingTop: insets.top + spacing.s2, paddingBottom: 130 + insets.bottom }]}>
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
          <Text style={[type.serifTitle, { color: colors.ink }]}>菜品复审</Text>
          <View style={statics.back} />
        </View>

        <FoodImage uri={dish.image} kind="bowl" width={VIEWPORT} height={160} />

        <View style={statics.headRow}>
          <Text style={statics.name}>{dish.name}</Text>
          <ChefBadge category={dish.category} />
        </View>
        <Text style={statics.fieldLine}>
          {cuisine} · {method} · {dish.calories} · 当令 {splitList(dish.solar_terms).join('、')}
        </Text>

        <Field label="主料(每份)">
          {parseIngredients(dish.main_ingredients).map((i) => (
            <Text key={i.name} style={statics.kvLine}>
              {i.name} —— {i.amount ?? '适量'}
            </Text>
          ))}
        </Field>
        {!!dish.extras && (
          <Field label="辅料 / 调料">
            {parseIngredients(dish.extras).map((i) => (
              <Text key={i.name} style={statics.kvLine}>
                {i.name} —— {i.amount ?? '适量'}
              </Text>
            ))}
          </Field>
        )}

        <Field label={`步骤(${steps.length})`}>
          {steps.map((s, i) => (
            <Text key={i} style={statics.kvLine}>
              {i + 1}. {s}
            </Text>
          ))}
        </Field>

        <Field label="养生好处">
          <Text style={statics.bodyText}>{dish.benefits}</Text>
        </Field>
        {!!dish.story && (
          <Field label="风味与文化(美食大厨必填)">
            <Text style={statics.bodyText}>{dish.story}</Text>
          </Field>
        )}
        {!!dish.caution && (
          <View style={statics.cautionBox}>
            <Text style={statics.cautionTitle}>⚠ 忌口提示</Text>
            <Text style={statics.cautionText}>{dish.caution}</Text>
          </View>
        )}
        {!!dish.remark && (
          <View style={statics.cautionBox}>
            <Text style={statics.cautionTitle}>⚠ 存疑备注(核验未决)</Text>
            <Text style={statics.cautionText}>{dish.remark}</Text>
          </View>
        )}
        <Text style={[type.caption, { color: colors.ink3, marginTop: spacing.s4 }]}>
          ID {dish.id} · {dish.status}
        </Text>
      </ScrollView>

      <View style={[statics.bottomBar, shadows.lift.android, { paddingBottom: insets.bottom + 12 }]}>
        <View style={statics.barRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="驳回"
            disabled={acting}
            onPress={() => act('已驳回')}
            style={({ pressed }) => [statics.rejectBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={statics.rejectText}>驳回</Text>
          </Pressable>
          <View style={statics.primaryWrap}>
            <PrimaryButton label="通过" loading={acting} onPress={() => act('已通过')} />
          </View>
        </View>
      </View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={statics.field}>
      <Text style={[type.sectionLabel, { color: colors.ink3 }, statics.fieldLabel]}>{label}</Text>
      <View style={statics.fieldBody}>{children}</View>
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
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
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
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    marginTop: spacing.s4,
  },
  fieldLine: {
    ...type.body,
    color: colors.ink,
    marginTop: spacing.s2,
  },
  name: {
    fontFamily: type.display.fontFamily,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    color: colors.ink,
    flex: 1,
  },
  field: {
    marginTop: spacing.s4,
  },
  fieldLabel: {
    marginBottom: spacing.s1,
  },
  fieldBody: {
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.s3,
    gap: spacing.s1,
  },
  kvLine: {
    ...type.caption,
    ...tabularNums,
    color: colors.ink,
  },
  bodyText: {
    ...type.body,
    color: colors.ink,
  },
  cautionBox: {
    backgroundColor: functional.warningSoft,
    borderRadius: radius.m,
    padding: spacing.s4,
    gap: spacing.s1,
    marginTop: spacing.s4,
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
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: pagePad,
    paddingTop: spacing.s3,
  },
  barRow: {
    flexDirection: 'row',
    gap: spacing.s3,
  },
  rejectBtn: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: functional.danger,
    backgroundColor: functional.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: {
    ...type.bodyStrong,
    color: functional.danger,
  },
  primaryWrap: {
    flex: 1,
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
