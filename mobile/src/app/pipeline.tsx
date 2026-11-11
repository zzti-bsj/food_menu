/** 食材流水线(工坊 push,对照 pipeline.html):
 *  block「为哪个节气补货?(默认当前 ±2)」±2 快捷 chips + 「全部 24 节气 ⌄」展开;
 *  运行后 steps-card 五行 stepper(绿点 + 动态 s-note 药丸)+ res-group 三分组
 *  (入库名称药丸带 mini 签牌 / 存疑 notice-card / 失败明细)。 */
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ChevronRightIcon } from '@/components/icons';
import { runBatch, type BatchResult } from '@/api/workshop-api';
import { ApiError } from '@/api/client';
import { SEASON_TERMS, currentTerm, nearbyTerms } from '@/domain/solar-terms';
import { colors, functional, seasons, activeSeason } from '@/theme/tokens';
import { fontDisplay, pagePad, radius, shadows, spacing, tabularNums, type } from '@/theme/theme';

const spring = seasons.spring;
const accent = seasons[activeSeason];

const ALL_LABEL = '全部 24 节气';

/** 五步文案(设计稿原文);s-note 数值由批次结果动态填充 */
const STEPS: { title: string; desc: string }[] = [
  { title: '推荐食材', desc: '节气词表 + 时令口径,LLM 推荐候选' },
  { title: '填充档案', desc: '性味归经、功效、当令节气逐字段生成' },
  { title: '结构校验', desc: '字段类型 + 词表值域逐项核对' },
  { title: '事实核验', desc: '三态判定:pass / fail / 存疑' },
  { title: '入库待审核', desc: '直接入库 + 存疑入库(标注存疑点)' },
];

export default function PipelineScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = currentTerm();
  const near: string[] = nearbyTerms(now);

  const [term, setTerm] = useState<string>(now);
  const [showAll, setShowAll] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      setResult(await runBatch(term));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '网络连接失败,请检查网络后重试');
    } finally {
      setRunning(false);
    }
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

      {/* Step 1 · 选节气 */}
      <Text style={statics.blockLabel}>为哪个节气补货?(默认当前 ±2)</Text>
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
      <View style={statics.runWrap}>
        <PrimaryButton label={`运行流水线 · ${term}`} loading={running} onPress={run} />
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={[type.caption, { color: functional.danger, marginTop: spacing.s2 }]}>
          {error}
        </Text>
      )}

      {/* 运行进度(steps-card;完成态展示) */}
      {result && (
        <>
          <View style={[statics.stepsCard, shadows.card.android]}>
            {STEPS.map((s, i) => (
              <View key={s.title} style={[statics.stepRow, i === STEPS.length - 1 && statics.stepRowLast]}>
                <View style={[statics.stepDot, i === STEPS.length - 1 && { backgroundColor: accent.main }]}>
                  <Text style={statics.stepDotText}>{i + 1}</Text>
                </View>
                <View style={statics.stepGrow}>
                  <Text style={statics.stepTitle}>{s.title}</Text>
                  <Text style={statics.stepDesc}>{s.desc}</Text>
                </View>
                <View style={statics.stepNote}>
                  <Text style={statics.stepNoteText}>{stepNotes[i]}</Text>
                </View>
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
        selected && { backgroundColor: accent.main, borderColor: accent.main },
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
      {children}
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
  blockLabel: {
    ...type.caption,
    color: colors.ink3,
    marginBottom: spacing.s2,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  allWrap: {
    marginTop: spacing.s2,
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
    marginTop: spacing.s4,
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.s4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.s3,
    paddingBottom: 18,
    position: 'relative',
  },
  stepRowLast: {
    paddingBottom: 0,
  },
  stepDot: {
    width: 27,
    height: 27,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: spring.main,
    zIndex: 1,
  },
  stepDotText: {
    ...tabularNums,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    color: colors.surface,
  },
  stepGrow: {
    flex: 1,
    minWidth: 0,
  },
  stepTitle: {
    ...type.body,
    fontWeight: '700',
    color: colors.ink,
  },
  stepDesc: {
    ...type.caption,
    color: colors.ink3,
    marginTop: 2,
    lineHeight: 19,
  },
  stepNote: {
    alignSelf: 'center',
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
    marginTop: spacing.s4,
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
  nameChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  nameChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.s3,
    marginBottom: spacing.s2,
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
