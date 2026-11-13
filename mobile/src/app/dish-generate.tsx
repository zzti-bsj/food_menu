/** 菜品生成(工坊 push,对照 dish-generate.html v1.4.1 双厨师单入口 + v1.2 品牌语言):
 *  秋粉彩 Hero 内双厨师品牌卡(「健」朱砂章 /「美」琥珀渐变章,衬线字 + 同色彩影,点选切换);
 *  健康厨师:候选食材 pick 药丸(可删)+ 添加输入;美食大厨:三模式面板(选中=琥珀实底白字);
 *  结果:stage 状态卡 + 粉彩封面(季随节气 · ChefBadge + 星光)+ f-card 落库字段预览。 */
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChefBadge, PanelPop, Sparkle, Sticker } from '@/components/brand';
import { SectionLabel } from '@/components/ui/section-label';
import { PrimaryButton } from '@/components/ui/primary-button';
import { IngredientInput } from '@/components/content/ingredient-input';
import { listCuisines } from '@/api/content-api';
import { startCuisineJob, startDishJob, type CuisineChefResult } from '@/api/workshop-api';
import { useAsync } from '@/hooks/use-async';
import { useGenerationJob } from '@/hooks/use-generation-job';
import { parseIngredients, parseSteps, parseStyle, splitList } from '@/utils/text';
import { seasonOfTerm } from '@/domain/solar-terms';
import type { Dish } from '@/api/types';
import { brand, colors, functional, seasons } from '@/theme/tokens';
import { cursorProps, inputText, fontDisplay, pagePad, radius, shadows, spacing, tabularNums, type } from '@/theme/theme';

const summer = seasons.summer;

type Chef = 'health' | 'cuisine';
type CuisineMode = 'cuisine' | 'name' | 'ingredient';

