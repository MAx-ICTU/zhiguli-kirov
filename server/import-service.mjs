import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inferCategory } from "../tools/build-products.mjs";
import { loadProducts } from "./catalog-store.mjs";
import { parseXlsxRows } from "./xlsx-parser.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const productsPath = path.join(rootDir, "src", "products.js");
const dataDir = path.join(rootDir, "server", "data");
const pendingImportsPath = path.join(dataDir, "pending-imports.json");
const importHistoryPath = path.join(dataDir, "import-history.json");

function ensureDataFiles() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(pendingImportsPath)) {
    fs.writeFileSync(pendingImportsPath, "{}\n", "utf8");
  }
  if (!fs.existsSync(importHistoryPath)) {
    fs.writeFileSync(importHistoryPath, "[]\n", "utf8");
  }
}

function readJson(filePath, fallback) {
  ensureDataFiles();
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDataFiles();
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parsePrice(value) {
  if (typeof value === "number") return Math.max(0, Math.round(value));
  const clean = String(value || "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  return Math.max(0, Math.round(Number(clean) || 0));
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replaceAll("ё", "е").trim();
}

function normalizeHeader(value) {
  return normalizeText(value).replace(/[^a-zа-я0-9]/g, "");
}

function mapHeader(header) {
  const aliases = {
    code: ["код", "артикул", "номенклатурныйномер", "sku", "id"],
    name: ["название", "наименование", "товар", "номенклатура", "name"],
    unit: ["ед", "единица", "единицаизмерения", "unit"],
    price: ["цена", "розница", "прайс", "price"],
    sourceCategory: ["группа", "раздел", "категорияисточника", "sourcecategory"],
    category: ["категориясайта", "категория", "category"],
  };
  const normalized = normalizeHeader(header);
  return Object.keys(aliases).find((field) => aliases[field].includes(normalized)) || "";
}

function splitTextRows(text, delimiter) {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, "")))
    .filter((row) => row.some(Boolean));
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find(Boolean) || "";
  if (firstLine.includes("\t")) return "\t";
  if (firstLine.includes(";")) return ";";
  return ",";
}

function parseHtmlTable(text) {
  const rowMatches = [...text.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  return rowMatches
    .map((rowMatch) =>
      [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) =>
        String(cellMatch[1] || "").replace(/<[^>]+>/g, "").trim(),
      ),
    )
    .filter((row) => row.some(Boolean));
}

function rowsToProducts(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(mapHeader);
  return rows.slice(1).map((row) =>
    headers.reduce((product, field, index) => {
      if (field) product[field] = row[index] || "";
      return product;
    }, {}),
  );
}

export function parseImportFile({ fileName = "", contentBase64 = "" }) {
  const buffer = Buffer.from(contentBase64, "base64");
  const name = String(fileName || "").toLowerCase();

  if (!buffer.length) throw new Error("Файл пустой.");

  if (name.endsWith(".xlsx")) {
    return rowsToProducts(parseXlsxRows(buffer));
  }

  if (name.endsWith(".xls") && buffer.subarray(0, 8).toString("hex") === "d0cf11e0a1b11ae1") {
    throw new Error("Бинарный .xls пока не поддержан. Сохраните прайс как .xlsx и загрузите повторно.");
  }

  const text = buffer.toString("utf8").trim();
  if (!text) throw new Error("Файл пустой.");
  if (text.startsWith("[") || text.startsWith("{")) {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : parsed.products || [];
  }

  const rows = /<table/i.test(text) ? parseHtmlTable(text) : splitTextRows(text, detectDelimiter(text));
  return rowsToProducts(rows);
}

export function normalizeImportProducts(rawProducts) {
  return normalizeImportProductsWithStats(rawProducts).products;
}

function normalizeImportProductsWithStats(rawProducts) {
  if (!Array.isArray(rawProducts)) {
    return { products: [], stats: { rows: 0, skipped: 0, duplicates: 0, missingCode: 0, missingName: 0 } };
  }

  const seen = new Set();
  const stats = {
    rows: rawProducts.length,
    skipped: 0,
    duplicates: 0,
    missingCode: 0,
    missingName: 0,
  };
  const products = [];

  rawProducts.forEach((product) => {
      const normalized = {
        code: String(product.code || "").trim(),
        name: String(product.name || "").trim(),
        unit: String(product.unit || "шт").trim() || "шт",
        price: parsePrice(product.price),
        sourceCategory: String(product.sourceCategory || product.category || "").trim(),
        category: String(product.category || "").trim(),
      };
      normalized.category = normalized.category || inferCategory(normalized);
      if (!normalized.code) stats.missingCode += 1;
      if (!normalized.name) stats.missingName += 1;
      if (seen.has(normalized.code)) stats.duplicates += 1;
      if (!normalized.code || !normalized.name || seen.has(normalized.code)) {
        stats.skipped += 1;
        return;
      }
      seen.add(normalized.code);
      products.push(normalized);
  });

  return { products, stats };
}

