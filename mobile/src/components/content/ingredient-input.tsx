/** 候选食材输入(工坊菜品生成「按食材」两种方式并存):
 *  1) 输入框自由添加:库外食材允许输入(流水线列入「弃置」);
 *  2) 「从食材库选择」:底部弹层 sheet——官方 + 本人已通过食材库,名称/别名搜索,多选回填(去重保序)。
 *  已选池药丸可删;accent 跟随出品厨师(健康=朱砂 / 美食=琥珀)。 */
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckIcon } from '@/components/icons';
import { MonoTag, NatureBadge } from '@/components/brand';
import { PrimaryButton } from '@/components/ui/primary-button';
import { BookLineIcon } from '@/components/icons';
import { listApprovedIngredients } from '@/api/content-api';
import { useAsync } from '@/hooks/use-async';
import { splitList } from '@/utils/text';
import { currentTerm, nearbyTerms, seasonOfTerm } from '@/domain/solar-terms';
import type { Ingredient } from '@/api/types';
import { colors } from '@/theme/tokens';
import { cursorProps, inputText, radius, spacing, type, z } from '@/theme/theme';

export interface IngredientInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** 主色(添加按钮 / 选中勾,跟随厨师) */
  accent: string;
  /** 弹层底部主按钮渐变深档(默认同 accent) */
  accentTo?: string;
  /** 主按钮文字色(琥珀浅底传墨棕字) */
  labelColor?: string;
  placeholder?: string;
  hint?: string;
}

