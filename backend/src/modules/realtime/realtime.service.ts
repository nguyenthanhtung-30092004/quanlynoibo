import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

/** Nhóm dữ liệu vừa thay đổi; client chỉ cần biết nhóm nào để tải lại, không nhận dữ liệu thật */
export const REALTIME_TOPICS = ['orders', 'partners', 'routes', 'carriers', 'users'] as const;
export type RealtimeTopic = (typeof REALTIME_TOPICS)[number];

export interface RealtimeEvent {
  topic: RealtimeTopic;
  /** Người thao tác, để máy của chính họ bỏ qua nếu cần */
  actorId: number | null;
}

/**
 * Kênh phát sự kiện trong bộ nhớ của tiến trình. Backend chạy một tiến trình nên
 * đủ dùng; nếu sau này chạy nhiều bản thì cần thay bằng Redis pub/sub.
 */
@Injectable()
export class RealtimeService {
  private readonly subject = new Subject<RealtimeEvent>();

  emit(event: RealtimeEvent): void {
    this.subject.next(event);
  }

  stream(): Observable<RealtimeEvent> {
    return this.subject.asObservable();
  }
}
