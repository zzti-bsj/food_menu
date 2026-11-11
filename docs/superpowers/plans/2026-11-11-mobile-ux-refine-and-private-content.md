# 移动端体验修订与私有内容闭环 —— 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落实 spec 五项（输入框浮动标签重设计、文案清理、删最近批次、审核入口 admin 化、私有内容「生成即归属 + 编辑」闭环），后端补 user_id 贯穿与 /api/vocab。

**Architecture:** 移动端新增统一 `Field` 组件（Animated 浮动标签，outline/filled 双变体）替换三处内联输入；后端在 `optional_login` 下把当前用户 id 经 pipeline 构造参数传到 `repository.insert_*` 的 user_id 列；编辑复用既有 PATCH 端点，词表经新增 `GET /api/vocab` 下发。

**Tech Stack:** Flask + PyMySQL + PyJWT（后端）；Expo 58 / React Native / expo-router / jest-expo（移动端）。测试沿用 tests/fakes.py 与 test_web_crud.py 的 monkeypatch 模式；移动端无 testing-library，只做纯函数测试 + lint/tsc。

**Spec:** `docs/superpowers/specs/2026-11-11-mobile-ux-refine-and-private-content-design.md`

**约定（全任务适用）：**
- 移动端命令一律在 `mobile/` 下执行：`npx tsc --noEmit`、`npx expo lint`、`npx jest <file>`
- 后端命令在仓库根 `.venv` 激活后执行：`python -m pytest tests/<file> -v`
- 提交信息结尾带 `Co-Authored-By: Claude Code <noreply@anthropic.com>`

---

### Task 1: `Field` 组件（浮动标签 + 双变体）

**Files:**
- Create: `mobile/src/components/ui/field.tsx`
- Create: `mobile/src/components/ui/field.test.ts`

- [ ] **Step 1: 写纯函数失败测试**

`mobile/src/components/ui/field.test.ts`：

```ts
import { labelFloatState } from './field';

describe('labelFloatState', () => {
  it('空值未聚焦 = 沉底(作占位)', () => {
    expect(labelFloatState('', false)).toBe(false);
  });
  it('聚焦即上浮(无论有无值)', () => {
    expect(labelFloatState('', true)).toBe(true);
    expect(labelFloatState('x', true)).toBe(true);
  });
  it('有值未聚焦也上浮(不失焦回落)', () => {
    expect(labelFloatState('x', false)).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd mobile && npx jest src/components/ui/field.test.ts`
Expected: FAIL（Cannot find module './field'）

- [ ] **Step 3: 实现 `field.tsx`**

```tsx
/** 表单输入域 v2:真浮动标签(空值失焦沉框内作占位 16px·ink3;聚焦/有值上浮框顶 12px·accent)
 *  + outline(登录/资料:1.5px lineStrong 描边,聚焦描边渐变 accent,错误朱砂描边)
 *  + filled(生成页:surface2 填充无描边,聚焦浮出 accent 细描边)双变体。
 *  动画用 RN 内置 Animated(布局属性,useNativeDriver:false),不引依赖。 */
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, functional, seasons, activeSeason } from '@/theme/tokens';
import { radius, spacing, type } from '@/theme/theme';

const accent = seasons[activeSeason];

/** 浮动判定(纯函数供测试):聚焦或有值即上浮 */
export function labelFloatState(value: string, focused: boolean): boolean {
  return focused || value.length > 0;
}

export interface FieldProps extends TextInputProps {
  label: string;
  variant?: 'outline' | 'filled';
  /** 错误文案(逐字对齐后端);非空时描边变朱砂并显示 */
  error?: string | null;
  /** 规则说明(密码 ≥6 位等),显示在框下 */
  helper?: string | null;
  required?: boolean;
  /** 密码模式:内建可见性切换眼睛按钮 */
  secure?: boolean;
  /** 右侧附加元素(与 secure 互斥使用) */
  right?: ReactNode;
}

export function Field({
  label, variant = 'outline', error, helper, required, secure, right, value, onChangeText, onBlur, multiline, ...rest
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);
  const float = useRef(new Animated.Value(labelFloatState(value, false) ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(float, {
      toValue: labelFloatState(value, focused) ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [focused, value, float]);

  const floated = labelFloatState(value, focused);
  const labelTop = float.interpolate({ inputRange: [0, 1], outputRange: variant === 'outline' ? [19, 7] : [15, 5] });
  const labelSize = float.interpolate({ inputRange: [0, 1], outputRange: [16, 12] });

  return (
    <View>
      <View style={[statics.box, variant === 'filled' ? statics.boxFilled : statics.boxOutline,
        focused && !error && (variant === 'filled' ? statics.boxFilledFocus : statics.boxOutlineFocus),
        !!error && statics.boxError, multiline && statics.boxMultiline]}>
        <Animated.Text
          style={[statics.label, { top: labelTop, fontSize: labelSize, color: floated ? (error ? functional.danger : accent.deep) : colors.ink3 }]}
          numberOfLines={1}
        >
          {label}{required ? ' *' : ''}
        </Animated.Text>
        <TextInput
          style={[statics.input, multiline && statics.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          placeholder=""
          secureTextEntry={secure && !reveal}
          multiline={multiline}
          {...rest}
        />
        {secure ? (
          <Pressable accessibilityRole="button" accessibilityLabel={reveal ? '隐藏密码' : '显示密码'} hitSlop={8}
            onPress={() => setReveal((s) => !s)} style={statics.eye}>
            <Text style={statics.eyeText}>{reveal ? '隐藏' : '显示'}</Text>
          </Pressable>
        ) : right}
      </View>
      {!!helper && !error && <Text style={statics.helper}>{helper}</Text>}
      {!!error && (
        <Text accessibilityRole="alert" style={statics.error}>{error}</Text>
      )}
    </View>
  );
}

const statics = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.m ?? 14, borderWidth: 1.5 },
  boxOutline: { height: 56, backgroundColor: colors.surface, borderColor: colors.lineStrong, paddingHorizontal: 14 },
  boxOutlineFocus: { borderColor: accent.main },
  boxFilled: { height: 52, backgroundColor: colors.surface2, borderColor: 'transparent', paddingHorizontal: 12 },
  boxFilledFocus: { borderWidth: 1, borderColor: accent.main },
  boxError: { borderColor: functional.danger },
  boxMultiline: { height: 120, alignItems: 'flex-start', paddingTop: 24 },
  label: { position: 'absolute', left: 15, fontWeight: '600', zIndex: 1, backgroundColor: 'transparent' },
  input: { flex: 1, minHeight: 24, paddingTop: variantSafe(20), paddingBottom: 4, ...type.body, color: colors.ink },
  inputMultiline: { paddingTop: 26, textAlignVertical: 'top' },
  eye: { paddingHorizontal: 6, paddingVertical: 8 },
  eyeText: { ...type.caption, fontWeight: '600', color: colors.ink3 },
  helper: { ...type.caption, color: colors.ink3, marginTop: 6, lineHeight: 17 },
  error: { ...type.caption, color: functional.danger, marginTop: 6, fontWeight: '600' },
});

/** StyleSheet.create 里不能引用运行时参数,箱内输入的顶部留白固定值抽出来 */
function variantSafe(n: number) { return n; }
```

