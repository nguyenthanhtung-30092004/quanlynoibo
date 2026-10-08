// Nạp danh sách đối tác vào bảng "partners". Chạy lại nhiều lần vẫn an toàn:
// tên đã có (không phân biệt hoa thường) sẽ được bỏ qua.
//
//   cd backend && node scripts/seed-partners.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const RAW = `
Hải Phòng Travel
Minh Anh
Hoàng Phương
Hà Hải
36 Travel
Hoàng Phú
Tuấn Minh
Phúc Xuyên
Mạnh Quân
Interbus
Duy Khang
HK Buslines
Xuân Tráng
Hùng Cường
APT
Newstar
Duy Khang
Sao Việt
Dream
Thanh Nhung
Bình Hoài
Phúc Lâm
Hà Lan
Duy Khánh
Xuân Đạt
Cửa Ông
Hải Dương
Anh Huy 92
Tùng Tuấn
X.E Việt Nam
Gia Nguyễn
Bằng Phấn
Ngọc Cường
Trần Tùng
Anh Huy Đất Cảng
Sơn Hải
Vĩnh Quang
Duy Quang
Sapa Group Bus
Hồng Vinh
Đức Phúc
Futa Hà Sơn
Anh Tùng
Hoàng Hà
Sapa King
Anh Quốc
Anh Tùng vé fan
khách sạn Valley
khách sạn Vista
khách sạn Charm
khách sạn BamBo
khách sạn Diamond
khách sạn Bora
khách sạn Kk sapa
khách sạn HC
G8 OPEN TOUR
Strip
`;

/** Cắt khoảng trắng thừa, viết hoa chữ đầu ("khách sạn Valley" -> "Khách sạn Valley") */
const clean = (s) => {
  const t = s.trim().replace(/\s+/g, ' ');
  return t.charAt(0).toLocaleUpperCase('vi') + t.slice(1);
};

const names = [];
const seen = new Set();
for (const line of RAW.split('\n')) {
  if (!line.trim()) continue;
  const name = clean(line);
  if (seen.has(name.toLowerCase())) continue; // ví dụ "Duy Khang" xuất hiện 2 lần
  seen.add(name.toLowerCase());
  names.push(name);
}

const env = {};
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
}

const client = new pg.Client({
  host: env.DATABASE_HOST || 'localhost',
  port: Number(env.DATABASE_PORT || 5432),
  user: env.DATABASE_USERNAME || 'postgres',
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE_NAME || 'quan_ly_noi_bo',
});

await client.connect();
try {
  await client.query('BEGIN');
  let inserted = 0;
  for (const name of names) {
    const exists = await client.query('SELECT 1 FROM partners WHERE LOWER(name) = LOWER($1)', [name]);
    if (exists.rowCount) continue;
    await client.query('INSERT INTO partners (name) VALUES ($1)', [name]);
    inserted += 1;
  }
  await client.query('COMMIT');
  const total = await client.query('SELECT COUNT(*)::int AS n FROM partners');
  console.log(`Danh sách: ${names.length} đối tác | thêm mới: ${inserted} | bỏ qua (đã có): ${names.length - inserted} | tổng trong bảng: ${total.rows[0].n}`);
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  await client.end();
}
