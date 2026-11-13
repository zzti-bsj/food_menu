/** 生成作业 hook:启动服务端异步作业 + 轮询快照,让长流水线抗切后台/锁屏/进程被杀。
 *  - 轮询请求是秒级短连接,后台被断网只影响当拍:静默退避重试,回前台(AppState active)立即补拍;
 *  - 作业号落盘(job-store):进程被杀后冷启动,回到生成页自动接续未完成的作业取结果;
 *  - 作业 404/403(服务重启或 TTL 过期)转可重试错误;其余网络失败不外显,避免误报「网络错误」。 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError } from '@/api/client';
import { clearPendingJob, getPendingJob, savePendingJob } from '@/api/job-store';
import { getGenerationJob } from '@/api/workshop-api';

const POLL_MS = 2500;
/** 连续失败后的轮询上限(仍会恢复,只是降频) */
const POLL_MAX_MS = 8000;

/** 启动器:由调用方拼 payload(食材批次 / 健康厨师 / 美食大厨),hook 只管作业生命周期 */
export type JobLauncher = () => Promise<{ job_id: string }>;

export interface GenerationJobState<T> {
  running: boolean;
  error: string | null;
  result: T | null;
  /** 启动一次生成(旧结果与错误一并清掉) */
  start: (launch: JobLauncher) => void;
}

export function useGenerationJob<T>(screen: 'pipeline' | 'dish'): GenerationJobState<T> {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const jobRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef(POLL_MS);
  const aliveRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finish = useCallback(
    (jobId: string) => {
      if (jobRef.current === jobId) jobRef.current = null;
      setRunning(false);
      void clearPendingJob(screen);
    },
    [screen],
  );

  const poll = useCallback(() => {
    const jobId = jobRef.current;
    if (!jobId || !aliveRef.current) return;
    getGenerationJob<T>(jobId)
      .then((snap) => {
        if (!aliveRef.current || jobRef.current !== jobId) return;
        if (snap.status === 'done') {
          setResult(snap.result ?? null);
          finish(jobId);
        } else if (snap.status === 'error') {
          setError(snap.error ?? '生成失败,请重试');
          finish(jobId);
        } else {
          intervalRef.current = POLL_MS;
          timerRef.current = setTimeout(poll, POLL_MS);
        }
      })
      .catch((e: unknown) => {
        if (!aliveRef.current || jobRef.current !== jobId) return;
        if (e instanceof ApiError && e.status !== 0) {
          // 4xx/5xx:作业已丢失或不可读(服务重启 / TTL 过期),静等无意义,转可重试错误
          setError(
            e.status === 404 ? '生成任务已失效(服务重启或超时),请重新运行' : e.message,
          );
          finish(jobId);
          return;
        }
        // 网络层失败(切后台断网等):静默退避,回前台由 AppState 补拍
        intervalRef.current = Math.min(intervalRef.current + POLL_MS, POLL_MAX_MS);
        timerRef.current = setTimeout(poll, intervalRef.current);
      });
  }, [finish, screen]);

  const start = useCallback(
    (launch: JobLauncher) => {
      stopPolling();
      jobRef.current = null;
      setError(null);
      setResult(null);
      setRunning(true);
      launch()
        .then(({ job_id }) => {
          if (!aliveRef.current) return;
          jobRef.current = job_id;
          intervalRef.current = POLL_MS;
          void savePendingJob(screen, job_id);
          timerRef.current = setTimeout(poll, POLL_MS);
        })
        .catch((e: unknown) => {
          if (!aliveRef.current) return;
          setError(e instanceof ApiError ? e.message : '网络连接失败,请检查网络后重试');
          setRunning(false);
        });
    },
    [poll, screen, stopPolling],
  );

  // 冷启动接续 + 回前台补拍;卸载只停轮询(落盘的作业号留给下次进入接续)
  useEffect(() => {
    aliveRef.current = true;
    void (async () => {
      const saved = await getPendingJob(screen);
      if (!saved || !aliveRef.current || jobRef.current) return;
      jobRef.current = saved;
      setRunning(true);
      poll();
    })();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && jobRef.current) {
        stopPolling();
        intervalRef.current = POLL_MS;
        poll();
      }
    });
    return () => {
      aliveRef.current = false;
      stopPolling();
      subscription.remove();
    };
  }, [poll, screen, stopPolling]);

  return { running, error, result, start };
}
