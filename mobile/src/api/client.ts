/** API client:Bearer 注入 / 401 单飞 refresh 轮换重试 / 失败清退并广播 / 接口 error 文案逐字透传。
 *  后端契约(web/app.py):成功直接返回 JSON;失败 {"error": "..."} + 4xx/5xx,无统一信封。 */
import { Platform } from 'react-native';
import { API_BASE_URL } from './config';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './tokens';
import type { AuthSession, User } from './types';

export class ApiError extends Error {
  /** 0 = 网络层失败(后端不可达) */
  constructor(
    message: string,
    readonly status: number,
    /** PATCH 校验失败的逐字段明细(「字段: 文案」数组,error=「校验未通过」时附带) */
    readonly details?: string[],
  ) {
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

/** 主动轮换一次令牌(原生上传通道 401 时复用同一单飞)。成功返回 null。 */
export function refreshOnce(): Promise<ApiError | null> {
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

/** 上传接口:web 走 fetch + FormData(blob);原生走 expo-file-system 原生 multipart 上传
 *  任务(原生层直读本地文件,RN FormData 在部分设备读不了裁剪输出导致请求发不出去)。
 *  服务端契约不变:POST multipart 字段 file + Bearer,响应 JSON。401 同一套 refresh 单飞。 */
export async function apiUpload<T>(path: string, file: { uri: string; name: string; mimeType: string }): Promise<T> {
  if (Platform.OS === 'web') {
    return uploadOnce<T>(path, file, await getAccessToken(), true);
  }
  return nativeUpload<T>(path, file);
}

async function nativeUpload<T>(
  path: string,
  file: { uri: string; name: string; mimeType: string },
): Promise<T> {
  // 动态引入:避免 JSON 客户端测试路径加载原生模块
  const { File, UploadType } = await import('expo-file-system');
  const send = async (token: string | null) => {
    const task = new File(file.uri).createUploadTask(`${API_BASE_URL}${path}`, {
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType: file.mimeType,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return task.uploadAsync();
  };

  let result: Awaited<ReturnType<typeof send>>;
  try {
    result = await send(await getAccessToken());
  } catch {
    throw new ApiError('网络连接失败,请检查网络后重试', 0);
  }
  if (result.status === 401) {
    const refreshError = await refreshOnce();
    if (!refreshError) {
      result = await send(await getAccessToken());
    } else {
      await clearTokens();
      if (sessionActive) {
        sessionActive = false;
        unauthorizedListeners.forEach((fn) => fn());
      }
      throw refreshError;
    }
  }
  if (result.status < 200 || result.status >= 300) {
    try {
      const data = JSON.parse(result.body) as { error?: unknown };
      if (typeof data?.error === 'string') {
        throw new ApiError(data.error, result.status);
      }
    } catch (e) {
      if (e instanceof ApiError) throw e;
    }
    throw new ApiError(`请求失败(${result.status})`, result.status);
  }
  return JSON.parse(result.body) as T;
}

async function uploadOnce<T>(
  path: string,
  file: { uri: string; name: string; mimeType: string },
  accessToken: string | null,
  allowRefresh: boolean,
): Promise<T> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    // RN-web 不支持 { uri } 文件部分:先取 blob 再传
    const blob = await fetch(file.uri).then((res) => res.blob());
    form.append('file', blob, file.name);
  } else {
    form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
    });
  } catch {
    throw new ApiError('网络连接失败,请检查网络后重试', 0);
  }
  if (res.status === 401 && allowRefresh) {
    const refreshError = await refreshOnce();
    if (!refreshError) {
      return uploadOnce<T>(path, file, await getAccessToken(), false);
    }
    await clearTokens();
    if (sessionActive) {
      sessionActive = false;
      unauthorizedListeners.forEach((fn) => fn());
    }
    throw refreshError;
  }
  if (!res.ok) {
    throw await errorFrom(res);
  }
  return (await res.json()) as T;
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
    const data = (await res.json()) as { error?: unknown; details?: unknown };
    if (typeof data?.error === 'string') {
      const details = Array.isArray(data.details)
        ? data.details.filter((d): d is string => typeof d === 'string')
        : undefined;
      return new ApiError(data.error, res.status, details);
    }
  } catch {
    // 响应体非 JSON,走下方兜底
  }
  return new ApiError(`请求失败(${res.status})`, res.status);
}
