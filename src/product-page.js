(function () {
  const products = Array.isArray(window.ZHIGULI_PRODUCTS) ? window.ZHIGULI_PRODUCTS : [];
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code") || params.get("product") || "";
  const product = products.find((item) => item.code === code);
  const page = document.getElementById("productPage");
  const crumb = document.getElementById("productCrumb");
  const requestCount = document.getElementById("productRequestCount");
  const requestStorageKey = "zhiguli-request-list";
  let requestItems = JSON.parse(localStorage.getItem(requestStorageKey) || "[]");

  function normalize(value) {
    return String(value || "").toLowerCase().replaceAll("ё", "е").trim();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatPrice(price) {
    return price ? `${Number(price).toLocaleString("ru-RU")} ₽` : "цену уточнить";
  }

  function getCategoryVisual(productItem) {
    const visuals = {
      Двигатель: { code: "ДВ", icon: "icon-engine", label: "Двигатель и навесное" },
      Подвеска: { code: "ХД", icon: "icon-suspension", label: "Ходовая часть" },
      Тормоза: { code: "ТМ", icon: "icon-brake", label: "Тормозная система" },
      Электрика: { code: "ЭЛ", icon: "icon-electric", label: "Электрика" },
      Кузов: { code: "КЗ", icon: "icon-body", label: "Кузовные детали" },
      "Масла и жидкости": { code: "МЖ", icon: "icon-oil", label: "Масла и жидкости" },
      Автохимия: { code: "АХ", icon: "icon-chemistry", label: "Автохимия" },
      Инструменты: { code: "ИН", icon: "icon-tools", label: "Инструменты" },
    };
    return visuals[productItem.category] || { code: "ВАЗ", icon: "icon-parts", label: "Автозапчасть" };
  }

  function renderCategoryIcon(productItem) {
    const visual = getCategoryVisual(productItem);
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <use href="assets/category-icons.svg#${escapeHtml(visual.icon)}"></use>
      </svg>
    `;
  }

  function getDetectedModels(productItem) {
    const text = normalize(`${productItem.name} ${productItem.sourceCategory || ""}`);
    const detected = [];
    [
      ["2101-2107", ["2101", "2103", "2105", "2106", "2107"]],
      ["2108-2115", ["2108", "2109", "21099", "2113", "2114", "2115"]],
      ["Нива", ["2121", "21213", "21214", "нива"]],
      ["Калина", ["1118", "1119", "калина"]],
      ["Приора", ["2170", "2171", "2172", "приора"]],
      ["Гранта", ["2190", "2191", "гранта"]],
      ["Vesta", ["vesta", "веста"]],
      ["Largus", ["largus", "ларгус"]],
      ["XRAY", ["xray", "x-ray", "иксрей"]],
    ].forEach(([label, terms]) => {
      if (terms.some((term) => text.includes(normalize(term)))) detected.push(label);
    });
    return detected;
  }

  function getProductHint(productItem) {
    const hints = {
      Двигатель: "Проверьте модель двигателя, год выпуска и старый артикул.",
      Подвеска: "Сверьте сторону установки, кузов и год выпуска автомобиля.",
      Тормоза: "Проверьте диаметр диска, тип суппорта и ось установки.",
      Электрика: "Сверьте разъем, напряжение и маркировку старой детали.",
      Кузов: "Уточните сторону, цвет, кузов и наличие крепежа.",
      "Масла и жидкости": "Проверьте допуск, вязкость и нужный объем.",
      Автохимия: "Уточните назначение, объем и совместимость с материалом.",
      Инструменты: "Сверьте размер, посадку и назначение инструмента.",
    };
    return hints[productItem.category] || "Назовите код товара менеджеру, чтобы быстрее проверить наличие.";
  }

  function saveRequestItems() {
    localStorage.setItem(requestStorageKey, JSON.stringify(requestItems));
  }

  function updateRequestCount() {
    const count = requestItems.reduce((total, item) => total + item.qty, 0);
    requestCount.textContent = count.toLocaleString("ru-RU");
  }

  function addToRequest(productItem) {
    const existing = requestItems.find((item) => item.code === productItem.code);
    if (existing) {
      existing.qty += 1;
    } else {
      requestItems.push({
        code: productItem.code,
        name: productItem.name,
        price: productItem.price,
        unit: productItem.unit || "шт",
        category: productItem.category,
        qty: 1,
      });
    }
    saveRequestItems();
    updateRequestCount();
  }

  function getSimilarProducts(productItem) {
    return products
      .filter((item) => item.code !== productItem.code && item.category === productItem.category)
      .slice(0, 4);
  }

  function renderProduct(productItem) {
    const visual = getCategoryVisual(productItem);
    const models = getDetectedModels(productItem);
    const similar = getSimilarProducts(productItem);
    const modelText = models.length ? models.join(", ") : "модель не определена по названию";
    crumb.textContent = productItem.code;
    document.title = `${productItem.name} - Жигули`;

    page.innerHTML = `
      <article class="product-page-card">
        <div class="product-page-visual">
          ${renderCategoryIcon(productItem)}
          <span>${escapeHtml(visual.code)}</span>
          <small>${escapeHtml(visual.label)}</small>
        </div>
        <div class="product-page-info">
          <p class="eyebrow">${escapeHtml(productItem.category)}</p>
          <h1>${escapeHtml(productItem.name)}</h1>
          <div class="product-page-price">
            <span>${formatPrice(productItem.price)}</span>
            <small>${productItem.price ? "Цена из прайса. Перед поездкой уточните наличие." : "Цена не указана в прайсе. Уточните у менеджера."}</small>
          </div>
          <div class="product-page-actions">
            <button class="primary-btn" id="productAddRequest" type="button">Добавить в запрос</button>
            <a class="secondary-btn" href="tel:+78332620888">Позвонить</a>
            <a class="secondary-btn" href="catalog.html">Назад в каталог</a>
          </div>
          <p class="form-note" id="productPageStatus"></p>
        </div>
      </article>

      <section class="product-page-details" aria-label="Информация о товаре">
        <dl class="product-details">
          <div>
            <dt>Код</dt>
            <dd>${escapeHtml(productItem.code)}</dd>
          </div>
          <div>
            <dt>Раздел</dt>
            <dd>${escapeHtml(productItem.category)}</dd>
          </div>
          <div>
            <dt>Исходная группа</dt>
            <dd>${escapeHtml(productItem.sourceCategory || "Без группы")}</dd>
          </div>
          <div>
            <dt>Единица</dt>
            <dd>${escapeHtml(productItem.unit || "шт")}</dd>
          </div>
        </dl>
        <div class="product-fitment">
          <div class="fitment-block">
            <strong>Применяемость</strong>
            <p>${escapeHtml(modelText)}. Сверьте по коду товара или старому артикулу перед покупкой.</p>
          </div>
          <div class="fitment-block">
            <strong>Что проверить</strong>
            <p>${escapeHtml(getProductHint(productItem))}</p>
          </div>
        </div>
      </section>

      <section class="product-store-panel" aria-label="Как уточнить наличие">
        <img src="assets/store-front-winter.webp" alt="Фасад магазина Жигули в Кирове" />
        <div>
          <p class="eyebrow">Перед поездкой</p>
          <h2>Уточните наличие по коду ${escapeHtml(productItem.code)}</h2>
          <p>
            Назовите код товара менеджеру. Так проще проверить актуальную цену,
            остаток и удобный магазин для самовывоза.
          </p>
          <div class="store-actions">
            <a href="tel:+78332620888">Позвонить</a>
            <a href="index.html#stores">Адреса магазинов</a>
          </div>
        </div>
      </section>

      <section class="section-shell product-related">
        <div class="section-heading">
          <div>
            <p class="eyebrow">В том же разделе</p>
            <h2>Похожие позиции</h2>
          </div>
          <p>Откройте соседние товары или вернитесь к поиску по каталогу.</p>
        </div>
        <div class="catalog-page-grid">
          ${similar
            .map(
              (item) => `
                <article class="catalog-page-card">
                  <a class="catalog-card-visual" href="product.html?code=${encodeURIComponent(item.code)}">
                    ${renderCategoryIcon(item)}
                    <span>${escapeHtml(getCategoryVisual(item).code)}</span>
                    <small>${escapeHtml(item.category)}</small>
                  </a>
                  <div class="catalog-card-body">
                    <span class="product-code">Код ${escapeHtml(item.code)}</span>
                    <h2><a href="product.html?code=${encodeURIComponent(item.code)}">${escapeHtml(item.name)}</a></h2>
                    <p>${escapeHtml(item.sourceCategory || "Без группы")}</p>
                    <div class="catalog-card-bottom">
                      <strong>${formatPrice(item.price)}</strong>
                      <a class="details-btn" href="product.html?code=${encodeURIComponent(item.code)}">Открыть</a>
                    </div>
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>
    `;

    document.getElementById("productAddRequest").addEventListener("click", () => {
      addToRequest(productItem);
      document.getElementById("productPageStatus").textContent =
        "Товар добавлен в запрос. Можно открыть запрос на главной странице или позвонить в магазин.";
    });
  }

  if (product) {
    renderProduct(product);
  }
  updateRequestCount();
})();