**注意**：上面 `statics.input` 的 `paddingTop` 引用了组件外函数——这不符合 RN StyleSheet 习惯。落地时直接写死数值：`paddingTop: 20`。最终 `statics.input` 为：

```ts
  input: { flex: 1, minHeight: 24, paddingTop: 20, paddingBottom: 4, ...type.body, color: colors.ink },
```

并删除 `variantSafe` 函数。若 `radius` 无 `m` 键，查看 `mobile/src/theme/theme.ts` 中 radius 实际键名后替换（`radius.m ?? 14` 仅为兜底写法，落地时改成确定值）。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd mobile && npx jest src/components/ui/field.test.ts && npx tsc --noEmit`
Expected: 3 passed，tsc 无错误

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/ui/field.tsx mobile/src/components/ui/field.test.ts
git commit -m "feat(mobile): Field 组件——浮动标签 + outline/filled 双变体输入域"
```

---

### Task 2: login.tsx 接入 Field

**Files:**
- Modify: `mobile/src/app/login.tsx`

- [ ] **Step 1: 手机号字段替换**

删除「手机号」`<View style={statics.field}>…</View>` 整块（约 117-142 行），替换为：

```tsx
        <View style={statics.field}>
          <Field
            label="手机号"
            required
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: undefined }));
            }}
            onBlur={() => validateField('phone')}
            error={fieldErrors.phone ?? null}
            keyboardType="number-pad"
            textContentType="telephoneNumber"
            maxLength={11}
            autoComplete="tel"
          />
        </View>
```

- [ ] **Step 2: 密码字段替换**

删除「密码」`<View style={statics.field}>…</View>` 整块（约 144-191 行，含 labelRow/忘记密码/inputWrap/眼睛按钮/helper），替换为：

```tsx
        <View style={statics.field}>
          <Field
            label="密码"
            required
            secure
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
            }}
            onBlur={() => validateField('password')}
            error={fieldErrors.password ?? null}
            helper="密码至少 6 位;支持粘贴与密码管理器自动填充"
            textContentType={mode === 'login' ? 'password' : 'newPassword'}
            autoComplete={mode === 'login' ? 'password' : 'new-password'}
          />
          {mode === 'login' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="忘记密码"
              onPress={() => toast.showToast('密码找回接口待上线,可先联系管理员')}
              style={statics.forgotRow}
            >
              <Text style={[statics.forgot, { color: accent.deep }]}>忘记密码?</Text>
            </Pressable>
          )}
        </View>
```

- [ ] **Step 3: import 与样式清理**

文件顶部加 `import { Field } from '@/components/ui/field';`；删除本地 `EyeIcon` 函数定义（约 214-230 行）及其 Svg/Path import（若无其他使用）；statics 中删除不再引用的键：`labelRow`、`label`、`required`、`input`、`inputWrap`、`passwordInput`、`inputError`、`eye`、`helper`、`error`（保留 `forgot`、`field`、`serverError` 等）；新增：

```ts
  forgotRow: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
  },
```

- [ ] **Step 4: 验证**

Run: `cd mobile && npx tsc --noEmit && npx expo lint`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add mobile/src/app/login.tsx
git commit -m "refactor(mobile): 登录页接入 Field 浮动标签输入域"
```

---

### Task 3: edit-profile.tsx 接入 Field

**Files:**
- Modify: `mobile/src/app/edit-profile.tsx`

- [ ] **Step 1: 昵称字段替换**

删除「昵称」`<View style={statics.field}>…</View>`（约 94-122 行），替换为（计数器挪到 helper 位）：

```tsx
        <View style={statics.field}>
          <Field
            label="昵称"
            required
            value={nickname}
            onChangeText={(v) => {
              setNickname(v);
              if (error) setError(null);
            }}
            onBlur={validate}
            error={error}
            helper={`${nickname.trim().length}/${NICKNAME_MAX} 字`}
            maxLength={NICKNAME_MAX + 10}
            textContentType="nickname"
          />
        </View>
```

- [ ] **Step 2: import 与样式清理**

加 `import { Field } from '@/components/ui/field';`；TextInput 从 import 列表移除；statics 删除 `labelRow`、`label`、`required`、`input`、`inputError`、`error`（保留 `field`）。

- [ ] **Step 3: 验证 + Commit**

```bash
cd mobile && npx tsc --noEmit && npx expo lint
git add mobile/src/app/edit-profile.tsx
git commit -m "refactor(mobile): 编辑资料页接入 Field"
```

---

### Task 4: dish-generate.tsx 输入接入 Field(filled) + 失败文案用户语言化

**Files:**
- Modify: `mobile/src/app/dish-generate.tsx`

- [ ] **Step 1: 三处 TextInput 换 Field**

加 `import { Field } from '@/components/ui/field';`。三处替换（均在 poolCard 内）：

① 健康厨师「添加输入」`addRow` 里的 TextInput（保留右侧「添加」按钮，Field 用 `right` 挂不到——按钮在行外，保持 addRow 布局，仅把 TextInput 换成 Field 会双框。**采用方案**：TextInput 保留原样（它是「输入+按钮」组合行，不是表单域），只换下面两处）。

② 美食大厨 mode==='name' 的菜名 TextInput：

```tsx
              <Field
                variant="filled"
                label="菜名"
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="如:豉汁蒸排骨"
                maxLength={100}
              />
```
（原 placeholder「(已收录会防重)」信息并入 helper 可省——防重由 duplicate 结果态呈现，不预教育。）

③ 其余独立 TextInput（若有第三处独立输入按同模式：`variant="filled"` + label 化 placeholder）。

**判定规则**：凡「独立成域、无内联按钮」的 TextInput 换 Field(filled)；「输入+添加按钮」组合行保留 TextInput 原样式（组合行不是表单域语义）。

- [ ] **Step 2: 失败态文案用户语言化**

`stageLabel` 映射（约 375-381 行）改为：

```ts
  const stageLabel: Record<string, string> = {
    inserted: '已生成,审核中',
    duplicate: '已有同名菜品,换个名字试试',
    rejected: '内容核验未通过,请调整后重试',
    invalid: '生成结果不达标,已自动重试仍未通过',
    invalid_input: '输入不合法,请检查后重试',
    not_found: '暂时无法确认这道菜,换个说法试试',
  };
