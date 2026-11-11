/** 菜品横幅卡(§6 菜品横幅):季粉彩渐变横幅 h92 + 墨衬线菜名 + 白底千卡胶囊 + 季色大字水印,
 *  下段出品厨师徽章 + 做法摘要。整卡热区,推入详情。 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChefBadge } from '@/components/brand';
import { parseCalories, seasonOfTerm } from '@/domain/solar-terms';
import { parseStyle, splitList } from '@/utils/text';
import type { Dish } from '@/api/types';
import { colors, seasons } from '@/theme/tokens';
import { radius, shadows, spacing, tabularNums, type } from '@/theme/theme';

export interface DishCardProps {
  dish: Dish;
  onPress: () => void;
}

export function DishCard({ dish, onPress }: DishCardProps) {
  const terms = splitList(dish.solar_terms);
  const season = seasonOfTerm(terms[0] ?? '');
  const palette = seasons[season];
  const calories = parseCalories(dish.calories);
  const { method } = parseStyle(dish.style);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看菜品 ${dish.name}`}
      onPress={onPress}
      style={({ pressed }) => [statics.card, pressed && { opacity: 0.92 }]}
    >
      <View style={[statics.bannerWrap, shadows.card.android]}>
        <LinearGradient
          colors={palette.panel}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* 季色大字水印(装饰,首字) */}
        <Text style={[statics.watermark, { color: palette.deep }]} aria-hidden>
          {dish.name.slice(0, 1)}
        </Text>
        <View style={statics.bannerBody}>
          <Text style={statics.name} numberOfLines={1}>
            {dish.name}
          </Text>
          <View style={statics.bannerMeta}>
            <ChefBadge category={dish.category} />
            {!!calories && (
              <View style={statics.calChip}>
                <Text style={statics.calText}>{calories} 千卡/份</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <View style={statics.body}>
        <Text style={statics.summary} numberOfLines={1}>
          {method ? `${method} · ` : ''}
          {splitList(dish.main_ingredients)[0] ?? ''} 等主料
        </Text>
        <Text style={statics.terms} numberOfLines={1}>
          当令:{terms.join('、')}
        </Text>
      </View>
    </Pressable>
  );
}

const statics = StyleSheet.create({
  card: {
    borderRadius: radius.m,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  bannerWrap: {
    height: 92,
    justifyContent: 'center',
    padding: spacing.s4,
    overflow: 'hidden',
  },
  bannerBody: {
    gap: spacing.s2,
  },
  watermark: {
    position: 'absolute',
    right: 12,
    top: -18,
    fontSize: 84,
    lineHeight: 110,
    fontWeight: '700',
    opacity: 0.16,
  },
  name: {
    ...type.serifTitle,
    color: colors.ink,
  },
  bannerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
  },
  calChip: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  calText: {
    ...tabularNums,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.ink,
  },
  /** 文字区固定高 78:名称/摘要/节气各 1 行,溢出截断(列表高度恒定,完整信息在详情) */
  body: {
    height: 78,
    padding: spacing.s3,
    gap: 2,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  summary: {
    ...type.body,
    color: colors.ink2,
  },
  terms: {
    ...type.caption,
    color: colors.ink3,
  },
});
