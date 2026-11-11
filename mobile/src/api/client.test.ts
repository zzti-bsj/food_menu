/** apiFetch 契约测试:Bearer 注入 / 401 单飞 refresh / 失败清退 / 错误文案逐字透传。 */
import { apiFetch, ApiError, bootstrapSession, onUnauthorized, storeSession } from '@/api/client';
import type { User } from '@/api/types';
import * as tokens from '@/api/tokens';

jest.mock('@/api/tokens');

const mocked = tokens as jest.Mocked<typeof tokens>;

type FetchHandler = (url: string, init: RequestInit) => Response | Promise<Response>;
let handler: FetchHandler | null = null;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  jest.resetAllMocks();
  handler = null;
  globalThis.fetch = jest.fn((url: any, init: any) => {
    if (!handler) throw new Error('未设置 fetch handler');
    return Promise.resolve(handler(url, init));
  }) as unknown as typeof fetch;
  mocked.getAccessToken.mockResolvedValue(null);
  mocked.getRefreshToken.mockResolvedValue(null);
});

describe('apiFetch', () => {
  it('携带已有 access 令牌并返回解析后的 JSON', async () => {
    mocked.getAccessToken.mockResolvedValue('a1');
    let seenAuth: string | undefined;
    handler = (_url, init) => {
      seenAuth = (init.headers as Record<string, string>).Authorization;
      return json({ user: { id: 1 } });
    };

    const data = await apiFetch<{ user: { id: number } }>('/api/auth/me');

    expect(seenAuth).toBe('Bearer a1');
    expect(data.user.id).toBe(1);
  });

  it('auth:false 的调用不附带令牌', async () => {
    let seenAuth: string | undefined;
    handler = (_url, init) => {
      seenAuth = (init.headers as Record<string, string>).Authorization;
      return json({});
    };

    await apiFetch('/api/auth/login', { method: 'POST', body: {}, auth: false });

    expect(seenAuth).toBeUndefined();
  });

  it('并发 401 时 refresh 只发一次(单飞),重试均用新令牌', async () => {
    let access = 'a1';
    mocked.getAccessToken.mockImplementation(async () => access);
    mocked.getRefreshToken.mockResolvedValue('r1');
    let refreshCalls = 0;
    const retriedAuth: string[] = [];

    handler = (url, init) => {
      if (String(url).endsWith('/api/auth/refresh')) {
        refreshCalls += 1;
        access = 'a2';
        return json({ token: 'a2', refresh_token: 'r2', user: {} });
      }
      const auth = (init.headers as Record<string, string>).Authorization ?? '';
      if (auth === 'Bearer a2') {
        retriedAuth.push(auth);
        return json({ ok: true });
      }
      return json({ error: '登录已过期' }, 401);
    };

    const results = await Promise.all([
      apiFetch('/api/terms'),
      apiFetch('/api/terms'),
      apiFetch('/api/terms'),
    ]);

    expect(results).toHaveLength(3);
    expect(refreshCalls).toBe(1);
    expect(retriedAuth.filter((a) => a === 'Bearer a2')).toHaveLength(3);
  });

  it('refresh 失败:清除令牌、通知监听器、抛出接口原文错误', async () => {
    mocked.getAccessToken.mockResolvedValue('a1');
    mocked.getRefreshToken.mockResolvedValue('r1');
    handler = (url) => {
      if (String(url).endsWith('/api/auth/refresh')) {
        return json({ error: 'refresh 令牌无效或已过期' }, 401);
      }
      return json({ error: 'x' }, 401);
    };
    const notified: string[] = [];
    onUnauthorized(() => notified.push('out'));
    // 模拟已登录(会话有效)——失效广播每次失效只发一次
    await storeSession({ token: 'a1', refresh_token: 'r1', user: {} as User });

    await expect(apiFetch('/api/auth/me')).rejects.toThrow('refresh 令牌无效或已过期');
    await expect(apiFetch('/api/auth/me')).rejects.toMatchObject({ status: 401 });
    expect(mocked.clearTokens).toHaveBeenCalled();
    expect(notified).toEqual(['out']);
  });

  it('服务器 error 字段逐字透传(含状态码)', async () => {
    handler = () => json({ error: '手机号已注册:13800000000' }, 409);

    const err = (await apiFetch('/api/auth/register', { method: 'POST', body: {}, auth: false }).catch(
      (e) => e,
    )) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('手机号已注册:13800000000');
    expect(err.status).toBe(409);
  });

  it('登录 401 是业务失败:不触发 refresh、不清令牌、文案原样抛出', async () => {
    handler = () => json({ error: '手机号或密码不正确' }, 401);

    const err = (await apiFetch('/api/auth/login', { method: 'POST', body: {}, auth: false }).catch(
      (e) => e,
    )) as ApiError;

    expect(err.message).toBe('手机号或密码不正确');
    expect(err.status).toBe(401);
    expect(mocked.getRefreshToken).not.toHaveBeenCalled();
    expect(mocked.clearTokens).not.toHaveBeenCalled();
  });

  it('网络层失败返回可读错误(status 0)', async () => {
    handler = null;
    globalThis.fetch = jest.fn(() => Promise.reject(new TypeError('NetworkError'))) as unknown as typeof fetch;

    await expect(apiFetch('/api/terms', { auth: false })).rejects.toMatchObject({
      status: 0,
      message: '网络连接失败,请检查网络后重试',
    });
  });
});

describe('bootstrapSession', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    handler = null;
    globalThis.fetch = jest.fn((url: any, init: any) => {
      if (!handler) throw new Error('未设置 fetch handler');
      return Promise.resolve(handler(url, init));
    }) as unknown as typeof fetch;
    mocked.getAccessToken.mockResolvedValue(null);
    mocked.getRefreshToken.mockResolvedValue(null);
  });

  it('本机无 refresh 令牌:返回 null 且不请求', async () => {
    mocked.getRefreshToken.mockResolvedValue(null);

    await expect(bootstrapSession()).resolves.toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('有 refresh 令牌:轮换成功 → 落库并返回用户', async () => {
    mocked.getRefreshToken.mockResolvedValue('r1');
    handler = () => json({ token: 'a2', refresh_token: 'r2', user: { id: 7, phone: '13800000000', nickname: null, role: 'user', status: '正常' } });

    const user = await bootstrapSession();

    expect(user?.id).toBe(7);
    expect(mocked.saveTokens).toHaveBeenCalledWith('a2', 'r2');
  });

  it('refresh 令牌已失效:清令牌返回 null', async () => {
    mocked.getRefreshToken.mockResolvedValue('r-expired');
    handler = () => json({ error: 'refresh 令牌无效或已过期' }, 401);

    await expect(bootstrapSession()).resolves.toBeNull();
    expect(mocked.clearTokens).toHaveBeenCalled();
  });
});
