import { parseImportFile } from "../server/import-service.mjs";

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return buffer;
}

function createStoredZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  Object.entries(files).forEach(([name, content]) => {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);
    const localHeader = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBuffer.length),
      u16(0),
      nameBuffer,
    ]);

    localParts.push(localHeader, data);
    centralParts.push(
      Buffer.concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(nameBuffer.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBuffer,
      ]),
    );
    offset += localHeader.length + data.length;
  });

  const central = Buffer.concat(centralParts);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(Object.keys(files).length),
    u16(Object.keys(files).length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);

  return Buffer.concat([...localParts, central, end]);
}

const worksheet = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>Код</t></is></c>
      <c r="B1" t="inlineStr"><is><t>Наименование</t></is></c>
      <c r="C1" t="inlineStr"><is><t>Цена</t></is></c>
      <c r="D1" t="inlineStr"><is><t>Группа</t></is></c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr"><is><t>TEST-1</t></is></c>
      <c r="B2" t="inlineStr"><is><t>Фильтр масляный</t></is></c>
      <c r="C2"><v>1250</v></c>
      <c r="D2" t="inlineStr"><is><t>Фильтры</t></is></c>
    </row>
  </sheetData>
</worksheet>`;

const workbook = createStoredZip({
  "xl/worksheets/sheet1.xml": worksheet,
});

const products = parseImportFile({
  fileName: "price.xlsx",
  contentBase64: workbook.toString("base64"),
});

if (products.length !== 1) throw new Error(`Expected 1 product, got ${products.length}`);
if (products[0].code !== "TEST-1") throw new Error("Product code was not parsed");
if (products[0].name !== "Фильтр масляный") throw new Error("Product name was not parsed");
if (Number(products[0].price) !== 1250) throw new Error("Product price was not parsed");

console.log("Import parser: ok");
