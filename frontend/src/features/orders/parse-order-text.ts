/** Các ô của form vé mà đoạn chữ dán vào có thể điền được */
export interface ParsedOrderText {
  departureTime?: string;
  departureDate?: string;
  phone?: string;
  customerName?: string;
  pickupPoint?: string;
  dropoffPoint?: string;
  seatCount?: number;
  seatFront?: number;
  seatMiddle?: number;
  seatBack?: number;
}

/** "2 ghế", "1 ghế đầu", "1 đầu" (số đứng trước) */
const SEAT_AFTER =
  /(\d{1,2})\s*(?:(?:ghế|ghe|chỗ|cho)(?![\p{L}])(?:\s*(đầu|giữa|cuối)(?![\p{L}]))?|(đầu|giữa|cuối)(?![\p{L}]))/giu;
/** "đầu 1", "cuối: 2" (số đứng sau) */
const SEAT_BEFORE = /(?<![\p{L}])(đầu|giữa|cuối)\s*[:=]?\s*(\d{1,2})(?!\d)/giu;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Đọc đoạn tin nhắn đặt vé viết tay, ví dụ:
 *   14h ngày 11/10
 *   0912345678 lê anh/ Nguyễn Văn Luân
 *   đón ks alacar
 *   trả đường tròn điềm thụy phú bình tn
 *   2 ghế
 * Chỉ trả về những ô đọc được, ô nào không thấy thì bỏ trống để không ghi đè.
 * Đọc luôn được nội dung do nút "Sao chép" của form tạo ra.
 */
export function parseOrderText(raw: string, currentYear: number): ParsedOrderText {
  const out: ParsedOrderText = {};
  let text = raw.replace(/\r/g, '');

  // Số điện thoại: 0xxxxxxxxx hoặc +84..., cho phép có dấu cách / chấm xen giữa
  const phoneMatch = text.match(/(?<![\d/])(?:\+?84|0)(?:[ .]?\d){8,10}(?!\d)/);
  if (phoneMatch) {
    const digits = phoneMatch[0].replace(/[^\d+]/g, '').replace(/^\+?84/, '0');
    if (/^0\d{9,10}$/.test(digits)) {
      out.phone = digits;
      text = text.replace(phoneMatch[0], ' \u0000 ');
    }
  }

  // Số quốc tế: +mã nước (khác +84) rồi 7-14 chữ số, giữ nguyên dấu +
  if (!out.phone) {
    const intl = text.match(/(?<![\d/])\+(?!84)[1-9](?:[ .-]?\d){7,13}(?!\d)/);
    if (intl) {
      out.phone = intl[0].replace(/[^\d+]/g, '');
      text = text.replace(intl[0], ' \u0000 ');
    }
  }

  // Ngày: 11/10, 11-10-2026, 11.10 ...
  const dateMatch = text.match(/(?:ngày\s*)?(\d{1,2})\s*[/\-.]\s*(\d{1,2})(?:\s*[/\-.]\s*(\d{4}|\d{2}))?/i);
  if (dateMatch) {
    const day = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    let year = dateMatch[3] ? Number(dateMatch[3]) : currentYear;
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      out.departureDate = `${year}-${pad(month)}-${pad(day)}`;
      text = text.replace(dateMatch[0], ' ');
    }
  }

  // Giờ: 14h, 14h30, 14:30, 14 giờ 30
  const timeMatch =
    text.match(/\b(\d{1,2})[ \t]*(?:h|giờ|gio)(?![\p{L}\d])[ \t]*(\d{1,2})?(?!\d)/iu) ??
    text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (timeMatch) {
    const hour = Number(timeMatch[1]);
    const minute = timeMatch[2] ? Number(timeMatch[2]) : 0;
    if (hour <= 23 && minute <= 59) {
      out.departureTime = `${pad(hour)}:${pad(minute)}`;
      text = text.replace(timeMatch[0], ' ');
    }
  }

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const rest: string[] = [];
  for (const line of lines) {
    const pickup = line.match(/^(?:đón|don)\s*[:\-]?\s*(.+)$/i);
    const dropoff = line.match(/^(?:trả|tra)\s*[:\-]?\s*(.+)$/i);
    if (pickup) out.pickupPoint = pickup[1].trim();
    else if (dropoff) out.dropoffPoint = dropoff[1].trim();
    else rest.push(line);
  }

  // Số ghế: "2 ghế" là tổng; "1 ghế đầu", "1 đầu", "đầu 1" là theo vị trí
  const zoneKey = { đầu: 'seatFront', giữa: 'seatMiddle', cuối: 'seatBack' } as const;
  // Dòng bắt đầu bằng tên vị trí ("đầu 2 giữa 1") thì số đứng sau; còn lại số đứng trước ("2 đầu 1 cuối")
  for (const line of rest) {
    if (/^(?:đầu|giữa|cuối)\s*[:=]?\s*\d/iu.test(line)) {
      for (const m of line.matchAll(SEAT_BEFORE)) {
        out[zoneKey[m[1].toLowerCase() as keyof typeof zoneKey]] = Number(m[2]);
      }
      continue;
    }
    for (const m of line.matchAll(SEAT_AFTER)) {
      const n = Number(m[1]);
      const zone = (m[2] ?? m[3])?.toLowerCase() as keyof typeof zoneKey | undefined;
      if (zone) out[zoneKey[zone]] = n;
      else out.seatCount = n;
    }
  }

  // Tên khách: phần còn lại của dòng có số điện thoại (bỏ ký hiệu thừa)
  const phoneLine = rest.find((l) => l.includes('\u0000'));
  if (phoneLine) {
    const name = phoneLine
      .replace(/\u0000/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(SEAT_AFTER, ' ').replace(SEAT_BEFORE, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[\s\-:,.;/|]+|[\s\-:,.;/|]+$/g, '');
    if (name) out.customerName = name;
  } else {
    // Không có số điện thoại: dòng chữ còn lại đầu tiên (không phải ngày giờ, ghế, đón/trả) là tên khách
    const nameLine = rest
      .map((l) =>
        l
          .replace(/\[[^\]]*\]/g, ' ')
          .replace(SEAT_AFTER, ' ').replace(SEAT_BEFORE, ' ')
          .replace(/\s+/g, ' ')
          .replace(/^[\s\-:,.;/|+]+|[\s\-:,.;/|+]+$/g, ''),
      )
      .find((l) => /\p{L}{2,}/u.test(l));
    if (nameLine) out.customerName = nameLine;
  }

  return out;
}