function changeSamples(items) {
  return items.slice(0, 20);
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function qualityCheck(id, title, severity, detail) {
  return { id, title, severity, detail };
}

function analyzeImportQuality(currentProducts, nextProducts, summary, stats) {
  const checks = [];
  const currentTotal = currentProducts.length;
  const removedPercent = percent(summary.removed, currentTotal);
  const skippedPercent = percent(stats.skipped, stats.rows);
  const noPriceCount = nextProducts.filter((product) => !product.price).length;
  const noPricePercent = percent(noPriceCount, nextProducts.length);

  if (summary.total < 1000) {
    checks.push(
      qualityCheck(
        "too_few_products",
        "Слишком мало товаров",
        "block",
        `В файле найдено ${summary.total.toLocaleString("ru-RU")} товаров. Для рабочего прайса это похоже на неполную выгрузку.`,
      ),
    );
  }

  if (currentTotal && summary.total < Math.round(currentTotal * 0.5)) {
    checks.push(
      qualityCheck(
        "catalog_shrank",
        "Каталог резко уменьшился",
        "block",
        `Новый файл меньше текущего каталога больше чем в два раза: ${summary.total.toLocaleString("ru-RU")} против ${currentTotal.toLocaleString("ru-RU")}.`,
      ),
    );
  }

  if (removedPercent >= 40) {
    checks.push(
      qualityCheck(
        "many_removed",
        "Много исчезнувших товаров",
        "block",
        `Из нового прайса исчезло ${removedPercent}% текущего каталога. Проверьте, что загружен полный файл.`,
      ),
    );
  } else if (removedPercent >= 15) {
    checks.push(
      qualityCheck(
        "many_removed",
        "Заметно много исчезнувших товаров",
        "warn",
        `Из нового прайса исчезло ${removedPercent}% текущего каталога. Перед публикацией лучше проверить причину.`,
      ),
    );
  }

  if (skippedPercent >= 5) {
    checks.push(
      qualityCheck(
        "many_skipped",
        "Много строк пропущено",
        "block",
        `Пропущено ${skippedPercent}% строк из-за пустого кода, названия или дублей.`,
      ),
    );
  } else if (stats.skipped > 0) {
    checks.push(
      qualityCheck(
        "some_skipped",
        "Есть пропущенные строки",
        "warn",
        `Пропущено строк: ${stats.skipped}. Без кода или названия товар нельзя связать с каталогом.`,
      ),
    );
  }

  if (noPricePercent >= 80) {
    checks.push(
      qualityCheck(
        "many_empty_prices",
        "Почти все цены пустые",
        "warn",
        `У ${noPricePercent}% товаров цена будет показана как «цену уточнить».`,
      ),
    );
  }

  if (!checks.length) {
    checks.push(
      qualityCheck(
        "ok",
        "Прайс выглядит нормально",
        "ok",
        "Критичных проблем не найдено. Каталог можно публиковать после ручной проверки изменений.",
      ),
    );
  }

  return {
    canApply: !checks.some((check) => check.severity === "block"),
    level: checks.some((check) => check.severity === "block")
      ? "block"
      : checks.some((check) => check.severity === "warn")
        ? "warn"
        : "ok",
    stats: {
      rows: stats.rows,
      skipped: stats.skipped,
      duplicates: stats.duplicates,
      missingCode: stats.missingCode,
      missingName: stats.missingName,
      noPrice: noPriceCount,
    },
    checks,
  };
}

export function createImportPreview(payload) {
  const rawProducts = payload.file ? parseImportFile(payload.file) : payload.products;
  const { products: nextProducts, stats } = normalizeImportProductsWithStats(rawProducts);
  if (!nextProducts.length) {
    throw new Error("В файле не найдены товары с кодом и названием.");
  }

  const currentProducts = loadProducts();
  const currentByCode = new Map(currentProducts.map((product) => [product.code, product]));
  const nextByCode = new Map(nextProducts.map((product) => [product.code, product]));

  const added = nextProducts.filter((product) => !currentByCode.has(product.code));
  const removed = currentProducts.filter((product) => !nextByCode.has(product.code));
  const changed = nextProducts
    .map((product) => {
      const current = currentByCode.get(product.code);
      if (!current) return null;

      const changes = {};
      ["name", "unit", "price", "sourceCategory", "category"].forEach((field) => {
        if (String(current[field] || "") !== String(product[field] || "")) {
          changes[field] = { before: current[field] || "", after: product[field] || "" };
        }
      });

      return Object.keys(changes).length ? { code: product.code, name: product.name, changes } : null;
    })
    .filter(Boolean);

  const summary = {
    total: nextProducts.length,
    added: added.length,
    removed: removed.length,
    changed: changed.length,
    unchanged: nextProducts.length - added.length - changed.length,
  };
  const quality = analyzeImportQuality(currentProducts, nextProducts, summary, stats);

  const preview = {
    id: `IMP-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`,
    sourceName: String(payload.sourceName || "price").trim(),
    createdAt: new Date().toISOString(),
    products: nextProducts,
    summary,
    quality,
    samples: {
      added: changeSamples(added),
      removed: changeSamples(removed),
      changed: changeSamples(changed),
    },
  };

  const pendingImports = readJson(pendingImportsPath, {});
  pendingImports[preview.id] = preview;
  writeJson(pendingImportsPath, pendingImports);
  return preview;
}

export function applyImport(importId) {
  const pendingImports = readJson(pendingImportsPath, {});
  const preview = pendingImports[importId];
  if (!preview) return null;
  if (preview.quality && !preview.quality.canApply) {
    throw new Error("Публикация заблокирована проверкой качества прайса.");
  }

  fs.writeFileSync(
    productsPath,
    `window.ZHIGULI_PRODUCTS = ${JSON.stringify(preview.products, null, 2)};\n`,
    "utf8",
  );

  delete pendingImports[importId];
  writeJson(pendingImportsPath, pendingImports);

  const history = readJson(importHistoryPath, []);
  const record = {
    id: preview.id,
    sourceName: preview.sourceName,
    appliedAt: new Date().toISOString(),
    summary: preview.summary,
  };
  history.unshift(record);
  writeJson(importHistoryPath, history.slice(0, 50));

  return record;
}

export function loadImportHistory() {
  return readJson(importHistoryPath, []);
}
