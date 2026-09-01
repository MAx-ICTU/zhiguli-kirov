import zlib from "node:zlib";

function readUInt16(buffer, offset) {
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function decodeXml(value) {
  return String(value || "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function stripTags(value) {
  return decodeXml(String(value || "").replace(/<[^>]+>/g, ""));
}

function columnIndex(cellRef) {
  const letters = String(cellRef || "").match(/^[A-Z]+/i)?.[0] || "";
  return [...letters.toUpperCase()].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function findEndOfCentralDirectory(buffer) {
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65558); index -= 1) {
    if (readUInt32(buffer, index) === 0x06054b50) return index;
  }
  throw new Error("Не удалось прочитать структуру .xlsx файла.");
}

function unzipEntries(buffer) {
  const eocd = findEndOfCentralDirectory(buffer);
  const totalEntries = readUInt16(buffer, eocd + 10);
  let offset = readUInt32(buffer, eocd + 16);
  const entries = new Map();

  for (let index = 0; index < totalEntries; index += 1) {
    if (readUInt32(buffer, offset) !== 0x02014b50) {
      throw new Error("Повреждена таблица файлов внутри .xlsx.");
    }

    const method = readUInt16(buffer, offset + 10);
    const compressedSize = readUInt32(buffer, offset + 20);
    const fileNameLength = readUInt16(buffer, offset + 28);
    const extraLength = readUInt16(buffer, offset + 30);
    const commentLength = readUInt16(buffer, offset + 32);
    const localHeaderOffset = readUInt32(buffer, offset + 42);
    const fileName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    const localNameLength = readUInt16(buffer, localHeaderOffset + 26);
    const localExtraLength = readUInt16(buffer, localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    const data = method === 0 ? compressed : method === 8 ? zlib.inflateRawSync(compressed) : null;
    if (data) entries.set(fileName, data.toString("utf8"));

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
    stripTags([...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((textMatch) => textMatch[1]).join("")),
  );
}

function parseSheetRows(xml, sharedStrings) {
  return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)]
    .map((rowMatch) => {
      const row = [];
      [...rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].forEach((cellMatch) => {
        const attrs = cellMatch[1];
        const body = cellMatch[2];
        const ref = attrs.match(/\br="([^"]+)"/)?.[1] || "";
        const type = attrs.match(/\bt="([^"]+)"/)?.[1] || "";
        const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] || "";
        const inline = body.match(/<is\b[^>]*>([\s\S]*?)<\/is>/)?.[1] || "";
        const index = Math.max(0, columnIndex(ref));

        if (type === "s") {
          row[index] = sharedStrings[Number(value)] || "";
        } else if (type === "inlineStr") {
          row[index] = stripTags(inline);
        } else {
          row[index] = decodeXml(value);
        }
      });
      return row.map((cell) => String(cell || "").trim());
    })
    .filter((row) => row.some(Boolean));
}

export function parseXlsxRows(buffer) {
  const entries = unzipEntries(buffer);
  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml"));
  const worksheetName =
    [...entries.keys()].find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)) || "";
  const worksheet = entries.get(worksheetName);

  if (!worksheet) {
    throw new Error("В .xlsx файле не найден лист с товарами.");
  }

  return parseSheetRows(worksheet, sharedStrings);
}
