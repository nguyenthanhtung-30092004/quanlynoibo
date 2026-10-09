// Nạp danh mục tuyến đường vào bảng "routes". Chạy lại nhiều lần vẫn an toàn:
// tuyến đã có (trùng tên, không phân biệt hoa thường) sẽ được bỏ qua.
//
//   cd backend && node scripts/seed-routes.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const RAW = `
Hà Nội - Hải Phòng
Hải Phòng - Hà Nội
Hà Nội - Thái Bình
Thái Bình - Hà Nội
Hà Nội - Thái Nguyên
Thái Nguyên - Hà Nội
Hà Nội - Thanh Hóa
Thanh Hóa - Hà Nội
Hà Nội - Lạng Sơn
Lạng Sơn - Hà Nội
Hà Nội - Ninh Bình
Ninh Bình - Hà Nội
Hà Nội - Hạ Long
Hạ Long - Hà Nội
Hà Nội - Sapa
Sapa - Hà nội
Hà Nội - Móng Cái
Móng Cái - Hà Nội
Hà Nội - Sầm Sơn
Sầm sơn - Hà Nội
Hà Nội - Mộc Châu
Mộc Châu - Hà Nội
Hà Nội - Hà Cối
Hà Cối - Hà Nội
Hà Nội - Hà Giang
Hà Giang - Hà Nội
Hải Phòng - Móng Cái
Móng Cái - Hải Phòng
Hà Nội - Tiên Yên
Tiên Yên - Hà Nội
Hạ Long - Móng Cái
Móng Cái - Hạ Long
Hà Nội - Cẩm Phả
Cẩm Phả - Hà Nội
Hà Nội - Đầm Hà
Đầm Hà - Hà Nội
Hà Nội - Cửa Ông
Cửa Ông - Hà Nội
Móng Cái - Sân Bay
Sân Bay - Móng Cái
Hà Nội - Vân Đồn
Vân Đồn - Hà Nội
Trà Cổ - Hà Nội
Hà Nội - Trà Cổ
Hà Nội - Hải Dương
Hải Dương - Hà Nội
Hà Nội - Uông Bí
Uông Bí - Hà Nội
`;

/** "sầm  sơn" -> "Sầm Sơn" */
const titleCase = (s) =>
  s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toLocaleUpperCase('vi') + w.slice(1).toLocaleLowerCase('vi'))
    .join(' ');

const routes = [];
const seen = new Set();
for (const line of RAW.split('\n')) {
  if (!line.trim()) continue;
  const parts = line.split('-').map(titleCase);
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Dòng không hợp lệ: "${line}"`);
  }
  const [origin, destination] = parts;
  const name = `${origin} - ${destination}`;
  if (seen.has(name.toLowerCase())) continue;
  seen.add(name.toLowerCase());
  routes.push({ name, origin, destination });
}

// Cấu hình DB: ưu tiên biến môi trường (trong container Docker), nếu không có
// thì đọc backend/.env (chạy tay trên máy dev). Không in giá trị nhạy cảm.
const env = {};
try {
  const envPath = fileURLToPath(new URL('../.env', import.meta.url));
  for (const line of readFileSync(envPath, 'utf8').split(/?
/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)$/, '$2');
  }
} catch {
  // không có file .env: dùng biến môi trường
}
for (const k of ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_USERNAME', 'DATABASE_PASSWORD', 'DATABASE_NAME']) {
  if (process.env[k]) env[k] = process.env[k];
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
  for (const r of routes) {
    const exists = await client.query('SELECT 1 FROM routes WHERE LOWER(name) = LOWER($1)', [r.name]);
    if (exists.rowCount) continue;
    await client.query(
      `INSERT INTO routes (name, origin, destination, "defaultPrice", "isActive")
       VALUES ($1, $2, $3, 0, true)`,
      [r.name, r.origin, r.destination],
    );
    inserted += 1;
  }
  await client.query('COMMIT');
  const total = await client.query('SELECT COUNT(*)::int AS n FROM routes');
  console.log(`Danh sách: ${routes.length} tuyến | thêm mới: ${inserted} | bỏ qua (đã có): ${routes.length - inserted} | tổng trong bảng: ${total.rows[0].n}`);
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  await client.end();
}