export default function DishGenerateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: cuisines } = useAsync(listCuisines, []);

  const [chef, setChef] = useState<Chef>('health');
  // 健康厨师:候选食材池
  const [picked, setPicked] = useState<string[]>([]);
  // 美食大厨
  const [mode, setMode] = useState<CuisineMode>('cuisine');
  const [cuisine, setCuisine] = useState<string>('');
  const [nameInput, setNameInput] = useState('');
  const [modeIngredients, setModeIngredients] = useState<string[]>([]);

  // 表单校验错误(本地即时);作业错误(网络/服务端)由 hook 提供
  const [inputError, setInputError] = useState<string | null>(null);
  // 生成走服务端异步作业:切后台/锁屏不中断,回本页自动接续
  const { running, error, result, start } = useGenerationJob<CuisineChefResult>('dish');
  /** 产出当前结果的厨师(健康/美食各留一份展示,切厨师互不串台) */
  const [resultChef, setResultChef] = useState<Chef | null>(null);

  function generate() {
    setInputError(null);
    if (chef === 'health') {
      if (picked.length === 0) {
        setInputError('请至少添加 1 项食材');
        return;
      }
      setResultChef('health');
      start(() => startDishJob(picked));
      return;
    }
    let payload: { cuisine?: string; name?: string; ingredients?: string[] };
    if (mode === 'cuisine') {
      if (!cuisine) {
        setInputError('请选择菜系');
        return;
      }
      payload = { cuisine };
    } else if (mode === 'name') {
      if (!nameInput.trim()) {
        setInputError('请输入菜名');
        return;
      }
      payload = { name: nameInput.trim() };
    } else {
      if (modeIngredients.length === 0) {
        setInputError('请至少添加 1 项食材');
        return;
      }
      payload = { ingredients: modeIngredients };
    }
    setResultChef('cuisine');
    start(() => startCuisineJob(mode, payload));
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

      {/* 秋粉彩 Hero:出品厨师双卡(衬线章 + 同色彩影) */}
      <PanelPop season="autumn">
        <View style={statics.hero}>
          <View style={statics.heroHead}>
            <View style={statics.heroGrow}>
              <Text style={statics.heroTitle}>谁来掌勺?</Text>
              <Text style={statics.heroSub}>同一入口双厨师,点选切换下方表单</Text>
            </View>
            <Sparkle size={20} />
          </View>
          <View style={statics.chefSeg}>
            <ChefCard
              char="健"
              name="健康厨师"
              sub="减脂低卡 · 性味配伍"
              selected={chef === 'health'}
              onPress={() => {
                setChef('health');
                setInputError(null);
              }}
            />
            <ChefCard
              char="美"
              name="美食大厨"
              sub="菜系线 · 文化背景"
              selected={chef === 'cuisine'}
              onPress={() => {
                setChef('cuisine');
                setInputError(null);
              }}
            />
          </View>
        </View>
      </PanelPop>

      {chef === 'health' ? (
        <>
          <SectionLabel label="候选食材(至少 1 项)" style={statics.sectionGap} />
          <View style={[statics.poolCard, shadows.card.android]}>
            <IngredientInput
              value={picked}
              onChange={setPicked}
              accent={brand.seal}
              accentTo={brand.seal}
              hint="自由输入允许库外食材(列入「弃置」);也可从食材库多选"
            />
          </View>
        </>
      ) : (
        <>
          <SectionLabel label="选择模式" style={statics.sectionGap} />
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
                    setInputError(null);
                  }}
                  style={[statics.modeTab, mode === m && { backgroundColor: summer.main, borderColor: summer.main }]}
                >
                  <Text style={[statics.modeTabText, mode === m && { color: colors.surface }]}>{label}</Text>
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
                      style={[statics.pickText, cuisine === c && { color: summer.deep, fontWeight: '700' }]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {mode === 'name' && (
              <TextInput {...cursorProps}
                style={statics.input}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="输入菜名"
                placeholderTextColor={colors.ink3}
              />
            )}
            {mode === 'ingredient' && (
              <IngredientInput
                value={modeIngredients}
                onChange={setModeIngredients}
                accent={summer.main}
                accentTo={summer.deep}
                labelColor={brand.amberInk}
                hint="自由输入允许库外食材(列入「弃置」);也可从食材库多选"
              />
            )}
          </View>
        </>
      )}

      <View style={statics.runWrap}>
        <PrimaryButton
          label={chef === 'health' ? `运行健康厨师(${picked.length} 味)` : '运行美食大厨'}
          loading={running}
          onPress={generate}
          from={chef === 'health' ? brand.sealLight : '#F2B33C'}
          to={chef === 'health' ? brand.seal : brand.amber}
          shadowColor={chef === 'health' ? brand.seal : brand.amber}
          labelColor={chef === 'health' ? '#FFFFFF' : brand.amberInk}
        />
      </View>
      {!!inputError && (
        <Text accessibilityRole="alert" style={[type.caption, { color: functional.danger, marginTop: spacing.s2 }]}>
          {inputError}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={[type.caption, { color: functional.danger, marginTop: spacing.s2 }]}>
          {error}
        </Text>
      )}

      {/* 结果:健康厨师 */}
      {chef === 'health' && result && resultChef === 'health' && (
        <ResultBlock
          title="健康厨师产出"
          resultStage={result.stage}
          dish={result.dish}
          name={result.name}
          excluded={result.excluded}
          doubts={result.doubts}
          errors={result.errors ?? result.problems}
          ingredients={result.ingredients}
        />
      )}
      {/* 结果:美食大厨 */}
      {chef === 'cuisine' && result && resultChef === 'cuisine' && (
        <ResultBlock
          title="美食大厨产出"
          resultStage={result.stage}
          dish={result.dish}
          name={result.name}
          excluded={result.excluded}
          doubts={result.doubts}
          errors={
            result.errors ??
            result.problems ??
            (result.reason ? [result.reason] : undefined)
          }
          ingredients={result.ingredients}
          showCover={result.stage === 'inserted'}
        />
      )}
    </ScrollView>
  );
}