```

- [ ] **Step 3: 验证 + Commit**

```bash
cd mobile && npx tsc --noEmit && npx expo lint
git add mobile/src/app/dish-generate.tsx
git commit -m "refactor(mobile): 菜品生成输入接入 Field,失败文案用户语言化"
```

---

### Task 5: 文案清理（workshop / pipeline / my-content）

**Files:**
- Modify: `mobile/src/app/(tabs)/workshop.tsx`
- Modify: `mobile/src/app/pipeline.tsx`
- Modify: `mobile/src/app/my-content.tsx`

- [ ] **Step 1: workshop 入口卡副标题**

食材流水线卡 `pipeSub`（58-59 行）：

```tsx
              <Text style={statics.pipeSub}>
                选一个节气,一键生成时令食材档案
              </Text>
```

菜品生成卡 `pipeSub`（84-86 行）：

```tsx
              <Text style={statics.pipeSub}>
                健康厨师 · 减脂低卡|美食大厨 · 菜系风味{'\n'}点食材或菜名,生成你的专属菜谱
              </Text>
```

- [ ] **Step 2: workshop 底部 hint 删除**

删除 148-150 行整块 `<Text style={[type.caption, statics.hint, …]}>最近批次对应 GET /api/batch/last…</Text>` 与 statics 里的 `hint` 键。

- [ ] **Step 3: pipeline 五步 desc 删除**

`STEPS`（23-29 行）改为：

```ts
const STEPS: { title: string }[] = [
  { title: '推荐食材' },
  { title: '填充档案' },
  { title: '结构校验' },
  { title: '事实核验' },
  { title: '入库待审核' },
];
```

同步修改 STEPS 的使用处：类型引用 `{ title: string; desc: string }` 若有则改为 `{ title: string }`；渲染 `desc` 的 Text 删除（保留 title 与 s-note 动态数值）。

- [ ] **Step 4: my-content 文案**

79-81 行提示改：

```tsx
      <Text style={[type.caption, statics.hint, { color: colors.ink3 }]}>
        仅自己与管理员可见
      </Text>
```

99 行空态改 `暂无私有菜品,去工坊生成第一道菜`；111 行改 `暂无私有食材,去工坊流水线生成`。

- [ ] **Step 5: 验证 + Commit**

```bash
cd mobile && npx tsc --noEmit && npx expo lint
git add 'mobile/src/app/(tabs)/workshop.tsx' mobile/src/app/pipeline.tsx mobile/src/app/my-content.tsx
git commit -m "refactor(mobile): 清理开发者视角文案(流程链/API名/防探测/接口待补)"
```

---

### Task 6: 删除「最近批次」卡片

**Files:**
- Modify: `mobile/src/app/(tabs)/workshop.tsx`
- Modify: `mobile/src/api/workshop-api.ts`

- [ ] **Step 1: 删卡片**

删除 workshop.tsx 93-120 行「最近批次」整块 `<View style={[statics.statCard, …]}>…</View>`；删除 `const { data: lastBatch } = useAsync(getLastBatch, []);`（19 行）与 `const batch = lastBatch;`（31 行）；顶部 import 移除 `getLastBatch`。

- [ ] **Step 2: 删 API 函数**

workshop-api.ts 删除：

```ts
export function getLastBatch(): Promise<BatchResult | null> {
  return apiFetch<BatchResult | null>('/api/batch/last', { auth: false });
}
```

（`BatchResult` 接口保留——runBatch 仍用。）

- [ ] **Step 3: 验证 + Commit**

```bash
cd mobile && npx tsc --noEmit && npx expo lint && npx jest
git add 'mobile/src/app/(tabs)/workshop.tsx' mobile/src/api/workshop-api.ts
git commit -m "refactor(mobile): 移除最近批次卡片与 getLastBatch"
```

---

### Task 7: 审核入口 admin 化

**Files:**
- Modify: `mobile/src/app/(tabs)/mine.tsx`
- Modify: `mobile/src/app/(tabs)/workshop.tsx`

- [ ] **Step 1: mine.tsx 官方库审核仅 admin**

「协作与管理」分组（122-142 行）改为——普通用户该分组整个不渲染：

```tsx
          {user.role === 'admin' && (
            <View style={[statics.entryGroup, shadows.card.android]}>
              <EntryRow
                icon={<BookLineIcon color={accent.deep} />}
                iconBg={accent.soft}
                title="官方库审核"
                sub="流水线产出的人工终审"
                onPress={() => router.push('/review')}
              />
              <EntryRow
                icon={<ShieldIcon color={summer.deep} />}
                iconBg={summer.soft}
                title="用户管理"
                sub="启停 / 角色 / 删除"
                tag="admin"
                last
                onPress={() => router.push('/admin-users')}
              />
            </View>
          )}
```

（原「用户管理」单独的 `user.role === 'admin'` 条件合并进外层，`last` 属性移到用户管理行。）

- [ ] **Step 2: 未登录文案同步**

mine.tsx 162 行「登录后可使用私有食单、官方库审核与设置」改「登录后可使用私有食单与设置」。

- [ ] **Step 3: workshop 审核待办卡仅 admin**

workshop.tsx 需 `import { useAuth } from '@/auth/auth-context';`，组件内 `const { user } = useAuth();`；「审核待办」卡（122-146 行）包一层：

```tsx
          {user?.role === 'admin' && (
            <View style={[statics.statCard, shadows.card.android]}>
              {/* …原卡片内容不动… */}
            </View>
          )}
```

- [ ] **Step 4: 验证 + Commit**

```bash
cd mobile && npx tsc --noEmit && npx expo lint
git add 'mobile/src/app/(tabs)/mine.tsx' 'mobile/src/app/(tabs)/workshop.tsx'
git commit -m "feat(mobile): 审核入口(官方库审核/审核待办)收敛为 admin 可见"
```

---

### Task 8: repository insert 支持 user_id

**Files:**
- Modify: `shike/repository.py`

- [ ] **Step 1: insert_ingredient 补 user_id 列**

`insert_ingredient`（32-43 行附近）在 `fields = [...]` 之后加 user_id 追加：

```python
def insert_ingredient(record: dict) -> None:
    """以待审核状态写入一枚食材;name 冲突时抛 pymysql IntegrityError;user_id 非空则归属私有。"""
    fields = [f for f in _INGREDIENT_FIELDS if record.get(f) is not None]
    if record.get("user_id") is not None:
        fields.append("user_id")
    columns = ",".join(f"`{f}`" for f in fields + ["status"])
    placeholders = ",".join(["%s"] * (len(fields) + 1))
    values = [record[f] or None for f in fields] + ["待审核"]
