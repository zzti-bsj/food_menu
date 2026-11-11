/** 登录态 Context:冷启动 bootstrap 恢复、登录/注册写状态、令牌失效广播联动清退。 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { bootstrapSession, onUnauthorized } from '@/api/client';
import * as authApi from '@/api/auth-api';
import type { User } from '@/api/types';

export interface AuthContextValue {
  /** null = 未登录 */
  user: User | null;
  /** 冷启动恢复会话进行中(避免登录态闪变) */
  restoring: boolean;
  signIn(phone: string, password: string): Promise<void>;
  signUp(phone: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** 本地同步 PATCH me 后的用户视图(服务端已落库) */
  updateLocalUser(user: User): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    bootstrapSession()
      .then(setUser)
      .finally(() => setRestoring(false));
    // refresh 失败(会话终止)→ 联动清登录态
    return onUnauthorized(() => setUser(null));
  }, []);

  const signIn = useCallback(async (phone: string, password: string) => {
    setUser(await authApi.login(phone, password));
  }, []);

  const signUp = useCallback(async (phone: string, password: string) => {
    setUser(await authApi.register(phone, password));
  }, []);

  const signOut = useCallback(async () => {
    await authApi.signOut();
    setUser(null);
  }, []);

  const updateLocalUser = useCallback((updated: User) => {
    setUser(updated);
  }, []);

  const value = useMemo(
    () => ({ user, restoring, signIn, signUp, signOut, updateLocalUser }),
    [user, restoring, signIn, signUp, signOut, updateLocalUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth 必须在 AuthProvider 内使用');
  }
  return ctx;
}
