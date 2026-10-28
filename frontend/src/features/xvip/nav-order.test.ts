import { describe, expect, it } from 'vitest';
import { orderForMobile } from './nav-order';

const item = (href: string) => ({ href });
const hrefs = (list: Array<{ href: string }>) => list.map((i) => i.href.replace('/xvip/', '').replace('/xvip', 'tong-quan'));

/** Danh sách gốc giống NAV trong XvipShell */
const FULL = [
  '/xvip',
  '/xvip/quan-ly-ve',
  '/xvip/tao-qr',
  '/xvip/doi-tac',
  '/xvip/tuyen-duong',
  '/xvip/nhan-vien',
  '/xvip/cong-no',
  '/xvip/cham-cong',
  '/xvip/nghi-phep',
  '/xvip/bang-luong',
  '/xvip/bao-cao',
  '/xvip/cai-dat',
].map(item);

describe('orderForMobile', () => {
  it('Admin: Đăng ký nghỉ ở vị trí thứ 2, Đối tác và Tuyến đường xuống dưới cùng', () => {
    expect(hrefs(orderForMobile(FULL))).toEqual([
      'tong-quan',
      'nghi-phep',
      'quan-ly-ve',
      'tao-qr',
      'nhan-vien',
      'cong-no',
      'cham-cong',
      'bang-luong',
      'bao-cao',
      'cai-dat',
      'doi-tac',
      'tuyen-duong',
    ]);
  });

  it('nhân viên (không có Tổng quan): Đăng ký nghỉ vẫn là mục thứ 2', () => {
    const staff = ['/xvip/quan-ly-ve', '/xvip/tao-qr', '/xvip/doi-tac', '/xvip/tuyen-duong', '/xvip/cham-cong', '/xvip/nghi-phep', '/xvip/luong-cua-toi', '/xvip/bao-cao'].map(item);
    expect(hrefs(orderForMobile(staff))).toEqual([
      'quan-ly-ve',
      'nghi-phep',
      'tao-qr',
      'cham-cong',
      'luong-cua-toi',
      'bao-cao',
      'doi-tac',
      'tuyen-duong',
    ]);
  });

  it('không làm mất hay nhân đôi mục nào, và không đổi danh sách gốc', () => {
    const before = hrefs(FULL);
    const out = orderForMobile(FULL);
    expect(out).toHaveLength(FULL.length);
    expect(new Set(out.map((i) => i.href)).size).toBe(FULL.length);
    expect(hrefs(FULL)).toEqual(before);
  });

  it('thiếu mục nào thì bỏ qua, không lỗi', () => {
    expect(hrefs(orderForMobile([item('/xvip/quan-ly-ve'), item('/xvip/bao-cao')]))).toEqual(['quan-ly-ve', 'bao-cao']);
    expect(hrefs(orderForMobile([item('/xvip/nghi-phep')]))).toEqual(['nghi-phep']);
    expect(orderForMobile([])).toEqual([]);
  });
});
