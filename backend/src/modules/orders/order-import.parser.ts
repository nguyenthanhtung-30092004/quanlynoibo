import ExcelJS from 'exceljs';

/** Một dòng đơn đọc từ file Excel, đã chuẩn hóa nhưng chưa đối chiếu tuyến/nhân viên */
export interface ImportRow {
  rowNumber: number;
  entryDate?: string;
  staffName?: string;
  customerName?: string;
  phone: string;
  routeName: string;
  departureTime?: string;
  departureDate?: string;
  vehicleType?: string;
  seatFront: number;
  seatMiddle: number;
  seatBack: number;
  seatCount: number;
  costPrice: number;
  sellPrice: number;
  deposit: number;
  collectOnDelivery: number;
  commission: number;
  partner?: string;
  pickupPoint?: string;
  dropoffPoint?: string;
  note?: string;
  cancelled: boolean;
  errors: string[];
}

type FieldKey =
  | 'entryDate'
  | 'staff'
  | 'customer'
  | 'phone'
  | 'route'
  | 'time'
  | 'date'
  | 'vehicle'
  | 'front'
  | 'middle'
  | 'back'
  | 'seats'
  | 'cost'
  | 'sell'
  | 'deposit'
  | 'cod'
  | 'commission'
  | 'partner'
  | 'pickup'
  | 'dropoff'
  | 'note'
  | 'status';

/** Tên cột (đã bỏ dấu, bỏ khoảng trắng, chữ thường) mà mỗi trường chấp nhận */
const HEADER_ALIASES: Record<FieldKey, string[]> = {
  entryDate: ['ngayvaoso'],
  staff: ['nv', 'nhanvien'],
  customer: ['tenkhach', 'tenkhachhang', 'khachhang'],
  phone: ['sodienthoai', 'sdt', 'dienthoai'],
  route: ['tuyendi', 'tuyenduong', 'tuyen'],
  time: ['giodi', 'gioxe'],
  date: ['ngaykhoihanh', 'ngaydi'],
  vehicle: ['loaihinh'],
  front: ['dau'],
  middle: ['giua'],
  back: ['cuoi'],
  seats: ['soghe'],
  cost: ['gianhap'],
  sell: ['giaban'],
  deposit: ['dacoc'],
  cod: ['nhothu'],
  commission: ['lai', 'hoahong'],
  partner: ['doitac', 'nhaxe'],
  pickup: ['diemdon'],
  dropoff: ['diemtra'],
  note: ['ghichu'],
  status: ['trangthai'],
};

const REQUIRED_FIELDS: FieldKey[] = ['phone', 'route', 'date'];
const HEADER_SEARCH_ROWS = 15;
export const IMPORT_MAX_ROWS = 1000;

/** Bỏ dấu, khoảng trắng và ký tự lạ để so khớp tên cột/tuyến/nhân viên */
export function normalizeKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const pad = (n: number) => String(n).padStart(2, '0');

function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if ('richText' in v) return v.richText.map((r) => r.text).join('').trim();
  if ('result' in v) return cellText(v.result as ExcelJS.CellValue);
  if ('text' in v) return String(v.text).trim();
  return '';
}

/** Giá trị gốc của ô (giải công thức về kết quả) */
function rawValue(v: ExcelJS.CellValue): ExcelJS.CellValue {
  if (v && typeof v === 'object' && !(v instanceof Date) && 'result' in v) {
    return v.result as ExcelJS.CellValue;
  }
  return v;
}

function parseDate(v: ExcelJS.CellValue): { value?: string; error?: boolean } {
  const raw = rawValue(v);
  if (raw === null || raw === undefined || raw === '') return {};
  if (raw instanceof Date) {
    return { value: `${raw.getUTCFullYear()}-${pad(raw.getUTCMonth() + 1)}-${pad(raw.getUTCDate())}` };
  }
  if (typeof raw === 'number') {
    const dt = new Date(Math.round((raw - 25569) * 86400000));
    return { value: `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}` };
  }
  const s = cellText(raw);
  const vn = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(s);
  if (vn) {
    const y = vn[3].length === 2 ? 2000 + Number(vn[3]) : Number(vn[3]);
    if (isRealDate(y, Number(vn[2]), Number(vn[1]))) {
      return { value: `${y}-${pad(Number(vn[2]))}-${pad(Number(vn[1]))}` };
    }
    return { error: true };
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso && isRealDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))) {
    return { value: `${iso[1]}-${iso[2]}-${iso[3]}` };
  }
  return s ? { error: true } : {};
}

