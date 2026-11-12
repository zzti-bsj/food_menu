/** 菜品审核详情(工坊 push,对照 review-dish.html + v1.2 品牌语言):
 *  季粉彩 Hero(厨师徽章 + 衬线菜名 + 节气标签 + 星光)+ 定量表 / 步骤时间线 /
 *  养生好处 / 味卡(故事)/ 忌口与存疑警示 + 吸底「驳回 / 通过(绿=通过语义)」。 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChefBadge, OrnDivider, PanelPop, Sparkle } from '@/components/brand';
import { SectionLabel } from '@/components/ui/section-label';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useToast } from '@/components/ui/toast';
import { getDish } from '@/api/content-api';
import { setDishStatus } from '@/api/workshop-api';
import { useAsync } from '@/hooks/use-async';
import { parseIngredients, parseSteps, parseStyle, splitList } from '@/utils/text';
import { seasonOfTerm } from '@/domain/solar-terms';
import { ApiError } from '@/api/client';
import { brand, colors, functional, seasons } from '@/theme/tokens';
import { fontDisplay, pagePad, radius, shadows, spacing, tabularNums, type } from '@/theme/theme';

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

  const terms = splitList(dish.solar_terms);
  const season = seasonOfTerm(terms[0] ?? '');
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

        {/* 季粉彩 Hero */}
        <PanelPop season={season}>
          <View style={statics.hero}>
            <View style={statics.heroTopRow}>
              <ChefBadge category={dish.category} />
              <View style={statics.heroSpring} />
              <Sparkle size={18} />
            </View>
            <Text style={statics.heroName}>{dish.name}</Text>
            <Text style={statics.heroSub}>{[cuisine, method, dish.calories].filter(Boolean).join(' · ')}</Text>
            <View style={statics.heroTerms}>
              {terms.map((t) => {
                const s = seasons[seasonOfTerm(t)];
                return (
                  <View key={t} style={[statics.heroTerm, { backgroundColor: s.soft }]}>
                    <Text style={[statics.heroTermText, { color: s.deep }]}>{t}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </PanelPop>

        {/* 定量表 */}
        <SectionLabel label="定量表(每份)" style={statics.sectionGap} />
        <View style={[statics.card, statics.padBox]}>
          {parseIngredients(dish.main_ingredients).map((i) => (
            <QuantRow key={`m-${i.name}`} name={i.name} amount={i.amount} />
          ))}
          {parseIngredients(dish.extras ?? '').length > 0 && (
            <>
              <Text style={statics.extrasTitle}>辅料 / 调料</Text>
              {parseIngredients(dish.extras ?? '').map((i) => (
                <QuantRow key={`e-${i.name}`} name={i.name} amount={i.amount} />
              ))}
            </>
          )}
        </View>

        {/* 步骤时间线 */}
        <SectionLabel label={`烹饪步骤(${steps.length})`} style={statics.sectionGap} />
        <View style={[statics.card, statics.padBox]}>
          {steps.map((s, i) => (
            <View key={i} style={statics.stepRow}>
              <View style={statics.stepRail}>
                <View style={[statics.stepNo, { backgroundColor: seasons[season].main }]}>
                  <Text style={statics.stepNoText}>{i + 1}</Text>
                </View>
                {i < steps.length - 1 && <View style={statics.stepLine} />}
              </View>
              <Text style={statics.stepText}>{s}</Text>
            </View>
          ))}
        </View>

        {/* 养生好处 */}
        <SectionLabel label="养生好处" style={statics.sectionGap} />
        <View style={[statics.card, statics.padBox]}>
          <Text style={statics.bodyText}>{dish.benefits}</Text>
        </View>

        {/* 味卡(风味与文化) */}
        {!!dish.story && (
          <>
            <SectionLabel label="风味与文化" style={statics.sectionGap} />
            <View style={[statics.storyCard, statics.padBox, shadows.card.android]}>
              <View style={statics.storyBar} />
              <View style={statics.storyBody}>
                <Text style={statics.storyMark}>味</Text>
                <Text style={statics.storyText}>{dish.story}</Text>
              </View>
            </View>
          </>
        )}

        {/* 忌口 / 存疑警示 */}
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

        <View style={statics.orn}>
          <OrnDivider />
        </View>
        <Text style={[type.caption, { color: colors.ink3, marginTop: spacing.s3 }]}>
          ID {dish.id} · {dish.status}
        </Text>
      </ScrollView>

      {/* 吸底操作栏:驳回(danger 淡底描边)+ 通过(绿=通过语义,§2.4 功能色) */}
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
            <PrimaryButton
              label="通过"
              loading={acting}
              onPress={() => act('已通过')}
              from={functional.success}
              to={seasons.spring.deep}
              shadowColor={functional.success}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

/** 定量表行:名称 + 分量(tabular) */
function QuantRow({ name, amount }: { name: string; amount: string | null }) {
  return (
    <View style={statics.quantRow}>
      <Text style={statics.quantName}>{name}</Text>
      <Text style={[statics.quantAmount, tabularNums]}>{amount ?? '适量'}</Text>
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
  hero: {
    padding: spacing.s5,
    gap: spacing.s2,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
  },
  heroSpring: {
    flex: 1,
  },
  heroName: {
    fontFamily: fontDisplay,
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.ink,
  },
  heroSub: {
    ...type.caption,
    color: colors.ink2,
  },
  heroTerms: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  heroTerm: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  heroTermText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  sectionGap: {
    marginTop: spacing.s5,
    marginBottom: spacing.s2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  padBox: {
    padding: spacing.s4,
  },
  quantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  quantName: {
    ...type.body,
    color: colors.ink,
  },
  quantAmount: {
    ...type.body,
    color: colors.ink2,
  },
  extrasTitle: {
    ...type.caption,
    fontWeight: '600',
    color: colors.ink3,
    marginTop: spacing.s2,
    marginBottom: 2,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.s3,
  },
  stepRail: {
    alignItems: 'center',
    width: 28,
    alignSelf: 'stretch',
  },
  stepNo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNoText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.surface,
  },
  stepLine: {
    flex: 1,
    width: 2,
    marginVertical: 2,
    backgroundColor: colors.line,
    borderRadius: 1,
  },
  stepText: {
    ...type.body,
    color: colors.ink,
    paddingBottom: spacing.s4,
    flex: 1,
  },
  bodyText: {
    ...type.body,
    color: colors.ink,
  },
  storyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    flexDirection: 'row',
    gap: spacing.s3,
  },
  storyBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: brand.amber,
  },
  storyBody: {
    flex: 1,
  },
  storyMark: {
    fontFamily: fontDisplay,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: brand.amber,
    marginBottom: 4,
  },
  storyText: {
    fontFamily: fontDisplay,
    fontSize: 15,
    lineHeight: 26,
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
  orn: {
    marginTop: spacing.s6,
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
