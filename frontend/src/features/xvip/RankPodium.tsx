import type { ComponentType } from 'react';
import { Bed, Coffee, Crown, Medal, Moon, Sparkle, type IconProps } from '@phosphor-icons/react';

export interface PodiumEntry {
  staffId: number;
  fullName: string;
  total: number;
  seats: number;
}

/** honor = bục vinh danh (nhiều vé nhất); potential = bảng tiềm năng chưa khai phá (ít vé nhất) */
export type PodiumTheme = 'honor' | 'potential';

interface Look {
  icon: ComponentType<IconProps>;
  title: string;
  /** Nền thẻ: gradient đậm, chữ trắng */
  card: string;
  /** Quầng sáng phía sau thẻ */
  glow: string;
  /** Màu chữ cái trong ảnh đại diện */
  initial: string;
}

const LOOKS: Record<PodiumTheme, [Look, Look, Look]> = {
  honor: [
    {
      icon: Crown,
      title: 'Quán quân toàn hệ thống',
      card: 'from-yellow-300 via-amber-500 to-orange-600',
      glow: 'shadow-[0_18px_44px_-8px_rgba(245,158,11,0.75)]',
      initial: 'text-amber-600',
    },
    {
      icon: Medal,
      title: 'Á quân bán vé',
      card: 'from-slate-300 via-slate-500 to-slate-700',
      glow: 'shadow-[0_12px_28px_-8px_rgba(71,85,105,0.65)]',
      initial: 'text-slate-600',
    },
    {
      icon: Medal,
      title: 'Hạng ba',
      card: 'from-orange-300 via-amber-700 to-orange-900',
      glow: 'shadow-[0_12px_28px_-8px_rgba(194,65,12,0.6)]',
      initial: 'text-orange-700',
    },
  ],
  potential: [
    {
      icon: Bed,
      title: 'Siêu lười',
      card: 'from-rose-500 via-pink-600 to-fuchsia-700',
      glow: 'shadow-[0_18px_44px_-8px_rgba(225,29,72,0.7)]',
      initial: 'text-rose-600',
    },
    {
      icon: Coffee,
      title: 'Ngồi chơi ít thôi',
      card: 'from-orange-400 via-orange-500 to-red-600',
      glow: 'shadow-[0_12px_28px_-8px_rgba(234,88,12,0.65)]',
      initial: 'text-orange-600',
    },
    {
      icon: Moon,
      title: 'Ngủ ít thôi',
      card: 'from-indigo-500 via-violet-600 to-purple-800',
      glow: 'shadow-[0_12px_28px_-8px_rgba(109,40,217,0.65)]',
      initial: 'text-violet-700',
    },
  ],
};

/** Hạng 1 ở giữa và to nhất, hạng 2 bên trái, hạng 3 bên phải (máy tính); điện thoại xếp 1 rồi 2, 3 cạnh nhau */
export function RankPodium({ entries, theme }: { entries: readonly PodiumEntry[]; theme: PodiumTheme }) {
  const looks = LOOKS[theme];
  const only = entries.length === 1;
  return (
    <div className="grid grid-cols-2 gap-3 pt-2 md:grid-cols-3 md:items-end md:gap-4">
      {entries.slice(0, 3).map((e, i) => (
        <RankCard
          key={e.staffId}
          entry={e}
          rank={i + 1}
          look={looks[i]}
          className={
            i === 0
              ? `col-span-2 md:col-span-1 md:order-2 ${only ? 'md:col-start-2' : ''}`
              : i === 1
                ? 'md:order-1'
                : 'md:order-3'
          }
        />
      ))}
    </div>
  );
}

function RankCard({
  entry,
  rank,
  look,
  className,
}: {
  entry: PodiumEntry;
  rank: number;
  look: Look;
  className: string;
}) {
  const hero = rank === 1;
  const Icon = look.icon;
  const initial = entry.fullName.trim().split(' ').pop()?.charAt(0) ?? '?';
  const empty = entry.total === 0 && entry.seats === 0;
  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${look.card} ${look.glow} text-center text-white ring-1 ring-white/30 ${
        hero ? 'px-4 pb-5 pt-6 md:pb-8 md:pt-8' : 'px-2.5 pb-4 pt-5'
      } ${className}`}
    >
      {/* Trang trí: vòng sáng và tia lấp lánh */}
      <span className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/20 blur-2xl" />
      <span className="pointer-events-none absolute -bottom-12 -left-10 size-40 rounded-full bg-black/15 blur-2xl" />
      <Sparkle
        weight="fill"
        className="pointer-events-none absolute left-4 top-4 size-4 animate-pulse text-white/80"
      />
      <Sparkle
        weight="fill"
        className="pointer-events-none absolute right-5 top-12 size-3 animate-pulse text-white/60 [animation-delay:600ms]"
      />

      {/* Hạng */}
      <span
        className={`absolute left-3 top-3 flex items-center justify-center rounded-full bg-white/25 font-black backdrop-blur ${
          hero ? 'size-9 text-lg' : 'size-7 text-sm'
        }`}
      >
        {rank}
      </span>

      <div className="relative flex flex-col items-center">
        <Icon
          weight="fill"
          className={`drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] ${hero ? 'size-11 animate-bounce' : 'size-7'}`}
        />

        <span
          className={`mt-2 flex items-center justify-center rounded-full bg-white font-black shadow-[0_6px_16px_rgba(0,0,0,0.3)] ring-4 ring-white/60 ${look.initial} ${
            hero ? 'size-24 text-5xl' : 'size-14 text-2xl'
          }`}
        >
          {initial}
        </span>

        <span
          className={`mt-3 w-full break-words font-black leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] ${
            hero ? 'text-2xl' : 'text-base'
          }`}
        >
          {entry.fullName}
        </span>

        <span
          className={`mt-1.5 rounded-full bg-white/25 font-black uppercase tracking-wide backdrop-blur ${
            hero ? 'px-3.5 py-1 text-xs' : 'px-2.5 py-0.5 text-[10px]'
          }`}
        >
          {look.title}
        </span>

        <div
          className={`mt-3 grid w-full rounded-2xl bg-black/20 backdrop-blur ${
            empty ? 'grid-cols-1 py-3' : 'grid-cols-2 divide-x divide-white/25 py-2.5'
          }`}
        >
          {empty ? (
            <span className="text-sm font-bold">Chưa có đơn nào</span>
          ) : (
            <>
              <div>
                <div className={`tnum font-black leading-none ${hero ? 'text-4xl' : 'text-2xl'}`}>{entry.seats}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/80">vé</div>
              </div>
              <div>
                <div className={`tnum font-black leading-none ${hero ? 'text-4xl' : 'text-2xl'}`}>{entry.total}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/80">đơn</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
