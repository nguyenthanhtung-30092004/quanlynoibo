'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Bảng rộng: có thanh kéo ngang ở TRÊN đầu bảng (luôn thấy, dùng chuột kéo được) đồng bộ
 * với thanh ở đáy bảng. Không có khung cao cố định: bảng tràn hết xuống, cuộn dọc theo trang.
 * Điện thoại chỉ cuộn ngang trong bảng, vuốt dọc theo trang nên mượt.
 *
 * Khi cuộn trang xuống, thanh kéo ngang và hàng tiêu đề bảng được ghim lại ngay dưới thanh
 * header của trang, còn các dòng dữ liệu vẫn trượt bên dưới. CSS `position: sticky` không dùng
 * được vì vùng cuộn ngang (overflow-x) chặn nó, nên dời bằng transform theo vị trí cuộn trang.
 */
export function ScrollTable({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [overflowing, setOverflowing] = useState(false);
  const syncing = useRef(false);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const measure = () => {
      setContentWidth(main.scrollWidth);
      setOverflowing(main.scrollWidth > main.clientWidth + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(main);
    if (main.firstElementChild) ro.observe(main.firstElementChild);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = root.getBoundingClientRect();
      const pageHeader = document.querySelector('header');
      const pinTop = pageHeader && getComputedStyle(pageHeader).position === 'sticky' ? pageHeader.getBoundingClientRect().bottom : 0;
      const bar = topRef.current;
      const head = root.querySelector('thead');
      const pinnedHeight = (bar?.offsetHeight ?? 0) + (head?.getBoundingClientRect().height ?? 0);
      // Không đẩy tiêu đề ra khỏi cuối bảng
      const shift = Math.min(Math.max(0, pinTop - rect.top), Math.max(0, rect.height - pinnedHeight));
      root.style.setProperty('--stick-y', `${Math.round(shift)}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    // capture = true để bắt cả trường hợp trang cuộn trong một khung bên trong
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('resize', schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(root);
    return () => {
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      ro.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const sync = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    // Thanh trên đầu bị ẩn trên điện thoại (clientWidth = 0) thì không đồng bộ cho đỡ nặng
    if (!from || !to || to.clientWidth === 0 || syncing.current) return;
    syncing.current = true;
    to.scrollLeft = from.scrollLeft;
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  };

  return (
    <div ref={rootRef}>
      {overflowing && (
        <div
          ref={topRef}
          onScroll={() => sync(topRef.current, mainRef.current)}
          className="scroll-big relative z-[11] hidden md:block overflow-x-auto overflow-y-hidden border-b border-slate-200 bg-white [transform:translateY(var(--stick-y,0px))] dark:border-slate-700 dark:bg-slate-900"
          aria-hidden="true"
        >
          <div style={{ width: contentWidth, height: 1 }} />
        </div>
      )}
      <div
        ref={mainRef}
        onScroll={() => sync(mainRef.current, topRef.current)}
        className="scroll-big scroll-hide-md overflow-x-auto overscroll-x-contain [&_thead_th]:relative [&_thead_th]:z-10 [&_thead_th]:!bg-slate-100 [&_thead_th]:[transform:translateY(var(--stick-y,0px))] dark:[&_thead_th]:!bg-slate-800"
      >
        {children}
      </div>
    </div>
  );
}
