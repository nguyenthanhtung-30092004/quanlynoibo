'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Bảng rộng: có thanh kéo ngang ở TRÊN đầu bảng (luôn thấy, dùng chuột kéo được) đồng bộ
 * với thanh ở đáy bảng. Không có khung cao cố định: bảng tràn hết xuống, cuộn dọc theo trang.
 * Điện thoại chỉ cuộn ngang trong bảng, vuốt dọc theo trang nên mượt.
 */
export function ScrollTable({ children }: { children: ReactNode }) {
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
    <div>
      {overflowing && (
        <div
          ref={topRef}
          onScroll={() => sync(topRef.current, mainRef.current)}
          className="hidden md:block overflow-x-auto overflow-y-hidden border-b border-slate-200 dark:border-slate-700"
          aria-hidden="true"
        >
          <div style={{ width: contentWidth, height: 1 }} />
        </div>
      )}
      <div
        ref={mainRef}
        onScroll={() => sync(mainRef.current, topRef.current)}
        className="overflow-x-auto overscroll-x-contain"
      >
        {children}
      </div>
    </div>
  );
}
