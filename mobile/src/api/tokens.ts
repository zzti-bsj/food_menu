/** 双令牌存储:原生 iOS Keychain / Android Keystore(expo-secure-store);Web 用 localStorage。
 *  SecureStore 必须 web 分支内懒加载:其 web 构建在模块求值期即崩溃(import 即炸,不调用也炸)。
 *  设计系统 §10:access 2h / refresh 30 天;移动端不放 AsyncStorage。 */
import { Platform } from 'react-native';

const KEY_ACCESS = 'shike.access';
const KEY_REFRESH = 'shike.refresh';

/** 惰性取得 SecureStore(仅在原生分支调用) */
function secureStore(): typeof import('expo-secure-store') {
  return require('expo-secure-store');
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return secureStore().getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await secureStore().setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await secureStore().deleteItemAsync(key);
}

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([setItem(KEY_ACCESS, accessToken), setItem(KEY_REFRESH, refreshToken)]);
}

export async function getAccessToken(): Promise<string | null> {
  return getItem(KEY_ACCESS);
}

export async function getRefreshToken(): Promise<string | null> {
  return getItem(KEY_REFRESH);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([deleteItem(KEY_ACCESS), deleteItem(KEY_REFRESH)]);
}
