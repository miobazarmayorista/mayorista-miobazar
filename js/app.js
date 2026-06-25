// js/app.js
(function () {
  "use strict";

  const WHATSAPP_NUMBER = "5491170620278"; // +54 9 11 7062-0278 en formato internacional sin signos
  const MIN_PURCHASE = 300000;
  const PAGE_SIZE = 40;
  const CART_KEY = "mb_mayorista_cart_v1";

  const money = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  /** @type {Array<{id:number,name:string,image:string|null,retailPrice:number,price:number}>} */
  let allProducts = [];
  let filteredProducts = [];
  let visibleCount = PAGE_SIZE;

  /** @type {Record<string, number>} productId -> cantidad */
  let cart = loadCart();

  // ---------- DOM refs ----------
  const grid = document.getElementById("grid");
  const searchInput = document.getElementById("searchInput");
  const resultsCount = document.getElementById("resultsCount");
  const loadMoreWrap = document.getElementById("loadMoreWrap");
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  const emptyState = document.getElementById("emptyState");
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");

  const cartToggle = document.getElementById("cartToggle");
  const cartCount = document.getElementById("cartCount");
  const cartTotalMini = document.getElementById("cartTotalMini");
  const cartPanel = document.getElementById("cartPanel");
  const cartOverlay = document.getElementById("cartOverlay");
  const cartClose = document.getElementById("cartClose");
  const cartLines = document.getElementById("cartLines");
  const cartEmptyMsg = document.getElementById("cartEmptyMsg");
  const cartTotal = document.getElementById("cartTotal");
  const progressLabel = document.getElementById("progressLabel");
  const progressFill = document.getElementById("progressFill");
  const checkoutBtn = document.getElementById("checkoutBtn");
  const missingAmount = document.getElementById("missingAmount");

  // ---------- Carga de catálogo ----------
  async function loadProducts() {
    try {
      const res = await fetch("/.netlify/functions/products");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      allProducts = await res.json();
      filteredProducts = allProducts;
      loadingState.hidden = true;
      renderGrid();
    } catch (err) {
      loadingState.hidden = true;
      errorState.hidden = false;
      errorState.textContent =
        "No pudimos cargar el catálogo (" +
        err.message +
        "). Si recién configuraste el sitio, revisá las variables de entorno TN_STORE_ID y TN_ACCESS_TOKEN en Netlify.";
    }
  }

  // ---------- Render de la grilla ----------
  function renderGrid() {
    const term = searchInput.value.trim().toLowerCase();
    filteredProducts = term
      ? allProducts.filter((p) => p.name.toLowerCase().includes(term))
      : allProducts;

    visibleCount = Math.min(visibleCount, Math.max(filteredProducts.length, PAGE_SIZE));
    if (term) visibleCount = PAGE_SIZE; // reset al buscar

    const toShow = filteredProducts.slice(0, visibleCount);

    resultsCount.textContent = `${filteredProducts.length} producto${filteredProducts.length === 1 ? "" : "s"}`;
    emptyState.hidden = filteredProducts.length !== 0;
    loadMoreWrap.hidden = visibleCount >= filteredProducts.length;

    grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    toShow.forEach((p) => frag.appendChild(renderCard(p)));
    grid.appendChild(frag);
  }

  function renderCard(product) {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.id = product.id;

    const imgWrap = document.createElement("div");
    imgWrap.className = "card__img";
    if (product.image) {
      const img = document.createElement("img");
      img.src = product.image;
      img.alt = product.name;
      img.loading = "lazy";
      imgWrap.appendChild(img);
    } else {
      imgWrap.classList.add("card__img--placeholder");
      imgWrap.textContent = "Sin imagen";
    }

    const body = document.createElement("div");
    body.className = "card__body";

    const name = document.createElement("p");
    name.className = "card__name";
    name.textContent = product.name;

    const prices = document.createElement("div");
    prices.className = "card__prices";
    const retail = document.createElement("div");
    retail.className = "card__retail";
    retail.textContent = money.format(product.retailPrice);
    const wholesale = document.createElement("div");
    wholesale.className = "card__wholesale";
    wholesale.textContent = money.format(product.price);
    prices.append(retail, wholesale);

    const qtyRow = document.createElement("div");
    qtyRow.className = "card__qty-row";

    const stepper = document.createElement("div");
    stepper.className = "stepper";
    const minusBtn = document.createElement("button");
    minusBtn.type = "button";
    minusBtn.textContent = "−";
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "1";
    qtyInput.value = "1";
    qtyInput.inputMode = "numeric";
    const plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.textContent = "+";

    minusBtn.addEventListener("click", () => {
      qtyInput.value = Math.max(1, parseInt(qtyInput.value || "1", 10) - 1);
    });
    plusBtn.addEventListener("click", () => {
      qtyInput.value = Math.max(1, parseInt(qtyInput.value || "1", 10) + 1);
    });
    qtyInput.addEventListener("change", () => {
      const v = parseInt(qtyInput.value, 10);
      qtyInput.value = isNaN(v) || v < 1 ? 1 : v;
    });

    stepper.append(minusBtn, qtyInput, plusBtn);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "add-btn";
    addBtn.textContent = "Agregar";
    addBtn.addEventListener("click", () => {
      const qty = parseInt(qtyInput.value, 10) || 1;
      addToCart(product, qty);
      addBtn.textContent = "Agregado ✓";
      addBtn.classList.add("added");
      setTimeout(() => {
        addBtn.textContent = "Agregar";
        addBtn.classList.remove("added");
      }, 900);
    });

    qtyRow.append(stepper, addBtn);
    body.append(name, prices, qtyRow);
    card.append(imgWrap, body);
    return card;
  }

  // ---------- Carrito ----------
  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function addToCart(product, qty) {
    cart[product.id] = (cart[product.id] || 0) + qty;
    saveCart();
    renderCart();
    openCart();
  }

  function setQty(productId, qty) {
    if (qty <= 0) {
      delete cart[productId];
    } else {
      cart[productId] = qty;
    }
    saveCart();
    renderCart();
  }

  function removeFromCart(productId) {
    delete cart[productId];
    saveCart();
    renderCart();
  }

  function cartItems() {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const product = allProducts.find((p) => String(p.id) === String(id));
        if (!product) return null;
        return { product, qty };
      })
      .filter(Boolean);
  }

  function cartTotalAmount() {
    return cartItems().reduce((sum, { product, qty }) => sum + product.price * qty, 0);
  }

  function renderCart() {
    const items = cartItems();
    const total = cartTotalAmount();
    const count = items.reduce((s, i) => s + i.qty, 0);

    cartCount.textContent = count;
    cartTotalMini.textContent = money.format(total);
    cartTotal.textContent = money.format(total);

    cartLines.innerHTML = "";
    if (items.length === 0) {
      cartEmptyMsg.hidden = false;
      cartLines.appendChild(cartEmptyMsg);
    } else {
      cartEmptyMsg.hidden = true;
      items.forEach(({ product, qty }) => cartLines.appendChild(renderCartLine(product, qty)));
    }

    const pct = Math.min(100, (total / MIN_PURCHASE) * 100);
    progressFill.style.width = pct + "%";
    progressFill.classList.toggle("complete", total >= MIN_PURCHASE);
    progressLabel.textContent = `${money.format(total)} / ${money.format(MIN_PURCHASE)}`;

    if (total >= MIN_PURCHASE && items.length > 0) {
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = "Finalizar pedido por WhatsApp";
    } else {
      checkoutBtn.disabled = true;
      const missing = Math.max(0, MIN_PURCHASE - total);
      missingAmount.textContent = money.format(missing);
      checkoutBtn.innerHTML = `Te faltan <span id="missingAmount">${money.format(missing)}</span> para el mínimo`;
    }
  }

  function renderCartLine(product, qty) {
    const line = document.createElement("div");
    line.className = "cart-line";

    const imgWrap = document.createElement("div");
    imgWrap.className = "cart-line__img";
    if (product.image) {
      const img = document.createElement("img");
      img.src = product.image;
      img.alt = product.name;
      imgWrap.appendChild(img);
    }

    const info = document.createElement("div");
    info.className = "cart-line__info";
    const name = document.createElement("p");
    name.className = "cart-line__name";
    name.textContent = product.name;

    const meta = document.createElement("div");
    meta.className = "cart-line__meta";

    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "1";
    qtyInput.value = String(qty);
    qtyInput.style.width = "44px";
    qtyInput.addEventListener("change", () => {
      const v = parseInt(qtyInput.value, 10);
      setQty(product.id, isNaN(v) ? 0 : v);
    });

    const unit = document.createElement("span");
    unit.textContent = "× " + money.format(product.price);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "cart-line__remove";
    remove.textContent = "Quitar";
    remove.addEventListener("click", () => removeFromCart(product.id));

    meta.append(qtyInput, unit, remove);
    info.append(name, meta);

    const subtotal = document.createElement("div");
    subtotal.className = "cart-line__subtotal";
    subtotal.textContent = money.format(product.price * qty);

    line.append(imgWrap, info, subtotal);
    return line;
  }

  // ---------- Apertura/cierre del carrito ----------
  function openCart() {
    cartPanel.classList.add("open");
    cartOverlay.classList.add("open");
    cartPanel.setAttribute("aria-hidden", "false");
  }
  function closeCart() {
    cartPanel.classList.remove("open");
    cartOverlay.classList.remove("open");
    cartPanel.setAttribute("aria-hidden", "true");
  }

  cartToggle.addEventListener("click", openCart);
  cartClose.addEventListener("click", closeCart);
  cartOverlay.addEventListener("click", closeCart);

  // ---------- Checkout por WhatsApp ----------
  function buildWhatsappMessage() {
    const items = cartItems();
    const total = cartTotalAmount();
    const lines = items.map(
      ({ product, qty }) =>
        `• ${product.name} — x${qty} — ${money.format(product.price)} c/u — Subtotal: ${money.format(product.price * qty)}`
    );
    const text =
      "Hola! Quiero hacer este pedido mayorista:\n\n" +
      lines.join("\n") +
      `\n\nTOTAL: ${money.format(total)}`;
    return text;
  }

  checkoutBtn.addEventListener("click", () => {
    if (checkoutBtn.disabled) return;
    const text = buildWhatsappMessage();
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  });

  // ---------- Búsqueda y paginado ----------
  let searchTimer;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      visibleCount = PAGE_SIZE;
      renderGrid();
    }, 200);
  });

  loadMoreBtn.addEventListener("click", () => {
    visibleCount += PAGE_SIZE;
    renderGrid();
  });

  // ---------- Init ----------
  renderCart();
  loadProducts();
})();
