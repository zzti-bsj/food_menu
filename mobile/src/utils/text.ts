/** 行内字段解析:后端以逗号/换行分隔的字符串字段 → 结构化数据(db/schema.sql 注释口径)。 */
import type { Dish } from '@/api/types';

/** 「白萝卜 半根,鸡胸肉 1块」→ [{name, amount}](无分量时 amount null) */
export function parseIngredients(text: string): { name: string; amount: string | null }[] {
  return text
    .split(/[,，]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(\S+)(?:\s+(.+))?$/);
      return match ? { name: match[1], amount: match[2] ?? null } : { name: part, amount: null };
    });
}

/** 步骤 TEXT「1. xxx\n2. yyy」→ 去掉序号后的步骤数组 */
export function parseSteps(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[.、:：]?\s*/, '').trim())
    .filter(Boolean);
}

/** 逗号分隔多选 → 数组(归经/功效/分类/节气等通用) */
export function splitList(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** style「日式,凉拌」→ { cuisine, method };单段时两者同值 */
export function parseStyle(text: string): { cuisine: string; method: string } {
  const parts = splitList(text);
  return { cuisine: parts[0] ?? '', method: parts[1] ?? parts[0] ?? '' };
}

/** 菜品全部用到的食材名(主料+辅料,去重保序)— 备料清单/关联食材 */
export function dishIngredientNames(dish: Dish): string[] {
  const all = [...parseIngredients(dish.main_ingredients), ...parseIngredients(dish.extras ?? '')];
  return [...new Set(all.map((i) => i.name))];
}
