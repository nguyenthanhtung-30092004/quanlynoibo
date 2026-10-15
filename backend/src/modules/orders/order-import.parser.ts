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
  | 'partner'
  | 'note';

/** Tên cột (đã bỏ dấu, bỏ khoảng trắng, chữ thường) mà mỗi trường chấp nhận */
const HEADER_ALIASES: Record<FieldKey, string[]> = {
  entryDate: ['ngayvaoso', 'ngayvao'],
  customer: ['tenkhach', 'tenkhachhang', 'khachhang', 'khach'],
  phone: ['sodienthoai', 'sdt', 'dienthoai'],
  route: ['tuyendi', 'tuyenduong', 'tuyen'],
  time: ['giodi', 'gioxe', 'gio'],
  date: ['ngaykhoihanh', 'ngaydi'],
  vehicle: ['loaihinh'],
  front: ['dau', 'ghedau'],
  middle: ['giua', 'ghegiua'],
  back: ['cuoi', 'ghecuoi'],
  seats: ['soghe', 'ghe', 'soluongghe'],
  partner: ['doitac', 'nhaxe'],
  note: ['ghichu', 'note'],
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

/**
 * Viết hoa chữ cái đầu mỗi từ theo quy chuẩn hệ thống: "nguyễn văn mạnh" và
 * "NGUYỄN VĂN MẠNH" đều thành "Nguyễn Văn Mạnh". Từ có chữ số (3A, 280/12) giữ nguyên.
 */
export function titleCase(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => {
      if (/\d/.test(word)) return word;
      const lower = word.toLocaleLowerCase('vi');
      return lower.charAt(0).toLocaleUpperCase('vi') + lower.slice(1);
    })
    .join(' ');
}

const pad = (n: number) => String(n).padStart(2, '0');

function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if ('richText' in v)
    return v.richText
      .map((r) => r.text)
      .join('')
      .trim();
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
    return {
      value: `${raw.getUTCFullYear()}-${pad(raw.getUTCMonth() + 1)}-${pad(raw.getUTCDate())}`,
    };
  }
  if (typeof raw === 'number') {
    const dt = new Date(Math.round((raw - 25569) * 86400000));
    return {
      value: `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`,
    };
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

  // Tìm dòng tiêu đề: hỗ trợ cả tiêu đề 1 tầng và tiêu đề 2 tầng (gộp r và r + 1)
  let dataStartRow = 0;
  const columns = new Map<FieldKey, number>();

  // Lượt 1: dòng tiêu đề phải tự có đủ cột bắt buộc (tránh nhận nhầm dòng tiêu đề lớn phía trên
  // khi tiêu đề thật nằm ở dòng dưới). Lượt 2: cho phép gộp bắt buộc từ cả dòng bên dưới.
  for (const strict of [true, false]) {
    if (dataStartRow) break;
    for (let r = 1; r <= Math.min(HEADER_SEARCH_ROWS, sheet.rowCount); r++) {
      const found = new Map<FieldKey, number>();
      const foundOnSubRow = new Set<FieldKey>();

      // 1. Quét trên chính dòng r
      sheet.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => {
        const key = normalizeKey(cellText(cell.value));
        if (!key) return;
        for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
          FieldKey,
          string[],
        ][]) {
          if (aliases.includes(key) && !found.has(field)) {
            found.set(field, col);
          }
        }
      });

      const ownFound = new Set(found.keys());

      // 2. Quét dòng ngay bên dưới r + 1 (nếu có)
      if (r + 1 <= sheet.rowCount) {
        sheet.getRow(r + 1).eachCell({ includeEmpty: false }, (cell, col) => {
          const key = normalizeKey(cellText(cell.value));
          if (!key) return;
          for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
            FieldKey,
            string[],
          ][]) {
            if (aliases.includes(key) && !found.has(field)) {
              found.set(field, col);
              foundOnSubRow.add(field);
            }
          }
        });
      }

      // 3. Dòng tiêu đề được chấp nhận khi gộp xong đủ các trường bắt buộc (phone, route, date)
      if (REQUIRED_FIELDS.every((f) => (strict ? ownFound : found).has(f))) {
        const subHeaderFields: FieldKey[] = [
          'front',
          'middle',
          'back',
          'seats',
        ];
        const hasSubHeader = subHeaderFields.some((f) => foundOnSubRow.has(f));
        dataStartRow = hasSubHeader ? r + 1 : r;
        found.forEach((col, f) => {
          columns.set(f, col);
        });
        break;
      }
    }
  }

  if (!dataStartRow) {
    throw new Error(
      'Không tìm thấy dòng tiêu đề. File cần có các cột: Số điện thoại, Tuyến đi, Ngày khởi hành.',
    );
  }

  // Chỉ duyệt các dòng thật sự có dữ liệu bắt đầu sau tiêu đề
  const dataRows: ExcelJS.Row[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, r) => {
    if (r > dataStartRow) dataRows.push(row);
  });

  const rows: ImportRow[] = [];
  for (const row of dataRows) {
    const r = row.number;
    const get = (f: FieldKey): ExcelJS.CellValue => {
      const col = columns.get(f);
      return col ? row.getCell(col).value : null;
    };
    const text = (f: FieldKey) => cellText(rawValue(get(f)));

    const phone = parsePhone(get('phone'));
    const routeName = text('route');
    const dateCell = parseDate(get('date'));
    // Dòng trống, dòng TỔNG, khối tổng kết cuối bảng: không có SĐT, tuyến, tên khách thì bỏ qua
    if (!phone && !routeName && !text('customer')) continue;

    const errors: string[] = [];
    if (!phone) errors.push('thiếu số điện thoại');
    else if (!/^(0|\+84)\d{9,10}$/.test(phone))
      errors.push('số điện thoại không hợp lệ');
    if (!routeName) errors.push('thiếu tuyến đi');
    if (!dateCell.value)
      errors.push(
        dateCell.error
          ? 'ngày khởi hành sai định dạng'
          : 'thiếu ngày khởi hành',
      );

    const time = parseTime(get('time'));
    if (!time.value)
      errors.push(time.error ? 'giờ đi sai định dạng' : 'thiếu giờ đi');

    const entry = parseDate(get('entryDate'));
    const count = (f: FieldKey, label: string) => {
      const res = parseCount(get(f));
      if (res.error) errors.push(`${label} không hợp lệ`);
      return res.value;
    };

    const seatFront = count('front', 'số ghế đầu');
    const seatMiddle = count('middle', 'số ghế giữa');
    const seatBack = count('back', 'số ghế cuối');
    const seatCount = count('seats', 'số ghế');

    rows.push({
      rowNumber: r,
      entryDate: entry.value,
      staffName: undefined,
      customerName: titleCase(text('customer')) || undefined,
      phone,
      routeName,
      departureTime: time.value,
      departureDate: dateCell.value,
      vehicleType: titleCase(text('vehicle')) || undefined,
      seatFront,
      seatMiddle,
      seatBack,
      seatCount,
      costPrice: 0,
      sellPrice: 0,
      deposit: 0,
      collectOnDelivery: 0,
      commission: 0,
      partner: titleCase(text('partner')) || undefined,
      pickupPoint: undefined,
      dropoffPoint: undefined,
      note: text('note') || undefined,
      cancelled: false,
      errors,
    });
  }

  if (rows.length === 0) throw new Error('Không có dòng dữ liệu nào để nhập.');
  if (rows.length > IMPORT_MAX_ROWS) {
    throw new Error(
      `File có ${rows.length} đơn, mỗi lần nhập tối đa ${IMPORT_MAX_ROWS} đơn.`,
    );
  }
  return rows;
}
