/** 工坊(Tab 4)—— 对照 workshop.html:印章衬线页题 + 两张粉彩入口大卡(春·食材流水线 / 秋·菜品生成+贴纸)
 *  + 最近批次白卡(药丸 chips)+ 审核待办白卡。定位:单件流转;大批量走桌面审核台。 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanelPop, Seal, Sticker } from '@/components/brand';
import { BowlIcon, ChevronRightIcon, LeafLineIcon } from '@/components/icons';
import { getLastBatch } from '@/api/workshop-api';
import { listDishGroups, listIngredientGroups } from '@/api/content-api';
import { useAsync } from '@/hooks/use-async';
import { currentTerm, type SeasonKey } from '@/domain/solar-terms';
import type { Dish } from '@/api/types';
import { colors, functional, seasons, activeSeason } from '@/theme/tokens';
import { fontDisplay, pagePad, radius, shadows, spacing, tabularNums, type, z } from '@/theme/theme';

export default function WorkshopScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: lastBatch } = useAsync(getLastBatch, []);
  const { data: reviewCounts } = useAsync(async () => {
    const [ing, dish] = await Promise.all([listIngredientGroups(), listDishGroups()]);
    const pendingDishes = dish.待审核;
    return {
      pendingTotal: ing.待审核.length + pendingDishes.length,
      pendingIng: ing.待审核.length,
      pendingDish: pendingDishes.length,
      withDoubts: pendingDishes.filter((d: Dish) => !!d.remark).length,
    };
  }, []);

  const batch = lastBatch;

  return (
    <ScrollView
      contentContainerStyle={[statics.content, { paddingTop: insets.top + spacing.s4, paddingBottom: 122 + insets.bottom }]}
    >
      {/* 页题:朱砂印章「坊」+ 衬线大字(设计稿 .page-title) */}
      <View style={statics.titleRow}>
        <Seal char="坊" />
        <Text style={statics.pageTitle}>工坊</Text>
      </View>

      {/* 食材流水线入口(panel-pop spring 大卡) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="食材流水线"
        onPress={() => router.push('/pipeline')}
        style={({ pressed }) => [statics.pipeWrap, pressed && statics.pipePressed]}
      >
        <PanelPop season="spring">
          <View style={statics.pipeCard}>
            <View style={statics.pipeIcon}>
              <LeafLineIcon size={26} color={seasons.spring.deep} />
            </View>
            <View style={statics.pipeGrow}>
              <Text style={statics.pipeTitle}>食材流水线</Text>
              <Text style={statics.pipeSub}>
                选一个节气,批量推荐食材并生成档案{'\n'}推荐 → 填充 → 校验 → 核验 → 入库待审核
              </Text>
            </View>
            <ChevronRightIcon size={20} color={colors.ink3} />
          </View>
        </PanelPop>
      </Pressable>

      {/* 菜品生成入口(panel-pop autumn 大卡 + 贴纸「双厨师」卡内右上) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="菜品生成"
        onPress={() => router.push('/dish-generate')}
        style={({ pressed }) => [statics.pipeWrap, pressed && statics.pipePressed]}
      >
        <PanelPop season="autumn">
          <View style={statics.pipeCard}>
            <View style={statics.pipeIcon}>
              <BowlIcon size={26} color={seasons.autumn.deep} />
            </View>
            <View style={statics.pipeGrow}>
              {/* 标题行:标题 + 贴纸内联右置(绝对定位在 web 端渲染不稳定,弃用) */}
              <View style={statics.titleInline}>
                <Text style={statics.pipeTitle}>菜品生成</Text>
                <Sticker label="双厨师" />
              </View>
              <Text style={statics.pipeSub}>
                健康厨师 · 减脂低卡线|美食大厨 · 菜系线{'\n'}生成 → 校验 → 核验 → 入库待审核
              </Text>
            </View>
            <ChevronRightIcon size={20} color={colors.ink3} />
          </View>
        </PanelPop>
      </Pressable>

      {/* 最近批次(白卡 + 药丸 chips) */}
      <View style={[statics.statCard, shadows.card.android]}>
        <View style={statics.statHead}>
          <Text style={statics.statTitle}>
            最近批次{batch ? ` · ${batch.term}` : ''}
          </Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/pipeline')}
            style={statics.statLink}
          >
            <Text style={statics.statLinkText}>查看</Text>
            <ChevronRightIcon size={12} color={accent.deep} />
          </Pressable>
        </View>
        {batch ? (
          <View style={statics.chipRow}>
            <Pill tone="info" label={`推荐 ${batch.recommended.length} 个候选`} />
            <Pill tone="ok" label={`入库 ${batch.inserted.length}`} />
            <Pill tone="warn" label={`存疑 ${Object.keys(batch.doubts ?? {}).length}`} />
            <Pill tone="bad" label={`失败 ${(batch.failed ?? []).length}`} />
          </View>
        ) : (
          <Text style={[type.caption, { color: colors.ink3 }]}>
            本轮服务启动后还没有跑过批次,从上方流水线开始
          </Text>
        )}
      </View>

      {/* 审核待办(白卡) */}
      <View style={[statics.statCard, shadows.card.android]}>
        <View style={statics.statHead}>
          <Text style={statics.statTitle}>审核待办</Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/review')}
            style={statics.statLink}
          >
            <Text style={statics.statLinkText}>去审核</Text>
            <ChevronRightIcon size={12} color={accent.deep} />
          </Pressable>
        </View>
        {reviewCounts ? (
          <View style={statics.chipRow}>
            <Pill tone="info" label={`待审核 ${reviewCounts.pendingTotal} 条`} />
            <Pill label={`食材 ${reviewCounts.pendingIng} · 菜品 ${reviewCounts.pendingDish}`} />
            {reviewCounts.withDoubts > 0 && (
              <Pill tone="warn" label={`含存疑 ${reviewCounts.withDoubts}`} />
            )}
          </View>
        ) : (
          <Text style={[type.caption, { color: colors.ink3 }]}>统计加载中…</Text>
        )}
      </View>

      <Text style={[type.caption, statics.hint, { color: colors.ink3 }]}>
        最近批次对应 GET /api/batch/last;工坊覆盖单件流转与快速处理,大批量作业建议使用桌面端审核台
      </Text>
    </ScrollView>
  );
}

