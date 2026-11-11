/** 工坊端点封装 —— 契约见 web/app.py + llm/batch.py + llm/dish_pipeline.py + llm/cuisine_pipeline.py:
 *  POST /api/batch {term} → {term, recommended[], inserted[], doubts{name:[]}, failed[{name,stage,errors?|problems?}]}
 *  POST /api/dishes 健康厨师 {ingredients[]} → stage: inserted/duplicate/rejected/invalid
 *  POST /api/dishes 美食大厨 {chef:"cuisine", mode, ...} → stage: 上四种 + invalid_input/not_found
 *  POST /api/status|/api/dish/status {name, status} → {ok:true} */
import { apiFetch } from './client';
import type { Dish } from './types';

/** 食材批量流水线结果(llm/batch.py run) */
export interface BatchResult {
  term: string;
  recommended: string[];
  inserted: string[];
  /** 存疑:name → 存疑点列表(可能为字符串数组或字符串,渲染层归一) */
  doubts: Record<string, unknown>;
  /** 失败明细:含 stage 与 errors/problems */
  failed: { name: string; stage: string; errors?: string[]; problems?: string[] }[];
}

/** 健康厨师结果(stage 与字段随分支不同) */
export interface DishChefResult {
  stage: 'inserted' | 'duplicate' | 'rejected' | 'invalid' | string;
  ingredients?: string[];
  name?: string;
  dish?: Dish;
  excluded?: string[];
  errors?: string[];
  problems?: string[];
  doubts?: string[];
}

/** 美食大厨结果(六 stage) */
export interface CuisineChefResult {
  stage: 'inserted' | 'duplicate' | 'rejected' | 'invalid' | 'invalid_input' | 'not_found' | string;
  reason?: string;
  ingredients?: string[];
  mode?: string;
  name?: string;
  dish?: Dish;
  excluded?: string[];
  errors?: string[];
  problems?: string[];
  doubts?: string[];
}

export function runBatch(term: string): Promise<BatchResult> {
  return apiFetch<BatchResult>('/api/batch', { method: 'POST', body: { term } });
}

export function getLastBatch(): Promise<BatchResult | null> {
  return apiFetch<BatchResult | null>('/api/batch/last', { auth: false });
}

/** 健康厨师:ingredients 非空字符串数组(去重保序由端内做,后端也会做) */
export function runDishChef(ingredients: string[]): Promise<DishChefResult> {
  return apiFetch<DishChefResult>('/api/dishes', {
    method: 'POST',
    body: { ingredients },
  });
}

/** 美食大厨:mode = cuisine | name | ingredient */
export function runCuisineChef(
  mode: 'cuisine' | 'name' | 'ingredient',
  payload: { cuisine?: string; name?: string; ingredients?: string[] },
): Promise<CuisineChefResult> {
  return apiFetch<CuisineChefResult>('/api/dishes', {
    method: 'POST',
    body: { chef: 'cuisine', mode, ...payload },
  });
}

/** 食材审核状态写入(仅工坊;name 为业务键) */
export function setIngredientStatus(name: string, status: '已通过' | '已驳回'): Promise<void> {
  return apiFetch<{ ok: boolean }>('/api/status', { method: 'POST', body: { name, status } }).then(
    () => undefined,
  );
}

/** 菜品审核状态写入 */
export function setDishStatus(name: string, status: '已通过' | '已驳回'): Promise<void> {
  return apiFetch<{ ok: boolean }>('/api/dish/status', {
    method: 'POST',
    body: { name, status },
  }).then(() => undefined);
}
