/** Toast(§7):底部上浮于 Dock 上方 12px,3s 自动消失,aria-live 等价(accesibilityLiveRegion polite)。 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';
import { radius, shadows, type, z } from '@/theme/theme';

export interface ToastContextValue {
  showToast(message: string): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const DURATION_MS = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const nextId = useRef(0);
  const insets = useSafeAreaInsets();

  const showToast = useCallback((message: string) => {
    setToast({ message, id: ++nextId.current });
  }, []);

  useEffect(() => {
    if (!toast) return;
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        setToast(null);
      });
    }, DURATION_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[statics.wrap, { bottom: insets.bottom + 84 }]}
        >
          <Animated.View style={[statics.bubble, shadows.float.android, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
            <Text style={statics.text}>{toast.message}</Text>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast 必须在 ToastProvider 内使用');
  }
  return ctx;
}

const statics = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: z.toast,
    elevation: z.toast,
  },
  bubble: {
    maxWidth: '86%',
    borderRadius: radius.m,
    backgroundColor: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  text: {
    ...type.body,
    color: colors.surface,
  },
});
