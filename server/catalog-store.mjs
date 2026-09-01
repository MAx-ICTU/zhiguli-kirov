import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const productsPath = path.join(rootDir, "src", "products.js");
const dataDir = path.join(rootDir, "server", "data");
const overridesPath = path.join(dataDir, "catalog-overrides.json");
const requestsPath = path.join(dataDir, "requests.json");

function ensureDataFiles() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(overridesPath)) {
    fs.writeFileSync(overridesPath, "{}\n", "utf8");
  }
  if (!fs.existsSync(requestsPath)) {
    fs.writeFileSync(requestsPath, "[]\n", "utf8");
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

function loadBaseProducts() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(productsPath, "utf8"), context, { filename: productsPath });
  return Array.isArray(context.window.ZHIGULI_PRODUCTS) ? context.window.ZHIGULI_PRODUCTS : [];
}

export function loadOverrides() {
  return readJson(overridesPath, {});
}

export function loadProducts() {
  const overrides = loadOverrides();
  return loadBaseProducts().map((product) => ({
    published: true,
    ...product,
    ...(overrides[product.code] || {}),
  }));
}

export function saveProductOverride(code, patch) {
  const products = loadBaseProducts();
  const product = products.find((item) => item.code === code);
  if (!product) return null;

  const allowed = ["name", "category", "price", "published", "photoName"];
  const cleanPatch = Object.fromEntries(
    Object.entries(patch).filter(([key]) => allowed.includes(key)),
  );

  if (Object.hasOwn(cleanPatch, "price")) {
    cleanPatch.price = Math.max(0, Number(cleanPatch.price || 0));
  }
  if (Object.hasOwn(cleanPatch, "published")) {
    cleanPatch.published = cleanPatch.published !== false;
  }

  const overrides = loadOverrides();
  overrides[code] = { ...(overrides[code] || {}), ...cleanPatch, updatedAt: new Date().toISOString() };
  writeJson(overridesPath, overrides);
  return { published: true, ...product, ...overrides[code] };
}

export function loadRequests() {
  return readJson(requestsPath, []);
}

export function updateRequestStatus(id, status) {
  const allowedStatuses = ["new", "in_progress", "done"];
  if (!allowedStatuses.includes(status)) return null;

  const requests = loadRequests();
  const request = requests.find((item) => item.id === id);
  if (!request) return null;

  request.status = status;
  request.updatedAt = new Date().toISOString();
  writeJson(requestsPath, requests);
  return request;
}

export function addRequest(payload) {
  const requests = loadRequests();
  const request = {
    id: `REQ-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${String(requests.length + 1).padStart(4, "0")}`,
    status: "new",
    createdAt: new Date().toISOString(),
    customer: {
      name: String(payload.customer?.name || "").trim(),
      phone: String(payload.customer?.phone || "").trim(),
      email: String(payload.customer?.email || "").trim(),
    },
    comment: String(payload.comment || "").trim(),
    items: Array.isArray(payload.items)
      ? payload.items.map((item) => ({
          code: String(item.code || "").trim(),
          name: String(item.name || "").trim(),
          qty: Math.max(1, Number(item.qty || 1)),
          price: Math.max(0, Number(item.price || 0)),
        }))
      : [],
  };

  requests.unshift(request);
  writeJson(requestsPath, requests);
  return request;
}
