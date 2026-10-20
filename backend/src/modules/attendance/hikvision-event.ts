/**
 * Đọc gói tin "HTTP Listening" mà máy chấm công Hikvision đẩy về server.
 * Tùy đời máy / firmware, gói tin là: multipart/form-data (phần `event_log` là JSON, kèm ảnh),
 * JSON thuần, hoặc XML (máy cũ). Các hàm ở đây đều là hàm thuần để kiểm thử được.
 */

export interface HikvisionPunch {
  /** Mã nhân viên đã đăng ký trên máy (employeeNoString) */
  employeeNo: string;
  /** Giờ máy ghi nhận lượt quẹt */
  at: Date;
  /** attendanceStatus của máy: checkIn, checkOut, breakOut, breakIn, overTimeIn, overTimeOut hoặc undefined */
  status: string | null;
}

export type PunchDirection = 'in' | 'out';

const IN_STATUSES = new Set(['checkin', 'breakin', 'overtimein']);
const OUT_STATUSES = new Set(['checkout', 'breakout', 'overtimeout']);

/** Nút bấm trên máy (Check In / Check Out...) quyết định chiều; null nếu máy không gửi hoặc là "undefined" */
export function directionFromStatus(status: string | null): PunchDirection | null {
  const key = (status ?? '').trim().toLowerCase();
  if (IN_STATUSES.has(key)) return 'in';
  if (OUT_STATUSES.has(key)) return 'out';
  return null;
}

/** Máy không gửi chiều thì đoán theo thứ tự trong ngày: lượt 1 là vào, lượt 2 là ra, lượt 3 lại là vào... */
export function directionByOrder(punchesBefore: number): PunchDirection {
  return punchesBefore % 2 === 0 ? 'in' : 'out';
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const asText = (value: unknown): string | null => {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

/** Từ JSON của máy (đã parse) lấy ra lượt quẹt; null nếu không phải sự kiện có nhân viên (heartbeat, báo động, người lạ...) */
export function punchFromJson(input: unknown): HikvisionPunch | null {
  const root = asRecord(input);
  if (!root) return null;
  const event = asRecord(root.AccessControllerEvent);
  if (!event) return null;

  const employeeNo = asText(event.employeeNoString) ?? asText(event.employeeNo);
  if (!employeeNo || employeeNo === '0') return null;

  const at = parseDeviceTime(asText(root.dateTime));
  if (!at) return null;
  return { employeeNo, at, status: asText(event.attendanceStatus) };
}

/** Máy đời cũ gửi XML: chỉ cần vài trường nên dùng regex, không cần thư viện XML */
export function punchFromXml(xml: string): HikvisionPunch | null {
  const tag = (name: string) => new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1]?.trim() || null;
  const employeeNo = tag('employeeNoString') ?? tag('employeeNo');
  if (!employeeNo || employeeNo === '0') return null;
  const at = parseDeviceTime(tag('dateTime'));
  if (!at) return null;
  return { employeeNo, at, status: tag('attendanceStatus') };
}

/** dateTime của máy dạng ISO có múi giờ ("2026-05-01T08:00:01+07:00"); không đọc được thì trả null */
export function parseDeviceTime(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Tách các phần của gói multipart/form-data; chỉ giữ phần chữ (JSON/XML), bỏ phần ảnh */
export function textPartsOfMultipart(body: Buffer, contentType: string): string[] {
  const boundary = /boundary="?([^";]+)"?/i.exec(contentType)?.[1];
  if (!boundary) return [];

  const delimiter = Buffer.from(`--${boundary}`);
  const parts: string[] = [];
  let cursor = body.indexOf(delimiter);
  while (cursor !== -1) {
    const start = cursor + delimiter.length;
    const next = body.indexOf(delimiter, start);
    if (next === -1) break;

    const part = body.subarray(start, next);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headers = part.subarray(0, headerEnd).toString('latin1').toLowerCase();
      const isPicture = headers.includes('image/') || headers.includes('octet-stream');
      if (!isPicture) {
        // bỏ "\r\n" cuối trước dấu phân cách
        const payload = part.subarray(headerEnd + 4).toString('utf8').replace(/\r\n$/, '');
        parts.push(payload);
      }
    }
    cursor = next;
  }
  return parts;
}

/** Điểm vào chung: nhận phần thân đã đọc (object nếu Express đã parse JSON, hoặc Buffer thô) và trả về lượt quẹt */
export function parseHikvisionPunch(body: unknown, contentType: string): HikvisionPunch | null {
  if (Buffer.isBuffer(body)) {
    const texts = /multipart/i.test(contentType) ? textPartsOfMultipart(body, contentType) : [body.toString('utf8')];
    for (const text of texts) {
      const punch = punchFromText(text);
      if (punch) return punch;
    }
    return null;
  }
  return punchFromJson(body);
}

function punchFromText(text: string): HikvisionPunch | null {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try {
      return punchFromJson(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  if (trimmed.startsWith('<')) return punchFromXml(trimmed);
  return null;
}
