/** 食材流水线(工坊 push,对照 pipeline.html + v1.2 品牌语言):
 *  春粉彩 Hero(「为哪个节气补货?」+ 白底 chips + 星光)→ 运行按钮;
 *  结果 = 五步时间线 stepper(连线 + 同色影圆点 + 动态 s-note 药丸)+ 三分组白卡
 *  (入库名称药丸带 mini 签牌 / 存疑 notice-card / 失败明细)。 */
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanelPop, Sparkle } from '@/components/brand';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ChevronRightIcon } from '@/components/icons';
import { startBatchJob, type BatchResult } from '@/api/workshop-api';
import { useGenerationJob } from '@/hooks/use-generation-job';
import { SEASON_TERMS, currentTerm, nearbyTerms } from '@/domain/solar-terms';
import { colors, functional, seasons, activeSeason } from '@/theme/tokens';
import { fontDisplay, pagePad, radius, shadows, spacing, tabularNums, type } from '@/theme/theme';

const spring = seasons.spring;
const accent = seasons[activeSeason];

const ALL_LABEL = '全部 24 节气';

/** 五步文案(设计稿原文);s-note 数值由批次结果动态填充 */
const STEPS = ['推荐食材', '填充档案', '结构校验', '事实核验', '入库待审核'];

export default function PipelineScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = currentTerm();
  const near: string[] = nearbyTerms(now);

  const [term, setTerm] = useState<string>(now);
  const [showAll, setShowAll] = useState(false);
  // 生成走服务端异步作业:切后台/锁屏不中断,回本页自动接续
  const { running, error, result, start } = useGenerationJob<BatchResult>('pipeline');

  function run() {
    start(() => startBatchJob(term));
  }

  const failedInvalid = (result?.failed ?? []).filter((f) => f.stage === 'invalid').length;
  const failedOther = (result?.failed ?? []).filter((f) => f.stage !== 'invalid').length;
  const doubtsCount = Object.keys(result?.doubts ?? {}).length;
  const stepNotes = result
    ? [
        `${result.recommended.length} 候选`,
        `${result.recommended.length}/${result.recommended.length}`,
        `${result.recommended.length - failedInvalid - failedOther} 过 · ${failedInvalid + failedOther} 打回`,
        doubtsCount > 0 ? `存疑 ${doubtsCount}` : '全过',
        `${result.inserted.length} + ${doubtsCount} 存疑`,
      ]
    : [];

  const allTerms = [...SEASON_TERMS.spring, ...SEASON_TERMS.summer, ...SEASON_TERMS.autumn, ...SEASON_TERMS.winter];
  const quickTerms = near.filter((t) => t !== now).slice(0, 4);

  return (
    <ScrollView contentContainerStyle={[statics.content, { paddingTop: insets.top + spacing.s2, paddingBottom: 60 + insets.bottom }]}>
      <View style={statics.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回工坊"
          hitSlop={8}
          onPress={() => (router.canDismiss() ? router.back() : router.replace('/'))}
          style={statics.back}
        >
          <Text style={statics.backIcon}>‹</Text>
        </Pressable>
        <Text style={statics.screenTitle}>食材流水线</Text>
        <View style={statics.back} />
      </View>

      {/* 春粉彩 Hero:选节气(chips 白底描边,面板语言 §2.6)+ 星光 */}
      <PanelPop season="spring">
        <View style={statics.hero}>
          <View style={statics.heroHead}>
            <View style={statics.heroGrow}>
              <Text style={statics.heroTitle}>为哪个节气补货?</Text>
              <Text style={statics.heroSub}>按节气批量推荐当令食材,生成档案入库待审核</Text>
            </View>
            <Sparkle size={20} />
          </View>
          <View style={statics.chipWrap}>
            {quickTerms.map((t) => (
              <Chip key={t} label={t} selected={term === t} onPress={() => setTerm(t)} />
            ))}
            <Chip label={`${now} · 今`} selected={term === now} onPress={() => setTerm(now)} />
            <Chip label={ALL_LABEL} selected={showAll} onPress={() => setShowAll((s) => !s)} chevron />
          </View>
          {showAll && (
            <View style={[statics.chipWrap, statics.allWrap]}>
              {allTerms.map((t) => (
                <Chip key={t} label={t} selected={term === t} onPress={() => setTerm(t)} />
              ))}
            </View>
          )}
        </View>
      </PanelPop>

      <View style={statics.runWrap}>
        <PrimaryButton
          label={`运行流水线 · ${term}`}
          loading={running}
          onPress={run}
          from={spring.main}
          to={spring.deep}
          shadowColor={spring.deep}
        />
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={[type.caption, { color: functional.danger, marginTop: spacing.s2 }]}>
          {error}
        </Text>
      )}

      {/* 运行进度:五步时间线(连线 + 序号圆 + 动态药丸) */}
      {result && (
        <>
          <View style={[statics.stepsCard, shadows.card.android]}>
            {STEPS.map((s, i) => (
              <View key={s} style={statics.stepRow}>
                <View style={statics.stepRail}>
                  <View style={[statics.stepDot, i === STEPS.length - 1 && { backgroundColor: accent.main }]}>
                    <Text style={statics.stepDotText}>{i + 1}</Text>
                  </View>
                  {i < STEPS.length - 1 && <View style={statics.stepLine} />}
                </View>
                <Text style={statics.stepTitle}>{s}</Text>
                <View style={statics.stepSpring} />
                {stepNotes[i] !== undefined && (
                  <View style={statics.stepNote}>
                    <Text style={statics.stepNoteText}>{stepNotes[i]}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* 入库待审核 */}
          <ResGroup head="入库待审核" count={result.inserted.length} tone="ok">
            <View style={statics.nameChips}>
              {result.inserted.map((name) => (
                <View key={name} style={statics.nameChip}>
                  <View style={[statics.mini, { backgroundColor: spring.main }]}>
                    <Text style={[statics.miniText, { color: colors.surface }]}>{name.slice(0, 1)}</Text>
                  </View>
                  <Text style={statics.nameChipText}>{name}</Text>
                </View>
              ))}
              {result.inserted.length === 0 && <Text style={statics.emptyText}>本批次无直接入库</Text>}
            </View>
          </ResGroup>

          {/* 存疑入库 */}
          <ResGroup head="存疑入库" count={doubtsCount} tone="warn">
            {Object.entries(result.doubts ?? {}).map(([name, doubts]) => (
              <View key={name} style={statics.noticeCard}>
                <Text style={statics.noticeName}>{name}</Text>
                <Text style={statics.noticeText}>{normalize(doubts)}</Text>
              </View>
            ))}
            {doubtsCount === 0 && <Text style={statics.emptyText}>本批次无存疑</Text>}
          </ResGroup>

          {/* 失败 */}
          <ResGroup head="失败" count={(result.failed ?? []).length} tone="bad">
            {(result.failed ?? []).map((f, i) => (
              <View key={`${f.name}-${i}`} style={statics.noticeCard}>
                <Text style={statics.noticeName}>
                  {f.name} · {f.stage}
                </Text>
                {(f.errors ?? f.problems) && (
                  <Text style={statics.noticeText}>{(f.errors ?? f.problems ?? []).join(';')}</Text>
                )}
              </View>
            ))}
            {(result.failed ?? []).length === 0 && <Text style={statics.emptyText}>本批次无失败</Text>}
          </ResGroup>
        </>
      )}
    </ScrollView>
  );
}

/** 存疑点归一:后端可能给数组或字符串 */
function normalize(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join(';');
  return String(v ?? '');
}

/** 面板内 chip:白底描边(§2.6 面板语言);选中 = 季主色实底白字 */
function Chip({
  label,
  selected,
  chevron,
  onPress,
}: {
  label: string;
  selected: boolean;
  chevron?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        statics.termChip,
        selected && { backgroundColor: spring.main, borderColor: spring.main },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[statics.termText, selected && { color: colors.surface }]}>{label}</Text>
      {chevron && (
        <ChevronRightIcon size={12} color={selected ? colors.surface : colors.ink3} />
      )}
    </Pressable>
  );
}

/** 结果分组:标题 + 计数药丸 + 白卡内容容器 */
function ResGroup({
  head,
  count,
  tone,
  children,
}: {
  head: string;
  count: number;
  tone: 'ok' | 'warn' | 'bad';
  children: ReactNode;
}) {
  const toneMap = {
    ok: { bg: seasons.spring.soft, fg: seasons.spring.deep },
    warn: { bg: seasons.autumn.soft, fg: seasons.autumn.deep },
    bad: { bg: functional.dangerSoft, fg: functional.danger },
  } as const;
  const t = toneMap[tone];
  return (
    <View style={statics.resGroup}>
      <View style={statics.resHead}>
        <Text style={statics.resHeadText}>{head}</Text>
        <View style={[statics.countPill, { backgroundColor: t.bg }]}>
          <Text style={[tabularNums, statics.countPillText, { color: t.fg }]}>{count}</Text>
        </View>
      </View>
      <View style={[statics.resBody, shadows.card.android]}>{children}</View>
    </View>
  );
}

const statics = StyleSheet.create({
  content: {
    backgroundColor: colors.bg,
    paddingHorizontal: pagePad,
    paddingBottom: 40,
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
  screenTitle: {
    fontFamily: fontDisplay,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    color: colors.ink,
  },
  hero: {
    padding: spacing.s5,
    gap: spacing.s3,
  },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.s3,
  },
  heroGrow: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  heroTitle: {
    fontFamily: fontDisplay,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.ink,
  },
  heroSub: {
    ...type.caption,
    lineHeight: 18,
    color: colors.ink2,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  allWrap: {
    marginTop: spacing.s1,
  },
  termChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  termText: {
    ...type.caption,
    fontWeight: '600',
    color: colors.ink2,
  },
  runWrap: {
    marginTop: spacing.s3,
  },
  stepsCard: {
    marginTop: spacing.s5,
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.s4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    minHeight: 40,
  },
  stepRail: {
    alignItems: 'center',
    width: 27,
    alignSelf: 'stretch',
  },
  stepDot: {
    width: 27,
    height: 27,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: spring.main,
    shadowColor: spring.deep,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
    zIndex: 1,
  },
  stepDotText: {
    ...tabularNums,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    color: colors.surface,
  },
  stepLine: {
    flex: 1,
    width: 2,
    marginVertical: 2,
    borderRadius: 1,
    backgroundColor: colors.line,
  },
  stepTitle: {
    ...type.body,
    fontWeight: '700',
    color: colors.ink,
  },
  stepSpring: {
    flex: 1,
  },
  stepNote: {
    backgroundColor: spring.soft,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    flexShrink: 0,
  },
  stepNoteText: {
    ...tabularNums,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: spring.deep,
  },
  resGroup: {
    marginTop: spacing.s5,
  },
  resHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.s2,
  },
  resHeadText: {
    ...type.body,
    fontWeight: '700',
    color: colors.ink,
  },
  countPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  countPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  resBody: {
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.s3,
    gap: spacing.s2,
  },
  nameChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  nameChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bg,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
  },
  mini: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniText: {
    fontFamily: fontDisplay,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  nameChipText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: colors.ink,
  },
  noticeCard: {
    backgroundColor: colors.surface2,
    borderRadius: radius.s,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.s3,
    gap: 2,
  },
  noticeName: {
    ...type.body,
    fontWeight: '600',
    color: colors.ink,
  },
  noticeText: {
    ...type.caption,
    color: colors.ink3,
    lineHeight: 18,
  },
  emptyText: {
    ...type.caption,
    color: colors.ink3,
  },
});
