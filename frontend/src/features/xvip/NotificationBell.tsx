'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, PaperPlaneTilt, PencilSimple, PlusCircle, XCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/cn';
import { formatDateTimeShort } from '@/lib/format';
import { useCurrentUser } from '@/features/auth/hooks';
import { useOrderActivity } from '@/features/orders/hooks';
import type { OrderActivity, OrderHistoryAction } from '@/features/orders/types';

const ACTION_VIEW: Record<OrderHistoryAction, { verb: string; icon: typeof Bell; color: string }> = {
  CREATE: { verb: 'tạo vé mới', icon: PlusCircle, color: 'bg-emerald-600' },
  UPDATE: { verb: 'sửa vé', icon: PencilSimple, color: 'bg-amber-500' },
  CANCEL: { verb: 'hủy vé', icon: XCircle, color: 'bg-rose-600' },
  SEND_MESSAGE: { verb: 'gửi tin cho khách', icon: PaperPlaneTilt, color: 'bg-blue-600' },
};

/** Mốc "đã xem" lưu ở trình duyệt, theo từng tài khoản; chỉ là tiện ích nên lỗi lưu trữ thì bỏ qua */
const seenKey = (userId: number) => `qlnb_notif_seen_${userId}`;
const readSeen = (userId: number) => {
  try {
    return localStorage.getItem(seenKey(userId));
  } catch {
    return null;
  }
};
const writeSeen = (userId: number, iso: string) => {
  try {
    localStorage.setItem(seenKey(userId), iso);
  } catch {
    // Không lưu được thì lần sau coi như chưa xem
  }
};

function describe(a: OrderActivity) {
  const who = a.actorName || 'Hệ thống';
  const target = [a.customerName, a.routeName].filter(Boolean).join(' · ');
  // Tin nhắn: dùng luôn mô tả đã ghi ('Gửi SMS cho khách') để biết kênh nào, hạ chữ đầu cho nối câu
  const verb =
    a.action === 'SEND_MESSAGE' && a.summary
      ? a.summary.charAt(0).toLocaleLowerCase('vi') + a.summary.slice(1)
      : ACTION_VIEW[a.action].verb;
  return { who, verb, target };
}

/** Chuông thông báo: hoạt động mới trên vé của người khác (và của hệ thống), cập nhật trực tiếp */
export function NotificationBell() {
  const { data: me } = useCurrentUser();
  const { data: items = [] } = useOrderActivity();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Mốc xem lần cuối của tài khoản này
  useEffect(() => {
    if (me) setSeen(readSeen(me.id));
  }, [me]);

  const latest = items[0]?.createdAt ?? null;

  // Lần đầu dùng chuông (chưa có mốc): coi các thông báo hiện có là đã xem, tránh dồn một loạt số đỏ
  useEffect(() => {
    if (me && latest && readSeen(me.id) === null) {
      writeSeen(me.id, latest);
      setSeen(latest);
    }
  }, [me, latest]);

  // Chỉ đếm hoạt động của người khác; việc tự mình làm không cần báo lại
  const unread = useMemo(
    () => items.filter((a) => a.actorId !== me?.id && seen !== null && a.createdAt > seen).length,
    [items, me, seen],
  );

  const markSeen = () => {
    if (me && latest) {
      writeSeen(me.id, latest);
      setSeen(latest);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) {
        setOpen(false);
        markSeen();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        markSeen();
      }
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, latest, me]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (open) markSeen();
          setOpen((o) => !o);
        }}
        aria-label={unread > 0 ? `Thông báo, ${unread} chưa xem` : 'Thông báo'}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="btn-3d-mini relative size-9 rounded-xl"
      >
        <Bell size={20} weight="bold" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black leading-4 text-white shadow-[0_2px_4px_rgba(225,29,72,0.5)]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Thông báo"
          className="absolute right-0 top-full z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <span className="text-sm font-extrabold text-slate-800 dark:text-white">Thông báo</span>
            <span className="text-[11px] font-semibold text-slate-400">7 ngày gần đây</span>
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
              Chưa có hoạt động nào.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {items.map((a) => {
                const view = ACTION_VIEW[a.action];
                const Icon = view.icon;
                const { who, verb, target } = describe(a);
                const isNew = a.actorId !== me?.id && seen !== null && a.createdAt > seen;
                return (
                  <li key={a.id}>
                    <Link
                      href="/xvip/quan-ly-ve"
                      onClick={() => {
                        setOpen(false);
                        markSeen();
                      }}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 hover:bg-blue-50/60 dark:hover:bg-slate-800/60',
                        isNew && 'bg-blue-50/40 dark:bg-blue-950/20',
                      )}
                    >
                      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-white', view.color)}>
                        <Icon size={16} weight="bold" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-slate-800 dark:text-slate-100">
                          <strong>{a.actorId === me?.id ? 'Bạn' : who}</strong> {verb}
                        </span>
                        {target && (
                          <span className="block truncate text-xs font-medium text-slate-500 dark:text-slate-400">{target}</span>
                        )}
                        <span className="block text-[11px] font-semibold text-slate-400">{formatDateTimeShort(a.createdAt)}</span>
                      </span>
                      {isNew && <span className="mt-2 size-2 shrink-0 rounded-full bg-blue-600" aria-label="Chưa xem" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
