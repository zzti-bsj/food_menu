/** API client:Bearer 注入 / 401 单飞 refresh 轮换重试 / 失败清退并广播 / 接口 error 文案逐字透传。
 *  后端契约(web/app.py):成功直接返回 JSON;失败 {"error": "..."} + 4xx/5xx,无统一信封。 */
import { API_BASE_URL } from './config';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './tokens';
import type { AuthSession, User } from './types';

export class ApiError extends Error {
  /** 0 = 网络层失败(后端不可达) */
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** JSON 请求体 */
  body?: unknown;
  /** 默认 true:附带 access 令牌;登录/注册/刷新类调用传 false */
  auth?: boolean;
}

/* ---- 令牌失效广播(AuthProvider 订阅后回到登录态;每次失效只广播一次) ---- */
type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();
let sessionActive = false;

/** 令牌保存成功后调用,标记会话有效(下次 refresh 失败才广播)。 */
export function markSessionActive(): void {
  sessionActive = true;
}

/** 订阅「refresh 失败、会话终止」事件;返回退订函数。 */
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

/** 保存双令牌并标记会话有效(login/register/refresh 共用)。 */
export async function storeSession(pair: AuthSession): Promise<void> {
  await saveTokens(pair.token, pair.refresh_token);
  markSessionActive();
}

/* ---- 单飞 refresh:并发 401 共享同一次轮换;失败时返回携带接口文案的 ApiError ---- */
let refreshInFlight: Promise<ApiError | null> | null = null;

function refreshOnce(): Promise<ApiError | null> {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** 成功返回 null(令牌已轮换);失败返回带原文文案的 ApiError。 */
async function doRefresh(): Promise<ApiError | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return new ApiError('登录状态已失效', 401);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
  } catch {
    return new ApiError('网络连接失败,请检查网络后重试', 0);
  }
  if (!res.ok) return errorFrom(res);
  try {
    const pair = (await res.json()) as AuthSession;
    await storeSession(pair);
    return null;
  } catch {
    return new ApiError('refresh 令牌无效或已过期', 401);
  }
}

/** 不需要触发 refresh 的路径(其 401 即业务失败) */
function refreshExempt(path: string): boolean {
  return path.startsWith('/api/auth/refresh');
}

/** 冷启动恢复会话:本机存有 refresh 令牌则轮换并落库,返回用户;否则清退返回 null。 */
export async function bootstrapSession(): Promise<User | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
  } catch {
    // 网络不可达时保留令牌,待联网后由 401 拦截链路恢复
    return null;
  }
  if (!res.ok) {
    await clearTokens();
    return null;
  }
  try {
    const pair = (await res.json()) as AuthSession;
    await storeSession(pair);
    return pair.user;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const useAuth = options.auth !== false;
  const accessToken = useAuth ? await getAccessToken() : null;
  // 仅携带令牌的调用才允许触发 refresh;登录/注册等匿名调用的 401 是业务失败,直接透传
  return request<T>(path, options, accessToken, useAuth);
}

async function request<T>(
  path: string,
  options: ApiOptions,
  accessToken: string | null,
  allowRefresh: boolean,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError('网络连接失败,请检查网络后重试', 0);
  }

  if (res.status === 401 && allowRefresh && !refreshExempt(path)) {
    const refreshError = await refreshOnce();
    if (!refreshError) {
      return request<T>(path, options, await getAccessToken(), false);
    }
    await clearTokens();
    if (sessionActive) {
      sessionActive = false;
      unauthorizedListeners.forEach((fn) => fn());
    }
    // 抛 refresh 接口的原文文案(如「refresh 令牌无效或已过期」),而非原请求的笼统 401
    throw refreshError;
  }

  if (!res.ok) {
    throw await errorFrom(res);
  }
  return (await res.json()) as T;
}

async function errorFrom(res: Response): Promise<ApiError> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data?.error === 'string') {
      return new ApiError(data.error, res.status);
    }
  } catch {
    // 响应体非 JSON,走下方兜底
  }
  return new ApiError(`请求失败(${res.status})`, res.status);
}
