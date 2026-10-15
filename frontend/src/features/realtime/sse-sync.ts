/**
 * Quản lý chia sẻ một kết nối SSE duy nhất giữa nhiều tab cùng trình duyệt bằng BroadcastChannel.
 * Tab Leader sẽ giữ kết nối SSE và chuyển tiếp sự kiện đến các tab Follower.
 * Nếu Leader đóng tab, một tab khác sẽ tự động nhận quyền Leader và kết nối SSE.
 */

type SyncMessage =
  | { type: 'WHO_IS_LEADER'; from: string }
  | { type: 'I_AM_LEADER'; leaderId: string }
  | { type: 'HEARTBEAT'; leaderId: string }
  | { type: 'RESIGN'; leaderId: string }
  | { type: 'EVENT'; eventType: string; data: string }
  | { type: 'STATUS'; connected: boolean };

export class SseTabSync {
  private channel: BroadcastChannel | null = null;
  private readonly tabId = Math.random().toString(36).slice(2, 10);
  private isLeader = false;
  private leaderId: string | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private checkLeaderTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastLeaderHeartbeat = 0;
  private disposed = false;

  private onEventCallback: ((eventType: string, data: string) => void) | null = null;
  private onStatusCallback: ((connected: boolean) => void) | null = null;
  private startSseCallback: (() => void) | null = null;
  private stopSseCallback: (() => void) | null = null;

  constructor(callbacks: {
    onEvent: (eventType: string, data: string) => void;
    onStatus: (connected: boolean) => void;
    startSse: () => void;
    stopSse: () => void;
  }) {
    this.onEventCallback = callbacks.onEvent;
    this.onStatusCallback = callbacks.onStatus;
    this.startSseCallback = callbacks.startSse;
    this.stopSseCallback = callbacks.stopSse;
  }

  start(): void {
    if (typeof window === 'undefined') return;

    if (!('BroadcastChannel' in window)) {
      // Trình duyệt cũ không hỗ trợ BroadcastChannel -> fallback chạy SSE trực tiếp
      this.isLeader = true;
      this.startSseCallback?.();
      return;
    }

    this.channel = new BroadcastChannel('xvip_realtime_stream');
    this.channel.onmessage = (e: MessageEvent<SyncMessage>) => this.handleMessage(e.data);

    // Hỏi xem đã có ai làm leader chưa
    this.postMessage({ type: 'WHO_IS_LEADER', from: this.tabId });

    // Sau 350ms nếu không ai nhận làm leader thì tab này tự làm leader
    this.checkLeaderTimeout = setTimeout(() => {
      if (!this.leaderId) {
        this.claimLeadership();
      }
    }, 350);

    // Kiểm tra liveness của leader mỗi 2 giây
    this.heartbeatInterval = setInterval(() => {
      if (this.disposed) return;
      if (this.isLeader) {
        this.postMessage({ type: 'HEARTBEAT', leaderId: this.tabId });
      } else if (this.leaderId) {
        const now = Date.now();
        if (now - this.lastLeaderHeartbeat > 4500) {
          // Leader chết hoặc bị đơ -> Bầu leader mới
          this.leaderId = null;
          this.claimLeadership();
        }
      }
    }, 2000);

    window.addEventListener('beforeunload', this.handleUnload);
  }

  private handleUnload = () => {
    if (this.isLeader) {
      this.postMessage({ type: 'RESIGN', leaderId: this.tabId });
    }
  };

  private handleMessage(msg: SyncMessage): void {
    if (this.disposed) return;

    switch (msg.type) {
      case 'WHO_IS_LEADER':
        if (this.isLeader) {
          this.postMessage({ type: 'I_AM_LEADER', leaderId: this.tabId });
        }
        break;

      case 'I_AM_LEADER':
        this.leaderId = msg.leaderId;
        this.lastLeaderHeartbeat = Date.now();
        if (this.leaderId !== this.tabId && this.isLeader) {
          // Xung đột leader: tab có ID nhỏ hơn nhường
          if (this.tabId > msg.leaderId) {
            this.relinquishLeadership();
          }
        }
        break;

      case 'HEARTBEAT':
        if (msg.leaderId !== this.tabId) {
          this.leaderId = msg.leaderId;
          this.lastLeaderHeartbeat = Date.now();
        }
        break;

      case 'RESIGN':
        if (msg.leaderId === this.leaderId) {
          this.leaderId = null;
          this.claimLeadership();
        }
        break;

      case 'EVENT':
        if (!this.isLeader) {
          this.onEventCallback?.(msg.eventType, msg.data);
        }
        break;

      case 'STATUS':
        if (!this.isLeader) {
          this.onStatusCallback?.(msg.connected);
        }
        break;
    }
  }

  private claimLeadership(): void {
    this.isLeader = true;
    this.leaderId = this.tabId;
    this.lastLeaderHeartbeat = Date.now();
    this.postMessage({ type: 'I_AM_LEADER', leaderId: this.tabId });
    this.startSseCallback?.();
  }

  private relinquishLeadership(): void {
    this.isLeader = false;
    this.stopSseCallback?.();
  }

  /** Được gọi bởi SSE của tab Leader để phát sự kiện cho các tab con */
  broadcastEvent(eventType: string, data: string): void {
    if (this.isLeader) {
      this.postMessage({ type: 'EVENT', eventType, data });
    }
  }

  /** Được gọi bởi SSE của tab Leader để phát trạng thái kết nối cho các tab con */
  broadcastStatus(connected: boolean): void {
    if (this.isLeader) {
      this.postMessage({ type: 'STATUS', connected });
    }
  }

  private postMessage(msg: SyncMessage): void {
    try {
      this.channel?.postMessage(msg);
    } catch {
      // Phớt lờ nếu channel đã đóng
    }
  }

  destroy(): void {
    this.disposed = true;
    window.removeEventListener('beforeunload', this.handleUnload);
    if (this.checkLeaderTimeout) clearTimeout(this.checkLeaderTimeout);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    if (this.isLeader) {
      this.postMessage({ type: 'RESIGN', leaderId: this.tabId });
      this.stopSseCallback?.();
    }

    try {
      this.channel?.close();
    } catch {
      // Ignored
    }
    this.channel = null;
  }
}
