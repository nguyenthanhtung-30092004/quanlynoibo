import { directionByOrder, directionFromStatus, parseHikvisionPunch } from './hikvision-event.js';

const EVENT = {
  ipAddress: '192.168.1.64',
  dateTime: '2026-05-01T08:00:01+07:00',
  eventType: 'AccessControllerEvent',
  AccessControllerEvent: {
    majorEventType: 5,
    subEventType: 75,
    employeeNoString: '12',
    attendanceStatus: 'checkIn',
  },
};

const multipart = (boundary: string, json: string) =>
  Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="event_log"\r\nContent-Type: application/json\r\n\r\n${json}\r\n`,
    ),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="Picture"; filename="a.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    Buffer.from([0xff, 0xd8, 0xff, 0x7b, 0x22]),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

describe('parseHikvisionPunch', () => {
  it('JSON thuần (Express đã parse)', () => {
    const punch = parseHikvisionPunch(EVENT, 'application/json');
    expect(punch?.employeeNo).toBe('12');
    expect(punch?.status).toBe('checkIn');
    expect(punch?.at.toISOString()).toBe('2026-05-01T01:00:01.000Z');
  });

  it('multipart: lấy phần event_log, bỏ qua phần ảnh', () => {
    const body = multipart('MIME_boundary', JSON.stringify(EVENT));
    const punch = parseHikvisionPunch(body, 'multipart/form-data; boundary=MIME_boundary');
    expect(punch?.employeeNo).toBe('12');
  });

  it('XML máy đời cũ', () => {
    const xml = `<EventNotificationAlert><dateTime>2026-05-01T17:30:00+07:00</dateTime><AccessControllerEvent><employeeNoString>7</employeeNoString></AccessControllerEvent></EventNotificationAlert>`;
    const punch = parseHikvisionPunch(Buffer.from(xml), 'application/xml');
    expect(punch?.employeeNo).toBe('7');
    expect(punch?.status).toBeNull();
  });

  it('bỏ qua heartbeat, người lạ (không có mã nhân viên) và dữ liệu rác', () => {
    expect(parseHikvisionPunch({ eventType: 'heartBeat', dateTime: EVENT.dateTime }, 'application/json')).toBeNull();
    const stranger = { ...EVENT, AccessControllerEvent: { majorEventType: 5, subEventType: 76 } };
    expect(parseHikvisionPunch(stranger, 'application/json')).toBeNull();
    expect(parseHikvisionPunch(Buffer.from('xyz'), 'text/plain')).toBeNull();
    expect(parseHikvisionPunch({}, 'application/json')).toBeNull();
  });
});

describe('chiều vào / ra', () => {
  it('ưu tiên nút bấm trên máy', () => {
    expect(directionFromStatus('checkIn')).toBe('in');
    expect(directionFromStatus('checkOut')).toBe('out');
    expect(directionFromStatus('breakOut')).toBe('out');
    expect(directionFromStatus('undefined')).toBeNull();
    expect(directionFromStatus(null)).toBeNull();
  });

  it('máy không gửi chiều: lẻ/chẵn theo số lượt quẹt trước đó trong ngày', () => {
    expect(directionByOrder(0)).toBe('in');
    expect(directionByOrder(1)).toBe('out');
    expect(directionByOrder(2)).toBe('in');
  });
});
