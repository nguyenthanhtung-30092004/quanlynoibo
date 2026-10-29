import type { ComponentType, CSSProperties } from 'react';
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
  /** Bệ đỡ phía dưới thẻ (chỉ hiện trên màn hình rộng) */
  pedestal: string;
  /** Quầng sáng phía sau thẻ */
  glow: string;
  /** Viền chuyển sắc quanh ảnh đại diện */
  ring: string;
  /** Màu chữ cái trong ảnh đại diện */
  initial: string;
}

const LOOKS: Record<PodiumTheme, [Look, Look, Look]> = {
  honor: [
    {
      icon: Crown,
      title: 'Vua gọi là có – Thánh chốt đơn',
      card: 'from-yellow-300 via-amber-500 to-orange-600',
      pedestal: 'from-amber-500 to-orange-700',
      glow: 'shadow-[0_14px_34px_-10px_rgba(245,158,11,0.8)]',
      ring: 'from-yellow-100 via-amber-300 to-orange-500',
      initial: 'text-amber-600',
    },
    {
      icon: Medal,
      title: 'Phó tướng săn vé – Chỉ thua cái ngai',
      card: 'from-slate-300 via-slate-500 to-slate-700',
      pedestal: 'from-slate-500 to-slate-800',
      glow: 'shadow-[0_10px_24px_-10px_rgba(71,85,105,0.7)]',
      ring: 'from-white via-slate-200 to-slate-400',
      initial: 'text-slate-600',
    },
    {
      icon: Medal,
      title: 'Tay đua nước rút – Sắp chiếm ngôi',
      card: 'from-orange-300 via-amber-700 to-orange-900',
      pedestal: 'from-amber-700 to-orange-950',
      glow: 'shadow-[0_10px_24px_-10px_rgba(194,65,12,0.65)]',
      ring: 'from-orange-100 via-orange-300 to-amber-700',
      initial: 'text-orange-700',
    },
  ],
  potential: [
    {
      icon: Bed,
      title: 'Đang giữ kỷ lục… ít vé nhất',
      card: 'from-rose-500 via-pink-600 to-fuchsia-700',
      pedestal: 'from-pink-600 to-fuchsia-800',
      glow: 'shadow-[0_14px_34px_-10px_rgba(225,29,72,0.75)]',
      ring: 'from-rose-100 via-pink-300 to-fuchsia-500',
      initial: 'text-rose-600',
    },
    {
      icon: Coffee,
      title: 'Cố thêm vài đơn nữa!',
      card: 'from-orange-400 via-orange-500 to-red-600',
      pedestal: 'from-orange-500 to-red-700',
      glow: 'shadow-[0_10px_24px_-10px_rgba(234,88,12,0.7)]',
      ring: 'from-orange-100 via-orange-300 to-red-500',
      initial: 'text-orange-600',
    },
    {
      icon: Moon,
      title: 'Sắp thoát bảng rồi!',
      card: 'from-indigo-500 via-violet-600 to-purple-800',
      pedestal: 'from-violet-600 to-purple-900',
      glow: 'shadow-[0_10px_24px_-10px_rgba(109,40,217,0.7)]',
      ring: 'from-indigo-100 via-violet-300 to-purple-500',
      initial: 'text-violet-700',
    },
  ],
};

/** Chiều cao bệ đỡ theo hạng (máy tính): hạng 1 cao nhất */
const PEDESTAL_HEIGHT = ['h-9', 'h-6', 'h-4'];

/** Lớp chấm bi mờ phủ lên nền thẻ cho đỡ phẳng */
const DOTS: CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.22) 1px, transparent 1.2px)',
  backgroundSize: '11px 11px',
};

/**
 * Hạng 1 ở giữa và nổi nhất, hạng 2 bên trái, hạng 3 bên phải trên bệ đỡ (máy tính);
 * điện thoại xếp thẻ hạng 1 chiếm cả hàng rồi hạng 2, 3 cạnh nhau.
 */