/** 状态药丸(设计稿 .stat-chip;sc-info 蓝 / sc-ok 绿 / sc-warn 琥珀 / sc-bad 红 / 默认透明) */
function Pill({ tone, label }: { tone?: 'info' | 'ok' | 'warn' | 'bad'; label: string }) {
  const toneMap = {
    info: { bg: seasons.winter.soft, fg: seasons.winter.deep },
    ok: { bg: seasons.spring.soft, fg: seasons.spring.deep },
    warn: { bg: seasons.autumn.soft, fg: seasons.autumn.deep },
    bad: { bg: functional.dangerSoft, fg: functional.danger },
  } as const;
  const t = tone ? toneMap[tone] : null;
  return (
    <View style={[statics.pill, t && { backgroundColor: t.bg }]}>
      <Text style={[statics.pillText, t && { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const accent = seasons[activeSeason as SeasonKey];

const statics = StyleSheet.create({
  content: {
    backgroundColor: colors.bg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    paddingHorizontal: pagePad,
    marginBottom: spacing.s4,
  },
  pageTitle: {
    fontFamily: fontDisplay,
    fontSize: 28,
    lineHeight: 38,
    fontWeight: '600',
    letterSpacing: 2,
    color: colors.ink,
  },
  pipeWrap: {
    paddingHorizontal: pagePad,
    marginBottom: spacing.s3,
  },
  pipePressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  pipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s4,
    padding: spacing.s5,
    /** 贴纸绝对定位的显式锚点(web 端不依赖默认 containing block) */
    position: 'relative',
  },
  pipeIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#26231C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  pipeGrow: {
    flex: 1,
    minWidth: 0,
  },
  titleInline: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  pipeTitle: {
    fontFamily: fontDisplay,
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.ink,
    flexShrink: 1,
  },
  pipeSub: {
    ...type.caption,
    color: colors.ink3,
    lineHeight: 19,
    marginTop: 3,
  },
  statCard: {
    marginHorizontal: pagePad,
    marginBottom: spacing.s3,
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.s4,
  },
  statHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.s3,
  },
  statTitle: {
    ...type.body,
    fontWeight: '700',
    color: colors.ink,
  },
  statLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingLeft: 8,
  },
  statLinkText: {
    ...type.caption,
    fontWeight: '700',
    color: accent.deep,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  pillText: {
    ...tabularNums,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  hint: {
    paddingHorizontal: pagePad,
    marginTop: spacing.s2,
    lineHeight: 19,
  },
});
