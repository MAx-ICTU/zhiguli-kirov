(function () {
  let products = Array.isArray(window.ZHIGULI_PRODUCTS) ? window.ZHIGULI_PRODUCTS : [];
  let categories = [];
  let apiEnabled = false;
  const draftKey = "zhiguli-admin-draft";
  const draft = JSON.parse(localStorage.getItem(draftKey) || "{}");

  const state = {
    query: "",
    category: "",
    selectedCode: "",
  };

  const adminProductsCount = document.getElementById("adminProductsCount");
  const adminCategoriesCount = document.getElementById("adminCategoriesCount");
  const adminRequestPriceCount = document.getElementById("adminRequestPriceCount");
  const adminSearch = document.getElementById("adminSearch");
  const adminCategory = document.getElementById("adminCategory");
  const adminProductRows = document.getElementById("adminProductRows");
  const resetAdminDraft = document.getElementById("resetAdminDraft");
  const editorTitle = document.getElementById("editorTitle");
  const editorHint = document.getElementById("editorHint");
  const editorForm = document.getElementById("editorForm");
  const editorCode = document.getElementById("editorCode");
  const editorName = document.getElementById("editorName");
  const editorCategory = document.getElementById("editorCategory");
  const editorPrice = document.getElementById("editorPrice");
  const editorPublished = document.getElementById("editorPublished");
  const editorPhoto = document.getElementById("editorPhoto");
  const photoPreview = document.getElementById("photoPreview");

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

  function mergedProduct(product) {
    return { published: true, ...product, ...(apiEnabled ? {} : draft[product.code] || {}) };
  }

  function formatPrice(price) {
    if (!Number(price)) return "уточнить";
    return `${Number(price).toLocaleString("ru-RU")} ₽`;
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function updateCategoryOptions(nextCategories) {
    categories = nextCategories;
    const categoryOptions = categories
      .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
      .join("");
    adminCategory.innerHTML = `<option value="">Все разделы</option>${categoryOptions}`;
    editorCategory.innerHTML = categoryOptions;
  }

  async function loadSummary() {
    if (apiEnabled) {
      const summary = await fetchJson("/api/catalog/summary");
      adminProductsCount.textContent = summary.products.toLocaleString("ru-RU");
      adminCategoriesCount.textContent = summary.categories.length.toLocaleString("ru-RU");
      adminRequestPriceCount.textContent = summary.requestPrice.toLocaleString("ru-RU");
      updateCategoryOptions(summary.categories);
      return;
    }

    const fallbackCategories = [...new Set(products.map((product) => product.category))].sort((a, b) =>
      a.localeCompare(b, "ru"),
    );
    adminProductsCount.textContent = products.length.toLocaleString("ru-RU");
    adminCategoriesCount.textContent = fallbackCategories.length.toLocaleString("ru-RU");
    adminRequestPriceCount.textContent = products
      .filter((product) => !product.price)
      .length.toLocaleString("ru-RU");
    updateCategoryOptions(fallbackCategories);
  }

  function filteredProducts() {
    const query = normalize(state.query);
    return products
      .map(mergedProduct)
      .filter((product) => {
        const matchesQuery =
          !query ||
          normalize(product.name).includes(query) ||
          normalize(product.code).includes(query) ||
          normalize(product.sourceCategory).includes(query);
        const matchesCategory = !state.category || product.category === state.category;
        return matchesQuery && matchesCategory;
      })
      .slice(0, 80);
  }

  async function loadProducts() {
    if (apiEnabled) {
      const params = new URLSearchParams({
        limit: "80",
        query: state.query,
        category: state.category,
      });
      const result = await fetchJson(`/api/products?${params.toString()}`);
      products = result.items;
      return products;
    }

    return filteredProducts();
  }

  async function renderRows() {
    adminProductRows.innerHTML = '<tr><td colspan="5">Загрузка...</td></tr>';
    const rows = await loadProducts();
    adminProductRows.innerHTML = rows
      .map(
        (product) => `
          <tr data-code="${escapeHtml(product.code)}" class="${product.code === state.selectedCode ? "is-selected" : ""}">
            <td>${escapeHtml(product.code)}</td>
            <td>${escapeHtml(product.name)}</td>
            <td>${escapeHtml(product.category)}</td>
            <td>${formatPrice(product.price)}</td>
            <td>${product.published ? "опубликован" : "скрыт"}</td>
          </tr>
        `,
      )
      .join("");
  }

  async function getProduct(code) {
    if (apiEnabled) {
      return fetchJson(`/api/products/${encodeURIComponent(code)}`);
    }
    const baseProduct = products.find((product) => product.code === code);
    return baseProduct ? mergedProduct(baseProduct) : null;
  }

  async function selectProduct(code) {
    const product = await getProduct(code);
    if (!product) return;

    state.selectedCode = code;
    editorTitle.textContent = product.name;
    editorHint.textContent = `Исходная группа: ${product.sourceCategory || "без группы"}`;
    editorCode.value = product.code;
    editorName.value = product.name;
    editorCategory.value = product.category;
    editorPrice.value = Number(product.price || 0);
    editorPublished.checked = product.published !== false;
    photoPreview.textContent = product.photoName || "Фото не выбрано";
    photoPreview.style.backgroundImage = "";
    await renderRows();
  }

  async function saveProduct() {
    if (!state.selectedCode) return;

    const payload = {
      name: editorName.value.trim(),
      category: editorCategory.value,
      price: Number(editorPrice.value || 0),
      published: editorPublished.checked,
      photoName: photoPreview.dataset.fileName || "",
    };

    if (apiEnabled) {
      await fetchJson(`/api/products/${encodeURIComponent(state.selectedCode)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      const baseProduct = products.find((product) => product.code === state.selectedCode);
      draft[state.selectedCode] = {
        ...payload,
        name: payload.name || baseProduct.name,
        category: payload.category || baseProduct.category,
        photoName: payload.photoName || draft[state.selectedCode]?.photoName || "",
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    }

    await selectProduct(state.selectedCode);
  }

  let renderTimer = 0;
  function queueRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(renderRows, 150);
  }

  adminSearch.addEventListener("input", (event) => {
    state.query = event.target.value;
    queueRender();
  });

  adminCategory.addEventListener("change", (event) => {
    state.category = event.target.value;
    renderRows();
  });

  adminProductRows.addEventListener("click", (event) => {
    const row = event.target.closest("[data-code]");
    if (row) {
      selectProduct(row.dataset.code);
    }
  });

  editorForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await saveProduct();
      alert(apiEnabled ? "Изменения сохранены на сервере." : "Изменения сохранены в черновик прототипа.");
    } catch (error) {
      alert("Не удалось сохранить изменения. Проверьте, запущен ли backend.");
    }
  });

  editorPhoto.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    photoPreview.dataset.fileName = file.name;
    photoPreview.textContent = file.name;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      photoPreview.style.backgroundImage = `url("${reader.result}")`;
    });
    reader.readAsDataURL(file);
  });

  resetAdminDraft.addEventListener("click", () => {
    localStorage.removeItem(draftKey);
    location.reload();
  });

  async function init() {
    try {
      await fetchJson("/api/health");
      apiEnabled = true;
      resetAdminDraft.textContent = "Обновить данные";
    } catch (error) {
      apiEnabled = false;
    }

    await loadSummary();
    await renderRows();
    if (products[0]) {
      await selectProduct(products[0].code);
    }
  }

  init();
})();
