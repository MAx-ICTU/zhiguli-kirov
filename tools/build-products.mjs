import fs from "node:fs";
import path from "node:path";

const inputPath = path.resolve("work/products.raw.json");
const outputPath = path.resolve("src/products.js");
const rawProducts = JSON.parse(fs.readFileSync(inputPath, "utf8"));

function inferCategory(product) {
  const text = `${product.name} ${product.sourceCategory}`.toLowerCase();

  if (/масл|антифриз|тосол|жидк|лукойл|shell|gazprom|g-energy/.test(text)) return "Масла и жидкости";
  if (/очист|смазк|гермет|антигель|разморажив|полир|автохим|3ton|лавр/.test(text)) return "Автохимия";
  if (/ключ|съемник|инструмент|домкрат|головк|отвертк/.test(text)) return "Инструменты";
  if (/стекл|зеркал/.test(text)) return "Стекла";
  if (/кузов|крыл|капот|двер|бампер|решетк|железо|накладк/.test(text)) return "Кузов";
  if (/колодк|тормоз|диск торм|цилиндр/.test(text)) return "Тормоза";
  if (/шаров|стойк|рычаг|амортиз|сайлент|стабилиз|пружин|подвес/.test(text)) return "Подвеска";
  if (/рулев|наконечник|тяга|рейк/.test(text)) return "Рулевое";
  if (/генератор|стартер|свеч|провод|ламп|датчик|электр|аккум|реле/.test(text)) return "Электрика";
  if (/фильтр|карбюратор|радиатор|помп|двигател|клапан|порш|грм|ремень/.test(text)) return "Двигатель";
  if (/антенн|аптечк|коврик|чехол|наклейк|аксесс/.test(text)) return "Аксессуары";

  return "Прочее";
}

const products = rawProducts.map((product) => ({
  ...product,
  category: inferCategory(product),
}));

fs.writeFileSync(
  outputPath,
  `window.ZHIGULI_PRODUCTS = ${JSON.stringify(products, null, 2)};\n`,
  "utf8",
);

console.log(`Saved ${products.length} products to ${outputPath}`);
