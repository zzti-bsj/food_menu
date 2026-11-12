/** 编辑菜谱(私有食单「编辑」进入,PATCH /api/dishes/{id} 全字段轻校验):
 *  封面图上传(ImagePickField → POST /api/uploads)· 基本信息(名称/出品厨师/菜系·做法/
 *  热量/当令节气 chips,升序自动排序)· 内容(主料/辅料/步骤/养生好处/风味故事/忌口/备注)。
 *  失焦校验文案逐字对齐后端;400 details 按「字段: 文案」回填到对应输入框。 */
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SectionLabel } from '@/components/ui/section-label';
import { ChipGroup, FormCard, FormField, FormInput, FormTextarea } from '@/components/ui/form';
import { ImagePickField } from '@/components/content/image-pick-field';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/api/client';
import { fetchVocab, getDish, updateDish } from '@/api/content-api';
import { useAsync } from '@/hooks/use-async';
import { useAuth } from '@/auth/auth-context';
import { splitList } from '@/utils/text';
import { colors, functional } from '@/theme/tokens';
import { pagePad, spacing, type } from '@/theme/theme';

const LIMITS = {
  name: 100, style: 100, calories: 50, main_ingredients: 500, extras: 500,
  steps: 2000, benefits: 500, story: 500, caution: 500, remark: 500,
} as const;

/** 必填字段(对齐 web/app.py _dish_patch_errors 与词表校验) */
const REQUIRED: Array<keyof DishForm> = [
  'name', 'category', 'style', 'calories', 'solar_terms',
  'main_ingredients', 'steps', 'benefits',
];

interface DishForm {
  name: string;
  category: string;
  style: string;
  calories: string;
  solar_terms: string[];
  main_ingredients: string;
  extras: string;
  steps: string;
  benefits: string;
  story: string;
  caution: string;
  remark: string;
  image: string | null;
}

const EMPTY_FORM: DishForm = {
  name: '', category: '', style: '', calories: '', solar_terms: [],
  main_ingredients: '', extras: '', steps: '', benefits: '', story: '',
  caution: '', remark: '', image: null,
};

