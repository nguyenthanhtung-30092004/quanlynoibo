export const money = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const CARRIERS = [
  { name: 'XVIP', tickets: 320, revenue: 96000000 },
  { name: 'Sao Việt', tickets: 210, revenue: 65100000 },
  { name: 'Hải Âu', tickets: 145, revenue: 43500000 },
  { name: 'Kumho Việt Thanh', tickets: 120, revenue: 36000000 },
  { name: 'Phúc Xuyên', tickets: 85, revenue: 25500000 },
  { name: 'Các nhà xe khác', tickets: 120, revenue: 36500000 },
];

export const ROUTE_SHARE = [
  { name: 'Hà Nội - Cẩm Phả', pct: 28, color: '#2563EB' },
  { name: 'Hà Nội - Hạ Long', pct: 24, color: '#EF3E5C' },
  { name: 'Hà Nội - Uông Bí', pct: 15, color: '#22A55B' },
  { name: 'Hà Nội - Đông Triều', pct: 12, color: '#F5832A' },
  { name: 'Hà Nội - Yên Tử', pct: 10, color: '#8B7FD6' },
  { name: 'Các tuyến khác', pct: 11, color: '#B8C0CC' },
];

export const TOP_STAFF = [
  { name: 'Nguyễn Thị Hương', tickets: 82, revenue: 24600000, commission: 1640000 },
  { name: 'Trần Thu Hà', tickets: 76, revenue: 22800000, commission: 1520000 },
  { name: 'Lê Thị Mai', tickets: 71, revenue: 21300000, commission: 1420000 },
  { name: 'Phạm Thị Lan', tickets: 68, revenue: 20400000, commission: 1360000 },
  { name: 'Nguyễn Thu Trang', tickets: 65, revenue: 19500000, commission: 1300000 },
  { name: 'Đỗ Thị Hạnh', tickets: 62, revenue: 18600000, commission: 1240000 },
  { name: 'Trần Thu Ngọc', tickets: 58, revenue: 17400000, commission: 1160000 },
  { name: 'Nguyễn Thị Vân', tickets: 56, revenue: 16800000, commission: 1120000 },
];

export type TicketStatus = 'Đã bán' | 'Hủy';

export interface Ticket {
  code: string;
  time: string;
  carrier: string;
  route: string;
  customer: string;
  phone: string;
  departure: string;
  price: number;
  commission: number;
  staff: string;
  status: TicketStatus;
}

export const TICKETS: Ticket[] = [
  { code: 'VE251008001', time: '10:24', carrier: 'XVIP', route: 'Hà Nội - Cẩm Phả', customer: 'Nguyễn Văn An', phone: '0983 456 789', departure: '11:00', price: 300000, commission: 20000, staff: 'Nguyễn Thị Hương', status: 'Đã bán' },
  { code: 'VE251008002', time: '10:22', carrier: 'Sao Việt', route: 'Hà Nội - Hạ Long', customer: 'Trần Thị Mai', phone: '0976 234 567', departure: '11:30', price: 280000, commission: 20000, staff: 'Trần Thu Hà', status: 'Đã bán' },
  { code: 'VE251008003', time: '10:20', carrier: 'Hải Âu', route: 'Hà Nội - Uông Bí', customer: 'Lê Văn Bình', phone: '0912 345 678', departure: '12:00', price: 260000, commission: 15000, staff: 'Lê Thị Mai', status: 'Đã bán' },
  { code: 'VE251008004', time: '10:18', carrier: 'XVIP', route: 'Hà Nội - Yên Tử', customer: 'Phạm Thu Thảo', phone: '0987 654 321', departure: '12:30', price: 300000, commission: 20000, staff: 'Phạm Thị Lan', status: 'Đã bán' },
  { code: 'VE251008005', time: '10:16', carrier: 'Kumho Việt Thanh', route: 'Hà Nội - Đông Triều', customer: 'Hoàng Văn Nam', phone: '0965 111 222', departure: '13:00', price: 250000, commission: 15000, staff: 'Nguyễn Thu Trang', status: 'Đã bán' },
  { code: 'VE251008006', time: '10:12', carrier: 'XVIP', route: 'Hà Nội - Cẩm Phả', customer: 'Đỗ Thị Hạnh', phone: '0981 222 333', departure: '13:30', price: 300000, commission: 20000, staff: 'Nguyễn Thị Hương', status: 'Đã bán' },
  { code: 'VE251008007', time: '10:10', carrier: 'Sao Việt', route: 'Hà Nội - Hạ Long', customer: 'Trần Văn Toàn', phone: '0978 444 555', departure: '14:00', price: 280000, commission: 20000, staff: 'Trần Thu Hà', status: 'Hủy' },
  { code: 'VE251008008', time: '10:08', carrier: 'Hải Âu', route: 'Hà Nội - Uông Bí', customer: 'Nguyễn Thị Nga', phone: '0985 666 777', departure: '14:30', price: 260000, commission: 15000, staff: 'Lê Thị Mai', status: 'Đã bán' },
];

export const DEBTS = [
  { carrier: 'XVIP', tickets: 15280, revenue: 4564000000, commission: 305600000, settled: 280000000, owed: 25600000 },
  { carrier: 'Sao Việt', tickets: 9120, revenue: 2736000000, commission: 182400000, settled: 170000000, owed: 12400000 },
  { carrier: 'Hải Âu', tickets: 6540, revenue: 1962000000, commission: 130800000, settled: 120000000, owed: 10800000 },
  { carrier: 'Kumho Việt Thanh', tickets: 5200, revenue: 1560000000, commission: 104000000, settled: 90000000, owed: 14000000 },
  { carrier: 'Phúc Xuyên', tickets: 3850, revenue: 1155000000, commission: 77000000, settled: 70000000, owed: 7000000 },
  { carrier: 'Các nhà xe khác', tickets: 6350, revenue: 1905000000, commission: 127000000, settled: 110000000, owed: 17000000 },
];
