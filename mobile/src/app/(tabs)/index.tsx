/** 今日(Tab 1)—— 对照 home.html:节气 Hero(粉彩面板)· 当令带(±2 共 5)· 当令食材横滑 · 应季菜谱。
 *  数据:listTerms + 已通过食材/菜品;当前节气端内推算(§domain)。 */
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DefaultImage, OrnDivider, PanelPop, Seal, Sparkle } from '@/components/brand';
import { DishCard } from '@/components/content/dish-card';
import { listApprovedDishes, listApprovedIngredients, listTerms } from '@/api/content-api';
import { useAsync } from '@/hooks/use-async';
import { currentTerm, nearbyTerms, seasonOfTerm, type SeasonKey } from '@/domain/solar-terms';
import { splitList } from '@/utils/text';
import type { Dish, Ingredient } from '@/api/types';
import { colors, functional, seasons } from '@/theme/tokens';
import { pagePad, radius, spacing, type } from '@/theme/theme';

/** 当令口径:与任一附近节气相交即算当令 */
function inSeason(solarTerms: string, near: readonly string[]): boolean {
  return splitList(solarTerms).some((t) => near.includes(t));
}

export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([listTerms(), listApprovedIngredients(), listApprovedDishes()]),
    [],
  );

  const term = currentTerm();
  const near = nearbyTerms(term);
  const season = seasonOfTerm(term);

  const ingredients: Ingredient[] = (data?.[1] ?? []).filter((i) => inSeason(i.solar_terms, near));
  const dishes: Dish[] = (data?.[2] ?? []).filter((d) => inSeason(d.solar_terms, near));

  return (
    <ScrollView
      contentContainerStyle={[statics.content, { paddingTop: insets.top + spacing.s4, paddingBottom: 122 + insets.bottom }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.ink3} />}
    >
      {/* 节气 Hero:点按进全年节气 */}
      <Pressable accessibilityRole="button" accessibilityLabel="查看全年节气" onPress={() => router.push('/terms')}>
        <View style={statics.pad}>
          <PanelPop season={season}>
            <View style={statics.hero}>
              <View style={statics.heroSparkles}>
                <Sparkle size={16} />
                <Sparkle size={11} color="#3D7A50" />
              </View>
              <View style={statics.heroHead}>
                <Seal char="食" />
                <View style={statics.heroMeta}>
                  <Text style={statics.heroKicker}>今日 · {seasonLabel(season)}季节气</Text>
                  <Text style={type.hero}>{term}</Text>
                </View>
              </View>
              <View style={statics.termBand}>
                {near.map((t) => {
                  const isCurrent = t === term;
                  return (
                    <View key={t} style={[statics.termChip, isCurrent && { backgroundColor: seasons[season].main }]}>
                      <Text style={[statics.termText, isCurrent && { color: colors.surface }]}>{t}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </PanelPop>
        </View>
      </Pressable>

      {error && <ErrorHint message={error} onRetry={reload} />}

      {/* 当令食材(横滑):无当令数据时保留区块并给出空态,与设计稿结构一致 */}
      <View style={statics.section}>
        <Text style={[type.sectionLabel, { color: colors.ink3 }, statics.pad]}>当令食材</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[statics.pad, statics.foodRow]}
        >
          {ingredients.slice(0, 12).map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`查看食材 ${item.name}`}
              onPress={() => router.push(`/ingredient/${item.id}`)}
              style={statics.foodItem}
            >
              <DefaultImage kind="leaf" size={56} />
              <Text style={statics.foodName}>{item.name}</Text>
            </Pressable>
          ))}
          {ingredients.length === 0 && !loading && (
            <Text style={[type.caption, statics.foodEmpty, { color: colors.ink3 }]}>
              暂无当令食材,去工坊跑一条食材流水线吧
            </Text>
          )}
        </ScrollView>
      </View>

      {/* 应季菜谱 */}
      <View style={statics.section}>
        <Text style={[type.sectionLabel, { color: colors.ink3 }, statics.pad]}>应季菜谱</Text>
        <View style={[statics.pad, statics.sectionGap, statics.dishList]}>
          {dishes.slice(0, 5).map((dish) => (
            <DishCard key={dish.id} dish={dish} onPress={() => router.push(`/dish/${dish.id}`)} />
          ))}
          {dishes.length === 0 && !loading && (
            <Text style={[type.caption, { color: colors.ink3 }]}>近期暂无当令菜谱,工坊可生成后审核入库</Text>
          )}
        </View>
      </View>

      <View style={statics.pad}>
        <OrnDivider />
      </View>
    </ScrollView>
  );
}

function seasonLabel(season: SeasonKey): string {
  return { spring: '春', summer: '夏', autumn: '秋', winter: '冬' }[season];
}

function ErrorHint({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={statics.errorBox}>
      <Text style={[type.caption, { color: functional.danger }]}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={8}>
        <Text style={[type.caption, { color: colors.ink2, textDecorationLine: 'underline' }]}>重试</Text>
      </Pressable>
    </View>
  );
}

const statics = StyleSheet.create({
  content: {
    backgroundColor: colors.bg,
  },
  pad: {
    paddingHorizontal: pagePad,
  },
  hero: {
    padding: spacing.s5,
  },
  heroSparkles: {
    position: 'absolute',
    top: spacing.s3,
    right: spacing.s4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.s1,
  },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
  },
  heroMeta: {
    gap: 2,
  },
  heroKicker: {
    ...type.caption,
    color: colors.ink2,
  },
  termBand: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
    marginTop: spacing.s4,
  },
  termChip: {
    borderRadius: radius.s,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  termText: {
    ...type.caption,
    color: colors.ink2,
  },
  section: {
    marginTop: spacing.s6,
  },
  sectionGap: {
    marginTop: spacing.s2,
  },
  foodRow: {
    flexDirection: 'row',
    gap: spacing.s4,
    marginTop: spacing.s2,
    paddingBottom: spacing.s1,
  },
  foodItem: {
    alignItems: 'center',
    gap: spacing.s1,
    minWidth: 64,
  },
  foodEmpty: {
    paddingVertical: spacing.s3,
  },
  foodName: {
    ...type.caption,
    color: colors.ink2,
  },
  dishList: {
    gap: spacing.s3,
  },
  errorBox: {
    marginTop: spacing.s4,
    marginHorizontal: pagePad,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
