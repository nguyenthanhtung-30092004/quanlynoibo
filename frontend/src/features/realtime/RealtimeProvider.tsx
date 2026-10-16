'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { SseTabSync } from './sse-sync';

/** Nhóm dữ liệu server báo đã đổi -> các khóa truy vấn cần tải lại */
const TOPIC_KEYS: Record<string, QueryKey[]> = {
  orders: [['orders', 'list'], ['orders', 'activity'], ['kpi']],
  partners: [['partners']],
  routes: [['routes']],
  carriers: [['carriers']],
  users: [['users']],
  presence: [['online-users']],
  leave: [['leave']],
};

/** Gom các sự kiện dồn dập (vd. nhập nhiều vé liền) thành một lần tải lại */
const BATCH_MS = 300;
const MAX_RETRY_MS = 30_000;

const RealtimeContext = createContext(false);

/** Có đang nhận được cập nhật trực tiếp từ máy chủ hay không */
export const useRealtimeConnected = () => useContext(RealtimeContext);

/**
 * Giữ một luồng SSE tới máy chủ (chia sẻ giữa các tab qua BroadcastChannel).
 * Khi có thay đổi, màn hình tự tải lại phần dữ liệu liên quan, không cần F5.
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
          // Chỉ tải lại query đang hiển thị trên màn hình, tránh tải ngầm tab nền
          queryClient.invalidateQueries({ queryKey, refetchType: 'active' });
        }
      }
      pending.clear();
    };

    const handleTopicChanged = (topic: string) => {
      pending.add(topic);
      // Jitter ngẫu nhiên 300ms - 1500ms để phân tán request, tránh 1000 máy cùng gọi server một lúc
      const jitter = Math.floor(Math.random() * 1200);
      batchTimer ??= setTimeout(flush, BATCH_MS + jitter);
    };

    const handleRawEvent = (eventType: string, data: string) => {
      if (eventType === 'change') {
        try {
          const { topic } = JSON.parse(data) as { topic: string };
          handleTopicChanged(topic);
        } catch {
          // Bỏ qua gói tin hỏng
        }
      }
    };

    let sync: SseTabSync | null = null;

    const stopSse = () => {
      if (source) {
        source.close();
        source = null;
      }
      clearTimeout(retryTimer);
    };

    const startSse = () => {
      if (disposed || source) return;

      source = new EventSource('/api/realtime/stream');

      source.onopen = () => {
        retryMs = 1000;
        setConnected(true);
        sync?.broadcastStatus(true);
        // Vừa nối lại sau khi mất kết nối: có thể đã lỡ sự kiện, tải lại tất cả
        if (wasDown) {
          wasDown = false;
          queryClient.invalidateQueries({ refetchType: 'active' });
        }
      };

      source.addEventListener('change', (e) => {
        const rawData = (e as MessageEvent<string>).data;
        sync?.broadcastEvent('change', rawData);
        handleRawEvent('change', rawData);
      });

      source.onerror = () => {
        setConnected(false);
        sync?.broadcastStatus(false);
        wasDown = true;
        // Trình duyệt tự nối lại khi mạng rớt; nếu server từ chối (đóng hẳn) thì tự thử lại có giãn cách
        if (source?.readyState === EventSource.CLOSED) {
          stopSse();
          retryTimer = setTimeout(startSse, retryMs);
          retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
        }
      };
    };

    sync = new SseTabSync({
      onEvent: (eventType, data) => handleRawEvent(eventType, data),
      onStatus: (status) => setConnected(status),
      startSse,
      stopSse,
    });
    sync.start();

    return () => {
      disposed = true;
      sync?.destroy();
      stopSse();
      clearTimeout(batchTimer);
    };
  }, [queryClient]);

  return <RealtimeContext.Provider value={connected}>{children}</RealtimeContext.Provider>;
}
