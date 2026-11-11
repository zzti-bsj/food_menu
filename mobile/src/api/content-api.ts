/** 内容端点封装 —— 契约见 web/app.py:
 *  GET /api/terms → 24 节气名数组;GET /api/ingredients|dishes → 按 status 三态分组;
 *  GET /api/ingredients/{id}|dishes/{id → 行(可见性规则后端已做,他人私有 404);
 *  GET /api/cuisines → 菜系名数组。 */
import { apiFetch } from './client';
import type { Dish, Ingredient, StatusGrouped } from './types';

/** C 端唯一可见的审核状态(§10:C 端只呈现「已通过」) */
export const VISIBLE_STATUS = '已通过' as const;

export function listTerms(): Promise<string[]> {
  return apiFetch<string[]>('/api/terms', { auth: false });
}

/** 三态整表(C 端调用方应经 listApproved* 过滤;工坊 Phase 5 用原样分组) */
export function listIngredientGroups(): Promise<StatusGrouped<Ingredient>> {
  return apiFetch<StatusGrouped<Ingredient>>('/api/ingredients', { auth: false });
}

export function listDishGroups(): Promise<StatusGrouped<Dish>> {
  return apiFetch<StatusGrouped<Dish>>('/api/dishes', { auth: false });
}

export async function listApprovedIngredients(): Promise<Ingredient[]> {
  const groups = await listIngredientGroups();
  return groups[VISIBLE_STATUS];
}

export async function listApprovedDishes(): Promise<Dish[]> {
  const groups = await listDishGroups();
  return groups[VISIBLE_STATUS];
}

export function getIngredient(id: number): Promise<Ingredient> {
  return apiFetch<Ingredient>(`/api/ingredients/${id}`);
}

export function getDish(id: number): Promise<Dish> {
  return apiFetch<Dish>(`/api/dishes/${id}`);
}

export function listCuisines(): Promise<string[]> {
  return apiFetch<string[]>('/api/cuisines', { auth: false });
}

/** 删除私有内容(后端硬规则:仅本人或 admin;官方库 403)。 */
export function deleteDish(id: number): Promise<void> {
  return apiFetch<{ ok: boolean }>(`/api/dishes/${id}`, { method: 'DELETE' }).then(() => undefined);
}

export function deleteIngredient(id: number): Promise<void> {
  return apiFetch<{ ok: boolean }>(`/api/ingredients/${id}`, { method: 'DELETE' }).then(() => undefined);
}
