/** 菜品详情(二级 push,对照 dish-detail.html):
 *  粉彩 Hero + 图片/默认占位 · 热量环 · 定量表(tabular)· 步骤时间线 · 养生/忌口 ·
 *  美食大厨 story「味」字卡 · 吸底「开始烹饪」(全屏步骤模式预留)。 */
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalorieRing, ChefBadge, OrnDivider, PanelPop } from '@/components/brand';
import { SectionLabel } from '@/components/ui/section-label';
import { FoodImage } from '@/components/content/food-image';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useToast } from '@/components/ui/toast';
import { getDish } from '@/api/content-api';
import { useAsync } from '@/hooks/use-async';
import { parseCalories, seasonOfTerm } from '@/domain/solar-terms';
import { parseIngredients, parseSteps, parseStyle, splitList } from '@/utils/text';
import { brand, colors, functional, seasons } from '@/theme/tokens';
import { pagePad, radius, shadows, spacing, tabularNums, type } from '@/theme/theme';

const VIEWPORT = 350; // 卡片图区宽基准(390 - 2×20)

export default function DishDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { data: dish, loading, error, reload } = useAsync(() => getDish(Number(id)), [id]);

  // 聚焦即重拉:编辑保存后返回详情即时生效
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (loading) {
    return <Centered text="加载中…" />;
  }
  if (error || !dish) {
    return <Centered text={error ?? '未找到该菜品'} onRetry={reload} />;
  }

  const terms = splitList(dish.solar_terms);
  const season = seasonOfTerm(terms[0] ?? '');
  const calories = parseCalories(dish.calories);
  const steps = parseSteps(dish.steps);
  const main = parseIngredients(dish.main_ingredients);
  const extras = parseIngredients(dish.extras ?? '');
  const { cuisine, method } = parseStyle(dish.style);

  return (
    <View style={statics.flex}>
      <ScrollView contentContainerStyle={[statics.content, { paddingTop: insets.top + spacing.s2, paddingBottom: 130 + insets.bottom }]}>
        {/* 顶栏 */}
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
          <Text style={[type.serifTitle, { color: colors.ink }]} numberOfLines={1}>
            {dish.name}
          </Text>
          <View style={statics.back} />
        </View>

        {/* 粉彩 Hero + 图 */}
        <PanelPop season={season}>
          <View style={statics.hero}>
            <View style={statics.heroMeta}>
              <ChefBadge category={dish.category} />
              <Text style={statics.heroName}>{dish.name}</Text>
              <Text style={statics.heroSub}>
                {[cuisine, method].filter(Boolean).join(' · ')} · 当令 {terms.join('、')}
              </Text>
            </View>
          </View>
        </PanelPop>
        <View style={statics.imageWrap}>
          <FoodImage uri={dish.image} kind="bowl" width={VIEWPORT} height={180} />
        </View>

        {/* 热量环 + 忌口提示 */}
        <View style={statics.calRow}>
          {calories && <CalorieRing calories={calories} />}
          <View style={statics.calSide}>
            {dish.caution && (
              <View style={statics.cautionBox}>
                <Text style={statics.cautionTitle}>⚠ 忌口提示</Text>
                <Text style={statics.cautionText}>{dish.caution}</Text>
              </View>
            )}
            <Text style={[type.caption, { color: colors.ink3 }]}>约一餐七成(500 千卡参考餐)</Text>
          </View>
        </View>

        {/* 养生好处 */}
        <SectionLabel label="养生好处" style={statics.sectionLabel} />
        <View style={[statics.card, statics.padBox]}>
          <Text style={statics.bodyText}>{dish.benefits}</Text>
        </View>

        {/* 味 · 风味与文化背景(美食大厨出品) */}
        {dish.story && (
          <>
            <SectionLabel label="风味与文化" style={statics.sectionLabel} />
            <View style={statics.storyCard}>
              <View style={statics.storyBar} />
              <View style={statics.storyBody}>
                <Text style={statics.storyMark}>味</Text>
                <Text style={statics.storyText}>{dish.story}</Text>
              </View>
            </View>
          </>
        )}

        {/* 定量表 */}
        <SectionLabel label="主料(每份定量)" style={statics.sectionLabel} />
        <View style={[statics.card, statics.padBox]}>
          {main.map((item) => (
            <View key={`m-${item.name}`} style={statics.tableRow}>
              <Text style={statics.tableName}>{item.name}</Text>
              <Text style={statics.tableAmount}>{item.amount ?? '适量'}</Text>
            </View>
          ))}
          {extras.length > 0 && (
            <>
              <Text style={statics.extrasTitle}>辅料 / 调料</Text>
              {extras.map((item) => (
                <View key={`e-${item.name}`} style={statics.tableRow}>
                  <Text style={statics.tableName}>{item.name}</Text>
                  <Text style={statics.tableAmount}>{item.amount ?? '适量'}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* 步骤时间线(§7:序号圆 accent 实底白字 + 渐隐连线,技巧并入步骤) */}
        <SectionLabel label="烹饪步骤" style={statics.sectionLabel} />
        <View style={[statics.card, statics.padBox]}>
          {steps.map((step, i) => (
            <View key={i} style={statics.stepRow}>
              <View style={statics.stepRail}>
                <View style={[statics.stepNo, { backgroundColor: seasons[season].main }]}>
                  <Text style={statics.stepNoText}>{i + 1}</Text>
                </View>
                {i < steps.length - 1 && <View style={statics.stepLine} />}
              </View>
              <Text style={statics.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={statics.orn}>
          <OrnDivider />
        </View>
      </ScrollView>

      {/* 吸底操作条(§8):全不透明底 + 主按钮一屏一个 */}
      <View style={[statics.bottomBar, shadows.lift.android, { paddingBottom: insets.bottom + 12 }]}>
        <PrimaryButton
          label="开始烹饪"
          onPress={() => toast.showToast('全屏烹饪模式即将上线')}
        />
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
  hero: {
    padding: spacing.s5,
  },
  heroMeta: {
    gap: spacing.s2,
  },
  heroName: {
    fontFamily: type.display.fontFamily,
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.ink,
  },
  heroSub: {
    ...type.caption,
    color: colors.ink2,
  },
  imageWrap: {
    marginTop: spacing.s3,
    alignItems: 'center',
  },
  calRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s4,
    marginTop: spacing.s5,
  },
  calSide: {
    flex: 1,
    gap: spacing.s2,
  },
  cautionBox: {
    backgroundColor: functional.warningSoft,
    borderRadius: radius.s,
    padding: spacing.s3,
    gap: 4,
  },
  cautionTitle: {
    ...type.caption,
    fontWeight: '700',
    color: functional.warning,
  },
  cautionText: {
    ...type.caption,
    color: functional.warning,
  },
  sectionLabel: {
    marginTop: spacing.s6,
    marginBottom: spacing.s2,
  },
  card: {
    borderRadius: radius.m,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  padBox: {
    padding: spacing.s4,
  },
  bodyText: {
    ...type.body,
    color: colors.ink,
  },
  storyCard: {
    borderRadius: radius.m,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.s4,
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
    fontFamily: type.display.fontFamily,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: brand.amber,
    marginBottom: 4,
  },
  storyText: {
    fontFamily: type.display.fontFamily,
    fontSize: 15,
    lineHeight: 26,
    color: colors.ink,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  tableName: {
    ...type.body,
    color: colors.ink,
  },
  tableAmount: {
    ...tabularNums,
    ...type.body,
    color: colors.ink2,
  },
  extrasTitle: {
    ...type.caption,
    fontWeight: '600',
    color: colors.ink3,
    marginTop: spacing.s3,
    marginBottom: 2,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.s3,
  },
  stepRail: {
    alignItems: 'center',
    width: 28,
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