```

（后续 connect/execute 原样保留。）

- [ ] **Step 2: insert_dish 同样处理**

`insert_dish`（267-280 行）：

```python
def insert_dish(record: dict) -> None:
    """以待审核状态写入一道菜;name 冲突时抛 pymysql IntegrityError;user_id 非空则归属私有。"""
    fields = [f for f in _DISH_FIELDS if record.get(f) is not None]
    if record.get("user_id") is not None:
        fields.append("user_id")
    columns = ",".join(f"`{f}`" for f in fields + ["status"])
    placeholders = ",".join(["%s"] * (len(fields) + 1))
    values = [record[f] or None for f in fields] + ["待审核"]
```

- [ ] **Step 3: 现有测试不回归**

Run: `python -m pytest tests/ -v`
Expected: 全部 PASS（本任务纯增量，无行为变化）

- [ ] **Step 4: Commit**

```bash
git add shike/repository.py
git commit -m "feat(db): insert_ingredient/insert_dish 支持归属列 user_id"
```

---

### Task 9: pipeline 贯穿 user_id

**Files:**
- Modify: `llm/pipeline.py`
- Modify: `llm/dish_pipeline.py`
- Modify: `llm/cuisine_pipeline.py`
- Modify: `llm/batch.py`
- Test: `tests/test_pipeline_user_id.py`

- [ ] **Step 1: 写失败测试**

`tests/test_pipeline_user_id.py`（IngredientPipeline 全链路 fake：filler 直给合法记录、verifier 放行，monkeypatch repository.insert_ingredient 捕获入参。合法记录需过 validate_ingredient——字段值照抄 tests/test_pipeline.py 中已验证合法的记录结构）：

```python
"""生成流水线 user_id 归属贯穿:Dish/Ingredient/Batch 三线落库均携带归属列。"""
import pytest

from llm.batch import IngredientBatchPipeline
from llm.dish_pipeline import DishPipeline
from llm.pipeline import IngredientPipeline


class FakeFiller:
    def __init__(self):
        from shike.vocab import load_vocab
        self.vocab = load_vocab()

    def fill(self, name, feedback=None):
        return {
            "name": name,
            "aliases": None,
            "category": "蔬菜",
            "nature": "平",
            "flavor": "甘",
            "meridian": "脾经",
            "benefits": None,
            "season_note": None,
            "caution": None,
            "classic_note": None,
            "solar_terms": "立冬",
        }


class FakeVerifier:
    def verify(self, record, *args):
        return "pass", []


def test_ingredient_pipeline_carries_user_id(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        "shike.repository.insert_ingredient",
        lambda record: captured.update(record) or None,
    )
    result = IngredientPipeline(filler=FakeFiller(), verifier=FakeVerifier(), user_id=42).run("白萝卜")
    assert result["stage"] == "inserted"
    assert captured["user_id"] == 42


def test_ingredient_pipeline_anonymous_keeps_none(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        "shike.repository.insert_ingredient",
        lambda record: captured.update(record) or None,
    )
    IngredientPipeline(filler=FakeFiller(), verifier=FakeVerifier()).run("白萝卜")
    assert "user_id" not in captured or captured.get("user_id") is None


def test_batch_pipeline_passes_user_id_to_factory(monkeypatch):
    made = {}

    def factory(user_id=None):
        made["user_id"] = user_id
        return IngredientPipeline(filler=FakeFiller(), verifier=FakeVerifier(), user_id=user_id)

    captured = {}
    monkeypatch.setattr(
        "shike.repository.insert_ingredient",
        lambda record: captured.update(record) or None,
    )

    class FakeRecommender:
        def recommend(self, term):
            return ["白萝卜"]

    pipeline = IngredientBatchPipeline(recommender=FakeRecommender(), pipeline_factory=factory, user_id=7)
    result = pipeline.run("立冬")
    assert result["inserted"] == ["白萝卜"]
    assert made["user_id"] == 7
    assert captured["user_id"] == 7
```

**注意**：FakeFiller 的记录若过不了 `validate_ingredient`（词表值/必填不匹配），以 `python -m pytest tests/test_pipeline.py -v` 现有用例里使用的合法字段值为准修正——**先跑现有 test_pipeline.py 找到其 filler 返回的记录形状，照抄字段值**。

- [ ] **Step 2: 跑测试确认失败**

Run: `python -m pytest tests/test_pipeline_user_id.py -v`
Expected: FAIL（`IngredientPipeline.__init__() got an unexpected keyword argument 'user_id'`）

- [ ] **Step 3: IngredientPipeline 加 user_id**

llm/pipeline.py `__init__`（12-20 行）与 `_insert`：

```python
    def __init__(
        self,
        filler: IngredientFiller | None = None,
        verifier: IngredientVerifier | None = None,
        max_revisions: int = 3,
        user_id: int | None = None,
    ):
        self.filler = filler or IngredientFiller()
        self.verifier = verifier or IngredientVerifier()
        self.max_revisions = max_revisions
        self.user_id = user_id
```

`_insert` 改：

```python
    def _insert(self, name: str, record: dict) -> dict:
        record = {**record, "user_id": self.user_id}
        try:
            repository.insert_ingredient(record)
        except IntegrityError:
            return {"name": name, "stage": "duplicate"}
        return {"name": name, "stage": "inserted"}
```

- [ ] **Step 4: DishPipeline / CuisinePipeline 同模式**

dish_pipeline.py `__init__` 加 `user_id: int | None = None` 参数与 `self.user_id = user_id`；`_insert` 首行改：

```python
        db = {**to_db_record(record, remark), "user_id": self.user_id}
```

cuisine_pipeline.py `__init__`（49-55 行）同样加参数；`_insert`（162 行起）`db = to_db_record(record, remark)` 改：

```python
        db = {**to_db_record(record, remark), "user_id": self.user_id}
```

- [ ] **Step 5: IngredientBatchPipeline 加 user_id**

llm/batch.py `__init__`：

```python
    def __init__(
        self,
        recommender: SolarTermIngredientRecommender | None = None,
        pipeline_factory=None,
        max_workers: int = 3,
        user_id: int | None = None,
    ):
        self.recommender = recommender or SolarTermIngredientRecommender()
        self.pipeline_factory = pipeline_factory or (lambda: IngredientPipeline(user_id=user_id))
        self.max_workers = max_workers
