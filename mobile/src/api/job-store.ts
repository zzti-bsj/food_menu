/** 在途生成作业号持久化:进程被杀/冷启动后,回到生成页可凭 job_id 重新接续服务端作业。
 *  存储 同 tokens.ts:原生 expo-secure-store(懒加载,web 构建在 import 期即崩),Web 用 localStorage。 */
import { Platform } from 'react-native';

const keyOf = (screen: string) => `shike.job.${screen}`;

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

export async function savePendingJob(screen: string, jobId: string): Promise<void> {
  await setItem(keyOf(screen), jobId);
}

export async function getPendingJob(screen: string): Promise<string | null> {
  return getItem(keyOf(screen));
}

export async function clearPendingJob(screen: string): Promise<void> {
  await deleteItem(keyOf(screen));
}
