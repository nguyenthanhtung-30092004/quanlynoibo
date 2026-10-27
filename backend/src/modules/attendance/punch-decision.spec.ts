import { describe, expect, it } from 'vitest';
import { MAX_PUNCHES_PER_DAY, PUNCH_COOLDOWN_SECONDS, decidePunch } from './attendance.logic.js';

describe('decidePunch', () => {
  it('khoảng chờ quẹt trùng là 15 phút', () => {
    expect(PUNCH_COOLDOWN_SECONDS).toBe(15 * 60);
  });

  it('lượt đầu trong ngày được ghi (giờ vào)', () => {
    expect(decidePunch(0, 0)).toBe('recorded');
  });

  it('quẹt lại trong khoảng chờ thì bỏ qua, chưa tính là chấm ra', () => {
    expect(decidePunch(1, 1)).toBe('duplicate');
  });

  it('quẹt sau khoảng chờ thì được ghi và đó là giờ ra', () => {
    expect(decidePunch(1, 0)).toBe('recorded');
  });

  it('đã chấm ra rồi thì quẹt bao nhiêu lần cũng không tính', () => {
    expect(MAX_PUNCHES_PER_DAY).toBe(2);
    expect(decidePunch(2, 0)).toBe('after_out');
    expect(decidePunch(3, 0)).toBe('after_out');
  });

  it('đã chấm ra thì quẹt ngay sau đó cũng gọi là sau khi chấm ra, không phải quẹt trùng', () => {
    expect(decidePunch(2, 1)).toBe('after_out');
  });

  it('hôm sau đếm lại từ đầu (hôm sau chưa có lượt nào nên lượt đầu lại là giờ vào)', () => {
    expect(decidePunch(0, 0)).toBe('recorded');
  });
});
