'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Từ breakpoint `md` của Tailwind trở lên là máy tính (có thanh kéo ngang ghim ở đầu bảng) */
const DESKTOP_QUERY = '(min-width: 768px)';

/**
 * Bảng rộng: có thanh kéo ngang ở TRÊN đầu bảng (luôn thấy, dùng chuột kéo được).
 * Không có khung cao cố định: bảng tràn hết xuống, cuộn dọc theo trang.
 *
 * Máy tính: thanh kéo ngang và hàng tiêu đề được ghim bằng CSS `position: sticky` ngay dưới
 * header của trang, nên do chính trình duyệt giữ chỗ khi cuộn, không bị giật hay biến mất.
 * `sticky` chỉ chạy khi không có tổ tiên nào là vùng cuộn, vì vậy vùng bảng dùng
 * `overflow-x: clip` (không phải `auto`) và việc cuộn ngang được làm bằng cách dịch bảng theo
 * thanh kéo ở đầu bảng (cả chuột lăn ngang / Shift + lăn cũng được chuyển sang thanh đó).
 * Khung bao ngoài bảng phải dùng `overflow-clip`, đừng dùng `overflow-hidden` kẻo chặn sticky.
 * `pinOffset`: chiều cao (px) của thanh dính khác nằm dưới header (vd thanh chọn tháng), để bảng ghim dưới thanh đó.
 *
 * Điện thoại: bảng cuộn cả hai chiều trong một khung có chiều cao tối đa bằng màn hình, và
 * tiêu đề được ghim bằng `sticky top-0` ngay trong khung đó. Trình duyệt tự ghim nên mượt,
 * không cần JS dời tiêu đề theo sự kiện scroll (cách cũ bị trễ một nhịp nên giật).
 */
export function ScrollTable({ children, pinOffset = 0 }: { children: ReactNode; pinOffset?: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [overflowing, setOverflowing] = useState(false);
  const syncing = useRef(false);

  // Đo bề rộng thật của bảng so với khung chứa
  useEffect(() => {
    const main = mainRef.current;
    const inner = innerRef.current;
    if (!main || !inner) return;
    const measure = () => {
      const table = inner.firstElementChild as HTMLElement | null;
      const width = Math.max(table?.offsetWidth ?? 0, main.scrollWidth);
      setContentWidth(width);
      setOverflowing(width > main.clientWidth + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(main);
    if (inner.firstElementChild) ro.observe(inner.firstElementChild);
    return () => ro.disconnect();
  }, []);

  // Vị trí ghim: ngay dưới header của trang (và dưới thanh kéo ngang với hàng tiêu đề)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const mq = window.matchMedia(DESKTOP_QUERY);

    const measurePins = () => {
      const pageHeader = document.querySelector('header');
      const sticky = pageHeader && getComputedStyle(pageHeader).position === 'sticky';
      root.style.setProperty('--pin-top', `${(sticky ? pageHeader.offsetHeight : 0) + pinOffset}px`);
      root.style.setProperty('--bar-h', `${topRef.current?.offsetHeight ?? 0}px`);
    };

    const onResize = () => {
      measurePins();
      // Thu cửa sổ xuống cỡ điện thoại: bỏ phần dịch bảng của chế độ máy tính
      if (!mq.matches && innerRef.current) innerRef.current.style.transform = '';
    };

    measurePins();
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(root);
    const pageHeader = document.querySelector('header');
    if (pageHeader) ro.observe(pageHeader);
    if (topRef.current) ro.observe(topRef.current);
    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
    };
  }, [overflowing, pinOffset]);

  // Máy tính: lăn chuột ngang / Shift + lăn / vuốt ngang trên bảng thì cuộn thanh ở đầu bảng
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const onWheel = (e: WheelEvent) => {
      const top = topRef.current;
      if (!top || !window.matchMedia(DESKTOP_QUERY).matches) return;
      const horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!horizontal) return;
      const before = top.scrollLeft;
      top.scrollLeft += e.deltaX || e.deltaY;
      if (top.scrollLeft !== before) e.preventDefault();
    };
    main.addEventListener('wheel', onWheel, { passive: false });
    return () => main.removeEventListener('wheel', onWheel);
  }, []);

  // Thanh ở đầu bảng cuộn tới đâu thì dịch bảng theo tới đó (máy tính)
  const onTopScroll = () => {
    const top = topRef.current;
    const inner = innerRef.current;
    if (!top || !inner) return;
    inner.style.transform = top.clientWidth > 0 ? `translateX(${-top.scrollLeft}px)` : '';
  };

  // Điện thoại: giữ scrollLeft của khung bảng (thanh đầu bảng bị ẩn nên không có gì để đồng bộ)
  const onMainScroll = () => {
    const main = mainRef.current;
    const top = topRef.current;
    if (!main || !top || top.clientWidth === 0 || syncing.current) return;
    syncing.current = true;
    top.scrollLeft = main.scrollLeft;
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  };

  return (
    <div ref={rootRef}>
      {overflowing && (
        <div
          ref={topRef}
          onScroll={onTopScroll}
          className="scroll-big sticky top-[var(--pin-top,0px)] z-[11] hidden md:block overflow-x-auto overflow-y-hidden border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
          aria-hidden="true"
        >
          <div style={{ width: contentWidth, height: 1 }} />
        </div>
      )}
      <div
        ref={mainRef}
        onScroll={onMainScroll}
        className="scroll-big scroll-hide-md overflow-x-auto overscroll-x-contain max-md:max-h-[calc(100dvh-var(--pin-top,0px)-1rem)] max-md:overflow-y-auto md:overflow-x-clip [&_thead_th]:relative [&_thead_th]:z-10 [&_thead_th]:!bg-slate-100 dark:[&_thead_th]:!bg-slate-800 max-md:[&_thead_th]:!sticky max-md:[&_thead_th]:top-0 md:[&_thead_th]:!sticky md:[&_thead_th]:top-[calc(var(--pin-top,0px)+var(--bar-h,0px))]"
      >
        <div ref={innerRef} className="md:will-change-transform">
          {children}
        </div>
      </div>
    </div>
  );
}
