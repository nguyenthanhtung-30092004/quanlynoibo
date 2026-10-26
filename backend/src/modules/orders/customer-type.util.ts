/** Từ số đơn còn hiệu lực này trở lên (cùng số điện thoại) thì là khách quen */
export const REGULAR_CUSTOMER_MIN_ORDERS = 3;

export type CustomerType = 'REGULAR' | 'NEW';

export function customerTypeOf(orderCount: number): CustomerType {
  return orderCount >= REGULAR_CUSTOMER_MIN_ORDERS ? 'REGULAR' : 'NEW';
}
