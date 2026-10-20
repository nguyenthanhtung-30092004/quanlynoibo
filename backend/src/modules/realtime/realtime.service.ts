import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Observable, Subject } from 'rxjs';
import { User } from '../users/entities/user.entity.js';
import { AttendanceService } from '../attendance/attendance.service.js';

/** Nhóm dữ liệu vừa thay đổi; client chỉ cần biết nhóm nào để tải lại, không nhận dữ liệu thật */
export const REALTIME_TOPICS = ['orders', 'partners', 'routes', 'carriers', 'users', 'presence', 'leave', 'attendance'] as const;
export type RealtimeTopic = (typeof REALTIME_TOPICS)[number];

export interface RealtimeEvent {
  topic: RealtimeTopic;
  /** Người thao tác, để máy của chính họ bỏ qua nếu cần */
  actorId: number | null;
}

export interface PresenceRecord {
  userId: number;
  connections: number;
  onlineSince: Date;
  lastSeenAt: Date;
}

export interface OnlineUserItem {
  userId: number;
  fullName: string;
  role: string;
  connections: number;
  onlineSince: string;
  lastSeenAt: string;
  todayMinutes: number;
}

/**
 * Kênh phát sự kiện và quản lý hiện diện (presence) trong bộ nhớ của tiến trình.
 * Backend chạy một tiến trình nên đủ dùng; nếu sau này chạy nhiều bản thì cần thay bằng Redis pub/sub.
 */
@Injectable()
export class RealtimeService {
  private readonly subject = new Subject<RealtimeEvent>();
  private readonly presenceMap = new Map<number, PresenceRecord>();

  constructor(
    @Optional() @InjectRepository(User) private readonly userRepository?: Repository<User>,
    @Optional() private readonly attendanceService?: AttendanceService,
  ) {}

  emit(event: RealtimeEvent): void {
    this.subject.next(event);
  }

  stream(): Observable<RealtimeEvent> {
    return this.subject.asObservable();
  }

  /** Thêm kết nối cho một người dùng (khi mở tab / SSE stream) */
  addConnection(userId: number): void {
    const existing = this.presenceMap.get(userId);
    const now = new Date();
    if (existing) {
      existing.connections += 1;
      existing.lastSeenAt = now;
    } else {
      this.presenceMap.set(userId, {
        userId,
        connections: 1,
        onlineSince: now,
        lastSeenAt: now,
      });
    }
    this.emit({ topic: 'presence', actorId: userId });
  }

  /** Giảm kết nối khi tab / SSE stream đóng; về 0 thì coi là offline */
  removeConnection(userId: number): void {
    const existing = this.presenceMap.get(userId);
    if (!existing) return;
    existing.connections -= 1;
    existing.lastSeenAt = new Date();
    if (existing.connections <= 0) {
      this.presenceMap.delete(userId);
    }
    this.emit({ topic: 'presence', actorId: userId });
  }

  isOnline(userId: number): boolean {
    const record = this.presenceMap.get(userId);
    return !!record && record.connections > 0;
  }

  getPresence(userId: number): PresenceRecord | undefined {
    return this.presenceMap.get(userId);
  }

  getAllPresence(): PresenceRecord[] {
    return Array.from(this.presenceMap.values());
  }

  /** Lấy danh sách đầy đủ tài khoản đang online kèm thông tin tên, vai trò và số phút online hôm nay */
  async getOnlineUsersData(): Promise<OnlineUserItem[]> {
    const records = this.getAllPresence();
    if (records.length === 0) return [];
    const userIds = records.map((r) => r.userId);

    const users = this.userRepository
      ? await this.userRepository.find({
          where: { id: In(userIds) },
          select: { id: true, fullName: true, role: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const minutesMap = this.attendanceService
      ? await this.attendanceService.getTodayMinutesMap(userIds)
      : new Map<number, number>();

    return records
      .map((r) => {
        const u = userMap.get(r.userId);
        return {
          userId: r.userId,
          fullName: u?.fullName ?? `User #${r.userId}`,
          role: u?.role ?? 'STAFF',
          connections: r.connections,
          onlineSince: r.onlineSince.toISOString(),
          lastSeenAt: r.lastSeenAt.toISOString(),
          todayMinutes: minutesMap.get(r.userId) ?? 0,
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
  }
}
