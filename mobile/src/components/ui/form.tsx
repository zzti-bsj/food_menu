/**
 * 编辑表单原语(对照 edit-profile.html / v1.4 表单规范):
 *  - FormCard:字段分组白卡(§7 卡片,radius 16 + line 描边)
 *  - FormField:label 常显 + 必填 * + 右侧字数计数 + 失焦错误(文案逐字对齐接口,role=alert)
 *  - FormInput / FormTextarea:高 48 / 多行,radius 14,line-strong 描边,错误态 danger 描边
 *  - ChipGroup:筛选 chip(§7)——选中 accent 实底白字 + 同色投影,未选中白底浅描边
 */
import { type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from 'react-native';
import { seasons, activeSeason, brand, colors, functional } from '@/theme/tokens';
import { inputText, inputTextMultiline, radius, spacing, type } from '@/theme/theme';

const accent = seasons[activeSeason];

/** 字段分组白卡 */
export function FormCard({ children }: { children: ReactNode }) {
  return <View style={statics.card}>{children}</View>;
}

export interface FormFieldProps {
  label: string;
  /** 必填星号(朱砂) */
  required?: boolean;
  /** 右侧字数计数「n/max」(tabular) */
  counter?: string;
  /** 常驻 helper 说明(复杂输入的规则提示,Material:input-helper-text) */
  helper?: string;
  error?: string | null;
  children: ReactNode;
}

export function FormField({ label, required, counter, helper, error, children }: FormFieldProps) {
  return (
    <View style={statics.field}>
      <View style={statics.labelRow}>
        <Text style={statics.label}>
          {label}
          {required && <Text style={statics.required}> *</Text>}
        </Text>
        {!!counter && (
          <Text style={[type.caption, statics.counter, { color: colors.ink3 }]}>{counter}</Text>
        )}
      </View>
      {children}
      {!!helper && !error && (
        <Text style={[type.caption, statics.helper, { color: colors.ink3 }]}>{helper}</Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={[type.caption, statics.error]}>
          {error}
        </Text>
      )}
    </View>
  );
}

export function FormInput({
  value,
  onChangeText,
  onBlur,
  error,
  placeholder,
  maxLength,
  keyboardType,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  error?: boolean;
  placeholder?: string;
  maxLength?: number;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <TextInput
      style={[statics.input, error && statics.inputError]}
      value={value}
      onChangeText={onChangeText}
      onBlur={onBlur}
      placeholder={placeholder}
      placeholderTextColor={colors.ink3}
      maxLength={maxLength}
      keyboardType={keyboardType ?? 'default'}
      returnKeyType="done"
    />
  );
}

export function FormTextarea({
  value,
  onChangeText,
  onBlur,
  error,
  placeholder,
  maxLength,
  height = 110,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  error?: boolean;
  placeholder?: string;
  maxLength?: number;
  height?: number;
}) {
  return (
    <TextInput
      style={[statics.textarea, { height }, error && statics.inputError]}
      value={value}
      onChangeText={onChangeText}
      onBlur={onBlur}
      placeholder={placeholder}
      placeholderTextColor={colors.ink3}
      maxLength={maxLength}
      multiline
    />
  );
}

/** chip 选择组:multi=false 单选;选中态 accent 实底白字;选项顺序 = 词表顺序 */
export function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: readonly string[];
  onToggle: (option: string) => void;
}) {
  return (
    <View style={statics.chipWrap}>
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onToggle(option)}
            style={({ pressed }) => [
              statics.chip,
              on && statics.chipOn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={[statics.chipText, on && statics.chipTextOn]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const statics = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.s4,
  },
  field: {
    marginBottom: spacing.s5,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.s2,
  },
  label: {
    ...type.caption,
    fontWeight: '600',
    color: colors.ink2,
  },
  required: {
    color: brand.seal,
  },
  counter: {
    fontVariant: ['tabular-nums'],
  },
  input: {
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 14,
    ...inputText,
    color: colors.ink,
  },
  textarea: {
    minHeight: 110,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    ...inputTextMultiline,
    color: colors.ink,
  },
  inputError: {
    borderColor: functional.danger,
  },
  helper: {
    marginTop: spacing.s1,
  },
  error: {
    color: functional.danger,
    marginTop: spacing.s1,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  chip: {
    height: 36,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: accent.main,
    borderColor: accent.main,
    shadowColor: accent.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.32,
    shadowRadius: 6,
    elevation: 2,
  },
  chipText: {
    ...type.caption,
    fontWeight: '600',
    color: colors.ink2,
  },
  chipTextOn: {
    color: colors.surface,
    fontWeight: '700',
  },
});
