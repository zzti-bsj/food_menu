/** 菜品生成(工坊 push,对照 dish-generate.html v1.4.1 双厨师单入口):
 *  pool-card 内 chef-seg 分段(健康厨师=朱砂 / 美食大厨=琥珀,点选切换表单);
 *  健康厨师:候选食材 pick 药丸(可删)+ 添加输入;美食大厨:三模式面板;
 *  结果:stage 状态卡 + result-cover 粉彩封面(r-chips)+ f-card 落库字段预览(k/v 行)+ story 味卡。 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanelPop } from '@/components/brand';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/api/client';
import { listCuisines } from '@/api/content-api';
import { runCuisineChef, runDishChef } from '@/api/workshop-api';
import { useAsync } from '@/hooks/use-async';
import { parseStyle, splitList } from '@/utils/text';
import type { Dish } from '@/api/types';
import { brand, colors, functional, seasons, activeSeason } from '@/theme/tokens';
import { inputText, inputTextMultiline, fontDisplay, pagePad, radius, shadows, spacing, tabularNums, type } from '@/theme/theme';

const accent = seasons[activeSeason].main;

const summer = seasons.summer;

type Chef = 'health' | 'cuisine';
type CuisineMode = 'cuisine' | 'name' | 'ingredient';

export default function DishGenerateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { data: cuisines } = useAsync(listCuisines, []);

  const [chef, setChef] = useState<Chef>('health');
  // 健康厨师:候选食材池
  const [picked, setPicked] = useState<string[]>([]);
  const [pickInput, setPickInput] = useState('');
  // 美食大厨
  const [mode, setMode] = useState<CuisineMode>('cuisine');
  const [cuisine, setCuisine] = useState<string>('');
  const [nameInput, setNameInput] = useState('');
  const [modeIngredients, setModeIngredients] = useState<string[]>([]);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healthResult, setHealthResult] = useState<Awaited<ReturnType<typeof runDishChef>> | null>(null);
  const [cuisineResult, setCuisineResult] = useState<Awaited<ReturnType<typeof runCuisineChef>> | null>(null);

  /** 添加食材入池(去重保序) */
  function addPick(list: string[], value: string, setter: (v: string[]) => void, inputSetter: (v: string) => void) {
    const name = value.trim();
    if (!name) return;
    if (list.includes(name)) {
      toast.showToast('该食材已在候选池');
      inputSetter('');
      return;
    }
    setter([...list, name]);
    inputSetter('');
  }

  function removePick(list: string[], name: string, setter: (v: string[]) => void) {
    setter(list.filter((x) => x !== name));
  }

  async function generate() {
    setRunning(true);
    setError(null);
    try {
      if (chef === 'health') {
        if (picked.length === 0) {
          setError('请至少添加 1 项食材');
          return;
        }
        setHealthResult(await runDishChef(picked));
      } else {
        let payload: { cuisine?: string; name?: string; ingredients?: string[] };
        if (mode === 'cuisine') {
          if (!cuisine) {
            setError('请选择菜系');
            return;
          }
          payload = { cuisine };
        } else if (mode === 'name') {
          if (!nameInput.trim()) {
            setError('请输入菜名');
            return;
          }
          payload = { name: nameInput.trim() };
        } else {
          if (modeIngredients.length === 0) {
            setError('请至少添加 1 项食材');
            return;
          }
          payload = { ingredients: modeIngredients };
        }
        setCuisineResult(await runCuisineChef(mode, payload));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '网络连接失败,请检查网络后重试');
    } finally {
      setRunning(false);
    }
  }

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
        <Text style={statics.screenTitle}>菜品生成</Text>
        <View style={statics.back} />
      </View>

      {/* 出品厨师分段(设计稿 .chef-seg) */}
      <Text style={statics.blockLabel}>出品厨师</Text>
      <View style={[statics.poolCard, shadows.card.android]}>
        <View style={statics.chefSeg}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: chef === 'health' }}
            onPress={() => {
              setChef('health');
              setError(null);
            }}
            style={[statics.chefItem, chef === 'health' && { backgroundColor: brand.seal, borderColor: brand.seal }]}
          >
            <Text style={[statics.chefItemText, chef === 'health' && { color: colors.surface }]}>健康厨师</Text>
            <Text style={[statics.chefItemSub, chef === 'health' && { color: 'rgba(255,255,255,0.8)' }]}>
              减脂低卡 · 性味配伍
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: chef === 'cuisine' }}
            onPress={() => {
              setChef('cuisine');
              setError(null);
            }}
            style={[statics.chefItem, chef === 'cuisine' && { backgroundColor: summer.main, borderColor: summer.main }]}
          >
            <Text style={[statics.chefItemText, chef === 'cuisine' && { color: colors.surface }]}>美食大厨</Text>
            <Text style={[statics.chefItemSub, chef === 'cuisine' && { color: 'rgba(255,255,255,0.8)' }]}>
              菜系线 · 文化背景
            </Text>
          </Pressable>
        </View>
      </View>

      {chef === 'health' && (
        <>
          <Text style={statics.blockLabel}>候选食材(至少 1 项)</Text>
          <View style={[statics.poolCard, shadows.card.android]}>
            {/* 已选池:pick 药丸可删 */}
            <View style={statics.pickWrap}>
              {picked.map((name) => (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  accessibilityLabel={`移除 ${name}`}
                  onPress={() => removePick(picked, name, setPicked)}
                  style={statics.pick}
                >
                  <Text style={statics.pickText}>{name}</Text>
                  <Text style={statics.pickX}>✕</Text>
                </Pressable>
              ))}
            </View>
            {/* 添加输入 */}
            <View style={statics.addRow}>
              <TextInput
                style={statics.addInput}
                value={pickInput}
                onChangeText={setPickInput}
                placeholder="输入食材名后点「添加」"
                placeholderTextColor={colors.ink3}
                onSubmitEditing={() => addPick(picked, pickInput, setPicked, setPickInput)}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="添加食材"
                onPress={() => addPick(picked, pickInput, setPicked, setPickInput)}
                style={statics.addBtn}
              >
                <Text style={statics.addBtnText}>添加</Text>
              </Pressable>
            </View>
            <Text style={statics.ruleNote}>
              不在库或未采用的候选将列入「弃置」
            </Text>
          </View>
        </>
      )}

      {chef === 'cuisine' && (
        <>
          <Text style={statics.blockLabel}>选择模式</Text>
          <View style={[statics.poolCard, shadows.card.android]}>
            <View style={statics.modeRow}>
              {(
                [
                  ['cuisine', '按菜系'],
                  ['name', '按菜名'],
                  ['ingredient', '按食材'],
                ] as const
              ).map(([m, label]) => (
                <Pressable
                  key={m}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === m }}
                  onPress={() => {
                    setMode(m);
                    setError(null);
                  }}
                  style={[statics.modeTab, mode === m && { backgroundColor: summer.soft, borderColor: summer.deep }]}
                >
                  <Text style={[statics.modeTabText, mode === m && { color: summer.deep }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            {mode === 'cuisine' && (
              <View style={statics.pickWrap}>
                {(cuisines ?? []).map((c) => (
                  <Pressable
                    key={c}
                    accessibilityRole="button"
                    accessibilityState={{ selected: cuisine === c }}
                    onPress={() => setCuisine(c)}
                    style={[statics.pick, cuisine === c && { backgroundColor: summer.soft, borderColor: summer.deep }]}
                  >
                    <Text
                      style={[statics.pickText, cuisine === c && { color: summer.deep }]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {mode === 'name' && (
              <TextInput
                style={statics.input}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="输入菜名"
                placeholderTextColor={colors.ink3}
              />
            )}
            {mode === 'ingredient' && (
              <>
                <View style={statics.pickWrap}>
                  {modeIngredients.map((name) => (
                    <Pressable
                      key={name}
                      accessibilityRole="button"
                      accessibilityLabel={`移除 ${name}`}
                      onPress={() => removePick(modeIngredients, name, setModeIngredients)}
                      style={statics.pick}
                    >
                      <Text style={statics.pickText}>{name}</Text>
                      <Text style={statics.pickX}>✕</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={statics.addRow}>
                  <TextInput
                    style={statics.addInput}
                    value={pickInput}
                    onChangeText={setPickInput}
                    placeholder="输入食材名后点「添加」"
                    placeholderTextColor={colors.ink3}
                    onSubmitEditing={() => addPick(modeIngredients, pickInput, setModeIngredients, setPickInput)}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="添加食材"
                    onPress={() => addPick(modeIngredients, pickInput, setModeIngredients, setPickInput)}
                    style={statics.addBtn}
                  >
                    <Text style={statics.addBtnText}>添加</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </>
      )}

      <View style={statics.runWrap}>
        <PrimaryButton
          label={chef === 'health' ? `运行健康厨师(${picked.length} 味)` : '运行美食大厨'}
          loading={running}
          onPress={generate}
        />
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={[type.caption, { color: functional.danger, marginTop: spacing.s2 }]}>
          {error}
        </Text>
      )}

      {/* 结果:健康厨师 */}
      {chef === 'health' && healthResult && (
        <ResultBlock
          title="健康厨师产出"
          resultStage={healthResult.stage}
          dish={healthResult.dish}
          name={healthResult.name}
          excluded={healthResult.excluded}
          doubts={healthResult.doubts}
          errors={healthResult.errors ?? healthResult.problems}
          ingredients={healthResult.ingredients}
        />
      )}
      {/* 结果:美食大厨 */}
      {chef === 'cuisine' && cuisineResult && (
        <ResultBlock
          title="美食大厨产出"
          resultStage={cuisineResult.stage}
          dish={cuisineResult.dish}
          name={cuisineResult.name}
          excluded={cuisineResult.excluded}
          doubts={cuisineResult.doubts}
          errors={
            cuisineResult.errors ??
            cuisineResult.problems ??
            (cuisineResult.reason ? [cuisineResult.reason] : undefined)
          }
          ingredients={cuisineResult.ingredients}
          showCover={cuisineResult.stage === 'inserted'}
        />
      )}
    </ScrollView>
  );
}

/** 结果块:stage 状态卡 + (inserted)粉彩封面 r-chips + f-card 落库字段预览 + story 味卡 */
function ResultBlock({
  title,
  resultStage,
  dish,
  name,
  excluded,
  doubts,
  errors,
  ingredients,
  showCover = true,
}: {
  title: string;
  resultStage: string;
  dish?: Dish;
  name?: string;
  excluded?: string[];
  doubts?: string[];
  errors?: string[];
  ingredients?: string[];
  showCover?: boolean;
}) {
  const inserted = resultStage === 'inserted';
  const tone = inserted ? functional.success : functional.danger;
  const stageLabel: Record<string, string> = {
    inserted: '已入库 · 待审核',
    duplicate: '重复:已收录同名菜品',
    rejected: '事实核验驳回',
    invalid: '结构校验未通过',
    invalid_input: '输入不合法',
    not_found: '无法确认该菜品',
  };
  const dishFields = dish ? buildFields(dish, excluded ?? []) : [];
  return (
    <View style={statics.resultBlock}>
      <Text style={[type.sectionLabel, { color: colors.ink3 }, statics.sectionGap]}>{title}</Text>
      <View style={[statics.stageCard, { borderLeftColor: tone }]}>
        <Text style={[statics.stageText, { color: tone }]}>
          {stageLabel[resultStage] ?? resultStage}
          {name ? ` · ${name}` : ''}
        </Text>
        {(errors ?? []).map((line, i) => (
          <Text key={i} style={statics.errorLine}>
            {line}
          </Text>
        ))}
        {!!doubts && doubts.length > 0 && (
          <Text style={statics.stageSub}>存疑:{doubts.join(';')}</Text>
        )}
      </View>

      {/* 粉彩封面 + r-chips(inserted) */}
      {dish && showCover && (
        <View style={statics.coverWrap}>
          <PanelPop season="winter">
            <View style={statics.coverBody}>
              <Text style={statics.coverName}>{dish.name}</Text>
              <View style={statics.rChips}>
                <View style={[statics.rChip, { backgroundColor: dish.category === '美食大厨' ? brand.seal : colors.surface }]}>
                  <Text style={[statics.rChipText, { color: dish.category === '美食大厨' ? colors.surface : colors.ink2 }]}>
                    {dish.category}
                  </Text>
                </View>
                <View style={statics.rChip}>
                  <Text style={statics.rChipText}>{parseStyle(dish.style).method}</Text>
                </View>
                <View style={statics.rChip}>
                  <Text style={statics.rChipText}>{splitList(dish.solar_terms).slice(0, 2).join(' · ')}</Text>
                </View>
              </View>
            </View>
          </PanelPop>
        </View>
      )}

      {/* f-card 落库字段预览(设计稿 .f-card k/v 行) */}
      {dish && (
        <>
          <Text style={[type.sectionLabel, { color: colors.ink3 }, statics.sectionGap]}>
            落库字段预览
          </Text>
          <View style={[statics.fCard, shadows.card.android]}>
            {dishFields.map((f) => (
              <View key={f.k} style={statics.fRow}>
                <Text style={statics.fKey}>{f.k}</Text>
                <Text style={[statics.fValue, f.muted && { color: colors.ink3 }]}>{f.v}</Text>
              </View>
            ))}
          </View>
          <Text style={[type.caption, { color: colors.ink3, marginTop: spacing.s2 }]}>
            已入待审核队列,终审在「审核台」
          </Text>
        </>
      )}
    </View>
  );
}

/** dish 行 → k/v 字段预览行 */
function buildFields(dish: Dish, excluded: string[]): { k: string; v: string; muted?: boolean }[] {
  return [
    { k: 'category', v: dish.category },
    { k: 'main_ingredients', v: dish.main_ingredients },
    { k: 'extras', v: dish.extras ?? '—', muted: !dish.extras },
    { k: 'steps', v: `${dish.steps.split('\n').filter((l) => l.trim()).length} 步 · 刀工/火候写入步骤(详情见审核页)`, muted: true },
    { k: 'calories', v: dish.calories },
    { k: 'style', v: dish.style },
    { k: 'solar_terms', v: `${splitList(dish.solar_terms).join(', ')}` },
    { k: 'excluded', v: excluded.length > 0 ? excluded.join(', ') : '[](空)' , muted: excluded.length === 0 },
    { k: 'benefits', v: dish.benefits },
    { k: 'caution', v: dish.caution ?? '—', muted: !dish.caution },
    { k: 'remark', v: dish.remark ?? '(无存疑)', muted: !dish.remark },
  ];
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
  poolCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.s3,
    marginBottom: spacing.s4,
    gap: spacing.s3,
  },
  chefSeg: {
    flexDirection: 'row',
    gap: spacing.s2,
  },
  chefItem: {
    flex: 1,
    borderRadius: radius.s,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  chefItemText: {
    ...type.bodyStrong,
    color: colors.ink2,
  },
  chefItemSub: {
    fontSize: 11,
    lineHeight: 15,
    color: colors.ink3,
  },
  pickWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pickText: {
    ...type.caption,
    fontWeight: '600',
    color: colors.ink,
  },
  pickX: {
    fontSize: 11,
    lineHeight: 14,
    color: colors.ink3,
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.s2,
  },
  addInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    ...inputText,
    color: colors.ink,
  },
  addBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    ...type.caption,
    fontWeight: '700',
    color: colors.surface,
  },
  ruleNote: {
    ...type.caption,
    color: colors.ink3,
    lineHeight: 18,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.s2,
  },
  modeTab: {
    flex: 1,
    height: 36,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabText: {
    ...type.caption,
    fontWeight: '600',
    color: colors.ink2,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    ...inputText,
    color: colors.ink,
  },
  runWrap: {
    marginTop: spacing.s2,
  },
  resultBlock: {
    marginTop: spacing.s4,
  },
  sectionGap: {
    marginBottom: spacing.s2,
  },
  stageCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderLeftWidth: 3,
    padding: spacing.s4,
    gap: spacing.s1,
  },
  stageText: {
    ...type.bodyStrong,
  },
  stageSub: {
    ...type.caption,
    color: colors.ink2,
  },
  errorLine: {
    ...type.caption,
    color: functional.danger,
  },
  coverWrap: {
    marginTop: spacing.s3,
  },
  coverBody: {
    padding: spacing.s5,
    gap: spacing.s3,
  },
  coverName: {
    fontFamily: fontDisplay,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: colors.ink,
  },
  rChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  rChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rChipText: {
    ...type.caption,
    fontWeight: '600',
    color: colors.ink2,
  },
  fCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: spacing.s4,
  },
  fRow: {
    flexDirection: 'row',
    gap: spacing.s3,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  fKey: {
    width: 110,
    flexShrink: 0,
    ...tabularNums,
    ...type.caption,
    color: colors.ink3,
  },
  fValue: {
    flex: 1,
    ...type.caption,
    color: colors.ink,
    lineHeight: 19,
  },
});