export default function EditDishScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const { data: dish, loading, error, reload } = useAsync(() => getDish(Number(id)), [id]);
  const { data: vocab, error: vocabError, reload: reloadVocab } = useAsync(() => fetchVocab(), []);

  const [form, setForm] = useState<DishForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof DishForm, string>>>({});
  const [saving, setSaving] = useState(false);

  const ready = !!dish;
  useEffect(() => {
    if (!dish) return;
    setForm({
      name: dish.name,
      category: dish.category,
      style: dish.style,
      calories: dish.calories,
      solar_terms: splitList(dish.solar_terms),
      main_ingredients: dish.main_ingredients,
      extras: dish.extras ?? '',
      steps: dish.steps,
      benefits: dish.benefits,
      story: dish.story ?? '',
      caution: dish.caution ?? '',
      remark: dish.remark ?? '',
      image: dish.image,
    });
  }, [dish]);

  const canWrite = !!dish && (user?.role === 'admin' || dish.user_id === user?.id);

  const set = <K extends keyof DishForm>(key: K, value: DishForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  /** 节气选择:展示与提交都按词表顺序升序(后端要求 solar_terms 升序) */
  const sortedTerms = useMemo(() => {
    const order = vocab?.solar_terms ?? [];
    const indexOf = new Map(order.map((t, i) => [t, i]));
    return [...form.solar_terms].sort((a, b) => (indexOf.get(a) ?? 0) - (indexOf.get(b) ?? 0));
  }, [form.solar_terms, vocab]);

  function toggleTerm(term: string) {
    const next = form.solar_terms.includes(term)
      ? form.solar_terms.filter((t) => t !== term)
      : [...form.solar_terms, term];
    set('solar_terms', next);
  }

  /** 失焦必填校验,文案逐字对齐后端(web/app.py) */
  function validateField(key: keyof DishForm): string | null {
    if (!REQUIRED.includes(key)) return null;
    const value = form[key];
    const blank = Array.isArray(value) ? value.length === 0 : !String(value).trim();
    return blank ? '必填' : null;
  }

  function validateAll(): boolean {
    const next: Partial<Record<keyof DishForm, string>> = {};
    for (const key of REQUIRED) {
      const err = validateField(key);
      if (err) next[key] = err;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!validateAll()) {
      toast.showToast('还有必填项未完成');
      return;
    }
    setSaving(true);
    try {
      await updateDish(Number(id), {
        name: form.name.trim(),
        category: form.category,
        style: form.style.trim(),
        calories: form.calories.trim(),
        solar_terms: sortedTerms.join(','),
        main_ingredients: form.main_ingredients.trim(),
        extras: form.extras.trim() || null,
        steps: form.steps.trim(),
        benefits: form.benefits.trim(),
        story: form.story.trim() || null,
        caution: form.caution.trim() || null,
        remark: form.remark.trim() || null,
        image: form.image,
      });
      toast.showToast('菜谱已保存');
      router.back();
    } catch (e) {
      applyServerError(e);
    } finally {
      setSaving(false);
    }
  }

  /** 400 details「字段: 文案」回填到输入框;409 名称冲突按名称字段呈现 */
  function applyServerError(e: unknown) {
    if (!(e instanceof ApiError)) {
      toast.showToast('网络连接失败,请检查网络后重试');
      return;
    }
    if (e.details && e.details.length > 0) {
      const next: Partial<Record<keyof DishForm, string>> = {};
      for (const item of e.details) {
        const idx = item.indexOf(':');
        if (idx > 0) {
          const field = item.slice(0, idx).trim() as keyof DishForm;
          if (field in form) next[field] = item.slice(idx + 1).trim();
        }
      }
      setErrors(next);
      toast.showToast('校验未通过,请检查标红字段');
      return;
    }
    if (e.status === 409 && e.message.startsWith('菜名已存在')) {
      setErrors({ name: e.message.replace('菜名已存在:', '名称已存在:') });
      return;
    }
    toast.showToast(e.message);
  }

  if (loading) return <Centered text="加载中…" />;
  if (error || !dish) return <Centered text={error ?? '未找到该菜品'} onRetry={reload} />;
  if (!canWrite) return <Centered text="仅本人与管理员可编辑" />;

  const counterOf = (key: keyof typeof LIMITS) => `${form[key].length}/${LIMITS[key]}`;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={statics.flex}>
      <ScrollView
        contentContainerStyle={[statics.content, { paddingTop: insets.top + spacing.s2 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={statics.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="返回"
            hitSlop={8}
            onPress={() => (router.canDismiss() ? router.back() : router.replace('/(tabs)/mine'))}
            style={statics.back}
          >
            <Text style={statics.backIcon}>‹</Text>
          </Pressable>
          <Text style={[type.serifTitle, { color: colors.ink }]}>编辑菜谱</Text>
          <View style={statics.back} />
        </View>

        {/* 词表选项加载失败:chip 组会整体空白,必须显式可重试 */}
        {!!vocabError && (
          <Pressable onPress={reloadVocab} hitSlop={8} style={statics.vocabError}>
            <Text style={[type.caption, { color: functional.danger }]}>
              选项词表加载失败:{vocabError}(点按重试)
            </Text>
          </Pressable>
        )}

        {/* 封面图:上传/更换/移除(保存后随 PATCH 一并生效) */}
        <ImagePickField uri={form.image} kind="bowl" onChange={(uri) => set('image', uri)} />

        <SectionLabel label="基本信息" style={statics.sectionLabel} />
        <FormCard>
          <FormField label="菜名" required counter={counterOf('name')} error={errors.name}>
            <FormInput
              value={form.name}
              onChangeText={(v) => set('name', v)}
              onBlur={() => setErrors((p) => ({ ...p, name: validateField('name') ?? undefined }))}
              error={!!errors.name}
              placeholder="请输入菜名"
              maxLength={LIMITS.name}
            />
          </FormField>
          <FormField label="出品厨师" required error={errors.category}>
            <ChipGroup
              options={vocab?.dish_categories ?? []}
              selected={[form.category]}
              onToggle={(c) => set('category', form.category === c ? '' : c)}
            />
          </FormField>
          <FormField label="菜系 · 做法" required helper="逗号分隔,如「川菜,炒」" counter={counterOf('style')} error={errors.style}>
            <FormInput
              value={form.style}
              onChangeText={(v) => set('style', v)}
              onBlur={() => setErrors((p) => ({ ...p, style: validateField('style') ?? undefined }))}
              error={!!errors.style}
              placeholder="请输入菜系和做法"
              maxLength={LIMITS.style}
            />
          </FormField>
          <FormField label="每份热量" required helper="如「约350千卡」" counter={counterOf('calories')} error={errors.calories}>
            <FormInput
              value={form.calories}
              onChangeText={(v) => set('calories', v)}
              onBlur={() => setErrors((p) => ({ ...p, calories: validateField('calories') ?? undefined }))}
              error={!!errors.calories}
              placeholder="请输入热量估算"
              maxLength={LIMITS.calories}
            />
          </FormField>
          <FormField
            label="当令节气"
            required
            helper="可多选,保存时按节气先后升序"
            error={errors.solar_terms}
          >
            <ChipGroup options={vocab?.solar_terms ?? []} selected={sortedTerms} onToggle={toggleTerm} />
          </FormField>
          <View style={statics.lastField}>
            <FormField label="忌口提示" helper="不适宜人群,留空则不展示" counter={counterOf('caution')} error={errors.caution}>
              <FormTextarea
                value={form.caution}
                onChangeText={(v) => set('caution', v)}
                error={!!errors.caution}
                placeholder="请输入忌口提示"
                maxLength={LIMITS.caution}
                height={80}
              />
            </FormField>
          </View>
        </FormCard>

        <SectionLabel label="内容" style={statics.sectionLabel} />
        <FormCard>
          <FormField
            label="主料(每份定量)"
            required
            helper="逗号分隔,每项「食材 分量」,如「白萝卜 半根,鸡胸肉 1块」"
            counter={counterOf('main_ingredients')}
            error={errors.main_ingredients}
          >
            <FormTextarea
              value={form.main_ingredients}
              onChangeText={(v) => set('main_ingredients', v)}
              onBlur={() => setErrors((p) => ({ ...p, main_ingredients: validateField('main_ingredients') ?? undefined }))}
              error={!!errors.main_ingredients}
              placeholder="请输入主料"
              maxLength={LIMITS.main_ingredients}
              height={80}
            />
          </FormField>
          <FormField
            label="辅料 / 调料"
            helper="同主料格式,可留空"
            counter={counterOf('extras')}
            error={errors.extras}
          >
            <FormTextarea
              value={form.extras}
              onChangeText={(v) => set('extras', v)}
              error={!!errors.extras}
              placeholder="请输入辅料"
              maxLength={LIMITS.extras}
              height={80}
            />
          </FormField>
          <FormField
            label="烹饪步骤"
            required
            helper="编号分行,火候与技巧写入步骤"
            counter={counterOf('steps')}
            error={errors.steps}
          >
            <FormTextarea
              value={form.steps}
              onChangeText={(v) => set('steps', v)}
              onBlur={() => setErrors((p) => ({ ...p, steps: validateField('steps') ?? undefined }))}
              error={!!errors.steps}
              placeholder="请输入烹饪步骤"
              maxLength={LIMITS.steps}
              height={160}
            />
          </FormField>
          <FormField label="养生好处" required helper="中医性味 + 现代营养多角度" counter={counterOf('benefits')} error={errors.benefits}>
            <FormTextarea
              value={form.benefits}
              onChangeText={(v) => set('benefits', v)}
              onBlur={() => setErrors((p) => ({ ...p, benefits: validateField('benefits') ?? undefined }))}
              error={!!errors.benefits}
              placeholder="请输入养生好处"
              maxLength={LIMITS.benefits}
            />
          </FormField>
          <FormField label="风味故事" helper="风味与文化背景,美食大厨出品可填" counter={counterOf('story')} error={errors.story}>
            <FormTextarea
              value={form.story}
              onChangeText={(v) => set('story', v)}
              placeholder="请输入风味故事"
              error={!!errors.story}
              maxLength={LIMITS.story}
              height={80}
            />
          </FormField>
          <View style={statics.lastField}>
            <FormField label="备注" helper="校验存疑备注,可留空" counter={counterOf('remark')} error={errors.remark}>
              <FormTextarea
                value={form.remark}
                onChangeText={(v) => set('remark', v)}
                placeholder="请输入备注"
                error={!!errors.remark}
                maxLength={LIMITS.remark}
                height={80}
              />
            </FormField>
          </View>
        </FormCard>

        <View style={statics.submitWrap}>
          <PrimaryButton label="保存" loading={saving} onPress={() => void save()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    marginBottom: spacing.s4,
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
  sectionLabel: {
    marginTop: spacing.s5,
    marginBottom: spacing.s2,
  },
  vocabError: {
    marginBottom: spacing.s3,
  },
  lastField: {
    marginBottom: -spacing.s5,
  },
  submitWrap: {
    marginTop: spacing.s6,
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