export function IngredientInput({
  value,
  onChange,
  accent,
  accentTo,
  labelColor,
  placeholder = '请输入食材名',
  hint,
}: IngredientInputProps) {
  const [input, setInput] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  function addTyped() {
    const name = input.trim();
    if (!name) return;
    // 重复直接吞掉并清空输入,不打断节奏
    if (!value.includes(name)) {
      onChange([...value, name]);
    }
    setInput('');
  }

  function remove(name: string) {
    onChange(value.filter((x) => x !== name));
  }

  return (
    <View style={statics.wrap}>
      {/* 已选池:药丸可删 */}
      {value.length > 0 && (
        <View style={statics.pickWrap}>
          {value.map((name) => (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityLabel={`移除 ${name}`}
              onPress={() => remove(name)}
              style={({ pressed }) => [statics.pick, pressed && { opacity: 0.8 }]}
            >
              <Text style={statics.pickText}>{name}</Text>
              <Text style={statics.pickX}>✕</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* 方式一:自由输入 */}
      <View style={statics.addRow}>
        <TextInput {...cursorProps}
          style={statics.addInput}
          value={input}
          onChangeText={setInput}
          placeholder={placeholder}
          placeholderTextColor={colors.ink3}
          onSubmitEditing={addTyped}
          returnKeyType="done"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="添加食材"
          onPress={addTyped}
          style={({ pressed }) => [statics.addBtn, { backgroundColor: accent }, pressed && { opacity: 0.85 }]}
        >
          <Text style={statics.addBtnText}>添加</Text>
        </Pressable>
      </View>

      {/* 方式二:食材库弹层选择 */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="从食材库选择"
        onPress={() => setSheetOpen(true)}
        style={({ pressed }) => [statics.libBtn, pressed && { backgroundColor: colors.surface2 }]}
      >
        <BookLineIcon size={16} color={colors.ink2} />
        <Text style={statics.libBtnText}>从食材库选择</Text>
      </Pressable>

      {!!hint && <Text style={statics.hint}>{hint}</Text>}

      <IngredientPickerSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        selected={value}
        accent={accent}
        accentTo={accentTo}
        labelColor={labelColor}
        onConfirm={(names) => {
          // 去重保序回填
          onChange([...value, ...names.filter((n) => !value.includes(n))]);
        }}
      />
    </View>
  );
}

/** 底部弹层选择器:visible 挂载时拉已通过库;名称/别名搜索;多选勾选,完成回填 */
function IngredientPickerSheet({
  visible,
  onClose,
  selected,
  accent,
  accentTo,
  labelColor,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  selected: string[];
  accent: string;
  accentTo?: string;
  labelColor?: string;
  onConfirm: (names: string[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  // 每次打开重置搜索与本弹层内的勾选
  useEffect(() => {
    if (visible) {
      setQ('');
      setPicked([]);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* 背板可点按关闭;sheet 自身是无动作 Pressable,触控不会穿透到背板 */}
      <Pressable style={statics.backdrop} onPress={onClose}>
        <Pressable style={[statics.sheet, { paddingBottom: insets.bottom + spacing.s3 }]} onPress={() => undefined}>
          {visible && (
            <SheetBody
              selected={selected}
              accent={accent}
              accentTo={accentTo}
              labelColor={labelColor}
              q={q}
              setQ={setQ}
              picked={picked}
              setPicked={setPicked}
              onClose={onClose}
              onConfirm={() => {
                onConfirm(picked);
                onClose();
              }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** 底部弹层选择器:visible 挂载时拉已通过库;名称/别名搜索;时令筛选(当令/全部);多选回填 */
type TermFilter = 'current' | 'all';

const TERM_FILTERS: Array<{ key: TermFilter; label: string }> = [
  { key: 'current', label: '当令' },
  { key: 'all', label: '全部' },
];

function SheetBody({
  selected,
  accent,
  accentTo,
  labelColor,
  q,
  setQ,
  picked,
  setPicked,
  onClose,
  onConfirm,
}: {
  selected: string[];
  accent: string;
  accentTo?: string;
  labelColor?: string;
  q: string;
  setQ: (v: string) => void;
  picked: string[];
  setPicked: (v: string[]) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { data: items } = useAsync(() => listApprovedIngredients(), []);
  const [termFilter, setTermFilter] = useState<TermFilter>('current');

  // 时令筛选:当令 = 当前节气 ±2 并集(与首页当令推荐口径一致);无节气数据的食材只在「全部」出现
  const near: string[] = useMemo(() => nearbyTerms(currentTerm()), []);
  const matchTerm = useMemo(() => {
    return (item: Ingredient): boolean => {
      if (termFilter === 'all') return true;
      return splitList(item.solar_terms).some((t) => near.includes(t));
    };
  }, [termFilter, near]);

  // 各筛选项的计数(不受搜索词影响,先给量再定筛选)
  const counts = useMemo(() => {
    const rows = items ?? [];
    return {
      current: rows.filter((i) => splitList(i.solar_terms).some((t) => near.includes(t))).length,
      all: rows.length,
    } as Record<TermFilter, number>;
  }, [items, near]);

  const list = useMemo(() => {
    const query = q.trim();
    let rows = items ?? [];
    rows = rows.filter(matchTerm);
    if (query) {
      rows = rows.filter(
        (r) => r.name.includes(query) || (r.aliases ?? '').includes(query),
      );
    }
    return rows;
  }, [items, q, matchTerm]);

  function toggle(name: string) {
    setPicked(picked.includes(name) ? picked.filter((x) => x !== name) : [...picked, name]);
  }

  return (
    <>
      {/* 弹层头 */}
      <View style={statics.sheetHead}>
        <Text style={statics.sheetTitle}>选择食材</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭"
          onPress={onClose}
          hitSlop={8}
          style={statics.sheetClose}
        >
          <Text style={statics.sheetCloseText}>✕</Text>
        </Pressable>
      </View>

      {/* 弹层内搜索(名称/别名) */}
      <View style={statics.sheetSearch}>
        <TextInput {...cursorProps}
          style={statics.sheetSearchInput}
          value={q}
          onChangeText={setQ}
          placeholder="搜索名称或别名"
          placeholderTextColor={colors.ink3}
          returnKeyType="search"
        />
        {q.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="清空搜索" onPress={() => setQ('')} hitSlop={6}>
            <Text style={statics.sheetClear}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* 时令筛选:默认「当令」(选食材的初衷 = 看这时节有什么) */}
      <View style={statics.filterRow}>
        {TERM_FILTERS.map((f) => {
          const on = termFilter === f.key;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setTermFilter(f.key)}
              style={({ pressed }) => [
                statics.termChip,
                on && { backgroundColor: accent, borderColor: accent },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[statics.termChipText, on && { color: colors.surface }]}>
                {f.label} {counts[f.key]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 库列表(虚拟化) */}
      <FlatList
        data={list}
        keyExtractor={(item: Ingredient) => `${item.id}`}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const on = picked.includes(item.name) || selected.includes(item.name);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => toggle(item.name)}
              style={({ pressed }) => [statics.libRow, pressed && { backgroundColor: colors.surface2 }]}
            >
              <MonoTag char={item.name.slice(0, 1)} tone={seasonOfTerm(splitList(item.solar_terms)[0] ?? '')} size="sm" />
              <View style={statics.libRowGrow}>
                <Text style={statics.libRowName}>{item.name}</Text>
                {!!item.aliases && (
                  <Text style={statics.libRowAliases} numberOfLines={1}>
                    {item.aliases}
                  </Text>
                )}
              </View>
              <NatureBadge nature={item.nature} />
              <View style={[statics.check, on && { backgroundColor: accent, borderColor: accent }]}>
                {on && <CheckIcon size={13} color={colors.surface} />}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={statics.libEmpty}>
            <Text style={[type.caption, { color: colors.ink3 }, { textAlign: 'center', lineHeight: 18 }]}>
              {(items ?? []).length === 0
                ? '食材库为空,可直接在输入框添加'
                : `当前筛选下没有匹配「${q.trim() || '·'}」的食材,可切换时令或选「全部」`}
            </Text>
          </View>
        }
      />

      {/* 弹层底部:完成(N) */}
      <View style={statics.sheetFooter}>
        <PrimaryButton
          label={picked.length > 0 ? `完成(${picked.length})` : '完成'}
          onPress={onConfirm}
          from={accent}
          to={accentTo ?? accent}
          shadowColor={accentTo ?? accent}
          labelColor={labelColor}
        />
      </View>
    </>
  );
}

const statics = StyleSheet.create({
  wrap: {
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
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    ...type.caption,
    fontWeight: '700',
    color: colors.surface,
  },
  /** 库选择入口:中性描边次按钮语言 */
  libBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  libBtnText: {
    ...type.caption,
    fontWeight: '700',
    color: colors.ink2,
  },
  hint: {
    ...type.caption,
    lineHeight: 18,
    color: colors.ink3,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(38,35,28,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '82%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.l,
    borderTopRightRadius: radius.l,
    overflow: 'hidden',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.s5,
    paddingTop: spacing.s4,
    height: 44,
  },
  sheetTitle: {
    fontFamily: type.display.fontFamily,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.ink,
  },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseText: {
    fontSize: 16,
    lineHeight: 20,
    color: colors.ink3,
  },
  sheetSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    marginHorizontal: spacing.s5,
    marginBottom: spacing.s2,
  },
  /** 固定高(=容器 44)+ 无行高 + textAlignVertical 居中 + paddingTop 6 CJK 配重
   *  (与 my-content 搜索框同一套已验证组合,勿改回「自适应高 + inputText」) */
  sheetSearchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: colors.ink,
    paddingTop: 6,
    paddingBottom: 0,
    textAlignVertical: 'center',
  },
  sheetClear: {
    ...type.caption,
    color: colors.ink3,
    paddingHorizontal: 4,
  },
  /** 时令筛选 chips(默认「当令」):选中 = 主色实底白字 */
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s2,
    paddingHorizontal: spacing.s5,
    marginBottom: spacing.s2,
  },
  termChip: {
    height: 32,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termChipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.ink2,
  },
  libRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    paddingHorizontal: spacing.s5,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  libRowGrow: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  libRowName: {
    ...type.body,
    fontWeight: '600',
    color: colors.ink,
  },
  libRowAliases: {
    ...type.caption,
    color: colors.ink3,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.s8,
  },
  sheetFooter: {
    paddingHorizontal: spacing.s5,
    paddingTop: spacing.s3,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