function parseTime(v: ExcelJS.CellValue): { value?: string; error?: boolean } {
  const raw = rawValue(v);
  if (raw === null || raw === undefined || raw === '') return {};
  let h: number;
  let m: number;
  if (raw instanceof Date) {
    h = raw.getUTCHours();
    m = raw.getUTCMinutes();
  } else if (typeof raw === 'number') {
    const minutes = Math.round((raw - Math.floor(raw)) * 24 * 60);
    h = Math.floor(minutes / 60) % 24;
    m = minutes % 60;
  } else {
    const s = cellText(raw).toLowerCase().replace(/\s+/g, '');
    const match = /^(\d{1,2})(?:h|g|:|giờ)?(\d{1,2})?(?:p|phút)?$/.exec(s);
    if (!match) return s ? { error: true } : {};
    h = Number(match[1]);
    m = match[2] ? Number(match[2]) : 0;
  }
  if (h > 23 || m > 59) return { error: true };
  return { value: `${pad(h)}:${pad(m)}` };
}

/** Số ghế: ô trống = 0 */
function parseCount(v: ExcelJS.CellValue): { value: number; error?: boolean } {
  const raw = rawValue(v);
  if (raw === null || raw === undefined || raw === '') return { value: 0 };
  const n = typeof raw === 'number' ? raw : Number(cellText(raw));
  if (!Number.isInteger(n) || n < 0) return { value: 0, error: true };
  return { value: n };
}

/**
 * Tiền VNĐ. Sổ tay thường ghi theo nghìn đồng (320 = 320.000đ, 38.4 = 38.400đ),
 * nên số dương dưới 1.000 được hiểu là nghìn đồng. Chấp nhận "180k" và "15.000".
 */
function parseMoney(v: ExcelJS.CellValue): { value: number; error?: boolean } {
  const raw = rawValue(v);
  if (raw === null || raw === undefined || raw === '') return { value: 0 };
  let n: number;
  if (typeof raw === 'number') {
    n = raw;
  } else {
    let s = cellText(raw).toLowerCase().replace(/\s+/g, '').replace(/(đ|vnd|vnđ)$/, '');
    let thousand = false;
    if (s.endsWith('k')) {
      thousand = true;
      s = s.slice(0, -1);
    }
    s = /^\d{1,3}([.,]\d{3})+$/.test(s) ? s.replace(/[.,]/g, '') : s.replace(',', '.');
    n = Number(s);
    if (thousand) n *= 1000;
  }
  if (!Number.isFinite(n) || n < 0) return { value: 0, error: true };
  if (n > 0 && n < 1000) n *= 1000;
  return { value: Math.round(n) };
}

/** Số điện thoại: bỏ khoảng trắng; ô dạng số bị mất số 0 đầu thì bù lại */
function parsePhone(v: ExcelJS.CellValue): string {
  const raw = rawValue(v);
  let s = typeof raw === 'number' ? String(Math.round(raw)) : cellText(raw);
  s = s.replace(/[\s.\-()]/g, '');
  if (/^[1-9]\d{8,9}$/.test(s)) s = `0${s}`;
  return s;
}

