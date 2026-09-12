(function () {
  const products = Array.isArray(window.ZHIGULI_PRODUCTS) ? window.ZHIGULI_PRODUCTS : [];
  const state = {
    query: new URLSearchParams(window.location.search).get("q") || "",
    category: new URLSearchParams(window.location.search).get("category") || "",
    price: "",
    sort: "nameAsc",
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

  statsNode.textContent = products.length.toLocaleString("ru-RU");
  categoryFilter.innerHTML += categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)} (${formatCount(categoryCounts.get(category))})</option>`)
    .join("");
  searchInput.value = state.query;
  categoryFilter.value = state.category;

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

  function formatCount(value) {
    return Number(value || 0).toLocaleString("ru-RU");
  }

  function formatPrice(price) {
    return price ? `${Number(price).toLocaleString("ru-RU")} ₽` : "цену уточнить";
  }

  function getProductUrl(product) {
    return `product.html?code=${encodeURIComponent(product.code)}`;
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

  function applyFilters() {
    const query = normalize(state.query);
    const terms = query.split(/[^0-9a-zа-я]+/g).filter(Boolean);
    let result = products.filter((product) => {
      const text = normalize(`${product.code} ${product.name} ${product.category} ${product.sourceCategory || ""}`);
      const matchesQuery = !terms.length || terms.every((term) => text.includes(term));
      const matchesCategory = !state.category || product.category === state.category;
      const matchesPrice =
        !state.price ||
        (state.price === "priced" && product.price > 0) ||
        (state.price === "request" && !product.price);
      return matchesQuery && matchesCategory && matchesPrice;
    });

    result = [...result].sort((a, b) => {
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

  function render() {
    const result = applyFilters();
    const visible = result.slice(0, state.visible);
    countNode.textContent = `Найдено: ${formatCount(result.length)}`;
    productsNode.innerHTML =
      visible
        .map(
          (product) => `
            <article class="catalog-page-card">
              <a class="catalog-card-visual" href="${getProductUrl(product)}" aria-label="${escapeHtml(product.name)}">
                ${renderCategoryIcon(product.category)}
                <small>${escapeHtml(product.category)}</small>
              </a>
              <div class="catalog-card-body">
                <span class="product-code">Код ${escapeHtml(product.code)}</span>
                <h2><a href="${getProductUrl(product)}">${escapeHtml(product.name)}</a></h2>
                <p>${escapeHtml(product.sourceCategory || "Без группы")}</p>
                <div class="catalog-card-bottom">
                  <strong>${formatPrice(product.price)}</strong>
                  <a class="details-btn" href="${getProductUrl(product)}">Открыть</a>
                </div>
              </div>
            </article>
          `,
        )
        .join("") || `<article class="empty-results"><span>Ничего не найдено</span><h3>Попробуйте другой запрос</h3><p>Введите код, модель или короткое название детали.</p></article>`;
    loadMore.hidden = result.length <= state.visible;
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
    searchInput.value = "";
    categoryFilter.value = "";
    priceFilter.value = "";
    state.visible = 36;
    render();
  });

  loadMore.addEventListener("click", () => {
    state.visible += 36;
    render();
  });

  render();
})();
