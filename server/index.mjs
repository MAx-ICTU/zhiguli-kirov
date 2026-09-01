import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addRequest, loadProducts, loadRequests, saveProductOverride } from "./catalog-store.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4173);
const adminToken = process.env.ADMIN_TOKEN || "";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Payload too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function isAuthorized(request) {
  if (!adminToken) return true;
  return request.headers.authorization === `Bearer ${adminToken}`;
}

function normalize(value) {
  return String(value || "").toLowerCase().replaceAll("ё", "е").trim();
}

function filterProducts(searchParams) {
  const query = normalize(searchParams.get("query"));
  const category = searchParams.get("category") || "";
  const status = searchParams.get("status") || "";
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") || 80)));
  const offset = Math.max(0, Number(searchParams.get("offset") || 0));

  const products = loadProducts().filter((product) => {
    const matchesQuery =
      !query ||
      normalize(product.name).includes(query) ||
      normalize(product.code).includes(query) ||
      normalize(product.sourceCategory).includes(query);
    const matchesCategory = !category || product.category === category;
    const matchesStatus =
      !status ||
      (status === "published" && product.published !== false) ||
      (status === "hidden" && product.published === false);

    return matchesQuery && matchesCategory && matchesStatus;
  });

  return {
    total: products.length,
    items: products.slice(offset, offset + limit),
  };
}

function getSummary() {
  const products = loadProducts();
  const categories = [...new Set(products.map((product) => product.category))].sort((a, b) =>
    a.localeCompare(b, "ru"),
  );
  return {
    products: products.length,
    categories,
    requestPrice: products.filter((product) => !product.price).length,
    hidden: products.filter((product) => product.published === false).length,
  };
}

async function handleApi(request, response, url) {
  if (url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, service: "zhiguli-admin-api" });
    return true;
  }

  if (url.pathname === "/api/catalog/summary") {
    sendJson(response, 200, getSummary());
    return true;
  }

  if (url.pathname === "/api/products" && request.method === "GET") {
    sendJson(response, 200, filterProducts(url.searchParams));
    return true;
  }

  const productMatch = url.pathname.match(/^\/api\/products\/([^/]+)$/);
  if (productMatch && request.method === "GET") {
    const code = decodeURIComponent(productMatch[1]);
    const product = loadProducts().find((item) => item.code === code);
    sendJson(response, product ? 200 : 404, product || { error: "Product not found" });
    return true;
  }

  if (productMatch && request.method === "PATCH") {
    if (!isAuthorized(request)) {
      sendJson(response, 401, { error: "Authorization required" });
      return true;
    }
    const code = decodeURIComponent(productMatch[1]);
    const product = saveProductOverride(code, await readBody(request));
    sendJson(response, product ? 200 : 404, product || { error: "Product not found" });
    return true;
  }

  if (url.pathname === "/api/requests" && request.method === "POST") {
    const requestRecord = addRequest(await readBody(request));
    sendJson(response, 201, requestRecord);
    return true;
  }

  if (url.pathname === "/api/requests" && request.method === "GET") {
    if (!isAuthorized(request)) {
      sendJson(response, 401, { error: "Authorization required" });
      return true;
    }
    sendJson(response, 200, { items: loadRequests() });
    return true;
  }

  if (url.pathname === "/api/sync/status") {
    sendJson(response, 200, {
      source: "price.xls",
      externalSync: "planned",
      oneCReady: true,
      message: "Каталог сохраняет исходные коды товаров для будущей синхронизации.",
    });
    return true;
  }

  return false;
}

function serveStatic(request, response, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(rootDir, requestedPath));

  if (!filePath.startsWith(rootDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  try {
    if (url.pathname.startsWith("/api/") && (await handleApi(request, response, url))) {
      return;
    }
    serveStatic(request, response, url);
  } catch (error) {
    sendJson(response, 400, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Admin backend: http://localhost:${port}`);
});
