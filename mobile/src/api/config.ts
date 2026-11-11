/** API 地址配置。后端:web/app.py → 127.0.0.1:8787。
 *  真机调试:设 EXPO_PUBLIC_API_BASE_URL=http://<电脑局域网IP>:8787
 *  Android 模拟器:默认 10.0.2.2(宿主回环别名);iOS 模拟器:127.0.0.1 直达宿主。 */
import { Platform } from 'react-native';

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  Platform.select({
    android: 'http://10.0.2.2:8787',
    default: 'http://127.0.0.1:8787',
  });
