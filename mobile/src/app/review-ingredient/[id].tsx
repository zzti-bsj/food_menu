/** 食材审核详情(工坊 push,对照 review-ingredient.html):
 *  全字段展示 + 词表值域校验标记(四气/五味)+ 吸底「驳回 / 通过」操作栏(POST /api/status)。 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NatureBadge, QuoteCard } from '@/components/brand';
import { FoodImage } from '@/components/content/food-image';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useToast } from '@/components/ui/toast';
import { getIngredient } from '@/api/content-api';
import { setIngredientStatus } from '@/api/workshop-api';
import { useAsync } from '@/hooks/use-async';
import { splitList } from '@/utils/text';
import { ApiError } from '@/api/client';
import { colors, functional } from '@/theme/tokens';
import { pagePad, radius, shadows, spacing, type } from '@/theme/theme';

/** 词表值域(§10 对齐 db CHECK / validate.py);越界值标记 ⚠ */
const NATURE_VOCAB = ['寒', '微寒', '凉', '平', '微温', '温', '热'];
const FLAVOR_VOCAB = ['酸', '苦', '甘', '辛', '咸', '淡', '涩'];
const VIEWPORT = 350;

export default function ReviewIngredientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { data: item, loading, error, reload } = useAsync(() => getIngredient(Number(id)), [id]);
  const [acting, setActing] = useState(false);

  if (loading) return <Centered text="加载中…" />;
  if (error || !item) return <Centered text={error ?? '未找到该食材'} onRetry={reload} />;

  const flavors = splitList(item.flavor);
  const natureOk = NATURE_VOCAB.includes(item.nature);
  const flavorOk = flavors.every((f) => FLAVOR_VOCAB.includes(f));
  const benefits = splitList(item.benefits);

  async function act(status: '已通过' | '已驳回') {
    setActing(true);
    try {
      await setIngredientStatus(item!.name, status);
      toast.showToast(`「${item!.name}」${status}`);
      router.back();
    } catch (e) {
      toast.showToast(e instanceof ApiError ? e.message : '操作失败');
    } finally {
      setActing(false);
    }
  }

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
          <Text style={[type.serifTitle, { color: colors.ink }]}>食材复审</Text>
          <View style={statics.back} />
        </View>

        <FoodImage uri={item.image} kind="leaf" width={VIEWPORT} height={160} />

        <View style={statics.headRow}>
          <Text style={statics.name}>{item.name}</Text>
          <NatureBadge nature={item.nature} />
        </View>
        {/* 词表校验标记 */}
        {!natureOk && <Text style={statics.vocabWarn}>⚠ 四气「{item.nature}」不在七档词表</Text>}
        {!flavorOk && (
          <Text style={statics.vocabWarn}>
            ⚠ 五味含词表外值:{flavors.filter((f) => !FLAVOR_VOCAB.includes(f)).join('、')}
          </Text>
        )}
        <Text style={statics.fieldLine}>
          分类:{splitList(item.category).join('、')} · 五味:{flavors.join('、') || '—'}
        </Text>
        <Text style={statics.fieldLine}>归经:{splitList(item.meridian).join('、') || '—'}经</Text>
        {benefits.length > 0 && <Text style={statics.fieldLine}>功效:{benefits.join('、')}</Text>}
        <Text style={statics.fieldLine}>当令节气:{splitList(item.solar_terms).join('、')}</Text>
        {!!item.season_note && <Text style={statics.fieldLine}>时令备注:{item.season_note}</Text>}
        {!!item.caution && (
          <View style={statics.cautionBox}>
            <Text style={statics.cautionTitle}>⚠ 食用注意</Text>
            <Text style={statics.cautionText}>{item.caution}</Text>
          </View>
        )}
        {!!item.classic_note && (
          <>
            <Text style={[type.sectionLabel, { color: colors.ink3 }, statics.sectionGap]}>典籍注脚</Text>
            <QuoteCard note={item.classic_note} />
          </>
        )}
        <Text style={[type.caption, { color: colors.ink3, marginTop: spacing.s4 }]}>
          状态:{item.status} · ID {item.id} · 通过后 C 端可见
        </Text>
      </ScrollView>

      {/* 吸底操作栏(§8):驳回 danger 淡底描边 + 通过主按钮 */}
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
  name: {
    fontFamily: type.display.fontFamily,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    color: colors.ink,
    flex: 1,
  },
  vocabWarn: {
    ...type.caption,
    color: functional.warning,
    marginTop: spacing.s1,
  },
  fieldLine: {
    ...type.body,
    color: colors.ink,
    marginTop: spacing.s2,
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
  sectionGap: {
    marginTop: spacing.s4,
    marginBottom: spacing.s2,
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
