/** 编辑食材(私有食单「编辑」进入,PATCH /api/ingredients/{id} 词表校验):
 *  封面图上传 · 基本信息(名称/别名/分类≤3/四气单选/五味/归经/当令节气升序)+
 *  功效与注意(功效≤3/时令备注/食用注意/典籍注脚)。选项全部来自 GET /api/vocab;
 *  校验文案逐字对齐后端 shike/validate.py。 */
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
import { fetchVocab, getIngredient, updateIngredient } from '@/api/content-api';
import { useAsync } from '@/hooks/use-async';
import { useAuth } from '@/auth/auth-context';
import { splitList } from '@/utils/text';
import { colors, functional } from '@/theme/tokens';
import { pagePad, spacing, type } from '@/theme/theme';

const LIMITS = {
  name: 50, aliases: 200, season_note: 100, caution: 500, classic_note: 500,
} as const;

/** 多选上限(schema 注释:分类 1-3 个、功效 0-3 个) */
const MAX_CATEGORY = 3;
const MAX_BENEFITS = 3;

const REQUIRED_KEYS = ['name', 'category', 'nature', 'flavor', 'meridian', 'solar_terms'] as const;
type RequiredKey = (typeof REQUIRED_KEYS)[number];

interface IngredientForm {
  name: string;
  aliases: string;
  category: string[];
  nature: string;
  flavor: string[];
  meridian: string[];
  benefits: string[];
  season_note: string;
  caution: string;
  classic_note: string;
  solar_terms: string[];
  image: string | null;
}

const EMPTY_FORM: IngredientForm = {
  name: '', aliases: '', category: [], nature: '', flavor: [], meridian: [],
  benefits: [], season_note: '', caution: '', classic_note: '', solar_terms: [], image: null,
};

