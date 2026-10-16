'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Bảng thấp hơn mức này thì thôi không co theo màn hình nữa (trang tự cuộn như thường) */
const MIN_BODY_HEIGHT = 320;
/** Lề nhỏ giữa đáy bảng và đáy màn hình */
const BOTTOM_GAP = 12;

/**
 * Bảng rộng. Trên máy tính, bảng chiếm đúng phần màn hình còn lại bên dưới bộ lọc và tự cuộn dọc
 * bên trong: mọi thứ từ hàng tiêu đề bảng trở lên đứng yên, chỉ các dòng dữ liệu cuộn.
 * Thanh kéo ngang nằm ngay trên hàng tiêu đề (luôn thấy, đồng bộ với bảng); thanh ngang native
 * ở đáy bị che đi vì thừa.
 * Điện thoại: bảng không co theo màn hình, chỉ cuộn ngang trong bảng, vuốt dọc theo trang.
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

  // Co chiều cao vùng cuộn cho vừa phần màn hình còn lại (trừ phần nằm dưới bảng, vd phân trang)
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const desktop = window.matchMedia('(min-width: 768px)');
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!desktop.matches) {
        main.style.maxHeight = '';
        main.style.marginBottom = '';
        return;
      }
      // Thanh cuộn ngang native ở đáy: kéo xuống để khung cắt mất nó (đã có thanh ghim phía trên)
      const scrollbar = main.scrollWidth > main.clientWidth + 1 ? main.offsetHeight - main.clientHeight : 0;
      const rect = main.getBoundingClientRect();
      // Chỉ chừa phần nằm dưới bảng trong cùng thẻ (vd phân trang) và một lề nhỏ: bảng trải gần hết màn hình
      const card = main.closest('section');
      const inCard = card ? Math.max(0, card.getBoundingClientRect().bottom - (rect.bottom - scrollbar)) : 0;
      const available = Math.floor(window.innerHeight - (rect.top + window.scrollY) - inCard - BOTTOM_GAP);
      main.style.maxHeight = `${Math.max(MIN_BODY_HEIGHT, available) + scrollbar}px`;
      main.style.marginBottom = scrollbar ? `-${scrollbar}px` : '';
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('resize', schedule);
    desktop.addEventListener('change', schedule);
    // Nội dung phía trên bảng (bộ lọc, thẻ thống kê) đổi chiều cao thì tính lại
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    ro.observe(main);
    return () => {
      window.removeEventListener('resize', schedule);
      desktop.removeEventListener('change', schedule);
      ro.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [overflowing]);

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
          className="scroll-big hidden md:block overflow-x-auto overflow-y-hidden border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
          aria-hidden="true"
        >
          <div style={{ width: contentWidth, height: 1 }} />
        </div>
      )}
      <div className="md:overflow-hidden">
        <div
          ref={mainRef}
          onScroll={() => sync(mainRef.current, topRef.current)}
          className="scroll-big overflow-x-auto overscroll-x-contain md:overflow-y-auto md:[&_thead_th]:sticky md:[&_thead_th]:top-0 md:[&_thead_th]:z-10 md:[&_thead_th]:!bg-slate-100 dark:md:[&_thead_th]:!bg-slate-800"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
