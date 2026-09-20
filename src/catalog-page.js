(function () {
  const products = Array.isArray(window.ZHIGULI_PRODUCTS) ? window.ZHIGULI_PRODUCTS : [];
  const state = {
    query: new URLSearchParams(window.location.search).get("q") || "",
    category: new URLSearchParams(window.location.search).get("category") || "",
    price: "",
    sort: "relevance",
    visible: 36,
  };

  const categoryCounts = products.reduce((counts, product) => {
    counts.set(product.category, (counts.get(product.category) || 0) + 1);
    return counts;
  }, new Map());
  const categories = [...categoryCounts.keys()].sort((a, b) => a.localeCompare(b, "ru"));
  const searchInput = document.getElementById("pageCatalogSearch");
  const categoryFilter = document.getElementById("pageCategoryFilter");
  const priceFilter = document.getElementById("pagePriceFilter");
  const sortSelect = document.getElementById("pageSortSelect");
  const resetButton = document.getElementById("pageResetFilters");
  const countNode = document.getElementById("pageCatalogCount");
  const productsNode = document.getElementById("pageProductGrid");
  const loadMore = document.getElementById("pageLoadMore");
  const statsNode = document.getElementById("catalogPageProducts");
  const categoryRail = document.getElementById("pageCategoryRail");
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
    "2121": ["2121", "21213", "21214", "нива"],
    "21213": ["2121", "21213", "21214", "нива"],
    "21214": ["2121", "21213", "21214", "нива"],
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

  statsNode.textContent = products.length.toLocaleString("ru-RU");
  categoryFilter.innerHTML += categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)} (${formatCount(categoryCounts.get(category))})</option>`)
    .join("");
  searchInput.value = state.query;
  categoryFilter.value = state.category;

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
    return normalize(`${product.code} ${product.name} ${product.category} ${product.sourceCategory || ""} ${product.unit || ""}`);
  }

  function getMatchedQueryParts(searchText, queryParts) {
    return queryParts.filter((variants) => variants.some((variant) => searchText.includes(variant))).length;
  }

  function relevanceScore(product, query, queryParts) {
    const name = normalize(product.name);
    const code = normalize(product.code);
    const category = normalize(product.category);
    const sourceCategory = normalize(product.sourceCategory);
    let score = 0;

    if (code === query) score += 120;
    if (name === query) score += 90;
    if (name.includes(query)) score += 48;
    queryParts.forEach((variants) => {
      const token = variants[0];
      if (code === token) score += 70;
      if (code.includes(token)) score += 38;
      if (variants.some((variant) => name.startsWith(variant))) score += 26;
      if (variants.some((variant) => name.includes(variant))) score += 18;
      if (variants.some((variant) => sourceCategory.includes(variant))) score += 8;
      if (variants.some((variant) => category.includes(variant))) score += 6;
    });
    if (product.price > 0) score += 2;
    return score;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatCount(value) {
    return Number(value || 0).toLocaleString("ru-RU");
  }

  function formatPrice(price) {
    return price ? `${Number(price).toLocaleString("ru-RU")} ₽` : "цену уточнить";
  }

  function getProductUrl(product) {
    return `product.html?code=${encodeURIComponent(product.code)}`;
  }

  function getProductVisualClass(product) {
    return normalize(product.category).replace(/[^a-zа-я0-9]+/g, "-");
  }

  function getCategoryVisual(category) {
    const visuals = {
      Двигатель: { code: "ДВ", icon: "icon-engine" },
      Подвеска: { code: "ХД", icon: "icon-suspension" },
      Тормоза: { code: "ТМ", icon: "icon-brake" },
      Электрика: { code: "ЭЛ", icon: "icon-electric" },
      Кузов: { code: "КЗ", icon: "icon-body" },
      "Масла и жидкости": { code: "МЖ", icon: "icon-oil" },
      Автохимия: { code: "АХ", icon: "icon-chemistry" },
      Инструменты: { code: "ИН", icon: "icon-tools" },
    };
    return visuals[category] || { code: "ВАЗ", icon: "icon-parts" };
  }

  function renderCategoryIcon(category) {
    const visual = getCategoryVisual(category);
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <use href="assets/category-icons.svg#${escapeHtml(visual.icon)}"></use>
      </svg>
      <span>${escapeHtml(visual.code)}</span>
    `;
  }

  function renderCategoryRail() {
    if (!categoryRail) return;
    const topCategories = categories
      .map((category) => ({ category, count: categoryCounts.get(category) || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    categoryRail.innerHTML = topCategories
      .map(({ category, count }) => {
        const visual = getCategoryVisual(category);
        const activeClass = category === state.category ? " is-active" : "";
        return `
          <button class="catalog-category-tile${activeClass}" type="button" data-page-category="${escapeHtml(category)}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <use href="assets/category-icons.svg#${escapeHtml(visual.icon)}"></use>
            </svg>
            <span>${escapeHtml(category)}</span>
            <small>${formatCount(count)} поз.</small>
          </button>
        `;
      })
      .join("");
  }

  function applyFilters() {
    const query = normalize(state.query);
    const queryParts = getQueryParts(state.query);
    const minQueryMatches = queryParts.length > 1 ? 2 : 1;
    let result = products.filter((product) => {
      const text = getProductSearchText(product);
      const matchesQuery = !queryParts.length || getMatchedQueryParts(text, queryParts) >= minQueryMatches;
      const matchesCategory = !state.category || product.category === state.category;
      const matchesPrice =
        !state.price ||
        (state.price === "priced" && product.price > 0) ||
        (state.price === "request" && !product.price);
      return matchesQuery && matchesCategory && matchesPrice;
    });

    result = [...result].sort((a, b) => {
      if (state.sort === "relevance" && query) return relevanceScore(b, query, queryParts) - relevanceScore(a, query, queryParts);
      if (state.sort === "priceAsc") return (a.price || Number.MAX_SAFE_INTEGER) - (b.price || Number.MAX_SAFE_INTEGER);
      if (state.sort === "priceDesc") return (b.price || 0) - (a.price || 0);
      return a.name.localeCompare(b.name, "ru");
    });

    return result;
  }

  function syncUrl() {
    const url = new URL(window.location.href);
    state.query ? url.searchParams.set("q", state.query) : url.searchParams.delete("q");
    state.category ? url.searchParams.set("category", state.category) : url.searchParams.delete("category");
    window.history.replaceState({}, "", url);
  }

  function renderPageEmptyState() {
    const hasFilters = Boolean(state.query || state.category || state.price);
    return `
      <article class="empty-results catalog-page-empty-state">
        <span>Ничего не найдено</span>
        <h3>Попробуйте код, модель или более короткое название</h3>
        <p>Каталог лучше отвечает на короткие запросы: артикул, модель автомобиля, узел или раздел.</p>
        <div class="empty-search-guide">
          <strong>Быстрый старт:</strong>
          <span>код полностью</span>
          <span>модель + узел</span>
          <span>раздел + деталь</span>
        </div>
        <div class="empty-actions" aria-label="Подсказки поиска">
          <button type="button" data-page-empty-query="5481">Код 5481</button>
          <button type="button" data-page-empty-query="стойка 2114">Стойка 2114</button>
          <button type="button" data-page-empty-category="Тормоза">Тормоза</button>
          ${hasFilters ? '<button type="button" data-page-empty-reset>Сбросить фильтры</button>' : ""}
          <a href="index.html#selection">Подбор по автомобилю</a>
          <a href="tel:+78332620888">Позвонить 620-888</a>
        </div>
      </article>
    `;
  }

  function render() {
    const result = applyFilters();
    const visible = result.slice(0, state.visible);
    countNode.textContent = `Найдено: ${formatCount(result.length)}`;
    productsNode.innerHTML =
      visible
        .map(
          (product) => `
            <article class="catalog-page-card">
              <a class="catalog-card-visual product-visual-${escapeHtml(getProductVisualClass(product))}" href="${getProductUrl(product)}" aria-label="${escapeHtml(product.name)}">
                ${renderCategoryIcon(product.category)}
                <small>${escapeHtml(product.category)}</small>
              </a>
              <div class="catalog-card-body">
                <span class="product-code">Код ${escapeHtml(product.code)}</span>
                <h2><a href="${getProductUrl(product)}">${escapeHtml(product.name)}</a></h2>
                <p>${escapeHtml(product.sourceCategory || "Без группы")}</p>
                <small class="catalog-card-hint">Наличие уточняйте по коду товара</small>
                <div class="catalog-card-bottom">
                  <strong>${formatPrice(product.price)}</strong>
                  <a class="details-btn" href="${getProductUrl(product)}">Открыть</a>
                </div>
              </div>
            </article>
          `,
        )
        .join("") || renderPageEmptyState();
    loadMore.hidden = result.length <= state.visible;
    renderCategoryRail();
    syncUrl();
  }

  searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    state.visible = 36;
    render();
  });

  categoryFilter.addEventListener("change", (event) => {
    state.category = event.target.value;
    state.visible = 36;
    render();
  });

  priceFilter.addEventListener("change", (event) => {
    state.price = event.target.value;
    state.visible = 36;
    render();
  });

  sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });

  resetButton.addEventListener("click", () => {
    state.query = "";
    state.category = "";
    state.price = "";
    state.sort = "relevance";
    searchInput.value = "";
    categoryFilter.value = "";
    priceFilter.value = "";
    sortSelect.value = "relevance";
    state.visible = 36;
    render();
  });

  loadMore.addEventListener("click", () => {
    state.visible += 36;
    render();
  });

  productsNode.addEventListener("click", (event) => {
    const queryButton = event.target.closest("[data-page-empty-query]");
    if (queryButton) {
      state.query = queryButton.dataset.pageEmptyQuery;
      searchInput.value = state.query;
      state.visible = 36;
      render();
      return;
    }

    const categoryButton = event.target.closest("[data-page-empty-category]");
    if (categoryButton) {
      state.category = categoryButton.dataset.pageEmptyCategory;
      categoryFilter.value = state.category;
      state.visible = 36;
      render();
      return;
    }

    const resetEmptyButton = event.target.closest("[data-page-empty-reset]");
    if (resetEmptyButton) {
      state.query = "";
      state.category = "";
      state.price = "";
      state.sort = "relevance";
      searchInput.value = "";
      categoryFilter.value = "";
      priceFilter.value = "";
      sortSelect.value = "relevance";
      state.visible = 36;
      render();
    }
  });

  categoryRail?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page-category]");
    if (!button) return;
    state.category = state.category === button.dataset.pageCategory ? "" : button.dataset.pageCategory;
    state.visible = 36;
    categoryFilter.value = state.category;
    render();
  });

  render();
})();
