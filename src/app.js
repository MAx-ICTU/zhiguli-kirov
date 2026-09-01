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
  const requestProduct = document.getElementById("requestProduct");
  const requestDetails = document.getElementById("requestDetails");
  const requestNote = document.getElementById("requestNote");

  let selectedProduct = null;

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

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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
                <span class="product-category">${escapeHtml(product.category)}</span>
              </div>
              <h3>${escapeHtml(product.name)}</h3>
              <div class="source-category">${escapeHtml(product.sourceCategory || "")}</div>
              <div class="product-bottom">
                ${formatPrice(product.price)}
                <button class="details-btn" type="button" data-product-code="${escapeHtml(product.code)}">
                  Подробнее
                </button>
              </div>
            </article>
          `,
        )
        .join("") || '<p class="empty-state">Ничего не найдено. Попробуйте изменить запрос.</p>';
  }

  function openProduct(product) {
    selectedProduct = product;
    modalCategory.textContent = product.category;
    modalTitle.textContent = product.name;
    modalCode.textContent = product.code;
    modalSource.textContent = product.sourceCategory || "Без группы";
    modalUnit.textContent = product.unit || "шт";
    modalPrice.textContent = formatPlainPrice(product.price);
    productModal.classList.add("is-open");
    productModal.setAttribute("aria-hidden", "false");
  }

  function closeProduct() {
    productModal.classList.remove("is-open");
    productModal.setAttribute("aria-hidden", "true");
  }

  function fillRequestFromProduct(product) {
    requestDetails.value = `Интересует товар: ${product.name}\nКод: ${product.code}\nЦена: ${formatPlainPrice(product.price)}`;
    requestNote.textContent = "В заявку добавлен выбранный товар из каталога.";
    closeProduct();
    document.getElementById("selection").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setQuery(value) {
    state.query = value;
    state.visible = 18;
    catalogSearch.value = value;
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

  requestProduct.addEventListener("click", () => {
    if (selectedProduct) {
      fillRequestFromProduct(selectedProduct);
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

  document.querySelector(".request-form").addEventListener("submit", (event) => {
    event.preventDefault();
    alert("Заявка подготовлена. В рабочей версии она будет уходить менеджеру.");
  });

  render();
})();