```

（显式传 factory 的测试不受影响；run() 里 `self.pipeline_factory().run(n)` 原样。）

- [ ] **Step 6: 跑测试 + 回归**

Run: `python -m pytest tests/test_pipeline_user_id.py tests/test_pipeline.py tests/test_dish_pipeline.py tests/test_cuisine_pipeline.py tests/test_batch.py -v`
Expected: 全部 PASS

- [ ] **Step 7: Commit**

```bash
git add llm/pipeline.py llm/dish_pipeline.py llm/cuisine_pipeline.py llm/batch.py tests/test_pipeline_user_id.py
git commit -m "feat(llm): 三条流水线贯穿 user_id 归属参数"
```

---

### Task 10: 端点 optional_login 注入 + GET /api/vocab

**Files:**
- Modify: `web/app.py`
- Test: `tests/test_web_ownership.py`

- [ ] **Step 1: 写失败测试**

`tests/test_web_ownership.py`（复用 test_web_crud.py 的 fixtures 与常量）：

```python
"""生成端点归属注入:带 token → pipeline 构造收到 user_id;匿名 → None。"""
import pytest

import web.app as web_app
from tests.test_web_crud import PASSWORD, PHONE_USER, USERS, client, fake_db, send, token


def patch_pipeline(monkeypatch, target: str):
    captured = {}

    class FakePipeline:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        def run(self, *args, **kwargs):
            return {"stage": "inserted", "name": "测试菜", "ingredients": list(args[0]) if args else []}

    monkeypatch.setattr(web_app, target, FakePipeline)
    return captured


def test_dish_generate_with_token_attaches_user(monkeypatch, fake_db, client):
    captured = patch_pipeline(monkeypatch, "DishPipeline")
    res = send(client, "post", "/api/dishes", tok=token(client), json={"ingredients": ["山药"]})
    assert res.status_code == 200
    assert res.get_json()["stage"] == "inserted"
    assert captured["user_id"] == USERS[1]["id"]


def test_dish_generate_anonymous_keeps_none(monkeypatch, fake_db, client):
    captured = patch_pipeline(monkeypatch, "DishPipeline")
    res = client.post("/api/dishes", json={"ingredients": ["山药"]})
    assert res.status_code == 200
    assert captured["user_id"] is None


def test_batch_with_token_attaches_user(monkeypatch, fake_db, client):
    captured = patch_pipeline(monkeypatch, "IngredientBatchPipeline")

    class FakePipeline:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        def run(self, term):
            return {"term": term, "recommended": [], "inserted": [], "doubts": {}, "failed": []}

    monkeypatch.setattr(web_app, "IngredientBatchPipeline", FakePipeline)
    res = send(client, "post", "/api/batch", tok=token(client), json={"term": "立冬"})
    assert res.status_code == 200
    assert captured["user_id"] == USERS[1]["id"]


def test_vocab_endpoint_shape(client):
    res = client.get("/api/vocab")
    body = res.get_json()
    assert res.status_code == 200
    assert set(body) == {"solar_terms", "categories", "natures", "flavors", "meridians", "benefits"}
    assert "立冬" in body["solar_terms"]
    assert "平" in body["natures"]
```

**注意**：`USERS[1]["id"]` 以 test_web_crud.py 里 USERS/PHONE_USER 的实际定义为准——执行时先读该文件，把断言值对准 PHONE_USER 对应用户的 id。

- [ ] **Step 2: 跑测试确认失败**

Run: `python -m pytest tests/test_web_ownership.py -v`
Expected: FAIL（`captured == {}`——端点尚未传 user_id；vocab 404）

- [ ] **Step 3: web/app.py 三处修改**

① `run_batch`（62-69 行）：

```python
@app.post("/api/batch")
@auth.optional_login
def run_batch():
    global _last_batch
    data = request.get_json(silent=True) or {}
    term = data.get("term", "")
    if term not in VOCAB.solar_term_index:
        return jsonify({"error": f"非法节气:{term}"}), 400
    user = auth.current_user()
    _last_batch = IngredientBatchPipeline(user_id=user["id"] if user else None).run(term)
    return jsonify(_last_batch)
```

② `create_dish`（91-105 行）：

```python
@app.post("/api/dishes")
@auth.optional_login
def create_dish():
    user = auth.current_user()
    uid = user["id"] if user else None
    data = request.get_json(silent=True) or {}
    if data.get("chef") == "cuisine":
        return jsonify(CuisinePipeline(user_id=uid).run(data.get("mode") or "", data))
    ingredients = data.get("ingredients")
    if (
        not isinstance(ingredients, list)
        or not ingredients
        or not all(isinstance(i, str) and i.strip() for i in ingredients)
    ):
        return jsonify({"error": "ingredients 须为非空字符串数组"}), 400
    names = list(dict.fromkeys(i.strip() for i in ingredients))
    return jsonify(DishPipeline(user_id=uid).run(names))
```

③ 新增 vocab 端点（放在 `/api/cuisines` 之后）：

```python
@app.get("/api/vocab")
def vocab():
    """编辑表单用封闭值域(移动端 edit 页 chips 数据源)。"""
    return jsonify({
        "solar_terms": list(VOCAB.solar_terms),
        "categories": list(VOCAB.categories),
        "natures": list(VOCAB.natures),
        "flavors": list(VOCAB.flavors),
        "meridians": list(VOCAB.meridians),
        "benefits": sorted(VOCAB.benefits),
    })
```

- [ ] **Step 4: 跑测试 + 回归**

Run: `python -m pytest tests/test_web_ownership.py tests/test_web.py tests/test_web_crud.py tests/test_web_auth.py -v`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add web/app.py tests/test_web_ownership.py
git commit -m "feat(web): 生成端点可选归属(optional_login 注入 user_id) + GET /api/vocab"
```

---

### Task 11: 工坊登录门槛 + 生成成功引导

**Files:**
- Modify: `mobile/src/app/(tabs)/workshop.tsx`
- Modify: `mobile/src/app/pipeline.tsx`
- Modify: `mobile/src/app/dish-generate.tsx`
- Modify: `mobile/src/api/content-api.ts`（若无 my-content 计数刷新需要则不动）

- [ ] **Step 1: workshop 两入口未登录跳登录**

workshop.tsx 食材流水线入口 `onPress={() => router.push('/pipeline')}` 改：

```tsx
        onPress={() => router.push(user ? '/pipeline' : '/login')}
```

菜品生成入口同理改 `router.push(user ? '/dish-generate' : '/login')`。

- [ ] **Step 2: pipeline.tsx 未登录态整页引导**

pipeline.tsx 加 `import { useAuth } from '@/auth/auth-context';` 与 `import { PrimaryButton } from '@/components/ui/primary-button';`，组件内 `const { user, restoring } = useAuth();`。在 topBar 之后、Step1 之前插入：

```tsx
      {!restoring && !user && (
        <View style={statics.loginGate}>
          <Text style={[type.body, { color: colors.ink2 }]}>
            登录后生成的食材档案将归入你的私有库
          </Text>
          <PrimaryButton label="去登录" onPress={() => router.push('/login')} />
        </View>
      )}
```

