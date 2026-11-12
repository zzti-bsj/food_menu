/** 工坊(Tab 4)—— 对照 workshop.html:印章衬线页题 + 两张粉彩入口大卡(春·食材流水线 / 秋·菜品生成+贴纸)
 *  + 最近批次白卡(药丸 chips)+ 审核待办白卡。定位:单件流转;大批量走桌面审核台。 */
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanelPop, Seal, Sticker } from '@/components/brand';
import { BowlIcon, ChevronRightIcon, LeafLineIcon } from '@/components/icons';import { listDishGroups, listIngredientGroups } from '@/api/content-api';
import { useAsync } from '@/hooks/use-async';
import { useAuth } from '@/auth/auth-context';
import { currentTerm, type SeasonKey } from '@/domain/solar-terms';
import type { Dish, Ingredient } from '@/api/types';
import { brand, colors, functional, seasons, activeSeason } from '@/theme/tokens';
import { fontDisplay, pagePad, radius, shadows, spacing, tabularNums, type, z } from '@/theme/theme';

export default function WorkshopScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  // 待办口径 = 「你能审的」:admin 全量;登录用户仅自己名下;未登录无可审(0)
  const { data: reviewCounts, reload: reloadCounts } = useAsync(async () => {
    const [ing, dish] = await Promise.all([listIngredientGroups(), listDishGroups()]);
    const isAdmin = user?.role === 'admin';
    const mine = <T extends { user_id: number | null }>(rows: T[]): T[] =>
      rows.filter((r) => isAdmin || r.user_id === user?.id);
    const pendingDishes = mine(dish.待审核);
    const pendingIngredients = mine(ing.待审核);
    return {
      pendingTotal: pendingIngredients.length + pendingDishes.length,
      withDoubts: pendingDishes.filter((d) => !!d.remark).length,
    };
  }, [user?.id, user?.role]);
  const todoHot = (reviewCounts?.pendingTotal ?? 0) > 0;
  // 聚焦即重拉:审核/生成后返回本页数据即时生效
  useFocusEffect(useCallback(() => { reloadCounts(); }, [reloadCounts]));

  return (
    <ScrollView
      contentContainerStyle={[statics.content, { paddingTop: insets.top + spacing.s4, paddingBottom: 122 + insets.bottom }]}
    >
      {/* 页题:朱砂印章「坊」+ 衬线大字(设计稿 .page-title) */}
      <View style={statics.titleRow}>
        <Seal char="坊" small />
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
                按节气批量推荐当令食材并生成档案
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
                健康厨师 · 减脂低卡线|美食大厨 · 菜系线
              </Text>
            </View>
            <ChevronRightIcon size={20} color={colors.ink3} />
          </View>
        </PanelPop>
      </Pressable>

      {/* 审核待办:有待办 = 秋琥珀淡底(待审核语义色);无 = 普通白卡 */}
      <View
        style={[
          statics.statCard,
          shadows.card.android,
          todoHot && statics.todoCardHot,
        ]}
      >
        <View style={statics.statHead}>
          <View style={statics.urgentTitleRow}>
            <Text style={statics.statTitle}>审核待办</Text>
            {(reviewCounts?.pendingTotal ?? 0) > 0 && (
              <View style={statics.urgentBadge}>
                <Text style={statics.urgentBadgeText}>{reviewCounts!.pendingTotal}</Text>
              </View>
            )}
          </View>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/review')}
            style={statics.statLink}
          >
            <Text style={[statics.statLinkText, todoHot && { color: seasons.autumn.deep }]}>去审核</Text>
            <ChevronRightIcon size={12} color={todoHot ? seasons.autumn.deep : accent.deep} />
          </Pressable>
        </View>
        {reviewCounts ? (
          <View style={statics.chipRow}>
            <Pill tone="seal" label="待审核" count={reviewCounts.pendingTotal} suffix="条" />
            {reviewCounts.withDoubts > 0 && (
              <Pill tone="warn" label={`含存疑 ${reviewCounts.withDoubts}`} />
            )}
          </View>
        ) : (
          <Text style={[type.caption, { color: colors.ink3 }]}>统计加载中…</Text>
        )}
      </View>

    </ScrollView>
  );
}

/** 状态药丸(设计稿 .stat-chip;seal 朱砂底+冰蓝数字 / info 蓝 / ok 绿 / warn 琥珀 / bad 红)。
 *  朱砂药丸的红蓝配:数字用冬季淡蓝(#E2F0FA,对朱砂 5.6:1),正文白字。 */
function Pill({
  tone,
  label,
  count,
  suffix,
}: {
  tone?: 'seal' | 'info' | 'ok' | 'warn' | 'bad';
  label: string;
  /** 数字段(seal 态冰蓝高亮) */
  count?: number;
  suffix?: string;
}) {
  const toneMap = {
    seal: { bg: brand.seal, fg: colors.surface },
    info: { bg: seasons.winter.soft, fg: seasons.winter.deep },
    ok: { bg: seasons.spring.soft, fg: seasons.spring.deep },
    warn: { bg: seasons.autumn.soft, fg: seasons.autumn.deep },
    bad: { bg: functional.dangerSoft, fg: functional.danger },
  } as const;
  const t = tone ? toneMap[tone] : null;
  return (
    <View style={[statics.pill, t && { backgroundColor: t.bg, borderColor: t.bg }]}>
      {count === undefined ? (
        <Text style={[statics.pillText, t && { color: t.fg }]}>{label}</Text>
      ) : (
        <Text style={[statics.pillText, t && { color: t.fg }]}>
          {label}{' '}
          <Text style={[tabularNums, statics.pillCount, { color: seasons.winter.soft }]}>{count}</Text>
          {suffix ? ` ${suffix}` : ''}
        </Text>
      )}
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
    marginBottom: spacing.s5,
  },
  pageTitle: {
    fontFamily: fontDisplay,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: 1,
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
  /** 有待办:秋琥珀淡底(待审核语义色,不做大色块) */
  todoCardHot: {
    backgroundColor: seasons.autumn.soft,
    borderColor: seasons.autumn.soft,
  },
  urgentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
  },
  urgentBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: seasons.autumn.main,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  urgentBadgeText: {
    ...tabularNums,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: colors.surface,
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
  /** 朱砂药丸的冰蓝数字(红蓝配,对比 5.6:1) */
  pillCount: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
});
