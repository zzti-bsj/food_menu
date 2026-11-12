/** 鉴权端点封装 —— 契约见 web/app.py:
 *  register 201 / login 200 → {token, refresh_token, user};me → {user};
 *  PATCH me(body: nickname | avatar | password+current_password)→ {user}。 */
import { apiFetch, storeSession } from './client';
import { clearTokens } from './tokens';
import type { AuthSession, User } from './types';

/** 注册成功即登录(后端直接签发令牌对)。 */
export async function register(phone: string, password: string): Promise<User> {
  const session = await apiFetch<AuthSession>('/api/auth/register', {
    method: 'POST',
    body: { phone, password },
    auth: false,
  });
  await storeSession(session);
  return session.user;
}

/** 登录。失败文案逐字来自后端:「手机号或密码不正确」/「账号已禁用」。 */
export async function login(phone: string, password: string): Promise<User> {
  const session = await apiFetch<AuthSession>('/api/auth/login', {
    method: 'POST',
    body: { phone, password },
    auth: false,
  });
  await storeSession(session);
  return session.user;
}

export async function fetchMe(): Promise<User> {
  const data = await apiFetch<{ user: User }>('/api/auth/me');
  return data.user;
}

/** 修改资料。昵称 1-50 字;头像为上传返回的 URL(null/空串清空);改密码须带 current_password。 */
export async function updateMe(fields: {
  nickname?: string;
  avatar?: string | null;
  password?: string;
  current_password?: string;
}): Promise<User> {
  const data = await apiFetch<{ user: User }>('/api/auth/me', { method: 'PATCH', body: fields });
  return data.user;
}

/** 退出:后端无撤销端点,仅清除本机双令牌(§10)。 */
export async function signOut(): Promise<void> {
  await clearTokens();
}