并在主内容（选节气 chips 起）外包 `{(user || restoring) && (…)}`——restoring 期间原样渲染避免闪跳。statics 加：

```ts
  loginGate: {
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.s5,
    gap: spacing.s3,
    marginBottom: spacing.s4,
  },
```

- [ ] **Step 3: dish-generate.tsx 同样处理**

同 Step 2 模式：`const { user, restoring } = useAuth();`；未登录引导文案「登录后生成的菜谱将归入你的私有食单」；主表单区包 `(user || restoring)` 条件。

- [ ] **Step 4: 生成成功引导**

dish-generate.tsx 成功态（stage==='inserted' 的结果卡）末尾加一行（若结果卡是组件,在组件内加）：

```tsx
        <Pressable accessibilityRole="link" onPress={() => router.push('/my-content')}>
          <Text style={[type.caption, { color: accent.deep, fontWeight: '600', marginTop: 8 }]}>
            在「我的 · 私有食单」查看审核进度 ›
          </Text>
        </Pressable>
```

（accent 已在该文件定义则复用；没有则 `import { seasons, activeSeason } from '@/theme/tokens'; const accent = seasons[activeSeason];`。）

- [ ] **Step 5: 验证 + Commit**

```bash
cd mobile && npx tsc --noEmit && npx expo lint
git add 'mobile/src/app/(tabs)/workshop.tsx' mobile/src/app/pipeline.tsx mobile/src/app/dish-generate.tsx
git commit -m "feat(mobile): 工坊生成登录门槛与成功后私有食单引导"
```

---

### Task 12: 详情页编辑按钮 + 焦点刷新

**Files:**
- Modify: `mobile/src/app/dish/[id].tsx`
- Modify: `mobile/src/app/ingredient/[id].tsx`

- [ ] **Step 1: dish 详情顶栏编辑按钮**

加 `import { useAuth } from '@/auth/auth-context';`、`const { user } = useAuth();`。顶栏右侧占位 `<View style={statics.back} />`（59 行）替换：

```tsx
          {user && (user.role === 'admin' || dish.user_id === user.id) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="编辑菜品"
              hitSlop={8}
              onPress={() => router.push(`/edit-dish/${dish.id}`)}
              style={statics.back}
            >
              <Text style={[type.caption, { color: colors.ink2, fontWeight: '600' }]}>编辑</Text>
            </Pressable>
          ) : (
            <View style={statics.back} />
          )}
```

- [ ] **Step 2: dish 详情焦点刷新**

加 `import { useFocusEffect } from 'expo-router';`（若已在 expo-router import 里则合并）与 `import { useCallback } from 'react';`，组件内（useAsync 之后）加：

```tsx
  useFocusEffect(useCallback(reload, [reload]));
```

- [ ] **Step 3: ingredient 详情同样两处**

ingredient/[id].tsx 顶栏右侧 `<View style={statics.back} />` 同 Step 1 模式替换，跳转 `/edit-ingredient/${item.id}`（数据变量名以该文件实际为准——详情数据变量应为 `item` 或 `ingredient`，先读文件确认）；同样加 useFocusEffect 刷新。

- [ ] **Step 4: 验证 + Commit**

```bash
cd mobile && npx tsc --noEmit && npx expo lint
git add 'mobile/src/app/dish/[id].tsx' 'mobile/src/app/ingredient/[id].tsx'
git commit -m "feat(mobile): 菜品/食材详情页本人与admin可见编辑入口,焦点自动刷新"
```

---

### Task 13: edit-dish 编辑表单页

**Files:**
- Create: `mobile/src/app/edit-dish/[id].tsx`
- Modify: `mobile/src/api/content-api.ts`

- [ ] **Step 1: content-api 加 update 函数**

```ts
/** 编辑私有/管理内容(PATCH 白名单字段;409 重名/400 details 逐字抛出)。 */
export function updateDish(id: number, patch: Partial<Record<keyof Dish, string>>): Promise<Dish> {
  return apiFetch<Dish>(`/api/dishes/${id}`, { method: 'PATCH', body: patch });
}
```

- [ ] **Step 2: 实现 edit-dish/[id].tsx**

结构对齐 edit-profile.tsx（KeyboardAvoidingView + topBar 返回 + 表单 + PrimaryButton）。完整骨架：