/** 双厨师品牌卡:衬线单字章(健=朱砂实底 / 美=琥珀渐变,白字同色影)+ 选中彩边 */
function ChefCard({
  char,
  name,
  sub,
  selected,
  onPress,
}: {
  char: string;
  name: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}) {
  const isHealth = char === '健';
  const tile = (
    <LinearGradient
      colors={isHealth ? [brand.sealLight, brand.seal] : ['#F2B33C', brand.amber]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        statics.chefTile,
        {
          shadowColor: isHealth ? brand.seal : brand.amber,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 3,
        },
      ]}
    >
      <Text style={statics.chefTileChar}>{char}</Text>
    </LinearGradient>
  );
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        statics.chefCard,
        selected && {
          backgroundColor: colors.surface,
          borderColor: isHealth ? brand.seal : brand.amber,
          borderWidth: 1,
        },
        pressed && { opacity: 0.9 },
      ]}
    >
      {tile}
      <View style={statics.chefCardGrow}>
        <Text style={[statics.chefCardName, selected && { color: isHealth ? brand.seal : summer.deep }]}>
          {name}
        </Text>
        <Text style={statics.chefCardSub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

/** 结果块(inserted = 封面贴「待审核」贴纸 + 内容预览;其余状态 = 状态色横幅):
 *  预览与详情页同语言——基本信息行 / 定量表 / 步骤时间线 / 养生好处 / 忌口 / 弃置候选。 */
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
  /** duplicate 是「已存在」而非失败:琥珀提醒;其余失败态红色 */
  const warnOnly = resultStage === 'duplicate';
  const bannerSoft = warnOnly ? functional.warningSoft : functional.dangerSoft;
  const bannerTone = warnOnly ? functional.warning : functional.danger;
  const stageLabel: Record<string, string> = {
    inserted: '已入库 · 待审核',
    duplicate: '重复:已收录同名菜品',
    rejected: '事实核验驳回',
    invalid: '结构校验未通过',
    invalid_input: '输入不合法',
    not_found: '无法确认该菜品',
  };
  const main = dish ? parseIngredients(dish.main_ingredients) : [];
  const extras = dish ? parseIngredients(dish.extras ?? '') : [];
  const steps = dish ? parseSteps(dish.steps) : [];
  const dishSeason = dish ? seasonOfTerm(splitList(dish.solar_terms)[0] ?? '') : 'winter';

  return (
    <View style={statics.resultBlock}>
      <SectionLabel label={title} style={statics.sectionGap} />

      {/* 失败/重复:状态色横幅(无边框,色底 + 色字) */}
      {!inserted && (
        <View style={[statics.statusBanner, { backgroundColor: bannerSoft }]}>
          <Text style={[statics.statusTitle, { color: bannerTone }]}>
            {stageLabel[resultStage] ?? resultStage}
            {name ? ` · ${name}` : ''}
          </Text>
          {(errors ?? []).map((line, i) => (
            <Text key={i} style={[statics.bannerLine, { color: bannerTone }]}>
              {line}
            </Text>
          ))}
          {!!doubts && doubts.length > 0 && (
            <Text style={[statics.bannerLine, { color: bannerTone }]}>存疑:{doubts.join(';')}</Text>
          )}
        </View>
      )}

      {/* 已入库:季粉彩封面 + 「待审核」贴纸 + 出品厨师/做法/节气 chips */}
      {dish && showCover && (
        <View style={statics.coverWrap}>
          <PanelPop season={dishSeason}>
            <View style={statics.coverBody}>
              <View style={statics.coverHead}>
                <View style={statics.heroGrow}>
                  <Text style={statics.coverName}>{dish.name}</Text>
                </View>
                <Sticker label="待审核" />
              </View>
              <View style={statics.rChips}>
                <ChefBadge category={dish.category} />
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

      {/* 入库内容预览(详情页语言,替代表格化的落库字段预览) */}
      {dish && (
        <>
          <SectionLabel label="基本信息" style={statics.sectionGap} />
          <View style={[statics.previewCard, shadows.card.android]}>
            <InfoRow label="出品厨师">
              <ChefBadge category={dish.category} />
            </InfoRow>
            <InfoRow label="菜系 · 做法">
              <Text style={statics.infoValue}>{dish.style}</Text>
            </InfoRow>
            <InfoRow label="每份热量">
              <Text style={[statics.infoValue, tabularNums]}>{dish.calories}</Text>
            </InfoRow>
            <InfoRow label="当令节气" last>
              <View style={statics.termLine}>
                {splitList(dish.solar_terms).map((t) => {
                  const s = seasons[seasonOfTerm(t)];
                  return (
                    <View key={t} style={[statics.termTag, { backgroundColor: s.soft }]}>
                      <Text style={[statics.termTagText, { color: s.deep }]}>{t}</Text>
                    </View>
                  );
                })}
              </View>
            </InfoRow>
          </View>

          <SectionLabel label="定量表(每份)" style={statics.sectionGap} />
          <View style={[statics.previewCard, shadows.card.android]}>
            {main.map((item) => (
              <QuantRow key={`m-${item.name}`} name={item.name} amount={item.amount} />
            ))}
            {extras.length > 0 && (
              <>
                <Text style={statics.extrasTitle}>辅料 / 调料</Text>
                {extras.map((item) => (
                  <QuantRow key={`e-${item.name}`} name={item.name} amount={item.amount} />
                ))}
              </>
            )}
          </View>

          <SectionLabel label={`烹饪步骤(${steps.length})`} style={statics.sectionGap} />
          <View style={[statics.previewCard, shadows.card.android]}>
            {steps.map((step, i) => (
              <View key={i} style={statics.stepRow}>
                <View style={statics.stepRail}>
                  <View style={[statics.stepNo, { backgroundColor: seasons[dishSeason].main }]}>
                    <Text style={statics.stepNoText}>{i + 1}</Text>
                  </View>
                  {i < steps.length - 1 && <View style={statics.stepLine} />}
                </View>
                <Text style={statics.stepText}>{step}</Text>
              </View>
            ))}
          </View>

          <SectionLabel label="养生好处" style={statics.sectionGap} />
          <View style={[statics.previewCard, statics.padBox, shadows.card.android]}>
            <Text style={statics.bodyText}>{dish.benefits}</Text>
          </View>

          {!!dish.caution && (
            <>
              <SectionLabel label="忌口提示" style={statics.sectionGap} />
              <View style={statics.cautionBox}>
                <Text style={statics.cautionTitle}>⚠ 忌口提示</Text>
                <Text style={statics.cautionText}>{dish.caution}</Text>
              </View>
            </>
          )}

          {(excluded ?? []).length > 0 && (
            <>
              <SectionLabel label="弃置候选" style={statics.sectionGap} />
              <View style={[statics.previewCard, statics.padBox, shadows.card.android]}>
                <View style={statics.pickWrap}>
                  {(excluded ?? []).map((name) => (
                    <View key={name} style={statics.excludedChip}>
                      <Text style={statics.excludedText}>{name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}

          {!!dish.remark && (
            <>
              <SectionLabel label="存疑备注" style={statics.sectionGap} />
              <View style={statics.cautionBox}>
                <Text style={statics.cautionTitle}>⚠ 存疑备注</Text>
                <Text style={statics.cautionText}>{dish.remark}</Text>
              </View>
            </>
          )}

          <Text style={[type.caption, { color: colors.ink3, marginTop: spacing.s3 }]}>
            已入待审核队列,终审在「审核台」
          </Text>
        </>
      )}
    </View>
  );
}

/** 基本信息行:灰标签 + 内容(children) */
function InfoRow({ label, last = false, children }: { label: string; last?: boolean; children: ReactNode }) {
  return (
    <View style={[statics.infoRow, last && statics.infoRowLast]}>
      <Text style={statics.infoKey}>{label}</Text>
      <View style={statics.infoValueWrap}>{children}</View>
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
  chefSeg: {
    flexDirection: 'row',
    gap: spacing.s2,
  },
  chefCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
    borderRadius: radius.s,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.6)',
    padding: spacing.s3,
  },
  chefTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chefTileChar: {
    fontFamily: fontDisplay,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.surface,
  },
  chefCardGrow: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  chefCardName: {
    ...type.body,
    fontWeight: '700',
    color: colors.ink,
  },
  chefCardSub: {
    fontSize: 10,
    lineHeight: 14,
    color: colors.ink3,
  },
  poolCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.s3,
    marginBottom: spacing.s2,
    gap: spacing.s3,
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
  /** 失败/重复状态横幅:色底 + 色字,无边框 */
  statusBanner: {
    borderRadius: radius.m,
    padding: spacing.s4,
    gap: spacing.s1,
  },
  statusTitle: {
    ...type.bodyStrong,
  },
  bannerLine: {
    ...type.caption,
    lineHeight: 18,
  },
  coverWrap: {
    marginTop: spacing.s3,
  },
  coverBody: {
    padding: spacing.s5,
    gap: spacing.s3,
  },
  coverHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    alignItems: 'center',
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
  /** 预览分组卡(与详情页卡片同语言) */
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.s4,
    gap: 2,
  },
  padBox: {
    paddingTop: spacing.s4,
    paddingBottom: spacing.s4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoKey: {
    ...type.caption,
    fontWeight: '600',
    color: colors.ink3,
    width: 72,
    flexShrink: 0,
  },
  infoValueWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  infoValue: {
    ...type.body,
    color: colors.ink,
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
    width: 24,
    alignSelf: 'stretch',
  },
  stepNo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNoText: {
    fontSize: 12,
    lineHeight: 15,
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
    paddingBottom: spacing.s3,
    flex: 1,
  },
  bodyText: {
    ...type.body,
    color: colors.ink,
  },
  cautionBox: {
    backgroundColor: functional.warningSoft,
    borderRadius: radius.m,
    padding: spacing.s4,
    gap: spacing.s1,
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
  excludedChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface2,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  excludedText: {
    ...type.caption,
    fontWeight: '600',
    color: colors.ink3,
  },
  termLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  termTag: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  termTagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  resultBlock: {
    marginTop: spacing.s4,
  },
  sectionGap: {
    marginTop: spacing.s5,
    marginBottom: spacing.s2,
  },
});
