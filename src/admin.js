(function () {
  let products = Array.isArray(window.ZHIGULI_PRODUCTS) ? window.ZHIGULI_PRODUCTS : [];
  let categories = [];
  let apiEnabled = false;
  const draftKey = "zhiguli-admin-draft";
  const tokenKey = "zhiguli-admin-token";
  const draft = JSON.parse(localStorage.getItem(draftKey) || "{}");

  const state = {
    query: "",
    category: "",
    selectedCode: "",
  };

  const adminProductsCount = document.getElementById("adminProductsCount");
  const adminCategoriesCount = document.getElementById("adminCategoriesCount");
  const adminRequestPriceCount = document.getElementById("adminRequestPriceCount");
  const adminNewRequestsCount = document.getElementById("adminNewRequestsCount");
  const adminSearch = document.getElementById("adminSearch");
  const adminCategory = document.getElementById("adminCategory");
  const adminProductRows = document.getElementById("adminProductRows");
  const refreshRequests = document.getElementById("refreshRequests");
  const newRequestsList = document.getElementById("newRequestsList");
  const progressRequestsList = document.getElementById("progressRequestsList");
  const doneRequestsList = document.getElementById("doneRequestsList");
  const importFile = document.getElementById("importFile");
  const previewImport = document.getElementById("previewImport");
  const applyImport = document.getElementById("applyImport");
  const importResult = document.getElementById("importResult");
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
  let pendingImportId = "";

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

  function formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        resolve(String(reader.result || "").split(",")[1] || "");
      });
      reader.addEventListener("error", () => reject(new Error("Не удалось прочитать файл.")));
      reader.readAsDataURL(file);
    });
  }

  async function fetchJson(url, options = {}, retry = true) {
    const token = localStorage.getItem(tokenKey) || "";
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    if (response.status === 401 && retry) {
      const nextToken = window.prompt("Введите токен администратора");
      if (nextToken) {
        localStorage.setItem(tokenKey, nextToken.trim());
        return fetchJson(url, options, false);
      }
    }
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

  function renderRequestCard(request) {
    const phone = request.customer?.phone || "телефон не указан";
    const comment = request.comment || "Комментарий не указан";
    const items = Array.isArray(request.items) ? request.items : [];
    const actions =
      request.status === "new"
        ? '<button type="button" data-request-status="in_progress">В работу</button>'
        : request.status === "in_progress"
          ? '<button type="button" data-request-status="done">Закрыть</button>'
          : "";

    return `
      <article class="admin-request-card" data-request-id="${escapeHtml(request.id)}">
        <div class="admin-request-head">
          <strong>${escapeHtml(request.id)}</strong>
          <span>${escapeHtml(formatDate(request.createdAt))}</span>
        </div>
        <a class="admin-request-phone" href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a>
        <p>${escapeHtml(comment)}</p>
        <div class="admin-request-items">
          ${
            items
              .map(
                (item) => `
                  <span>
                    ${escapeHtml(item.name || item.code)}
                    <small>Код ${escapeHtml(item.code)} · ${Number(item.qty || 1)} шт.</small>
                  </span>
                `,
              )
              .join("") || "<span>Товар не выбран из каталога</span>"
          }
        </div>
        <div class="admin-request-actions">
          ${actions}
        </div>
      </article>
    `;
  }

  function renderRequestColumn(element, requests, emptyText) {
    element.innerHTML =
      requests.map(renderRequestCard).join("") || `<p class="empty-state">${escapeHtml(emptyText)}</p>`;
  }

  async function loadRequests() {
    if (!apiEnabled) {
      adminNewRequestsCount.textContent = "0";
      renderRequestColumn(newRequestsList, [], "Заявки появятся при запуске backend.");
      renderRequestColumn(progressRequestsList, [], "Пока нет заявок в работе.");
      renderRequestColumn(doneRequestsList, [], "Пока нет закрытых заявок.");
      return;
    }

    const result = await fetchJson("/api/requests");
    const requests = Array.isArray(result.items) ? result.items : [];
    const newRequests = requests.filter((request) => request.status === "new");
    const progressRequests = requests.filter((request) => request.status === "in_progress");
    const doneRequests = requests.filter((request) => request.status === "done").slice(0, 12);

    adminNewRequestsCount.textContent = newRequests.length.toLocaleString("ru-RU");
    renderRequestColumn(newRequestsList, newRequests, "Новых заявок нет.");
    renderRequestColumn(progressRequestsList, progressRequests, "Пока нет заявок в работе.");
    renderRequestColumn(doneRequestsList, doneRequests, "Пока нет закрытых заявок.");
  }

  async function changeRequestStatus(id, status) {
    await fetchJson(`/api/requests/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadRequests();
  }

  function renderImportPreview(preview) {
    pendingImportId = preview.id;
    applyImport.disabled = false;
    const summary = preview.summary;
    const changed = preview.samples.changed
      .map((item) => {
        const fields = Object.entries(item.changes)
          .map(([field, value]) => `${field}: ${escapeHtml(value.before)} -> ${escapeHtml(value.after)}`)
          .join("; ");
        return `<li><strong>${escapeHtml(item.code)}</strong> ${escapeHtml(item.name)}<small>${fields}</small></li>`;
      })
      .join("");
    const added = preview.samples.added
      .map((item) => `<li><strong>${escapeHtml(item.code)}</strong> ${escapeHtml(item.name)}</li>`)
      .join("");
    const removed = preview.samples.removed
      .map((item) => `<li><strong>${escapeHtml(item.code)}</strong> ${escapeHtml(item.name)}</li>`)
      .join("");

    importResult.innerHTML = `
      <div class="import-summary">
        <span><strong>${summary.total.toLocaleString("ru-RU")}</strong> товаров в файле</span>
        <span><strong>${summary.added.toLocaleString("ru-RU")}</strong> новых</span>
        <span><strong>${summary.changed.toLocaleString("ru-RU")}</strong> изменено</span>
        <span><strong>${summary.removed.toLocaleString("ru-RU")}</strong> исчезло</span>
      </div>
      <div class="import-samples">
        <section>
          <h3>Измененные</h3>
          <ul>${changed || "<li>Нет изменений.</li>"}</ul>
        </section>
        <section>
          <h3>Новые</h3>
          <ul>${added || "<li>Нет новых товаров.</li>"}</ul>
        </section>
        <section>
          <h3>Не найдены в файле</h3>
          <ul>${removed || "<li>Все текущие товары есть в файле.</li>"}</ul>
        </section>
      </div>
    `;
  }

  async function previewSelectedImport() {
    if (!apiEnabled) {
      importResult.innerHTML = '<p class="empty-state">Импорт работает при запуске backend.</p>';
      return;
    }
    const file = importFile.files && importFile.files[0];
    if (!file) {
      importResult.innerHTML = '<p class="empty-state">Выберите файл прайса.</p>';
      return;
    }

    applyImport.disabled = true;
    pendingImportId = "";
    importResult.innerHTML = '<p class="empty-state">Проверяем прайс...</p>';

    try {
      const contentBase64 = await readFileAsBase64(file);
      const preview = await fetchJson("/api/imports/preview", {
        method: "POST",
        body: JSON.stringify({
          sourceName: file.name,
          file: { fileName: file.name, contentBase64 },
        }),
      });
      renderImportPreview(preview);
    } catch (error) {
      importResult.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
    }
  }

  async function applySelectedImport() {
    if (!pendingImportId) return;
    applyImport.disabled = true;
    importResult.insertAdjacentHTML("afterbegin", '<p class="empty-state">Публикуем каталог...</p>');
    try {
      const record = await fetchJson(`/api/imports/${encodeURIComponent(pendingImportId)}/apply`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      pendingImportId = "";
      importResult.innerHTML = `<p class="empty-state">Каталог опубликован. В файле ${record.summary.total.toLocaleString("ru-RU")} товаров.</p>`;
      await loadSummary();
      await renderRows();
    } catch (error) {
      importResult.innerHTML = `<p class="empty-state">Не удалось опубликовать каталог: ${escapeHtml(error.message)}</p>`;
    }
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

  refreshRequests.addEventListener("click", loadRequests);
  previewImport.addEventListener("click", previewSelectedImport);
  applyImport.addEventListener("click", applySelectedImport);

  document.querySelectorAll(".admin-request-list").forEach((list) => {
    list.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-request-status]");
      if (!button) return;

      const card = button.closest("[data-request-id]");
      if (!card) return;

      try {
        await changeRequestStatus(card.dataset.requestId, button.dataset.requestStatus);
      } catch (error) {
        alert("Не удалось обновить статус заявки.");
      }
    });
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
    await loadRequests();
    await renderRows();
    if (products[0]) {
      await selectProduct(products[0].code);
    }
  }

  init();
})();
