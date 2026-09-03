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
  const resetFilters = document.getElementById("resetFilters");
  const loadMore = document.getElementById("loadMore");
  const productModal = document.getElementById("productModal");
  const modalCategory = document.getElementById("modalCategory");
  const modalTitle = document.getElementById("modalTitle");
  const modalCode = document.getElementById("modalCode");
  const modalSource = document.getElementById("modalSource");
  const modalUnit = document.getElementById("modalUnit");
  const modalPrice = document.getElementById("modalPrice");
  const addModalProduct = document.getElementById("addModalProduct");
  const copyProductLink = document.getElementById("copyProductLink");
  const productLinkStatus = document.getElementById("productLinkStatus");
  const requestDetails = document.getElementById("requestDetails");
  const requestCar = document.getElementById("requestCar");
  const requestPhone = document.getElementById("requestPhone");
  const requestNote = document.getElementById("requestNote");
  const requestListToggle = document.getElementById("requestListToggle");
  const requestListCount = document.getElementById("requestListCount");
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
  let requestItems = JSON.parse(localStorage.getItem(requestStorageKey) || "[]");

  document.getElementById("statProducts").textContent = products.length.toLocaleString("ru-RU");
  document.getElementById("statCategories").textContent = categories.length.toLocaleString("ru-RU");

  categoryFilter.innerHTML += categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("");

  function normalize(value) {
    return String(value || "").toLowerCase().replaceAll("ё", "е").trim();
  }

  function formatPrice(price) {
    if (!price) {
      return '<span class="request-price">цену уточнить</span>';
    }
    return `<span class="price">${Number(price).toLocaleString("ru-RU")} ₽</span>`;
  }

  function formatPlainPrice(price) {
    if (!price) return "цену уточнить";
    return `${Number(price).toLocaleString("ru-RU")} ₽`;
  }

  function getPriceStatus(product) {
    return product.price > 0 ? "Цена в прайсе" : "Уточнить у менеджера";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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
    let result = products.filter((product) => {
      const matchesQuery =
        !query ||
        normalize(product.name).includes(query) ||
        normalize(product.code).includes(query) ||
        normalize(product.sourceCategory).includes(query);
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
      result = result.sort((a, b) => relevanceScore(b, query) - relevanceScore(a, query));
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

  function relevanceScore(product, query) {
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
    if (product.price > 0) score += 3;

    return score;
  }

  function render() {
    const result = applyFilters();
    const visibleItems = result.slice(0, state.visible);
    catalogCount.textContent = `Найдено: ${result.length.toLocaleString("ru-RU")}`;
    loadMore.hidden = result.length <= state.visible;

    productGrid.innerHTML =
      visibleItems
        .map(
          (product) => `
            <article class="product-card" data-code="${escapeHtml(product.code)}">
              <div class="product-top">
                <span class="product-code">Код ${escapeHtml(product.code)}</span>
                <span class="product-status ${product.price > 0 ? "is-priced" : "is-request"}">
                  ${escapeHtml(getPriceStatus(product))}
                </span>
              </div>
              <h3>${escapeHtml(product.name)}</h3>
              <div class="product-meta">
                <span>${escapeHtml(product.category)}</span>
                <span>${escapeHtml(product.unit || "шт")}</span>
              </div>
              <div class="source-category">${escapeHtml(product.sourceCategory || "Без группы")}</div>
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
        .join("") || '<p class="empty-state">Ничего не найдено. Попробуйте изменить запрос.</p>';
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
    const lines = [
      "Здравствуйте. Прошу уточнить наличие и актуальную цену по товарам:",
      "",
      ...requestItems.map(
        (item, index) =>
          `${index + 1}. ${item.name}\nКод: ${item.code}\nКоличество: ${item.qty}\nЦена на сайте: ${formatPlainPrice(item.price)}`,
      ),
    ];
    const comment = requestComment.value.trim();
    if (comment) {
      lines.push("", `Комментарий: ${comment}`);
    }
    return lines.join("\n");
  }

  async function submitRequestToBackend() {
    const details = requestDetails.value.trim();
    const car = requestCar.value.trim();
    const phone = requestPhone.value.trim();
    const commentLines = [];

    if (car) commentLines.push(`Автомобиль: ${car}`);
    if (details) commentLines.push(`Запрос: ${details}`);

    const response = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: { phone },
        comment: commentLines.join("\n"),
        items: requestItems,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
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
    state.query = "";
    state.category = "";
    state.price = "";
    state.sort = "relevance";
    state.visible = 18;
    catalogSearch.value = "";
    categoryFilter.value = "";
    priceFilter.value = "";
    sortSelect.value = "relevance";
    render();
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

  document.querySelectorAll(".quick-categories button").forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      state.visible = 18;
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

  document.querySelector(".request-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await submitRequestToBackend();
      requestNote.textContent = "Заявка отправлена менеджеру. Он проверит наличие и перезвонит.";
      requestDetails.value = "";
      requestCar.value = "";
      requestPhone.value = "";
    } catch (error) {
      requestNote.textContent = "Запрос подготовлен. Позвоните в магазин или отправьте подготовленное письмо.";
    }
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
