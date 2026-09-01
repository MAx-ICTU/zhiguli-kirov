globalThis.window = {};
await import("./../src/products.js");

const products = globalThis.window?.ZHIGULI_PRODUCTS || [];
const categories = new Set(products.map((product) => product.category));

if (products.length < 9000) {
  throw new Error(`Expected at least 9000 products, got ${products.length}`);
}

if (categories.size < 8) {
  throw new Error(`Expected several storefront categories, got ${categories.size}`);
}

console.log(`Products: ${products.length}`);
console.log(`Categories: ${categories.size}`);
