import { Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import { cellText, normalizeKey, parseDate, parsePhone, parseTime, rawValue } from '../order-import.parser.js';

/** Một vé đọc được từ file Excel của nhà xe: chỉ giữ lại những gì cần để đối chiếu */
export interface TicketCompareRow {
  phone: string;
  /** Số vé/số ghế của dòng này (mặc định 1 nếu file không có cột số lượng) */
  quantity: number;
  customerName?: string;
  route?: string;
  /** Ngày/giờ khởi hành (hoặc chuyến đi) để nhận ra đúng vé nào, hiển thị thôi, không dùng để so khớp */
  departure?: string;
  /** Mã vé nếu file có (vd file nhà xe xuất), để tra lại đúng dòng trong file gốc */
  ticketId?: string;
}

type FieldKey = 'phone' | 'quantity' | 'status' | 'customer' | 'route' | 'date' | 'time' | 'trip' | 'ticketId';

/** Tên cột (đã bỏ dấu, bỏ khoảng trắng, chữ thường) mà mỗi trường chấp nhận */
const HEADER_ALIASES: Record<FieldKey, string[]> = {
  phone: ['sodienthoai', 'sdt', 'dienthoai'],
  quantity: ['soluong', 'soghe', 'soluongghe', 'soluongve'],
  status: ['trangthaive', 'trangthai'],
  customer: ['tenkhach', 'tenkhachhang', 'khachhang', 'khach', 'tennguoidi'],
  route: ['tuyendi', 'tuyenduong', 'tuyen'],
  date: ['ngaykhoihanh', 'ngaydi'],
  time: ['giodi', 'gioxe', 'gio'],
  // "Chuyến" (file nhà xe tự xuất): ngày giờ khởi hành gộp chung 1 cột, dạng chữ sẵn
  trip: ['chuyen'],
  ticketId: ['mave'],
};

/** "2026-10-04" -> "04/10/2026" để hiển thị quen mắt; giữ nguyên nếu không parse được */
function toVnDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

/** Ghép ngày + giờ khởi hành để hiển thị; nếu file chỉ có cột "Chuyến" gộp sẵn thì dùng luôn */
function buildDeparture(dateCell: ExcelJS.CellValue, timeCell: ExcelJS.CellValue, tripText: string): string | undefined {
  const date = parseDate(dateCell);
  const time = parseTime(timeCell);
  if (date.value || time.value) {
    return [date.value ? toVnDate(date.value) : null, time.value].filter(Boolean).join(' ') || undefined;
  }
  return tripText || undefined;
}

const HEADER_SEARCH_ROWS = 15;
const MAX_SCANNED_ROWS = 200000;

const TOO_MANY_ROWS_MESSAGE =
  'File có quá nhiều dòng. Hãy copy dữ liệu sang file Excel mới (chỉ gồm các dòng có vé) rồi thử lại.';

/** Vé có trạng thái chứa "hủy" (đã hủy, hủy vé...) không tính là vé hợp lệ */
function isCancelledStatus(statusText: string): boolean {
  return normalizeKey(statusText).includes('huy');
}

/** Tìm dòng tiêu đề trong các dòng đầu file: chỉ bắt buộc tìm thấy cột số điện thoại */
function findHeader(head: Map<number, ExcelJS.Row>): { headerRow: number; columns: Map<FieldKey, number> } | null {
  const maxRow = Math.max(0, ...head.keys());
  for (let r = 1; r <= Math.min(HEADER_SEARCH_ROWS, maxRow); r++) {
    const found = new Map<FieldKey, number>();
    head.get(r)?.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = normalizeKey(cellText(cell.value));
      if (!key) return;
      for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [FieldKey, string[]][]) {
        if (aliases.includes(key) && !found.has(field)) found.set(field, col);
      }
    });
    if (found.has('phone')) return { headerRow: r, columns: found };
  }
  return null;
}

/** Số lượng vé của dòng: ô trống/không hợp lệ coi là 1 vé (một dòng = một vé theo mặc định) */
function parseQuantity(v: ExcelJS.CellValue): number {
  const raw = rawValue(v);
  if (raw === null || raw === undefined || raw === '') return 1;
  const n = typeof raw === 'number' ? raw : Number(cellText(raw));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 1;
}

