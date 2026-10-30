/**
 * Chuyển file Excel thống kê hộ dân (mỗi sheet = 1 ấp) thành CSV để import vào bảng `house`.
 *
 *   node scripts/excel-to-house-csv.js "<file.xlsx>" "<Tên xã>" [output.csv]
 *
 * Mỗi sheet có bố cục cột khác nhau (có/không có STT, ô gộp lặp giá trị) nên cột được dò
 * theo nội dung header: "TÊN" → chủ hộ, "ĐỊA CHỈ" → ấp, "KHẨU" → số nhân khẩu.
 * Dòng "Trưởng ấp" và dòng tổng cuối sheet bị bỏ qua.
 *
 * id/qrCode sinh giống HousesService.create (qrCode = "TN-" + 8 ký tự đầu của UUID).
 * Bảng `house` chưa có cột nhân khẩu → ghi vào `note` ("Số nhân khẩu: N"), đồng thời giữ
 * cột `householdSize` riêng để đối soát. Các trường chưa có dữ liệu để trống.
 */
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const ExcelJS = require('exceljs');

const [, , inputFile, wardName, outputArg] = process.argv;
if (!inputFile || !wardName) {
  console.error('Cách dùng: node scripts/excel-to-house-csv.js "<file.xlsx>" "<Tên xã>" [output.csv]');
  process.exit(1);
}
const outputFile = outputArg ?? path.join(path.dirname(inputFile), 'house_import.csv');

const COLUMNS = [
  'id', 'qrCode', 'houseNumber', 'street', 'ward', 'hamlet', 'ownerName', 'ownerPhone',
  'ownerIdNumber', 'buildingType', 'floors', 'area', 'latitude', 'longitude', 'soTo', 'soThua',
  'householdSize', 'note',
];

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const upperNoSpace = (s) => clean(s).toUpperCase().replace(/\s+/g, '');

function cellValue(cell) {
  let v = cell.value;
  if (v && typeof v === 'object') {
    if ('result' in v) v = v.result;
    else if (v.richText) v = v.richText.map((t) => t.text).join('');
    else if ('text' in v) v = v.text;
  }
  return v;
}

/** "Ấp Thạnh An" / "Thạnh An" / "ấp  thạnh an" → "Ấp Thạnh An". */
function normalizeHamlet(raw) {
  const name = clean(raw).replace(/^ấp\s+/i, '');
  return name ? `Ấp ${name}` : '';
}

function csvEscape(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(inputFile);

  const rows = [];
  const report = [];

  for (const ws of wb.worksheets) {
    // Dò cột theo header dòng 1 — lấy cột ĐẦU TIÊN khớp (ô gộp lặp giá trị sang các cột sau).
    const header = ws.getRow(1);
    const col = {};
    for (let c = 1; c <= ws.columnCount; c++) {
      const h = upperNoSpace(cellValue(header.getCell(c)));
      if (!col.name && h.includes('TÊN')) col.name = c;
      else if (!col.address && h.includes('ĐỊACHỈ')) col.address = c;
      else if (!col.size && h.includes('KHẨU')) col.size = c;
    }
    if (!col.name || !col.address || !col.size) {
      throw new Error(`Sheet "${ws.name}": không dò được đủ cột (tên/địa chỉ/nhân khẩu)`);
    }

    let count = 0;
    let people = 0;
    const warnings = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const ownerName = clean(cellValue(row.getCell(col.name)));
      if (!ownerName || /^trưởng ấp$/i.test(ownerName)) continue;
      // Dòng "Trưởng ấp" ở sheet thiếu cột STT: tên trưởng ấp nằm ở cột tên, chữ "Trưởng ấp" ở cột trước.
      if (row.getCell(1).value && /^trưởng ấp$/i.test(clean(cellValue(row.getCell(1))))) continue;

      const hamlet = normalizeHamlet(cellValue(row.getCell(col.address)) || ws.name);
      const sizeRaw = cellValue(row.getCell(col.size));
      const size = sizeRaw === null || sizeRaw === undefined || sizeRaw === '' ? null : Number(sizeRaw);
      if (size !== null && !Number.isInteger(size)) warnings.push(`dòng ${r}: nhân khẩu "${sizeRaw}" không hợp lệ`);

      const id = randomUUID();
      rows.push({
        id,
        qrCode: `TN-${id.split('-')[0].toUpperCase()}`,
        houseNumber: '',
        street: '',
        ward: wardName,
        hamlet,
        ownerName,
        householdSize: Number.isInteger(size) ? size : '',
        note: Number.isInteger(size) ? `Số nhân khẩu: ${size}` : '',
      });
      count++;
      if (Number.isInteger(size)) people += size;
    }
    report.push({ sheet: ws.name, households: count, people, warnings });
  }

  const lines = [COLUMNS.join(',')];
  for (const row of rows) lines.push(COLUMNS.map((c) => csvEscape(row[c])).join(','));
  fs.writeFileSync(outputFile, lines.join('\n') + '\n', 'utf8');

  for (const r of report) {
    console.log(`${r.sheet.padEnd(14)} ${String(r.households).padStart(5)} hộ  ${String(r.people).padStart(6)} nhân khẩu`);
    for (const w of r.warnings) console.log(`   ⚠ ${w}`);
  }
  console.log(`Tổng: ${rows.length} hộ → ${outputFile}`);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
