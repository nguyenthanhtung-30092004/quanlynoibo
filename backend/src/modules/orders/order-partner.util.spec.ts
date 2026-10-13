import { describe, expect, it } from 'vitest';
import { matchCanonicalPartner } from './order-partner.util.js';

describe('matchCanonicalPartner', () => {
  const partners = [
    { name: 'Sao Việt' },
    { name: 'Cửa Ông' },
    { name: 'Hà Lan' },
  ];

  it('đối tác để trống / null / undefined / chỉ dấu cách trả về null', () => {
    expect(matchCanonicalPartner(null, partners)).toBeNull();
    expect(matchCanonicalPartner(undefined, partners)).toBeNull();
    expect(matchCanonicalPartner('', partners)).toBeNull();
    expect(matchCanonicalPartner('   ', partners)).toBeNull();
  });

  it('khớp chính xác tên thì trả về tên chuẩn', () => {
    expect(matchCanonicalPartner('Sao Việt', partners)).toBe('Sao Việt');
  });

  it('khớp không phân biệt hoa thường và bỏ khoảng trắng đầu/cuối', () => {
    expect(matchCanonicalPartner('  sao việt  ', partners)).toBe('Sao Việt');
    expect(matchCanonicalPartner('SAO VIỆT', partners)).toBe('Sao Việt');
    expect(matchCanonicalPartner('cửa ông', partners)).toBe('Cửa Ông');
    expect(matchCanonicalPartner('  Hà Lan ', partners)).toBe('Hà Lan');
  });

  it('đối tác không có trong danh sách trả về undefined', () => {
    expect(matchCanonicalPartner('Sao Việt 1', partners)).toBeUndefined();
    expect(matchCanonicalPartner('Cửa Ông 1', partners)).toBeUndefined();
    expect(matchCanonicalPartner('Nhà xe lạ', partners)).toBeUndefined();
    expect(matchCanonicalPartner('Sao', partners)).toBeUndefined();
  });
});