export default function EditIngredientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const { data: item, loading, error, reload } = useAsync(() => getIngredient(Number(id)), [id]);
  const { data: vocab, error: vocabError, reload: reloadVocab } = useAsync(() => fetchVocab(), []);

  const [form, setForm] = useState<IngredientForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof IngredientForm, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setForm({
      name: item.name,
      aliases: item.aliases ?? '',
      category: splitList(item.category),
      nature: item.nature,
      flavor: splitList(item.flavor),
      meridian: splitList(item.meridian),
      benefits: splitList(item.benefits ?? ''),
      season_note: item.season_note ?? '',
      caution: item.caution ?? '',
      classic_note: item.classic_note ?? '',
      solar_terms: splitList(item.solar_terms),
      image: item.image,
    });
  }, [item]);

  const canWrite = !!item && (user?.role === 'admin' || item.user_id === user?.id);

  const benefitTerms = useMemo(() => Object.keys(vocab?.benefits ?? {}), [vocab]);

  const set = <K extends keyof IngredientForm>(key: K, value: IngredientForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  /** 多选值按词表顺序升序展示与提交(节气有升序硬校验,其余保持词表序一致) */
  function orderedList(key: 'category' | 'flavor' | 'meridian' | 'benefits' | 'solar_terms'): string[] {
    const order =
      (key === 'category' ? vocab?.categories
      : key === 'flavor' ? vocab?.flavors
      : key === 'meridian' ? vocab?.meridians
      : key === 'benefits' ? benefitTerms
      : vocab?.solar_terms) ?? [];
    const indexOf = new Map(order.map((t, i) => [t, i]));
    return [...form[key]].sort((a, b) => (indexOf.get(a) ?? 0) - (indexOf.get(b) ?? 0));
  }

  function toggleIn(key: 'category' | 'flavor' | 'meridian' | 'benefits' | 'solar_terms', option: string, max?: number) {
    if (!form[key].includes(option) && max && form[key].length >= max) {
      toast.showToast(`最多 ${max} 个`);
      return;
    }
    const next = form[key].includes(option)
      ? form[key].filter((t) => t !== option)
      : [...form[key], option];
    set(key, next);
  }

  function validateField(key: keyof IngredientForm): string | null {
    if (!(REQUIRED_KEYS as readonly string[]).includes(key)) return null;
    const value = form[key as RequiredKey];
    const blank = Array.isArray(value) ? value.length === 0 : !value.trim();
    return blank ? '必填' : null;
  }

  function validateAll(): boolean {
    const next: Partial<Record<keyof IngredientForm, string>> = {};
    for (const key of REQUIRED_KEYS) {
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
      await updateIngredient(Number(id), {
        name: form.name.trim(),
        aliases: form.aliases.trim() || null,
        category: orderedList('category').join(','),
        nature: form.nature,
        flavor: orderedList('flavor').join(','),
        meridian: orderedList('meridian').join(','),
        benefits: orderedList('benefits').join(',') || null,
        season_note: form.season_note.trim() || null,
        caution: form.caution.trim() || null,
        classic_note: form.classic_note.trim() || null,
        solar_terms: orderedList('solar_terms').join(','),
        image: form.image,
      });
      toast.showToast('食材已保存');
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
      const next: Partial<Record<keyof IngredientForm, string>> = {};
      for (const entry of e.details) {
        const idx = entry.indexOf(':');
        if (idx > 0) {
          const field = entry.slice(0, idx).trim() as keyof IngredientForm;
          if (field in form) next[field] = entry.slice(idx + 1).trim();
        }
      }
      setErrors(next);
      toast.showToast('校验未通过,请检查标红字段');
      return;
    }
    if (e.status === 409 && e.message.startsWith('名称已存在')) {
      setErrors({ name: e.message });
      return;
    }
    toast.showToast(e.message);
  }

  if (loading) return <Centered text="加载中…" />;
  if (error || !item) return <Centered text={error ?? '未找到该食材'} onRetry={reload} />;
  if (!canWrite) return <Centered text="仅本人与管理员可编辑" />;

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
          <Text style={[type.serifTitle, { color: colors.ink }]} numberOfLines={1}>编辑食材</Text>
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

        <ImagePickField uri={form.image} kind="leaf" onChange={(uri) => set('image', uri)} />

        <SectionLabel label="基本信息" style={statics.sectionLabel} />
        <FormCard>
          <FormField label="名称" required counter={`${form.name.length}/${LIMITS.name}`} error={errors.name}>
            <FormInput
              value={form.name}
              onChangeText={(v) => set('name', v)}
              onBlur={() => setErrors((p) => ({ ...p, name: validateField('name') ?? undefined }))}
              error={!!errors.name}
              placeholder="请输入食材名称"
              maxLength={LIMITS.name}
            />
          </FormField>
          <FormField label="别名" helper="半角逗号分隔" counter={`${form.aliases.length}/${LIMITS.aliases}`} error={errors.aliases}>
            <FormInput
              value={form.aliases}
              onChangeText={(v) => set('aliases', v)}
              error={!!errors.aliases}
              placeholder="请输入别名"
              maxLength={LIMITS.aliases}
            />
          </FormField>
          <FormField label="分类" required helper={`大类多选,最多 ${MAX_CATEGORY} 个`} error={errors.category}>
            <ChipGroup
              options={vocab?.categories ?? []}
              selected={orderedList('category')}
              onToggle={(c) => toggleIn('category', c, MAX_CATEGORY)}
            />
          </FormField>
          <FormField label="四气" required helper="单选七档" error={errors.nature}>
            <ChipGroup
              options={vocab?.natures ?? []}
              selected={form.nature ? [form.nature] : []}
              onToggle={(n) => set('nature', n)}
            />
          </FormField>
          <FormField label="五味" required error={errors.flavor}>
            <ChipGroup options={vocab?.flavors ?? []} selected={orderedList('flavor')} onToggle={(f) => toggleIn('flavor', f)} />
          </FormField>
          <FormField label="归经" required error={errors.meridian}>
            <ChipGroup options={vocab?.meridians ?? []} selected={orderedList('meridian')} onToggle={(m) => toggleIn('meridian', m)} />
          </FormField>
          <View style={statics.lastField}>
            <FormField label="当令节气" required helper="可多选,保存时按节气先后升序" error={errors.solar_terms}>
              <ChipGroup
                options={vocab?.solar_terms ?? []}
                selected={orderedList('solar_terms')}
                onToggle={(t) => toggleIn('solar_terms', t)}
              />
            </FormField>
          </View>
        </FormCard>

        <SectionLabel label="功效与注意" style={statics.sectionLabel} />
        <FormCard>
          <FormField label="功效" helper={`词表多选,最多 ${MAX_BENEFITS} 个,可留空`} error={errors.benefits}>
            <ChipGroup
              options={benefitTerms}
              selected={orderedList('benefits')}
              onToggle={(b) => toggleIn('benefits', b, MAX_BENEFITS)}
            />
          </FormField>
          <FormField label="时令备注" helper="如「全年」「9-11月」" counter={`${form.season_note.length}/${LIMITS.season_note}`} error={errors.season_note}>
            <FormInput
              value={form.season_note}
              onChangeText={(v) => set('season_note', v)}
              error={!!errors.season_note}
              placeholder="请输入时令备注"
              maxLength={LIMITS.season_note}
            />
          </FormField>
          <FormField label="食用注意" counter={`${form.caution.length}/${LIMITS.caution}`} error={errors.caution}>
            <FormTextarea
              value={form.caution}
              onChangeText={(v) => set('caution', v)}
              error={!!errors.caution}
              placeholder="请输入食用注意"
              maxLength={LIMITS.caution}
              height={80}
            />
          </FormField>
          <View style={statics.lastField}>
            <FormField
              label="典籍注脚"
              helper="格式「典籍:原文」,如《本草纲目》:下气消痰"
              counter={`${form.classic_note.length}/${LIMITS.classic_note}`}
              error={errors.classic_note}
            >
              <FormTextarea
                value={form.classic_note}
                onChangeText={(v) => set('classic_note', v)}
                placeholder="请输入典籍注脚"
                error={!!errors.classic_note}
                maxLength={LIMITS.classic_note}
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