```tsx
/** 编辑菜品(登录 push,本人私有或 admin):Field 表单 + 节气 chips 多选(升序自动排序),
 *  提交 PATCH /api/dishes/<id>;400 details/409 重名逐字呈现。 */
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field } from '@/components/ui/field';
import { FilterChip } from '@/components/ui/filter-chip';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useToast } from '@/components/ui/toast';
import { getDish, listTerms, updateDish } from '@/api/content-api';
import { useAsync } from '@/hooks/use-async';
import { ApiError } from '@/api/client';
import { colors, functional } from '@/theme/tokens';
import { pagePad, radius, spacing, type } from '@/theme/theme';

/** 逗号串 ↔ 数组 */
const toList = (s: string | null) => (s ? s.split(',').map((v) => v.trim()).filter(Boolean) : []);
const joinList = (arr: string[]) => arr.join(',');

export default function EditDishScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { data: dish } = useAsync(() => getDish(Number(id)), [id]);
  const { data: terms } = useAsync(listTerms, []);

  const [form, setForm] = useState<Record<string, string>>({});
  const [pickedTerms, setPickedTerms] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dish) {
      setForm({
        name: dish.name, main_ingredients: dish.main_ingredients, extras: dish.extras ?? '',
        steps: dish.steps, calories: dish.calories, benefits: dish.benefits,
        story: dish.story ?? '', caution: dish.caution ?? '', style: dish.style,
        image: dish.image ?? '',
      });
      setPickedTerms(toList(dish.solar_terms));
    }
  }, [dish]);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** 节气多选:保持词表升序(后端校验硬规则) */
  function toggleTerm(t: string) {
    setPickedTerms((prev) => {
      const next = prev.includes(t) ? prev.filter((v) => v !== t) : [...prev, t];
      const order = terms ?? [];
      return next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    });
  }

  async function save() {
    if (!dish) return;
    if (!form.name?.trim() || !form.main_ingredients?.trim() || !form.steps?.trim() || !form.calories?.trim()) {
      setErrors(['菜名、主料、步骤、热量为必填']);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      await updateDish(dish.id, {
        name: form.name.trim(), main_ingredients: form.main_ingredients, extras: form.extras || null,
        steps: form.steps, calories: form.calories, benefits: form.benefits,
        story: form.story || null, caution: form.caution || null, style: form.style,
        image: form.image || null, solar_terms: pickedTerms.join(','),
      });
      toast.showToast('已保存');
      router.back();
    } catch (e) {
      if (e instanceof ApiError) {
        // 400 校验:{"error":"校验未通过","details":[...]};其余直接透传文案
        setErrors([e.message]);
      } else {
        setErrors(['网络连接失败,请检查网络后重试']);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!dish) {
    return (
      <View style={statics.centered}>
        <Text style={[type.body, { color: colors.ink2 }]}>加载中…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={statics.flex}>
      <ScrollView contentContainerStyle={[statics.content, { paddingTop: insets.top + spacing.s2 }]} keyboardShouldPersistTaps="handled">
        <View style={statics.topBar}>
          <Text style={[type.serifTitle, { color: colors.ink }]}>编辑菜品</Text>
        </View>

        <Field label="菜名" required value={form.name ?? ''} onChangeText={(v) => set('name', v)} maxLength={100} error={null} />
        <Field label="主料(食材 分量,逗号分隔)" required value={form.main_ingredients ?? ''} onChangeText={(v) => set('main_ingredients', v)} maxLength={500} />
        <Field label="辅料/调料(可空)" value={form.extras ?? ''} onChangeText={(v) => set('extras', v)} maxLength={500} />
        <Field label="制作步骤(一行一步)" required multiline value={form.steps ?? ''} onChangeText={(v) => set('steps', v)} />
        <Field label="热量估算" required value={form.calories ?? ''} onChangeText={(v) => set('calories', v)} maxLength={50} />
        <Field label="养生好处" required value={form.benefits ?? ''} onChangeText={(v) => set('benefits', v)} multiline maxLength={500} />
        <Field label="风味与文化(可空)" value={form.story ?? ''} onChangeText={(v) => set('story', v)} multiline maxLength={500} />
        <Field label="忌口提示(可空)" value={form.caution ?? ''} onChangeText={(v) => set('caution', v)} multiline maxLength={500} />
        <Field label="菜系与做法(逗号分隔)" value={form.style ?? ''} onChangeText={(v) => set('style', v)} maxLength={100} />

        <Text style={statics.blockLabel}>当令节气(已选自动升序)</Text>
        <View style={statics.chipWrap}>
          {(terms ?? []).map((t) => (
            <FilterChip key={t} label={t} selected={pickedTerms.includes(t)} onPress={() => toggleTerm(t)} />
          ))}
        </View>

        <Field label="图片 URL(可空)" value={form.image ?? ''} onChangeText={(v) => set('image', v)} maxLength={500} />

        {errors.map((e) => (
          <Text key={e} accessibilityRole="alert" style={statics.error}>{e}</Text>
        ))}

        <View style={statics.submitWrap}>
          <PrimaryButton label="保存" loading={saving} onPress={save} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const statics = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { backgroundColor: colors.bg, paddingHorizontal: pagePad, paddingBottom: 40, gap: spacing.s4 },
  topBar: { height: 44, justifyContent: 'center', marginBottom: spacing.s2 },
  blockLabel: { ...type.caption, fontWeight: '600', color: colors.ink2, marginTop: spacing.s2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s2 },
  error: { ...type.caption, color: functional.danger, fontWeight: '600' },
  submitWrap: { marginTop: spacing.s4 },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
```

**400 details 增强**（可选做对）：`ApiError` 只带 `message`（=「校验未通过」），details 未透出。在 save 的 catch 里不拆 details（client.ts 不改，保持信封简单），必填前端已拦,列宽/值域错误以 e.message 呈现即可接受——**如果执行时发现 e.message 信息不足,在 client.ts 的 errorFrom 里把 `details` 数组拼进 message**：`new ApiError([data.error, ...(Array.isArray(data.details) ? data.details : [])].join('\n'), res.status)`。

- [ ] **Step 3: 验证 + Commit**

```bash
cd mobile && npx tsc --noEmit && npx expo lint
git add 'mobile/src/app/edit-dish/[id].tsx' mobile/src/api/content-api.ts
git commit -m "feat(mobile): 菜品编辑表单页(Field + 节气升序多选)"
```

---

### Task 14: edit-ingredient 编辑表单页

**Files:**
- Create: `mobile/src/app/edit-ingredient/[id].tsx`
- Modify: `mobile/src/api/content-api.ts`

- [ ] **Step 1: content-api 加两个函数**

```ts
export function updateIngredient(
  id: number,
  patch: Partial<Record<keyof Ingredient, string | null>>,
): Promise<Ingredient> {
  return apiFetch<Ingredient>(`/api/ingredients/${id}`, { method: 'PATCH', body: patch });
}

/** GET /api/vocab → 编辑表单封闭值域(chips 数据源) */
export interface VocabLists {
  solar_terms: string[];
  categories: string[];
  natures: string[];
  flavors: string[];
  meridians: string[];
  benefits: string[];
}

export function getVocab(): Promise<VocabLists> {
  return apiFetch<VocabLists>('/api/vocab', { auth: false });
}
```

- [ ] **Step 2: 实现 edit-ingredient/[id].tsx**

整体骨架与 Task 13 的 edit-dish 相同（topBar/KeyboardAvoidingView/PrimaryButton/errors/保存流程复用同构代码），差异在字段组：

```tsx
/** 编辑食材(登录 push,本人私有或 admin):文本 Field + 词表 chips
 *  (分类≤3/功效≤3多选、四气单选、五味/归经/节气多选升序),PATCH /api/ingredients/<id>。 */
```

组件内数据装载：

```tsx
  const { data: item } = useAsync(() => getIngredient(Number(id)), [id]);
  const { data: vocab } = useAsync(getVocab, []);

  const [form, setForm] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name, aliases: item.aliases ?? '', season_note: item.season_note ?? '',
        caution: item.caution ?? '', classic_note: item.classic_note ?? '', image: item.image ?? '',
      });
      setPicked({
        category: toList(item.category), nature: item.nature ? [item.nature] : [],
        flavor: toList(item.flavor), meridian: toList(item.meridian),
        benefits: toList(item.benefits), solar_terms: toList(item.solar_terms),
      });
    }
  }, [item]);
```

多选/单选切换（nature 单选；category/benefits ≤3 上限）：

```tsx
  function toggle(group: string, value: string, opts: { single?: boolean; max?: number } = {}) {
    setPicked((prev) => {
      const cur = prev[group] ?? [];
      let next: string[];
      if (opts.single) {
        next = cur.includes(value) ? [] : [value];
      } else if (cur.includes(value)) {
        next = cur.filter((v) => v !== value);
      } else {
        next = opts.max && cur.length >= opts.max ? cur : [...cur, value];
      }
      if (group === 'solar_terms') {
        const order = vocab?.solar_terms ?? [];
        next = [...next].sort((a, b) => order.indexOf(a) - order.indexOf(b));
      }
      return { ...prev, [group]: next };
    });
  }
```

表单区块（Field 文本域 + 六组 chips，每组一个 blockLabel）：

