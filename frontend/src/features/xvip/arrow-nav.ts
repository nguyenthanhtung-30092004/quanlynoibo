import type { KeyboardEvent } from 'react';

/** Các ô có thể đưa con trỏ tới trong form: ô nhập, ô chọn, nút mở khung chọn giờ/ngày */
const FOCUSABLE =
  'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not(:disabled), textarea:not(:disabled), select:not(:disabled), button[aria-haspopup]:not(:disabled)';

type Dir = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

const isDir = (key: string): key is Dir =>
  key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown';

/** Ô văn bản gõ được (có con trỏ chữ): chỉ chuyển ô khi con trỏ đã ở mép chữ để không chặn việc di chuyển trong chữ */
function caretInfo(el: HTMLElement) {
  if (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.selectionStart !== null)) {
    const { selectionStart: start, selectionEnd: end, value } = el;
    if (start === null || end === null) return null;
    return { start, end, value };
  }
  return null;
}

function canLeave(el: HTMLElement, dir: Dir): boolean {
  // Ô chọn thả xuống: mũi tên lên/xuống đổi lựa chọn, để nguyên
  if (el instanceof HTMLSelectElement) return dir === 'ArrowLeft' || dir === 'ArrowRight';
  const caret = caretInfo(el);
  if (!caret) return true;
  if (caret.start !== caret.end) return false;
  const { start, value } = caret;
  const multiline = el instanceof HTMLTextAreaElement;
  switch (dir) {
    case 'ArrowLeft':
      return start === 0;
    case 'ArrowRight':
      return start === value.length;
    case 'ArrowUp':
      return !multiline || !value.slice(0, start).includes('\n');
    case 'ArrowDown':
      return !multiline || !value.slice(start).includes('\n');
  }
}

/** Chọn ô kế tiếp theo hướng bấm, dựa vào vị trí thật trên màn hình */
function pickNext(current: HTMLElement, all: HTMLElement[], dir: Dir): HTMLElement | null {
  const a = current.getBoundingClientRect();
  const ax = (a.left + a.right) / 2;
  const ay = (a.top + a.bottom) / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of all) {
    if (el === current) continue;
    const b = el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) continue;
    const bx = (b.left + b.right) / 2;
    const by = (b.top + b.bottom) / 2;
    const sameRow = Math.abs(by - ay) < Math.max(a.height, b.height) * 0.6;
    const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0;
    let score: number;

    if (dir === 'ArrowRight' || dir === 'ArrowLeft') {
      const ahead = dir === 'ArrowRight' ? bx > ax + 2 : bx < ax - 2;
      if (!sameRow || !ahead) continue;
      score = Math.abs(bx - ax);
    } else {
      const ahead = dir === 'ArrowDown' ? by > ay + 2 : by < ay - 2;
      if (!ahead || sameRow) continue;
      // Ưu tiên ô ngay trên/dưới (cùng cột), sau đó mới tới ô lệch sang bên
      score = Math.abs(by - ay) + Math.abs(bx - ax) * (overlapX ? 0.5 : 3);
    }
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

/**
 * Dùng cho onKeyDown của form: mũi tên chuyển con trỏ sang ô bên cạnh / ô trên dưới.
 * Ô đang gõ chữ chỉ chuyển khi con trỏ đã ở đầu/cuối chữ (hoặc dòng đầu/cuối với ô nhiều dòng),
 * nên vẫn di chuyển trong chữ bình thường.
 */
export function handleArrowNav(e: KeyboardEvent<HTMLElement>, root: HTMLElement | null) {
  if (!root || e.defaultPrevented) return;
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
  if (!isDir(e.key)) return;

  const target = e.target as HTMLElement;
  // Sự kiện từ khung chọn giờ/ngày hiện qua portal: không xử lý
  if (!root.contains(target) || !target.matches(FOCUSABLE)) return;
  if (!canLeave(target, e.key)) return;

  const all = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
  const next = pickNext(target, all, e.key);
  if (!next) return;

  e.preventDefault();
  next.focus();
}
