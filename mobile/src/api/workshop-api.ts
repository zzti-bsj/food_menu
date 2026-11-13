/** 工坊端点封装 —— 契约见 web/app.py + llm/batch.py + llm/dish_pipeline.py + llm/cuisine_pipeline.py:
 *  POST /api/jobs {kind:"batch"|"dish", payload} → 202 {job_id}(流水线转服务端后台线程,抗切后台断连)
 *  GET /api/jobs/{id} → {status:"running"|"done"|"error", result?, error?}(完成快照服务端保留 15 分钟)
 *  POST /api/batch {term} → 同步版(保留给 web 控制台;移动端不再使用)
 *  POST /api/dishes 健康厨师 {ingredients[]} / 美食大厨 {chef:"cuisine", mode, ...}(同步版,同上)
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

/** 生成作业快照(status=done 携 result,error 携 error 文案) */
export interface GenerationJobSnapshot<T> {
  status: 'running' | 'done' | 'error' | string;
  result?: T;
  error?: string;
}

export type GenerationJobKind = 'batch' | 'dish';

export function startGenerationJob(
  kind: GenerationJobKind,
  payload: Record<string, unknown>,
): Promise<{ job_id: string }> {
  return apiFetch<{ job_id: string }>('/api/jobs', { method: 'POST', body: { kind, payload } });
}

export function getGenerationJob<T>(jobId: string): Promise<GenerationJobSnapshot<T>> {
  return apiFetch<GenerationJobSnapshot<T>>(`/api/jobs/${jobId}`);
}

/** 食材流水线作业:payload {term} */
export function startBatchJob(term: string): Promise<{ job_id: string }> {
  return startGenerationJob('batch', { term });
}

/** 健康厨师作业:ingredients 非空字符串数组(去重保序由端内做,后端也会做) */
export function startDishJob(ingredients: string[]): Promise<{ job_id: string }> {
  return startGenerationJob('dish', { ingredients });
}

/** 美食大厨作业:mode = cuisine | name | ingredient */
export function startCuisineJob(
  mode: 'cuisine' | 'name' | 'ingredient',
  payload: { cuisine?: string; name?: string; ingredients?: string[] },
): Promise<{ job_id: string }> {
  return startGenerationJob('dish', { chef: 'cuisine', mode, ...payload });
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