```tsx
        <Field label="名称" required value={form.name ?? ''} onChangeText={(v) => set('name', v)} maxLength={50} />
        <Field label="别名(逗号分隔,可空)" value={form.aliases ?? ''} onChangeText={(v) => set('aliases', v)} maxLength={200} />
        <Field label="时令备注(如 全年 / 9-11月)" value={form.season_note ?? ''} onChangeText={(v) => set('season_note', v)} maxLength={100} />
        <Field label="食用注意(可空)" multiline value={form.caution ?? ''} onChangeText={(v) => set('caution', v)} maxLength={500} />
        <Field label="国学注脚(典籍:原文)" multiline value={form.classic_note ?? ''} onChangeText={(v) => set('classic_note', v)} maxLength={500} />
        <Field label="图片 URL(可空)" value={form.image ?? ''} onChangeText={(v) => set('image', v)} maxLength={500} />

        <ChipGroup label="分类(1-3 个)" values={vocab?.categories ?? []} picked={picked.category ?? []}
          onPress={(v) => toggle('category', v, { max: 3 })} />
        <ChipGroup label="四气(单选)" values={vocab?.natures ?? []} picked={picked.nature ?? []}
          onPress={(v) => toggle('nature', v, { single: true })} />
        <ChipGroup label="五味(多选)" values={vocab?.flavors ?? []} picked={picked.flavor ?? []}
          onPress={(v) => toggle('flavor', v)} />
        <ChipGroup label="归经(多选)" values={vocab?.meridians ?? []} picked={picked.meridian ?? []}
          onPress={(v) => toggle('meridian', v)} />
        <ChipGroup label="功效(0-3 个)" values={vocab?.benefits ?? []} picked={picked.benefits ?? []}
          onPress={(v) => toggle('benefits', v, { max: 3 })} />
        <ChipGroup label="当令节气(升序)" values={vocab?.solar_terms ?? []} picked={picked.solar_terms ?? []}
          onPress={(v) => toggle('solar_terms', v)} />
```

ChipGroup 辅助组件（文件内）：

```tsx
function ChipGroup({ label, values, picked, onPress }: {
  label: string; values: string[]; picked: string[]; onPress: (v: string) => void;
}) {
  return (
    <View>
      <Text style={statics.blockLabel}>{label}</Text>
      <View style={statics.chipWrap}>
        {values.map((v) => (
          <FilterChip key={v} label={v} selected={picked.includes(v)} onPress={() => onPress(v)} />
        ))}
      </View>
    </View>
  );
}
```

save 校验与提交（对齐后端 validate_ingredient 硬规则）：

```tsx
  async function save() {
    if (!item) return;
    const errs: string[] = [];
    if (!form.name?.trim()) errs.push('name: 必填');
    if (!(picked.category ?? []).length) errs.push('category: 至少 1 个');
    if (!(picked.nature ?? []).length) errs.push('nature: 必选');
    if (!(picked.flavor ?? []).length) errs.push('flavor: 至少 1 个');
    if (!(picked.meridian ?? []).length) errs.push('meridian: 至少 1 个');
    if (!(picked.solar_terms ?? []).length) errs.push('solar_terms: 至少 1 个');
    if (errs.length) { setErrors(errs); return; }
    setSaving(true);
    setErrors([]);
    try {
      await updateIngredient(item.id, {
        name: form.name.trim(), aliases: form.aliases || null,
        category: picked.category.join(','), nature: picked.nature.join(','),
        flavor: picked.flavor.join(','), meridian: picked.meridian.join(','),
        benefits: picked.benefits.join(',') || null, season_note: form.season_note || null,
        caution: form.caution || null, classic_note: form.classic_note || null,
        image: form.image || null, solar_terms: picked.solar_terms.join(','),
      });
      toast.showToast('已保存');
      router.back();
    } catch (e) {
      setErrors([e instanceof ApiError ? e.message : '网络连接失败,请检查网络后重试']);
    } finally {
      setSaving(false);
    }
  }
```

（`toList`/`joinList`/statics 骨架从 Task 13 复制；import 换成 `getIngredient, getVocab, updateIngredient`。）

- [ ] **Step 3: 验证 + Commit**

```bash
cd mobile && npx tsc --noEmit && npx expo lint
git add 'mobile/src/app/edit-ingredient/[id].tsx' mobile/src/api/content-api.ts
git commit -m "feat(mobile): 食材编辑表单页(词表 chips 多选/单选+节气升序)"
```

---

### Task 15: 全量验证与手工闭环

- [ ] **Step 1: 自动化全跑**

```bash
cd mobile && npx tsc --noEmit && npx expo lint && npx jest
cd .. && .venv/bin/python -m pytest tests/ -v
```

Expected: 全绿。

- [ ] **Step 2: 启动联调（用户侧或本机）**

后端 `.venv/bin/python -m web.app`；移动端 `EXPO_PUBLIC_API_BASE_URL=http://192.168.71.138:8787 npx expo start --lan`。

- [ ] **Step 3: 手工清单**

1. 登录页/编辑资料：输入框浮动标签动画、聚焦描边、错误朱砂描边
2. 未登录点工坊两入口 → 登录页
3. 登录后菜品生成 → 成功 → 「我的私有食单」出现该菜（待审核）
4. 详情页见「编辑」→ 改名保存 → 返回详情已刷新
5. 食材编辑页 chips 全组可选、节气自动升序、保存成功
6. 普通用户「我的」无「官方库审核」；admin 账号可见且工坊有审核待办
7. 工坊无「最近批次」卡；无 API 名/流程链文案
8. 匿名 curl `POST /api/dishes`（无 header）→ 仍 200 官方库路径：
   `curl -s -X POST http://127.0.0.1:8787/api/dishes -H 'Content-Type: application/json' -d '{"ingredients":["山药"]}'`
9. 带库内验证：`.venv/bin/python -c "from shike import repository; print([ (d['name'], d['user_id']) for d in repository.list_dishes() ])"` 确认归属

- [ ] **Step 4: 收尾提交**

```bash
git add -A && git commit -m "chore: 五项体验修订与私有内容闭环收尾"
```

---

## Self-Review 记录

- **Spec 覆盖**：①=Task1-4；②=Task4-5；③=Task6；④=Task7；⑤后端=Task8-10、移动端=Task11-14；验证=Task15 ✓
- **占位符**：Task4 ①的「组合行保留」为明确决策非占位；Task9 FakeFiller 注明以现有测试合法值为准并给出修正路径 ✓
- **类型一致**：`labelFloatState`/`FieldProps`/`updateDish`/`updateIngredient`/`getVocab`/`VocabLists` 各任务引用名一致；`toggle`/`toggleTerm`/`ChipGroup` 在各自文件内定义 ✓
