import { describe, expect, it } from 'vitest';
import {
  applyImportPartnerAlias,
  filterOrdersByPartner,
  findUnlistedPartners,
  matchCanonicalPartner,
} from './order-partner.util.js';

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

describe('filterOrdersByPartner', () => {
  const partners = [
    { name: 'Sao Việt' },
    { name: 'Cửa Ông' },
  ];

  it('giữ lại đơn không có đối tác và đơn khớp bảng đối tác, loại đơn đối tác lạ', () => {
    const orders = [
      { id: 1, partner: null },
      { id: 2, partner: '' },
      { id: 3, partner: '   ' },
      { id: 4, partner: 'Sao Việt' },
      { id: 5, partner: 'sao việt' },
      { id: 6, partner: '  CỬA ÔNG  ' },
      { id: 7, partner: 'Sao Việt 1' },
      { id: 8, partner: 'Nhà xe lạ' },
    ];

    const { valid, excluded } = filterOrdersByPartner(orders, partners);

    expect(valid.map((o) => o.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(excluded.map((o) => o.id)).toEqual([7, 8]);
  });
});

describe('findUnlistedPartners', () => {
  const partners = [
    { name: 'Sao Việt' },
    { name: 'Cửa Ông' },
  ];

  it('gom nhóm đối tác lạ không phân biệt hoa thường và sắp theo số đơn giảm dần', () => {
    const orders = [
      { id: 1, partner: 'Sao Việt 1' },
      { id: 2, partner: 'sao việt 1' },
      { id: 3, partner: '  SAO VIỆT 1  ' },
      { id: 4, partner: 'Cửa Ông 1' },
      { id: 5, partner: 'Sao Việt' }, // Hợp lệ, không tính
      { id: 6, partner: null }, // Rỗng, không tính
    ];

    const unlisted = findUnlistedPartners(orders, partners);

    expect(unlisted).toEqual([
      { partner: 'Sao Việt 1', orders: 3 },
      { partner: 'Cửa Ông 1', orders: 1 },
    ]);
  });

  it('trả về mảng rỗng nếu không có đối tác lạ', () => {
    const orders = [
      { id: 1, partner: 'Sao Việt' },
      { id: 2, partner: null },
    ];
    expect(findUnlistedPartners(orders, partners)).toEqual([]);
  });
});

describe('applyImportPartnerAlias', () => {
  it('đổi tên viết tắt sang tên đối tác đầy đủ, bỏ qua hoa thường, dấu và khoảng trắng', () => {
    expect(applyImportPartnerAlias('Việt Nam')).toBe('X.E Việt Nam');
    expect(applyImportPartnerAlias('  viet  nam ')).toBe('X.E Việt Nam');
    expect(applyImportPartnerAlias('Đất Cảng')).toBe('Anh Huy Đất Cảng');
    expect(applyImportPartnerAlias('ANH HUY')).toBe('Anh Huy 92');
  });

  it('tên khác hoặc đã đầy đủ thì giữ nguyên', () => {
    expect(applyImportPartnerAlias('Anh Huy 92')).toBe('Anh Huy 92');
    expect(applyImportPartnerAlias('Anh Huy Đất Cảng')).toBe('Anh Huy Đất Cảng');
    expect(applyImportPartnerAlias('X.E Việt Nam')).toBe('X.E Việt Nam');
    expect(applyImportPartnerAlias('Sao Việt')).toBe('Sao Việt');
  });
});

describe('matchCanonicalPartner - lệch mã hóa / khoảng trắng / dấu', () => {
  const partners = [{ name: 'Hoàng Phương' }, { name: 'Sao Việt' }];

  it('khớp dù dấu tiếng Việt ở dạng dấu rời (NFD)', () => {
    expect(matchCanonicalPartner('Hoàng Phương'.normalize('NFD'), partners)).toBe('Hoàng Phương');
  });

  it('khớp dù có khoảng trắng đặc biệt hoặc thừa ở giữa', () => {
    expect(matchCanonicalPartner('Hoàng Phương', partners)).toBe('Hoàng Phương');
    expect(matchCanonicalPartner('Hoàng   Phương', partners)).toBe('Hoàng Phương');
    expect(matchCanonicalPartner('​Hoàng Phương', partners)).toBe('Hoàng Phương');
  });

  it('tên trong hệ thống bị dấu rời / khoảng trắng đặc biệt vẫn khớp tên gõ bình thường', () => {
    const odd = [{ name: 'Hoàng Phương'.normalize('NFD') }];
    expect(matchCanonicalPartner('Hoàng Phương', odd)).toBe(odd[0].name);
  });

  it('chỉ lệch dấu và duy nhất một đối tác thì vẫn khớp', () => {
    expect(matchCanonicalPartner('Hoang Phuong', partners)).toBe('Hoàng Phương');
  });

  it('lệch dấu nhưng mơ hồ giữa nhiều đối tác thì không khớp', () => {
    const dup = [{ name: 'Hoàng Phương' }, { name: 'Hoang Phuong' }];
    expect(matchCanonicalPartner('HOANG PHUONG', dup)).toBe('Hoang Phuong');
    expect(matchCanonicalPartner('Hoãng Phuong', dup)).toBeUndefined();
  });
});
