/** 内容端点封装 —— 契约见 web/app.py:
 *  GET /api/terms → 24 节气名数组;GET /api/vocab → 编辑表单全部封闭值域;
 *  GET /api/ingredients|dishes → 按 status 三态分组;
 *  GET /api/ingredients/{id}|dishes/{id → 行(可见性规则后端已做,他人私有 404);
 *  PATCH /api/ingredients/{id}|dishes/{id → 全字段轻校验更新(仅本人或 admin);
 *  POST /api/uploads → multipart 图片上传 → { url }(相对路径,展示侧拼 API_BASE_URL);
 *  GET /api/cuisines → 菜系名数组。 */
import { apiFetch, apiUpload } from './client';
import type { ContentVocab, Dish, Ingredient, StatusGrouped } from './types';

/** C 端唯一可见的审核状态(§10:C 端只呈现「已通过」) */
export const VISIBLE_STATUS = '已通过' as const;

export function listTerms(): Promise<string[]> {
  return apiFetch<string[]>('/api/terms', { auth: false });
}

/** 三态整表(C 端调用方应经 listApproved* 过滤;工坊 Phase 5 用原样分组) */
/** 分组列表带令牌请求:后端按「官方 + 本人」过滤,匿名则仅官方(归属模型 §可见性)。 */
export function listIngredientGroups(): Promise<StatusGrouped<Ingredient>> {
  return apiFetch<StatusGrouped<Ingredient>>('/api/ingredients');
}

export function listDishGroups(): Promise<StatusGrouped<Dish>> {
  return apiFetch<StatusGrouped<Dish>>('/api/dishes');
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

/** 编辑表单的全部封闭值域(词表文件为唯一事实来源,后端原样下发) */
export function fetchVocab(): Promise<ContentVocab> {
  return apiFetch<ContentVocab>('/api/vocab', { auth: false });
}

/** 编辑保存:PATCH 全字段轻校验(可选字段清空传 null);409 名称冲突等错误文案逐字透传。 */
export function updateDish(id: number, fields: Partial<Dish>): Promise<Dish> {
  return apiFetch<Dish>(`/api/dishes/${id}`, { method: 'PATCH', body: fields });
}

export function updateIngredient(id: number, fields: Partial<Ingredient>): Promise<Ingredient> {
  return apiFetch<Ingredient>(`/api/ingredients/${id}`, { method: 'PATCH', body: fields });
}

/** 封面图上传:返回相对 URL(如 /uploads/xxx.png),由调用方写入 image 字段一并保存。 */
export function uploadImage(file: { uri: string; name: string; mimeType: string }): Promise<{ url: string }> {
  return apiUpload<{ url: string }>('/api/uploads', file);
}

/** 删除私有内容(后端硬规则:仅本人或 admin;官方库 403)。 */
export function deleteDish(id: number): Promise<void> {
  return apiFetch<{ ok: boolean }>(`/api/dishes/${id}`, { method: 'DELETE' }).then(() => undefined);
}

export function deleteIngredient(id: number): Promise<void> {
  return apiFetch<{ ok: boolean }>(`/api/ingredients/${id}`, { method: 'DELETE' }).then(() => undefined);
}
