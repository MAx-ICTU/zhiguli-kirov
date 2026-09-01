import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inferCategory } from "../tools/build-products.mjs";
import { loadProducts } from "./catalog-store.mjs";

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

export function normalizeImportProducts(rawProducts) {
  if (!Array.isArray(rawProducts)) return [];

  const seen = new Set();
  return rawProducts
    .map((product) => {
      const normalized = {
        code: String(product.code || "").trim(),
        name: String(product.name || "").trim(),
        unit: String(product.unit || "шт").trim() || "шт",
        price: parsePrice(product.price),
        sourceCategory: String(product.sourceCategory || product.category || "").trim(),
        category: String(product.category || "").trim(),
      };
      normalized.category = normalized.category || inferCategory(normalized);
      return normalized;
    })
    .filter((product) => {
      if (!product.code || !product.name || seen.has(product.code)) return false;
      seen.add(product.code);
      return true;
    });
}

function changeSamples(items) {
  return items.slice(0, 20);
}

export function createImportPreview(payload) {
  const nextProducts = normalizeImportProducts(payload.products);
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

  const preview = {
    id: `IMP-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`,
    sourceName: String(payload.sourceName || "price").trim(),
    createdAt: new Date().toISOString(),
    products: nextProducts,
    summary: {
      total: nextProducts.length,
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      unchanged: nextProducts.length - added.length - changed.length,
    },
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
