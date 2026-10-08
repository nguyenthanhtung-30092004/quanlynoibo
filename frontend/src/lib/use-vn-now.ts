'use client';

import { useEffect, useState } from 'react';

/**
 * Thời điểm hiện tại, cập nhật theo chu kỳ. Trả về null ở lần render đầu
 * (trước khi mount) để HTML từ server và client khớp nhau.
 */
export function useNow(intervalMs = 30_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
