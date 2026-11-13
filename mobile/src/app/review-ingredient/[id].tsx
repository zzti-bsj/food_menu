/** 食材审核详情(工坊 push,对照 review-ingredient.html + v1.2 品牌语言):
 *  季粉彩 Hero(四气徽章 + 衬线名 + 别名 + 功效 chips + 星光)+ 词表值域校验标记 +
 *  性味归经卡 / 当令节气带 / 食用注意 / 典籍引文 + 吸底「驳回 / 通过(绿)」。 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NatureBadge, OrnDivider, PanelPop, QuoteCard, Sparkle } from '@/components/brand';
import { SectionLabel } from '@/components/ui/section-label';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useToast } from '@/components/ui/toast';
import { getIngredient } from '@/api/content-api';
import { setIngredientStatus } from '@/api/workshop-api';
import { useAsync } from '@/hooks/use-async';
import { splitList } from '@/utils/text';
import { currentTerm, nearbyTerms, seasonOfTerm } from '@/domain/solar-terms';
import { ApiError } from '@/api/client';
import { colors, flavorTints, functional, seasons } from '@/theme/tokens';
import { fontDisplay, pagePad, radius, shadows, spacing, type } from '@/theme/theme';

/** 词表值域(§10 对齐 db CHECK / validate.py);越界值标记 ⚠ */
const NATURE_VOCAB = ['寒', '微寒', '凉', '平', '微温', '温', '热'];
const FLAVOR_VOCAB = ['酸', '苦', '甘', '辛', '咸', '淡', '涩'];
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
  const terms = splitList(item.solar_terms);
  const season = seasonOfTerm(terms[0] ?? '');
  const near: string[] = nearbyTerms(currentTerm());

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
          <Text style={[type.serifTitle, { color: colors.ink }]} numberOfLines={1}>食材复审</Text>
          <View style={statics.back} />
        </View>

        {/* 季粉彩 Hero */}
        <PanelPop season={season}>
          <View style={statics.hero}>
            <View style={statics.heroTopRow}>
              <NatureBadge nature={item.nature} />
              <View style={statics.heroSpring} />
              <Sparkle size={18} />
            </View>
            <Text style={statics.heroName}>{item.name}</Text>
            {!!item.aliases && (
              <Text style={statics.heroAliases}>别名 {splitList(item.aliases).join('、')}</Text>
            )}
            {benefits.length > 0 && (
              <View style={statics.heroChips}>
                {benefits.map((b) => (
                  <View key={b} style={statics.benefitChip}>
                    <Text style={statics.benefitText}>{b}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </PanelPop>

        {/* 词表值域校验标记 */}
        {!natureOk && <Text style={statics.vocabWarn}>⚠ 四气「{item.nature}」不在七档词表</Text>}
        {!flavorOk && (
          <Text style={statics.vocabWarn}>
            ⚠ 五味含词表外值:{flavors.filter((f) => !FLAVOR_VOCAB.includes(f)).join('、')}
          </Text>
        )}

        {/* 性味归经 */}
        <SectionLabel label="性味归经" style={statics.sectionGap} />
        <View style={[statics.card, statics.padBox]}>
          <View style={statics.infoRow}>
            <Text style={statics.infoKey}>分类</Text>
            <NeutralChips items={splitList(item.category)} />
          </View>
          <View style={statics.infoRow}>
            <Text style={statics.infoKey}>五味</Text>
            <FlavorChips items={flavors} />
          </View>
          <View style={statics.infoRow}>
            <Text style={statics.infoKey}>归经</Text>
            <NeutralChips items={splitList(item.meridian).map((m) => `${m}经`)} />
          </View>
          <View style={[statics.infoRow, statics.infoRowLast]}>
            <Text style={statics.infoKey}>时令</Text>
            <Text style={statics.infoValue}>{item.season_note ?? terms.join('、')}</Text>
          </View>
        </View>

        {/* 当令节气带(当令 ±2 淡季底 / 当前节气实底) */}
        <SectionLabel label="当令节气" style={statics.sectionGap} />
        <View style={statics.termBand}>
          {terms.map((t) => {
            const isNear = near.includes(t);
            const isCurrent = t === currentTerm();
            const s = seasons[seasonOfTerm(t)];
            return (
              <View
                key={t}
                style={[
                  statics.termChip,
                  isNear && !isCurrent && { backgroundColor: s.soft, borderColor: s.soft },
                  isCurrent && { backgroundColor: s.main, borderColor: s.main },
                ]}
              >
                <Text
                  style={[
                    statics.termChipText,
                    isNear && !isCurrent && { color: s.deep },
                    isCurrent && { color: colors.surface },
                  ]}
                >
                  {t}
                </Text>
              </View>
            );
          })}
        </View>

        {/* 食用注意 */}
        {!!item.caution && (
          <View style={statics.cautionBox}>
            <Text style={statics.cautionTitle}>⚠ 食用注意</Text>
            <Text style={statics.cautionText}>{item.caution}</Text>
          </View>
        )}

        {/* 典籍注脚 */}
        {!!item.classic_note && (
          <>
            <SectionLabel label="典籍注脚" style={statics.sectionGap} />
            <QuoteCard note={item.classic_note} />
          </>
        )}

        <View style={statics.orn}>
          <OrnDivider />
        </View>
        <Text style={[type.caption, { color: colors.ink3, marginTop: spacing.s3 }]}>
          ID {item.id} · {item.status}
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

/** 五味 chips:五脏五色淡底(有映射),淡/涩保持中性描边 */
function FlavorChips({ items }: { items: string[] }) {
  return (
    <View style={statics.neutralChips}>
      {items.map((f) => {
        const tint = flavorTints[f];
        return (
          <View
            key={f}
            style={[statics.neutralChip, tint && { backgroundColor: tint.bg, borderColor: tint.bg }]}
          >
            <Text style={[statics.neutralChipText, tint && { color: tint.fg }]}>{f}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** 中性描边 chip 组(§2.5 语言,分类/归经共用) */
function NeutralChips({ items }: { items: string[] }) {
  return (
    <View style={statics.neutralChips}>
      {items.map((label) => (
        <View key={label} style={statics.neutralChip}>
          <Text style={statics.neutralChipText}>{label}</Text>
        </View>
      ))}
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
  heroAliases: {
    ...type.caption,
    color: colors.ink2,
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
    marginTop: 2,
  },
  benefitChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.s,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  benefitText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors.ink2,
  },
  vocabWarn: {
    ...type.caption,
    color: functional.warning,
    marginTop: spacing.s2,
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    gap: spacing.s3,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoKey: {
    ...type.caption,
    fontWeight: '600',
    color: colors.ink3,
    width: 40,
  },
  infoValue: {
    ...type.body,
    color: colors.ink,
    flex: 1,
  },
  neutralChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s1,
    flex: 1,
  },
  neutralChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  neutralChipText: {
    ...type.caption,
    color: colors.ink2,
  },
  termBand: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  termChip: {
    borderRadius: radius.s,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  termChipText: {
    ...type.caption,
    color: colors.ink2,
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
