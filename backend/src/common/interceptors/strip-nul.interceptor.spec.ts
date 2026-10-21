import { stripNul } from './strip-nul.interceptor.js';

describe('stripNul', () => {
  it('bỏ ký tự NUL ở mọi tầng của body', () => {
    const body = {
      pickupPoint: 'số 27 Nguyễn Thị Luyên  \u0000',
      goods: { receiverName: 'An\u0000', quantity: 2 },
      list: ['a\u0000b', 3, null],
    };
    expect(stripNul(body)).toEqual({
      pickupPoint: 'số 27 Nguyễn Thị Luyên  ',
      goods: { receiverName: 'An', quantity: 2 },
      list: ['ab', 3, null],
    });
  });

  it('giữ nguyên chuỗi bình thường và tiếng Việt có dấu', () => {
    expect(stripNul({ note: 'đã ck 270k cho xvip' })).toEqual({ note: 'đã ck 270k cho xvip' });
  });
});
