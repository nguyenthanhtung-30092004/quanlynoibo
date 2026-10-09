'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

/** Nhóm dữ liệu server báo đã đổi -> các khóa truy vấn cần tải lại */
const TOPIC_KEYS: Record<string, QueryKey[]> = {
  orders: [['orders'], ['kpi']],
  partners: [['partners']],
  routes: [['routes']],
  carriers: [['carriers']],
  users: [['users']],
};

/** Gom các sự kiện dồn dập (vd. nhập nhiều vé liền) thành một lần tải lại */
const BATCH_MS = 300;
const MAX_RETRY_MS = 30_000;

const RealtimeContext = createContext(false);

/** Có đang nhận được cập nhật trực tiếp từ máy chủ hay không */
export const useRealtimeConnected = () => useContext(RealtimeContext);

/**
 * Giữ một luồng SSE tới máy chủ (qua proxy /api). Khi người khác thêm/sửa/hủy
 * vé, đổi đối tác... màn hình tự tải lại phần dữ liệu liên quan, không cần F5.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let batchTimer: ReturnType<typeof setTimeout> | undefined;
    let retryMs = 1000;
    let wasDown = false;
    let disposed = false;
    const pending = new Set<string>();

    const flush = () => {
      batchTimer = undefined;
      for (const topic of pending) {
        for (const queryKey of TOPIC_KEYS[topic] ?? []) {
          queryClient.invalidateQueries({ queryKey });
        }
      }
      pending.clear();
    };

    const connect = () => {
      if (disposed) return;
      source = new EventSource('/api/realtime/stream');

      source.onopen = () => {
        retryMs = 1000;
        setConnected(true);
        // Vừa nối lại sau khi mất kết nối: có thể đã lỡ sự kiện, tải lại tất cả
        if (wasDown) {
          wasDown = false;
          queryClient.invalidateQueries();
        }
      };

      source.addEventListener('change', (e) => {
        try {
          const { topic } = JSON.parse((e as MessageEvent<string>).data) as { topic: string };
          pending.add(topic);
          batchTimer ??= setTimeout(flush, BATCH_MS);
        } catch {
          // Bỏ qua gói tin hỏng
        }
      });

      source.onerror = () => {
        setConnected(false);
        wasDown = true;
        // Trình duyệt tự nối lại khi mạng rớt; nếu server từ chối (đóng hẳn) thì tự thử lại có giãn cách
        if (source?.readyState === EventSource.CLOSED) {
          source.close();
          retryTimer = setTimeout(connect, retryMs);
          retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
        }
      };
    };

    connect();
    return () => {
      disposed = true;
      source?.close();
      clearTimeout(retryTimer);
      clearTimeout(batchTimer);
    };
  }, [queryClient]);

  return <RealtimeContext.Provider value={connected}>{children}</RealtimeContext.Provider>;
}