export function RankPodium({ entries, theme }: { entries: readonly PodiumEntry[]; theme: PodiumTheme }) {
  const looks = LOOKS[theme];
  const only = entries.length === 1;
  const topSeats = entries[0]?.seats ?? 0;
  return (
    <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2.5 pt-1 md:grid-cols-3 md:items-end md:gap-3">
      {entries.slice(0, 3).map((e, i) => (
        <div
          key={e.staffId}
          className={
            i === 0
              ? `col-span-2 md:col-span-1 md:order-2 ${only ? 'md:col-start-2' : ''}`
              : i === 1
                ? 'md:order-1'
                : 'md:order-3'
          }
        >
          <RankCard entry={e} rank={i + 1} look={looks[i]} gap={i === 0 ? 0 : topSeats - e.seats} theme={theme} />
          {/* Bệ đỡ: chỉ có trên màn hình rộng để ra dáng bục nhận giải */}
          <div
            className={`mx-2 hidden rounded-b-xl bg-gradient-to-b ${looks[i].pedestal} md:flex ${PEDESTAL_HEIGHT[i]} items-center justify-center text-xl font-black leading-none text-white/35 shadow-[inset_0_2px_0_rgba(255,255,255,0.25)]`}
            aria-hidden="true"
          >
            {i + 1}
          </div>
        </div>
      ))}
    </div>
  );
}

function RankCard({
  entry,
  rank,
  look,
  gap,
  theme,
}: {
  entry: PodiumEntry;
  rank: number;
  look: Look;
  /** Số vé kém hạng 1 (0 với hạng 1) */
  gap: number;
  theme: PodiumTheme;
}) {
  const hero = rank === 1;
  const Icon = look.icon;
  const initial = entry.fullName.trim().split(' ').pop()?.charAt(0) ?? '?';
  const empty = entry.total === 0 && entry.seats === 0;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${look.card} ${look.glow} text-center text-white ring-1 ring-white/40 ${
        hero ? 'px-3 pb-3.5 pt-4' : 'px-2 pb-3 pt-3.5'
      }`}
    >
      {/* Nền: chấm bi, vệt sáng chéo, vòng sáng và chữ số hạng chìm */}
      <span className="pointer-events-none absolute inset-0 opacity-70" style={DOTS} />
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/10" />
      <span className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-white/25 blur-2xl" />
      <span
        className={`pointer-events-none absolute -bottom-3 -right-1 select-none font-black leading-none text-white/15 ${
          hero ? 'text-[88px]' : 'text-[64px]'
        }`}
        aria-hidden="true"
      >
        {rank}
      </span>
      <Sparkle weight="fill" className="pointer-events-none absolute left-3 top-3 size-3 animate-pulse text-white/80" />
      {hero && (
        <Sparkle
          weight="fill"
          className="pointer-events-none absolute right-4 top-9 size-2.5 animate-pulse text-white/70 [animation-delay:700ms]"
        />
      )}

      <div className="relative flex flex-col items-center">
        {/* Biểu tượng nằm đè lên mép trên của ảnh đại diện */}
        <Icon
          weight="fill"
          className={`relative z-10 -mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] ${hero ? 'size-7' : 'size-5'}`}
        />

        <span className={`rounded-full bg-gradient-to-br p-[3px] shadow-[0_4px_12px_rgba(0,0,0,0.3)] ${look.ring}`}>
          <span
            className={`flex items-center justify-center rounded-full bg-white font-black ${look.initial} ${
              hero ? 'size-14 text-3xl' : 'size-10 text-xl'
            }`}
          >
            {initial}
          </span>
        </span>

        <span
          className={`mt-2 w-full break-words font-black leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] ${
            hero ? 'text-base' : 'text-[13px]'
          }`}
        >
          {entry.fullName}
        </span>

        <span
          className={`mt-1 rounded-lg bg-black/20 text-center font-bold leading-snug backdrop-blur ${
            hero ? 'px-2.5 py-1 text-[11px]' : 'px-2 py-0.5 text-[10px]'
          }`}
        >
          {look.title}
        </span>

        <div
          className={`mt-2.5 grid w-full rounded-xl bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur ${
            empty ? 'grid-cols-1 py-2' : 'grid-cols-2 divide-x divide-white/30 py-1.5'
          }`}
        >
          {empty ? (
            <span className="text-xs font-bold">Chưa có đơn nào</span>
          ) : (
            <>
              <div>
                <div className={`tnum font-black leading-none ${hero ? 'text-2xl' : 'text-xl'}`}>{entry.seats}</div>
                <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-white/85">vé</div>
              </div>
              <div>
                <div className={`tnum font-black leading-none ${hero ? 'text-2xl' : 'text-xl'}`}>{entry.total}</div>
                <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-white/85">đơn</div>
              </div>
            </>
          )}
        </div>

        {!hero && !empty && (
          <span className="mt-1.5 rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-white/90">
            {theme === 'honor' ? `Kém hạng 1: ${gap} vé` : `Hơn hạng 1: ${Math.abs(gap)} vé`}
          </span>
        )}
      </div>
    </div>
  );
}