/** Đọc toàn bộ file; ném lỗi (string) nếu không phải file Excel hoặc thiếu cột bắt buộc */
export async function parseOrderWorkbook(buffer: Buffer): Promise<ImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new Error('Không đọc được file. Hãy dùng file Excel .xlsx.');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('File Excel không có trang tính nào.');

  // Tìm dòng tiêu đề: dòng đầu có đủ các cột bắt buộc
  let headerRow = 0;
  const columns = new Map<FieldKey, number>();
  for (let r = 1; r <= Math.min(HEADER_SEARCH_ROWS, sheet.rowCount); r++) {
    const found = new Map<FieldKey, number>();
    sheet.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => {
      const key = normalizeKey(cellText(cell.value));
      if (!key) return;
      for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [FieldKey, string[]][]) {
        if (aliases.includes(key) && !found.has(field)) found.set(field, col);
      }
    });
    if (REQUIRED_FIELDS.every((f) => found.has(f))) {
      headerRow = r;
      found.forEach((col, f) => columns.set(f, col));
      break;
    }
  }
  if (!headerRow) {
    throw new Error(
      'Không tìm thấy dòng tiêu đề. File cần có các cột: Số điện thoại, Tuyến đi, Ngày khởi hành.',
    );
  }
  if (sheet.rowCount - headerRow > IMPORT_MAX_ROWS + 50) {
    throw new Error(`File quá nhiều dòng, mỗi lần nhập tối đa ${IMPORT_MAX_ROWS} đơn.`);
  }

  const rows: ImportRow[] = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const get = (f: FieldKey): ExcelJS.CellValue => {
      const col = columns.get(f);
      return col ? row.getCell(col).value : null;
    };
    const text = (f: FieldKey) => cellText(rawValue(get(f)));

    const phone = parsePhone(get('phone'));
    const routeName = text('route');
    const dateCell = parseDate(get('date'));
    // Dòng trống, dòng TỔNG, khối tổng kết cuối bảng: không có SĐT, tuyến, ngày thì bỏ qua
    if (!phone && !routeName && !dateCell.value && !dateCell.error) continue;

    const errors: string[] = [];
    if (!phone) errors.push('thiếu số điện thoại');
    else if (!/^(0|\+84)\d{9,10}$/.test(phone)) errors.push('số điện thoại không hợp lệ');
    if (!routeName) errors.push('thiếu tuyến đi');
    if (!dateCell.value) errors.push(dateCell.error ? 'ngày khởi hành sai định dạng' : 'thiếu ngày khởi hành');

    const time = parseTime(get('time'));
    if (!time.value) errors.push(time.error ? 'giờ đi sai định dạng' : 'thiếu giờ đi');

    const entry = parseDate(get('entryDate'));
    const count = (f: FieldKey, label: string) => {
      const res = parseCount(get(f));
      if (res.error) errors.push(`${label} không hợp lệ`);
      return res.value;
    };
    const money = (f: FieldKey, label: string) => {
      const res = parseMoney(get(f));
      if (res.error) errors.push(`${label} không hợp lệ`);
      return res.value;
    };

    const seatFront = count('front', 'số ghế đầu');
    const seatMiddle = count('middle', 'số ghế giữa');
    const seatBack = count('back', 'số ghế cuối');
    const seatCount = count('seats', 'số ghế');
    if (seatFront + seatMiddle + seatBack + seatCount < 1) {
      errors.push('thiếu số ghế (hoặc đầu/giữa/cuối)');
    }

    rows.push({
      rowNumber: r,
      entryDate: entry.value,
      staffName: text('staff') || undefined,
      customerName: text('customer') || undefined,
      phone,
      routeName,
      departureTime: time.value,
      departureDate: dateCell.value,
      vehicleType: text('vehicle') || undefined,
      seatFront,
      seatMiddle,
      seatBack,
      seatCount,
      costPrice: money('cost', 'giá nhập'),
      sellPrice: money('sell', 'giá bán'),
      deposit: money('deposit', 'đã cọc'),
      collectOnDelivery: money('cod', 'nhờ thu'),
      commission: money('commission', 'lãi/hoa hồng'),
      partner: text('partner') || undefined,
      pickupPoint: text('pickup') || undefined,
      dropoffPoint: text('dropoff') || undefined,
      note: text('note') || undefined,
      cancelled: normalizeKey(text('status')).includes('dahuy'),
      errors,
    });
  }
  if (rows.length === 0) throw new Error('Không có dòng dữ liệu nào để nhập.');
  if (rows.length > IMPORT_MAX_ROWS) {
    throw new Error(`File có ${rows.length} đơn, mỗi lần nhập tối đa ${IMPORT_MAX_ROWS} đơn.`);
  }
  return rows;
}