/**
 * Đọc một file Excel bất kỳ (file nội bộ hoặc file do nhà xe tự xuất) và lấy ra danh sách vé
 * (SĐT + số lượng) để phục vụ đối chiếu. Chỉ bắt buộc file có một cột số điện thoại; các cột
 * khác (số lượng, trạng thái, tên khách, tuyến) là tùy chọn, có cũng được không có cũng được.
 * Vé có trạng thái "đã hủy" bị loại khỏi kết quả vì không phải vé đã bán thật.
 * Đọc theo luồng để không nạp cả file nhiều dòng vào bộ nhớ; nếu luồng lỗi thì đọc nguyên khối.
 */
export async function parseTicketWorkbook(buffer: Buffer): Promise<{ rows: TicketCompareRow[]; cancelledCount: number }> {
  const result = { rows: [] as TicketCompareRow[], cancelledCount: 0 };
  let columns = new Map<FieldKey, number>();
  let dataStartRow = 0;
  let sawSheet = false;

  const processRow = (row: ExcelJS.Row) => {
    const get = (f: FieldKey): ExcelJS.CellValue => {
      const col = columns.get(f);
      return col ? row.getCell(col).value : null;
    };
    const phone = parsePhone(get('phone'));
    if (!phone) return; // dòng trống, dòng TỔNG, dòng hoa hồng cuối bảng...

    const statusText = cellText(rawValue(get('status')));
    if (statusText && isCancelledStatus(statusText)) {
      result.cancelledCount++;
      return;
    }

    result.rows.push({
      phone,
      quantity: columns.has('quantity') ? parseQuantity(get('quantity')) : 1,
      customerName: cellText(rawValue(get('customer'))) || undefined,
      route: cellText(rawValue(get('route'))) || undefined,
      departure: buildDeparture(get('date'), get('time'), cellText(rawValue(get('trip')))),
      ticketId: cellText(rawValue(get('ticketId'))) || undefined,
    });
  };

  const consumeSheet = async (source: AsyncIterable<ExcelJS.Row> | Iterable<ExcelJS.Row>) => {
    const head = new Map<number, ExcelJS.Row>();
    let scanned = 0;

    for await (const row of source) {
      if (++scanned > MAX_SCANNED_ROWS) throw new Error(TOO_MANY_ROWS_MESSAGE);
      if (!dataStartRow) {
        if (row.number <= HEADER_SEARCH_ROWS + 1) {
          head.set(row.number, row);
          continue;
        }
        const header = findHeader(head);
        if (!header) return;
        dataStartRow = header.headerRow;
        columns = header.columns;
        for (const [n, r] of head) if (n > dataStartRow) processRow(r);
        head.clear();
      }
      if (row.number > dataStartRow) processRow(row);
    }

    if (!dataStartRow) {
      const header = findHeader(head);
      if (header) {
        dataStartRow = header.headerRow;
        columns = header.columns;
        for (const [n, r] of head) if (n > dataStartRow) processRow(r);
      }
    }
  };

  const reader = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from([buffer]), {
    worksheets: 'emit',
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    styles: 'cache',
    entries: 'ignore',
  });

  try {
    for await (const sheet of reader) {
      sawSheet = true;
      await consumeSheet(sheet as unknown as AsyncIterable<ExcelJS.Row>);
      break;
    }
  } catch (err) {
    if (err instanceof Error && err.message === TOO_MANY_ROWS_MESSAGE) throw err;
    result.rows.length = 0;
    result.cancelledCount = 0;
    dataStartRow = 0;
    columns = new Map<FieldKey, number>();
    sawSheet = false;
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } catch {
      throw new Error('Không đọc được file. Hãy dùng file Excel .xlsx.');
    }
    const sheet = workbook.worksheets[0];
    if (sheet) {
      sawSheet = true;
      const loaded: ExcelJS.Row[] = [];
      sheet.eachRow({ includeEmpty: false }, (row) => loaded.push(row));
      await consumeSheet(loaded);
    }
  }

  if (!sawSheet) throw new Error('File Excel không có trang tính nào.');
  if (!dataStartRow) {
    throw new Error('Không tìm thấy cột "Số điện thoại" trong file. Hãy kiểm tra lại file Excel.');
  }
  if (result.rows.length === 0 && result.cancelledCount === 0) {
    throw new Error('Không có dòng dữ liệu nào trong file.');
  }
  return result;
}
