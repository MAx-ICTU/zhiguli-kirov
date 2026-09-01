(function () {
  const products = Array.isArray(window.ZHIGULI_PRODUCTS) ? window.ZHIGULI_PRODUCTS : [];
  const draftKey = "zhiguli-admin-draft";
  const draft = JSON.parse(localStorage.getItem(draftKey) || "{}");
  const categories = [...new Set(products.map((product) => product.category))].sort((a, b) =>
    a.localeCompare(b, "ru"),
  );

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

  adminProductsCount.textContent = products.length.toLocaleString("ru-RU");
  adminCategoriesCount.textContent = categories.length.toLocaleString("ru-RU");
  adminRequestPriceCount.textContent = products
    .filter((product) => !product.price)
    .length.toLocaleString("ru-RU");

  const categoryOptions = categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("");
  adminCategory.innerHTML += categoryOptions;
  editorCategory.innerHTML = categoryOptions;

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
    return { published: true, ...product, ...(draft[product.code] || {}) };
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

  function formatPrice(price) {
    if (!Number(price)) return "уточнить";
    return `${Number(price).toLocaleString("ru-RU")} ₽`;
  }

  function renderRows() {
    const rows = filteredProducts();
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

  function selectProduct(code) {
    const baseProduct = products.find((product) => product.code === code);
    if (!baseProduct) return;

    const product = mergedProduct(baseProduct);
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
    renderRows();
  }

  function saveDraft() {
    if (!state.selectedCode) return;

    const baseProduct = products.find((product) => product.code === state.selectedCode);
    draft[state.selectedCode] = {
      name: editorName.value.trim() || baseProduct.name,
      category: editorCategory.value || baseProduct.category,
      price: Number(editorPrice.value || 0),
      published: editorPublished.checked,
      photoName: photoPreview.dataset.fileName || draft[state.selectedCode]?.photoName || "",
    };

    localStorage.setItem(draftKey, JSON.stringify(draft));
    selectProduct(state.selectedCode);
  }

  adminSearch.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderRows();
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

  editorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveDraft();
    alert("Изменения сохранены в черновик прототипа.");
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

  renderRows();
  if (products[0]) {
    selectProduct(products[0].code);
  }
})();
