import { customerTypeOf, REGULAR_CUSTOMER_MIN_ORDERS } from './customer-type.util.js';

describe('customerTypeOf', () => {
  it('dưới ngưỡng là khách lạ', () => {
    expect(customerTypeOf(0)).toBe('NEW');
    expect(customerTypeOf(REGULAR_CUSTOMER_MIN_ORDERS - 1)).toBe('NEW');
  });

  it('đạt ngưỡng trở lên là khách quen', () => {
    expect(customerTypeOf(REGULAR_CUSTOMER_MIN_ORDERS)).toBe('REGULAR');
    expect(customerTypeOf(REGULAR_CUSTOMER_MIN_ORDERS + 10)).toBe('REGULAR');
  });
});
