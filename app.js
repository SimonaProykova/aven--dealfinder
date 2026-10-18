/**
 * Avène DealFinder & Smart Shopping Basket Matcher
 * Full Interactive Application Logic
 */

document.addEventListener("DOMContentLoaded", () => {
  // Ensure product data is loaded
  const products = window.AVENE_DATA || [];
  
  // State
  const state = {
    activeTab: "catalog", // 'catalog' | 'basket'
    searchQuery: "",
    selectedLine: "all",
    selectedStore: "all",
    sortBy: "discount_desc",
    onlyDiscounted: false,
    basket: [
      {
        id: "item-1",
        query: "Cicalfate+ Crème Réparatrice 100ml",
        matchedProduct: products.find(p => p.name.includes("Cicalfate + Crème Réparatrice Protectrice 100 ml")) || products[1],
        quantity: 1
      },
      {
        id: "item-2",
        query: "Hyaluron Activ B3 Crème Nuit",
        matchedProduct: products.find(p => p.name.includes("Hyaluron Activ B3 Crème Multi-Intensive Nuit")) || products[8],
        quantity: 1
      },
      {
        id: "item-3",
        query: "XeraCalm Nutrition Lait Hydratant 400ml",
        matchedProduct: products.find(p => p.name.includes("XeraCalm Nutrition Lait Hydratant 400 ml")) || products[13],
        quantity: 1
      }
    ]
  };

  // DOM Elements
  const tabCatalogBtn = document.getElementById("tab-catalog-btn");
  const tabBasketBtn = document.getElementById("tab-basket-btn");
  const catalogView = document.getElementById("catalog-view");
  const basketView = document.getElementById("basket-view");
  const basketCountBadge = document.getElementById("basket-count-badge");
  
  const searchInput = document.getElementById("search-input");
  const storeFilterSelect = document.getElementById("store-filter-select");
  const sortSelect = document.getElementById("sort-select");
  const discountedOnlyToggle = document.getElementById("discounted-only-toggle");
  const linePillsContainer = document.getElementById("line-pills-container");
  const productsGrid = document.getElementById("products-grid");
  const catalogCountSpan = document.getElementById("catalog-count-span");
  
  const basketItemsList = document.getElementById("basket-items-list");
  const customItemInput = document.getElementById("custom-item-input");
  const addItemBtn = document.getElementById("add-item-btn");
  const storeComparisonsGrid = document.getElementById("store-comparisons-grid");
  const matrixTableBody = document.getElementById("matrix-table-body");
  const matrixTableHead = document.getElementById("matrix-table-head");
  const toastEl = document.getElementById("toast-notice");

  // Show Toast Helper
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => {
      toastEl.classList.remove("show");
    }, 2800);
  }

  // Switch Tabs
  function setTab(tabName) {
    state.activeTab = tabName;
    if (tabName === "catalog") {
      tabCatalogBtn.classList.add("active");
      tabBasketBtn.classList.remove("active");
      catalogView.style.display = "block";
      basketView.style.display = "none";
    } else {
      tabBasketBtn.classList.add("active");
      tabCatalogBtn.classList.remove("active");
      catalogView.style.display = "none";
      basketView.style.display = "block";
      renderSmartBasket();
    }
  }

  tabCatalogBtn.addEventListener("click", () => setTab("catalog"));
  tabBasketBtn.addEventListener("click", () => setTab("basket"));

  // Update Basket Count Badge
  function updateBasketBadge() {
    const totalQty = state.basket.reduce((acc, item) => acc + item.quantity, 0);
    basketCountBadge.textContent = totalQty;
  }

  // Best Match Algorithm
  function findBestMatch(queryString) {
    if (!queryString || !queryString.trim()) return null;
    const cleanQuery = queryString.toLowerCase().trim();
    const queryTokens = cleanQuery.split(/\s+/).filter(t => t.length > 1);

    let bestScore = -1;
    let bestProduct = null;

    products.forEach(p => {
      const pName = p.name.toLowerCase();
      let score = 0;

      queryTokens.forEach(token => {
        if (pName.includes(token)) {
          score += 10;
        }
      });

      // Bonus if line matches
      if (cleanQuery.includes(p.line.toLowerCase())) {
        score += 15;
      }

      // Bonus if size numbers match
      const queryNums = cleanQuery.match(/\d+/g) || [];
      const prodNums = pName.match(/\d+/g) || [];
      queryNums.forEach(num => {
        if (prodNums.includes(num)) {
          score += 12;
        }
      });

      if (score > bestScore) {
        bestScore = score;
        bestProduct = p;
      }
    });

    return bestScore > 0 ? bestProduct : products[0];
  }

  // Render Line Filter Pills
  function renderLinePills() {
    const lines = ["all", "Cicalfate+", "Hydrance", "Hyaluron Activ B3", "XeraCalm", "Tolérance", "Cleanance", "Cold Cream", "DermAbsolu", "Solaire SPF"];
    linePillsContainer.innerHTML = "";

    lines.forEach(line => {
      const btn = document.createElement("button");
      btn.className = `pill-btn ${state.selectedLine === line ? "active" : ""}`;
      btn.textContent = line === "all" ? "✨ All Lines" : line;
      btn.addEventListener("click", () => {
        state.selectedLine = line;
        renderLinePills();
        renderCatalog();
      });
      linePillsContainer.appendChild(btn);
    });
  }

  // Filter & Sort Products
  function getFilteredProducts() {
    return products.filter(p => {
      // Search query
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesLine = p.line.toLowerCase().includes(q);
        const matchesCategory = p.category.toLowerCase().includes(q);
        if (!matchesName && !matchesLine && !matchesCategory) return false;
      }

      // Line filter
      if (state.selectedLine !== "all" && p.line !== state.selectedLine) {
        return false;
      }

      // Store filter
      if (state.selectedStore !== "all") {
        const hasStore = p.stores.some(s => s.store_name === state.selectedStore && s.in_stock);
        if (!hasStore) return false;
      }

      // Only discounted filter
      if (state.onlyDiscounted) {
        const hasDiscount = p.stores.some(s => s.discount_pct > 0 && (state.selectedStore === "all" || s.store_name === state.selectedStore));
        if (!hasDiscount) return false;
      }

      return true;
    }).sort((a, b) => {
      if (state.sortBy === "discount_desc") {
        return b.max_discount_pct - a.max_discount_pct;
      } else if (state.sortBy === "price_asc") {
        return a.best_price - b.best_price;
      } else if (state.sortBy === "price_desc") {
        return b.best_price - a.best_price;
      } else if (state.sortBy === "unit_asc") {
        return a.price_per_100ml - b.price_per_100ml;
      } else if (state.sortBy === "name_asc") {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
  }

  // Helper for line CSS class
  function getLineClass(line) {
    const slug = line.toLowerCase().replace(/[^a-z0-9]/g, "-");
    return slug;
  }

  // Render Catalog Grid
  function renderCatalog() {
    const filtered = getFilteredProducts();
    catalogCountSpan.textContent = `${filtered.length} products found`;

    if (filtered.length === 0) {
      productsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">🔍</div>
          <h3>No Avène creams matched your filter</h3>
          <p>Try clearing your search query or enabling "All Lines".</p>
        </div>
      `;
      return;
    }

    productsGrid.innerHTML = "";

    filtered.forEach(p => {
      const card = document.createElement("div");
      card.className = "product-card";

      const inBasket = state.basket.some(item => item.matchedProduct && item.matchedProduct.id === p.id);

      // Best store info based on current filter or overall best
      let storeInfo = p.stores.find(s => s.store_name === state.selectedStore && s.in_stock);
      if (!storeInfo) {
        storeInfo = p.stores.find(s => s.store_name === p.best_store) || p.stores[0];
      }

      const hasDiscount = storeInfo.discount_pct > 0;

      card.innerHTML = `
        <div class="card-header-tags">
          <span class="line-tag ${getLineClass(p.line)}">${p.line}</span>
          ${hasDiscount ? `<span class="discount-badge">-${storeInfo.discount_pct}% OFF</span>` : ""}
        </div>
        
        <h3 class="product-name" title="${p.name}">${p.name}</h3>
        
        <div class="product-volume">
          <span>🧴 Size: <strong>${p.size_ml} ml</strong></span>
          <span style="margin: 0 0.35rem;">•</span>
          <span class="unit-price-pill">€${storeInfo.price_per_100ml.toFixed(2)} / 100ml</span>
        </div>

        <div class="pricing-block">
          <div class="price-row">
            ${hasDiscount ? `<span class="regular-price-crossed">€${storeInfo.regular_price.toFixed(2)}</span>` : "<span></span>"}
            <span class="promo-price">€${storeInfo.promo_price.toFixed(2)}</span>
          </div>
        </div>

        <div class="store-availability-row">
          <span>Best at: <span class="store-name-tag">🏪 ${storeInfo.store_name}</span></span>
          <span style="color: #059669; font-weight: 700;">✓ In Stock</span>
        </div>

        <div class="card-actions">
          <button class="btn-add-basket ${inBasket ? "in-basket" : ""}" data-id="${p.id}">
            ${inBasket ? "✓ In Basket" : "+ Add to Smart List"}
          </button>
          <a href="${storeInfo.direct_link}" target="_blank" rel="noopener noreferrer" class="btn-view-store" title="Open Store Page">
            ↗
          </a>
        </div>
      `;

      // Event listener for Add to Basket
      const addBtn = card.querySelector(".btn-add-basket");
      addBtn.addEventListener("click", () => {
        addToBasket(p);
      });

      productsGrid.appendChild(card);
    });
  }

  // Add Product to Basket
  function addToBasket(product) {
    const existing = state.basket.find(item => item.matchedProduct && item.matchedProduct.id === product.id);
    if (existing) {
      existing.quantity += 1;
      showToast(`Added another "${product.name.slice(0, 32)}..." to your basket`);
    } else {
      state.basket.push({
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        query: product.name,
        matchedProduct: product,
        quantity: 1
      });
      showToast(`Added "${product.name.slice(0, 32)}..." to Smart Basket`);
    }

    updateBasketBadge();
    renderCatalog();
  }

  // Event Listeners for Filters
  searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    renderCatalog();
  });

  storeFilterSelect.addEventListener("change", (e) => {
    state.selectedStore = e.target.value;
    renderCatalog();
  });

  sortSelect.addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    renderCatalog();
  });

  discountedOnlyToggle.addEventListener("change", (e) => {
    state.onlyDiscounted = e.target.checked;
    renderCatalog();
  });

  // Smart Basket UI Rendering
  function renderSmartBasket() {
    updateBasketBadge();

    // 1. Render Basket Items List
    if (state.basket.length === 0) {
      basketItemsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🛒</div>
          <h4>Your Smart Basket is empty</h4>
          <p>Type an Avène cream name above, pick a preset, or click "+ Add to Smart List" from the catalog.</p>
        </div>
      `;
      storeComparisonsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <p>Add at least one item to see cross-store cost comparison.</p>
        </div>
      `;
      matrixTableBody.innerHTML = `
        <tr><td colspan="5" style="text-align:center; padding: 2rem;">No items in basket</td></tr>
      `;
      return;
    }

    basketItemsList.innerHTML = "";
    state.basket.forEach(item => {
      const p = item.matchedProduct;
      const row = document.createElement("div");
      row.className = "basket-item-row";

      row.innerHTML = `
        <div class="basket-item-info">
          <div class="basket-item-title">${p ? p.name : item.query}</div>
          <div class="basket-item-matched">Matched: ${p ? `${p.line} (${p.size_ml} ml)` : "Custom Item"}</div>
        </div>
        <div class="basket-item-qty">
          <button class="qty-btn btn-minus" data-id="${item.id}">-</button>
          <span style="font-size: 0.85rem; font-weight: 700; min-width: 20px; text-align: center;">${item.quantity}</span>
          <button class="qty-btn btn-plus" data-id="${item.id}">+</button>
        </div>
        <button class="btn-remove-item" data-id="${item.id}" title="Remove item">&times;</button>
      `;

      // Handlers
      row.querySelector(".btn-plus").addEventListener("click", () => {
        item.quantity += 1;
        renderSmartBasket();
      });
      row.querySelector(".btn-minus").addEventListener("click", () => {
        if (item.quantity > 1) {
          item.quantity -= 1;
        } else {
          state.basket = state.basket.filter(b => b.id !== item.id);
        }
        renderSmartBasket();
        renderCatalog();
      });
      row.querySelector(".btn-remove-item").addEventListener("click", () => {
        state.basket = state.basket.filter(b => b.id !== item.id);
        renderSmartBasket();
        renderCatalog();
      });

      basketItemsList.appendChild(row);
    });

    // 2. Calculate Cross-Store Totals
    const storesList = ["Cocooncenter", "Easyparapharmacie", "DocMorris", "Newpharma"];
    const storeSummary = {};

    storesList.forEach(storeName => {
      let totalCost = 0;
      let regularCost = 0;
      let inStockCount = 0;
      let totalDiscountedCount = 0;

      state.basket.forEach(item => {
        const p = item.matchedProduct;
        if (!p) return;

        const storeOffer = p.stores.find(s => s.store_name === storeName);
        if (storeOffer && storeOffer.in_stock) {
          inStockCount += 1;
          totalCost += storeOffer.promo_price * item.quantity;
          regularCost += storeOffer.regular_price * item.quantity;
          if (storeOffer.discount_pct > 0) {
            totalDiscountedCount += 1;
          }
        } else {
          // If out of stock, assume regular price placeholder for fair penalty
          totalCost += (p.best_regular_price || 20) * item.quantity;
          regularCost += (p.best_regular_price || 20) * item.quantity;
        }
      });

      storeSummary[storeName] = {
        name: storeName,
        totalCost: totalCost,
        savings: Math.max(0, regularCost - totalCost),
        inStockCount: inStockCount,
        allInStock: inStockCount === state.basket.length,
        totalDiscountedCount: totalDiscountedCount
      };
    });

    // Find Winner (Cheapest store that has the items)
    const validStores = Object.values(storeSummary);
    validStores.sort((a, b) => {
      // Prioritize all in stock, then lowest total cost
      if (a.allInStock && !b.allInStock) return -1;
      if (!a.allInStock && b.allInStock) return 1;
      return a.totalCost - b.totalCost;
    });

    const winnerStoreName = validStores[0].name;

    // Render Store Comparison Cards
    storeComparisonsGrid.innerHTML = "";
    storesList.forEach(storeName => {
      const summary = storeSummary[storeName];
      const isWinner = storeName === winnerStoreName;

      const card = document.createElement("div");
      card.className = `store-card ${isWinner ? "winner" : ""}`;

      card.innerHTML = `
        ${isWinner ? `<div class="winner-banner">👑 CHEAPEST TOTAL BASKET</div>` : ""}
        <div class="store-card-header">
          <div class="store-card-name">${storeName}</div>
          <span class="store-card-country">${storeName === "DocMorris" ? "DE" : storeName === "Newpharma" ? "BE" : "FR"}</span>
        </div>
        
        <div class="store-total-price">€${summary.totalCost.toFixed(2)}</div>
        <div class="store-savings-tag">Total Saved: €${summary.savings.toFixed(2)}</div>
        
        <div class="store-stock-status ${summary.allInStock ? "status-all-in-stock" : "status-missing-items"}">
          ${summary.allInStock 
            ? `✓ All ${summary.inStockCount}/${state.basket.length} Items Available (${summary.totalDiscountedCount} on Promo)` 
            : `⚠ Missing ${state.basket.length - summary.inStockCount} item(s) in stock`}
        </div>

        <button class="btn-primary" style="width:100%; font-size: 0.8rem; padding: 0.5rem;" onclick="window.open('${storeName === "Cocooncenter" ? "https://www.cocooncenter.com/marques/avene.html" : "#"}', '_blank')">
          Checkout at ${storeName} ↗
        </button>
      `;

      storeComparisonsGrid.appendChild(card);
    });

    // 3. Render Itemized Matrix Table
    matrixTableBody.innerHTML = "";
    state.basket.forEach(item => {
      const p = item.matchedProduct;
      const row = document.createElement("tr");

      // Find lowest price for this specific item across all stores
      let minItemPrice = 99999;
      storesList.forEach(sName => {
        const off = p.stores.find(s => s.store_name === sName);
        if (off && off.in_stock && off.promo_price < minItemPrice) {
          minItemPrice = off.promo_price;
        }
      });

      let storeCells = "";
      storesList.forEach(sName => {
        const off = p.stores.find(s => s.store_name === sName);
        if (off && off.in_stock) {
          const isBest = Math.abs(off.promo_price - minItemPrice) < 0.01;
          storeCells += `
            <td class="${isBest ? "best-price-cell" : ""}">
              €${(off.promo_price * item.quantity).toFixed(2)}
              ${off.discount_pct > 0 ? `<br><small style="color:#e11d48">(-${off.discount_pct}%)</small>` : ""}
            </td>
          `;
        } else {
          storeCells += `<td style="color: #94a3b8;">Out of stock</td>`;
        }
      });

      row.innerHTML = `
        <td>
          <strong>${p.name}</strong>
          <br><small style="color: #64748b;">Qty: ${item.quantity} × ${p.size_ml}ml</small>
        </td>
        ${storeCells}
      `;

      matrixTableBody.appendChild(row);
    });
  }

  // Add Item via Custom Input Form
  addItemBtn.addEventListener("click", () => {
    const text = customItemInput.value.trim();
    if (!text) return;

    const matched = findBestMatch(text);
    state.basket.push({
      id: `item-${Date.now()}`,
      query: text,
      matchedProduct: matched,
      quantity: 1
    });

    customItemInput.value = "";
    renderSmartBasket();
    showToast(`Added "${matched ? matched.name.slice(0, 30) : text}..." to basket`);
  });

  customItemInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      addItemBtn.click();
    }
  });

  // Presets Handlers
  document.querySelectorAll(".preset-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const presetType = pill.getAttribute("data-preset");

      if (presetType === "barrier") {
        const cicalfate100 = products.find(p => p.name.includes("Cicalfate + Crème Réparatrice Protectrice 100 ml"));
        const cicalfate40 = products.find(p => p.name.includes("Cicalfate + Crème Réparatrice Protectrice 40 ml"));
        state.basket = [
          { id: "b-1", query: "Cicalfate+ 100ml", matchedProduct: cicalfate100, quantity: 1 },
          { id: "b-2", query: "Cicalfate+ 40ml", matchedProduct: cicalfate40, quantity: 1 }
        ];
        showToast("Loaded Barrier Repair Routine!");
      } else if (presetType === "hydration") {
        const hydranceRiche = products.find(p => p.name.includes("Hydrance Riche Crème Hydratante 40 ml"));
        const hydranceAqua = products.find(p => p.name.includes("Hydrance Aqua Gel-Crème Hydratant 50 ml"));
        state.basket = [
          { id: "h-1", query: "Hydrance Riche", matchedProduct: hydranceRiche, quantity: 1 },
          { id: "h-2", query: "Hydrance Aqua Gel", matchedProduct: hydranceAqua, quantity: 1 }
        ];
        showToast("Loaded 24H Intense Hydration Routine!");
      } else if (presetType === "antiaging") {
        const haNuit = products.find(p => p.name.includes("Hyaluron Activ B3 Crème Multi-Intensive Nuit"));
        const haDay = products.find(p => p.name.includes("Hyaluron Activ B3 Crème Régénération Cellulaire 50 ml"));
        state.basket = [
          { id: "a-1", query: "Hyaluron Activ B3 Night", matchedProduct: haNuit, quantity: 1 },
          { id: "a-2", query: "Hyaluron Activ B3 Day", matchedProduct: haDay, quantity: 1 }
        ];
        showToast("Loaded Anti-Aging Cell Regeneration Duo!");
      } else if (presetType === "dryness") {
        const xeracalmBalm = products.find(p => p.name.includes("XeraCalm AD Baume Relipidant 400 ml"));
        const xeracalmSooth = products.find(p => p.name.includes("XeraCalm AD Concentré Apaisant 40 ml"));
        state.basket = [
          { id: "x-1", query: "XeraCalm Balm 400ml", matchedProduct: xeracalmBalm, quantity: 1 },
          { id: "x-2", query: "XeraCalm Soothing Concentrate", matchedProduct: xeracalmSooth, quantity: 1 }
        ];
        showToast("Loaded Eczema & Dryness Relief Kit!");
      }

      setTab("basket");
    });
  });

  // Initial Load
  renderLinePills();
  renderCatalog();
  updateBasketBadge();
});
