(function () {
  const state = {
    query: "",
    category: "",
    price: "",
    sort: "relevance",
    visible: 18,
  };

  const products = Array.isArray(window.ZHIGULI_PRODUCTS) ? window.ZHIGULI_PRODUCTS : [];
  const categories = [...new Set(products.map((item) => item.category))].sort((a, b) =>
    a.localeCompare(b, "ru"),
  );

  const productGrid = document.getElementById("productGrid");
  const catalogCount = document.getElementById("catalogCount");
  const categoryFilter = document.getElementById("categoryFilter");
  const catalogSearch = document.getElementById("catalogSearch");
  const heroSearch = document.getElementById("heroSearch");
  const priceFilter = document.getElementById("priceFilter");
  const sortSelect = document.getElementById("sortSelect");
  const catalogSummary = document.getElementById("catalogSummary");
  const resetFilters = document.getElementById("resetFilters");
  const loadMore = document.getElementById("loadMore");
  const productModal = document.getElementById("productModal");
  const modalCategory = document.getElementById("modalCategory");
  const modalTitle = document.getElementById("modalTitle");
  const modalCode = document.getElementById("modalCode");
  const modalSource = document.getElementById("modalSource");
  const modalUnit = document.getElementById("modalUnit");
  const modalPrice = document.getElementById("modalPrice");
  const modalPriceNote = document.getElementById("modalPriceNote");
  const addModalProduct = document.getElementById("addModalProduct");
  const copyProductLink = document.getElementById("copyProductLink");
  const productLinkStatus = document.getElementById("productLinkStatus");
  const requestDetails = document.getElementById("requestDetails");
  const requestCar = document.getElementById("requestCar");
  const requestPhone = document.getElementById("requestPhone");
  const requestNote = document.getElementById("requestNote");
  const requestListToggle = document.getElementById("requestListToggle");
  const requestListCount = document.getElementById("requestListCount");
  const requestCallHint = document.getElementById("requestCallHint");
  const quickRequestToggle = document.getElementById("quickRequestToggle");
  const quickRequestCount = document.getElementById("quickRequestCount");
  const requestDrawer = document.getElementById("requestDrawer");
  const requestDrawerClose = document.getElementById("requestDrawerClose");
  const requestList = document.getElementById("requestList");
  const requestComment = document.getElementById("requestComment");
  const requestEmail = document.getElementById("requestEmail");
  const copyRequest = document.getElementById("copyRequest");
  const clearRequest = document.getElementById("clearRequest");
  const copyStatus = document.getElementById("copyStatus");

  let selectedProduct = null;
  let shouldSyncUrl = true;
  const requestStorageKey = "zhiguli-request-list";
  const modelAliases = {
    "2101": ["2101", "2103", "2105", "2106", "2107"],
    "2103": ["2101", "2103", "2105", "2106", "2107"],
    "2105": ["2101", "2103", "2105", "2106", "2107"],
    "2106": ["2101", "2103", "2105", "2106", "2107"],
    "2107": ["2101", "2103", "2105", "2106", "2107"],
    "2108": ["2108", "2109", "21099", "2113", "2114", "2115"],
    "2109": ["2108", "2109", "21099", "2113", "2114", "2115"],
    "21099": ["2108", "2109", "21099", "2113", "2114", "2115"],
    "2113": ["2108", "2109", "21099", "2113", "2114", "2115"],
    "2114": ["2108", "2109", "21099", "2113", "2114", "2115"],
    "2115": ["2108", "2109", "21099", "2113", "2114", "2115"],
    "2121": ["2121", "21213", "21214"],
    "21213": ["2121", "21213", "21214"],
    "21214": ["2121", "21213", "21214"],
    "1118": ["1118", "1119", "калина"],
    "1119": ["1118", "1119", "калина"],
    "2170": ["2170", "2171", "2172", "приора"],
    "2171": ["2170", "2171", "2172", "приора"],
    "2172": ["2170", "2171", "2172", "приора"],
    "2190": ["2190", "2191", "гранта"],
    "2191": ["2190", "2191", "гранта"],
    калина: ["1118", "1119", "калина"],
    приора: ["2170", "2171", "2172", "приора"],
    гранта: ["2190", "2191", "гранта"],
    нива: ["2121", "21213", "21214", "нива"],
  };
  const categoryIntentTerms = {
    Двигатель: ["двигател", "ремен", "фильтр", "прокладк", "насос"],
    Подвеска: ["стойк", "шаров", "сайлентблок", "амортиз", "рычаг"],
    Тормоза: ["тормоз", "колод", "диск", "цилиндр"],
    Электрика: ["датчик", "реле", "ламп", "стартер", "генератор"],
  };
  const priceLabels = {
    priced: "с указанной ценой",
    request: "цену уточнить",
    under1000: "до 1 000 ₽",
    over5000: "от 5 000 ₽",
  };
  const sortLabels = {
    relevance: "по релевантности",
    priceAsc: "сначала дешевле",
    priceDesc: "сначала дороже",
    nameAsc: "по названию",
  };
  let requestItems = JSON.parse(localStorage.getItem(requestStorageKey) || "[]");

  document.getElementById("statProducts").textContent = products.length.toLocaleString("ru-RU");
  document.getElementById("statCategories").textContent = categories.length.toLocaleString("ru-RU");

  categoryFilter.innerHTML += categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("");

  function normalize(value) {
    return String(value || "").toLowerCase().replaceAll("ё", "е").trim();
  }

  function tokenVariants(token) {
    const variants = [token];
    if (modelAliases[token]) {
      variants.push(...modelAliases[token]);
    }
    const softEndings = ["ние", "ний", "няя", "ые", "ие", "ая", "ый", "ий", "ой"];
    const softEnding = softEndings.find((ending) => token.length > ending.length + 2 && token.endsWith(ending));
    if (softEnding) {
      variants.push(token.slice(0, -softEnding.length));
    }
    if (token.length > 4 && /[аеиоуыэюя]$/.test(token)) {
      variants.push(token.slice(0, -1));
    }
    return [...new Set(variants.filter((variant) => variant.length >= 2))];
  }

  function getQueryParts(value) {
    return normalize(value)
      .split(/[^0-9a-zа-я]+/g)
      .filter(Boolean)
      .map(tokenVariants);
  }

  function getProductSearchText(product) {
    return [
      product.name,
      product.code,
      product.category,
      product.sourceCategory,
      product.unit,
    ]
      .map(normalize)
      .join(" ");
  }

  function queryHasIntent(queryParts, intentTerms) {
    return queryParts.some((variants) =>
      variants.some((variant) => intentTerms.some((term) => variant.includes(term) || term.includes(variant))),
    );
  }

  function renderEmptyState() {
    const hasFilters = Boolean(state.query || state.category || state.price);
    return `
      <article class="empty-results">
        <span>Ничего не найдено</span>
        <h3>Попробуйте другой запрос или оставьте подбор менеджеру</h3>
        <p>
          Лучше работают короткие запросы: модель, код детали или название узла.
          Например: стойка 2114, ремень 2108, шаровая нива.
        </p>
        <div class="empty-actions" aria-label="Подсказки поиска">
          <button type="button" data-empty-query="стойка 2114">Стойка 2114</button>
          <button type="button" data-empty-query="ремень 2108">Ремень 2108</button>
          <button type="button" data-empty-category="Тормоза">Тормоза</button>
          ${hasFilters ? '<button type="button" data-empty-reset>Сбросить фильтры</button>' : ""}
          <a href="#selection">Подбор по автомобилю</a>
        </div>
      </article>
    `;
  }

  function formatPrice(price) {
    if (!price) {
      return `
        <div class="price-block">
          <span class="request-price">цену уточнить</span>
          <small>Добавьте товар в запрос, менеджер проверит наличие и актуальную цену.</small>
        </div>
      `;
    }
    return `
      <div class="price-block">
        <span class="price">${Number(price).toLocaleString("ru-RU")} ₽</span>
        <small>Цена из прайса. Перед поездкой уточните наличие по коду товара.</small>
      </div>
    `;
  }

  function formatPlainPrice(price) {
    if (!price) return "цену уточнить";
    return `${Number(price).toLocaleString("ru-RU")} ₽`;
  }

  function getPriceStatus(product) {
    return product.price > 0 ? "Цена в прайсе" : "Уточнить у менеджера";
  }

  function getPriceNote(product) {
    return product.price > 0
      ? "Цена взята из прайса. Назовите код товара менеджеру, чтобы уточнить наличие."
      : "Цена не указана в прайсе. Добавьте товар в запрос, менеджер проверит цену и наличие.";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getHighlightTerms() {
    return [
      ...new Set(
        getQueryParts(state.query)
          .flat()
          .map(normalize)
          .filter((term) => term.length >= 2),
      ),
    ].sort((a, b) => b.length - a.length);
  }

  function highlightMatches(value) {
    const text = String(value || "");
    const terms = getHighlightTerms();
    if (!terms.length) return escapeHtml(text);

    const normalizedText = normalize(text);
    const ranges = [];
    terms.forEach((term) => {
      let index = normalizedText.indexOf(term);
      while (index !== -1) {
        const end = index + term.length;
        if (!ranges.some((range) => index < range.end && end > range.start)) {
          ranges.push({ start: index, end });
        }
        index = normalizedText.indexOf(term, index + term.length);
      }
    });

    if (!ranges.length) return escapeHtml(text);

    ranges.sort((a, b) => a.start - b.start);
    let cursor = 0;
    let html = "";
    ranges.forEach((range) => {
      html += escapeHtml(text.slice(cursor, range.start));
      html += `<mark>${escapeHtml(text.slice(range.start, range.end))}</mark>`;
      cursor = range.end;
    });
    html += escapeHtml(text.slice(cursor));
    return html;
  }

  function getActiveFilters() {
    const filters = [];
    if (state.query) {
      filters.push({ key: "query", label: `Поиск: ${state.query}` });
    }
    if (state.category) {
      filters.push({ key: "category", label: `Раздел: ${state.category}` });
    }
    if (state.price) {
      filters.push({ key: "price", label: `Цена: ${priceLabels[state.price] || state.price}` });
    }
    if (state.sort !== "relevance") {
      filters.push({ key: "sort", label: `Сортировка: ${sortLabels[state.sort] || state.sort}` });
    }
    return filters;
  }

  function getResultMessage(resultLength) {
    const active = getActiveFilters();
    if (!active.length) {
      return `Показаны все товары каталога: ${resultLength.toLocaleString("ru-RU")}.`;
    }

    const parts = [];
    if (state.query) parts.push(`по запросу «${state.query}»`);
    if (state.category) parts.push(`в разделе «${state.category}»`);
    if (state.price) parts.push(`с фильтром «${priceLabels[state.price] || state.price}»`);

    const prefix = resultLength === 0 ? "Нет товаров" : `Найдено ${resultLength.toLocaleString("ru-RU")}`;
    const detail = parts.length ? ` ${parts.join(", ")}` : " товаров";
    const sortNote = state.sort !== "relevance" ? ` Сортировка: ${sortLabels[state.sort] || state.sort}.` : "";
    return `${prefix}${detail}.${sortNote}`;
  }

  function renderCatalogSummary(resultLength) {
    const active = getActiveFilters();
    catalogSummary.innerHTML = `
      <p>${escapeHtml(getResultMessage(resultLength))}</p>
      ${
        active.length
          ? `<div class="filter-chips" aria-label="Активные фильтры">
              ${active
                .map(
                  (filter) => `
                    <button type="button" data-clear-filter="${escapeHtml(filter.key)}">
                      ${escapeHtml(filter.label)}
                      <span aria-hidden="true">×</span>
                    </button>
                  `,
                )
                .join("")}
            </div>`
          : ""
      }
    `;
  }

  function getProductUrl(product) {
    const url = new URL(window.location.href);
    url.searchParams.set("product", product.code);
    url.hash = "catalog";
    return url.toString();
  }

  function syncUrl() {
    if (!shouldSyncUrl) return;

    const url = new URL(window.location.href);
    const params = url.searchParams;
    const values = {
      q: state.query,
      category: state.category,
      price: state.price,
      sort: state.sort === "relevance" ? "" : state.sort,
    };

    Object.entries(values).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    params.delete("product");

    const next = `${url.pathname}${params.toString() ? `?${params.toString()}` : ""}${url.hash}`;
    window.history.replaceState({}, "", next);
  }

  function applyUrlParams() {
    const params = new URLSearchParams(window.location.search);
    state.query = params.get("q") || "";
    state.category = params.get("category") || "";
    state.price = params.get("price") || "";
    state.sort = params.get("sort") || "relevance";

    catalogSearch.value = state.query;
    heroSearch.value = state.query;
    categoryFilter.value = state.category;
    priceFilter.value = state.price;
    sortSelect.value = state.sort;
  }

  function applyFilters() {
    const query = normalize(state.query);
    const queryParts = getQueryParts(state.query);
    let result = products.filter((product) => {
      const searchText = getProductSearchText(product);
      const matchesQuery =
        !query ||
        queryParts.every((variants) => variants.some((variant) => searchText.includes(variant)));
      const matchesCategory = !state.category || product.category === state.category;
      const matchesPrice =
        !state.price ||
        (state.price === "priced" && product.price > 0) ||
        (state.price === "request" && !product.price) ||
        (state.price === "under1000" && product.price > 0 && product.price < 1000) ||
        (state.price === "over5000" && product.price >= 5000);

      return matchesQuery && matchesCategory && matchesPrice;
    });

    if (state.sort === "relevance" && query) {
      result = result.sort((a, b) => relevanceScore(b, query, queryParts) - relevanceScore(a, query, queryParts));
    }
    if (state.sort === "priceAsc") {
      result = result.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
    }
    if (state.sort === "priceDesc") {
      result = result.sort((a, b) => (b.price || 0) - (a.price || 0));
    }
    if (state.sort === "nameAsc") {
      result = result.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    }

    return result;
  }

  function relevanceScore(product, query, queryParts) {
    const name = normalize(product.name);
    const code = normalize(product.code);
    const sourceCategory = normalize(product.sourceCategory);
    const category = normalize(product.category);
    let score = 0;

    if (code === query) score += 120;
    if (name === query) score += 100;
    if (name.startsWith(query)) score += 80;
    if (name.includes(query)) score += 60;
    if (sourceCategory.includes(query)) score += 25;
    if (category.includes(query)) score += 15;
    queryParts.forEach((variants) => {
      const token = variants[0];
      if (code === token) score += 70;
      if (code.includes(token)) score += 42;
      if (variants.some((variant) => name.startsWith(variant))) score += 26;
      if (variants.some((variant) => name.includes(variant))) score += 20;
      if (variants.some((variant) => sourceCategory.includes(variant))) score += 9;
      if (variants.some((variant) => category.includes(variant))) score += 8;
    });
    if (categoryIntentTerms[product.category] && queryHasIntent(queryParts, categoryIntentTerms[product.category])) {
      score += 18;
    }
    if (product.price > 0) score += 3;

    return score;
  }

  function render() {
    const result = applyFilters();
    const visibleItems = result.slice(0, state.visible);
    catalogCount.textContent = `Найдено: ${result.length.toLocaleString("ru-RU")}`;
    renderCatalogSummary(result.length);
    loadMore.hidden = result.length <= state.visible;

    productGrid.innerHTML =
      visibleItems
        .map(
          (product) => `
            <article class="product-card" data-code="${escapeHtml(product.code)}">
              <div class="product-top">
                <span class="product-code">Код ${highlightMatches(product.code)}</span>
                <span class="product-status ${product.price > 0 ? "is-priced" : "is-request"}">
                  ${escapeHtml(getPriceStatus(product))}
                </span>
              </div>
              <h3>${highlightMatches(product.name)}</h3>
              <div class="product-meta">
                <span>${highlightMatches(product.category)}</span>
                <span>${escapeHtml(product.unit || "шт")}</span>
              </div>
              <div class="source-category">${highlightMatches(product.sourceCategory || "Без группы")}</div>
              <div class="product-bottom">
                ${formatPrice(product.price)}
                <div class="product-actions">
                  <button class="details-btn" type="button" data-add-code="${escapeHtml(product.code)}">
                    В запрос
                  </button>
                  <button class="details-btn details-btn-muted" type="button" data-product-code="${escapeHtml(product.code)}">
                    Подробнее
                  </button>
                </div>
              </div>
            </article>
          `,
        )
        .join("") || renderEmptyState();
    syncUrl();
  }

  function openProduct(product) {
    selectedProduct = product;
    modalCategory.textContent = product.category;
    modalTitle.textContent = product.name;
    modalCode.textContent = product.code;
    modalSource.textContent = product.sourceCategory || "Без группы";
    modalUnit.textContent = product.unit || "шт";
    modalPrice.textContent = formatPlainPrice(product.price);
    modalPriceNote.textContent = getPriceNote(product);
    productLinkStatus.textContent = "";
    productModal.classList.add("is-open");
    productModal.setAttribute("aria-hidden", "false");
    if (shouldSyncUrl) {
      window.history.replaceState({}, "", getProductUrl(product));
    }
  }

  function closeProduct() {
    productModal.classList.remove("is-open");
    productModal.setAttribute("aria-hidden", "true");
    selectedProduct = null;
    syncUrl();
  }

  function saveRequestItems() {
    localStorage.setItem(requestStorageKey, JSON.stringify(requestItems));
  }

  function addToRequest(product) {
    const existing = requestItems.find((item) => item.code === product.code);
    if (existing) {
      existing.qty += 1;
    } else {
      requestItems.push({
        code: product.code,
        name: product.name,
        price: product.price,
        category: product.category,
        qty: 1,
      });
    }
    saveRequestItems();
    renderRequestList();
    openRequestDrawer();
  }

  function removeFromRequest(code) {
    requestItems = requestItems.filter((item) => item.code !== code);
    saveRequestItems();
    renderRequestList();
  }

  function changeRequestQty(code, delta) {
    const item = requestItems.find((entry) => entry.code === code);
    if (!item) return;
    item.qty = Math.max(1, item.qty + delta);
    saveRequestItems();
    renderRequestList();
  }

  function buildRequestText() {
    const hasItems = requestItems.length > 0;
    const lines = [
      hasItems
        ? "Здравствуйте. Прошу уточнить наличие и актуальную цену по товарам:"
        : "Здравствуйте. Прошу помочь с подбором детали.",
    ];
    if (hasItems) {
      lines.push(
        "",
        ...requestItems.map(
          (item, index) =>
            `${index + 1}. ${item.name}\nКод: ${item.code}\nКоличество: ${item.qty}\nЦена на сайте: ${formatPlainPrice(item.price)}`,
        ),
      );
    }
    const comment = requestComment.value.trim();
    if (comment) {
      lines.push("", `Комментарий: ${comment}`);
    }
    lines.push("", "Пожалуйста, подскажите, в каком магазине можно забрать подходящие позиции.");
    return lines.join("\n");
  }

  function updateRequestEmail() {
    const subject = encodeURIComponent("Запрос по товарам с сайта Жигули");
    const body = encodeURIComponent(buildRequestText());
    requestEmail.href = `mailto:info@zhiguli-kirov.ru?subject=${subject}&body=${body}`;
  }

  function renderRequestList() {
    const totalQty = requestItems.reduce((sum, item) => sum + item.qty, 0);
    requestListCount.textContent = totalQty.toLocaleString("ru-RU");
    quickRequestCount.textContent = totalQty.toLocaleString("ru-RU");
    requestListToggle.classList.toggle("has-items", totalQty > 0);
    quickRequestToggle.classList.toggle("has-items", totalQty > 0);
    requestCallHint.textContent =
      totalQty > 0
        ? `В запросе ${totalQty.toLocaleString("ru-RU")} поз. При звонке назовите коды товаров из списка.`
        : "Можно добавить товар из каталога или описать деталь в форме подбора.";

    requestList.innerHTML =
      requestItems
        .map(
          (item) => `
            <article class="request-item">
              <div>
                <strong>${escapeHtml(item.name)}</strong>
                <span>Код ${escapeHtml(item.code)} · ${formatPlainPrice(item.price)}</span>
              </div>
              <div class="qty-control" aria-label="Количество">
                <button type="button" data-qty-minus="${escapeHtml(item.code)}">-</button>
                <span>${item.qty}</span>
                <button type="button" data-qty-plus="${escapeHtml(item.code)}">+</button>
              </div>
              <button class="remove-item" type="button" data-remove-code="${escapeHtml(item.code)}">Удалить</button>
            </article>
          `,
        )
        .join("") || '<p class="empty-state">Список пока пуст. Добавьте товары из каталога.</p>';

    updateRequestEmail();
  }

  function openRequestDrawer() {
    requestDrawer.classList.add("is-open");
    requestDrawer.setAttribute("aria-hidden", "false");
  }

  function closeRequestDrawer() {
    requestDrawer.classList.remove("is-open");
    requestDrawer.setAttribute("aria-hidden", "true");
  }

  function setQuery(value) {
    state.query = value;
    state.visible = 18;
    catalogSearch.value = value;
    heroSearch.value = value;
    render();
    document.getElementById("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetCatalogFilters() {
    state.query = "";
    state.category = "";
    state.price = "";
    state.sort = "relevance";
    state.visible = 18;
    catalogSearch.value = "";
    heroSearch.value = "";
    categoryFilter.value = "";
    priceFilter.value = "";
    sortSelect.value = "relevance";
    render();
  }

  function clearFilter(key) {
    if (key === "query") {
      state.query = "";
      catalogSearch.value = "";
      heroSearch.value = "";
    }
    if (key === "category") {
      state.category = "";
      categoryFilter.value = "";
    }
    if (key === "price") {
      state.price = "";
      priceFilter.value = "";
    }
    if (key === "sort") {
      state.sort = "relevance";
      sortSelect.value = "relevance";
    }
    state.visible = 18;
    render();
  }

  document.querySelector(".hero-search").addEventListener("submit", (event) => {
    event.preventDefault();
    setQuery(heroSearch.value);
  });

  catalogSearch.addEventListener("input", (event) => {
    state.query = event.target.value;
    state.visible = 18;
    render();
  });

  categoryFilter.addEventListener("change", (event) => {
    state.category = event.target.value;
    state.visible = 18;
    render();
  });

  priceFilter.addEventListener("change", (event) => {
    state.price = event.target.value;
    state.visible = 18;
    render();
  });

  sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });

  resetFilters.addEventListener("click", () => {
    resetCatalogFilters();
  });

  catalogSummary.addEventListener("click", (event) => {
    const button = event.target.closest("[data-clear-filter]");
    if (button) {
      clearFilter(button.dataset.clearFilter);
    }
  });

  loadMore.addEventListener("click", () => {
    state.visible += 18;
    render();
  });

  productGrid.addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add-code]");
    if (addButton) {
      const product = products.find((item) => item.code === addButton.dataset.addCode);
      if (product) {
        addToRequest(product);
      }
      return;
    }

    const emptyQueryButton = event.target.closest("[data-empty-query]");
    if (emptyQueryButton) {
      state.category = "";
      state.price = "";
      categoryFilter.value = "";
      priceFilter.value = "";
      setQuery(emptyQueryButton.dataset.emptyQuery);
      return;
    }

    const emptyCategoryButton = event.target.closest("[data-empty-category]");
    if (emptyCategoryButton) {
      state.query = "";
      state.category = emptyCategoryButton.dataset.emptyCategory;
      state.price = "";
      state.visible = 18;
      catalogSearch.value = "";
      heroSearch.value = "";
      categoryFilter.value = state.category;
      priceFilter.value = "";
      render();
      return;
    }

    const emptyResetButton = event.target.closest("[data-empty-reset]");
    if (emptyResetButton) {
      resetCatalogFilters();
      return;
    }

    const button = event.target.closest("[data-product-code]");
    if (!button) return;

    const product = products.find((item) => item.code === button.dataset.productCode);
    if (product) {
      openProduct(product);
    }
  });

  document.querySelectorAll("[data-close-modal]").forEach((element) => {
    element.addEventListener("click", closeProduct);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeProduct();
    }
  });

  addModalProduct.addEventListener("click", () => {
    if (selectedProduct) {
      addToRequest(selectedProduct);
    }
  });

  copyProductLink.addEventListener("click", async () => {
    if (!selectedProduct) return;

    const link = getProductUrl(selectedProduct);
    try {
      await navigator.clipboard.writeText(link);
      productLinkStatus.textContent = "Ссылка на товар скопирована.";
    } catch (error) {
      productLinkStatus.textContent = link;
    }
  });

  requestListToggle.addEventListener("click", openRequestDrawer);
  quickRequestToggle.addEventListener("click", openRequestDrawer);
  requestDrawerClose.addEventListener("click", closeRequestDrawer);
  requestComment.addEventListener("input", updateRequestEmail);

  requestList.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-code]");
    const plusButton = event.target.closest("[data-qty-plus]");
    const minusButton = event.target.closest("[data-qty-minus]");

    if (removeButton) removeFromRequest(removeButton.dataset.removeCode);
    if (plusButton) changeRequestQty(plusButton.dataset.qtyPlus, 1);
    if (minusButton) changeRequestQty(minusButton.dataset.qtyMinus, -1);
  });

  clearRequest.addEventListener("click", () => {
    requestItems = [];
    requestComment.value = "";
    copyStatus.textContent = "";
    saveRequestItems();
    renderRequestList();
  });

  copyRequest.addEventListener("click", async () => {
    const text = buildRequestText();
    try {
      await navigator.clipboard.writeText(text);
      copyStatus.textContent = "Текст запроса скопирован.";
    } catch (error) {
      copyStatus.textContent = "Не удалось скопировать автоматически. Используйте отправку на email.";
    }
  });

  document.querySelectorAll("button[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      state.query = "";
      state.visible = 18;
      catalogSearch.value = "";
      heroSearch.value = "";
      categoryFilter.value = state.category;
      render();
      document.getElementById("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelectorAll("[data-model-query]").forEach((button) => {
    button.addEventListener("click", () => {
      setQuery(button.dataset.modelQuery);
    });
  });

  document.querySelector(".request-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const commentLines = [];
    const car = requestCar.value.trim();
    const details = requestDetails.value.trim();
    const phone = requestPhone.value.trim();

    if (car) commentLines.push(`Автомобиль: ${car}`);
    if (details) commentLines.push(`Что нужно найти: ${details}`);
    if (phone) commentLines.push(`Телефон для связи: ${phone}`);
    if (commentLines.length) {
      requestComment.value = commentLines.join("\n");
      updateRequestEmail();
    }
    requestNote.textContent = "Запрос подготовлен. Позвоните в магазин или используйте подготовленное письмо.";
    openRequestDrawer();
  });

  const initialProductCode = new URLSearchParams(window.location.search).get("product");
  shouldSyncUrl = false;
  applyUrlParams();
  shouldSyncUrl = true;
  render();

  if (initialProductCode) {
    const product = products.find((item) => item.code === initialProductCode);
    if (product) {
      openProduct(product);
    }
  }
  renderRequestList();
})();
