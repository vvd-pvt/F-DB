const SETTINGS_KEY = "fdb_v8_settings";
const THEME_KEY = "fdb_v8_theme";
const SHOP_ORDER = ["END", "SSENSE", "FARFETCH", "YOOX", "HBX"];

let DB = null;
let state = loadState();
let filters = { tier: "Core", category: "All", country: "All", showHidden: false };

async function loadDB() {
  const response = await fetch("brand_db.json", { cache: "no-store" });
  DB = await response.json();
  init();
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveState() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
}

function userFor(name) {
  return state[name] || { favorite: 3, hidden: false, memo: "" };
}

function updateUser(name, patch) {
  state[name] = { ...userFor(name), ...patch };
  saveState();
}

function applyTheme() {
  const theme = localStorage.getItem(THEME_KEY) || "dark";
  document.body.classList.toggle("light", theme === "light");
  document.getElementById("themeToggle").textContent = theme === "light" ? "Dark" : "Light";
}

document.getElementById("themeToggle").onclick = () => {
  const next = document.body.classList.contains("light") ? "dark" : "light";
  localStorage.setItem(THEME_KEY, next);
  applyTheme();
};

function setMainTab(name) {
  ["Search", "Compare", "Brands"].forEach((tab) => {
    document.getElementById("tab" + tab).classList.toggle("active", tab === name);
    document.getElementById("view" + tab).style.display = tab === name ? "" : "none";
  });
}

["Search", "Compare", "Brands"].forEach((tab) => {
  document.getElementById("tab" + tab).onclick = () => setMainTab(tab);
});

function productUrl(shop, query) {
  const q = encodeURIComponent(query.trim().toLowerCase());
  if (!q) return "#";

  const urls = {
    END: `https://www.endclothing.com/jp/catalogsearch/results?q=${q}`,
    SSENSE: `https://www.ssense.com/ja-jp/men?q=${q}`,
    FARFETCH: `https://www.farfetch.com/jp/shopping/men/search/items.aspx?q=${q}`,
    YOOX: `https://www.yoox.com/jp/メンズ/shoponline?textsearch=${q}`,
    HBX: `https://hbx.com/jp/search?q=${q}`
  };

  return urls[shop] || "#";
}

function renderProductLinks() {
  const q = document.getElementById("productSearch").value;
  const wrap = document.getElementById("productLinks");
  wrap.innerHTML = "";

  SHOP_ORDER.forEach((shop) => {
    const a = document.createElement("a");
    a.className = "searchLink";
    a.textContent = shop;
    a.href = productUrl(shop, q);
    a.target = "_blank";
    wrap.appendChild(a);
  });
}

document.getElementById("productSearch").addEventListener("input", renderProductLinks);
document.getElementById("productSearch").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const first = document.querySelector("#productLinks a");
    if (first && first.href !== "#") window.open(first.href, "_blank");
  }
});


const COMPARE_SETTINGS_KEY = "fdb_v9_compare_settings";

function defaultCompareSettings() {
  return {
    END: { ship: 2500, tax: 0, coupon: 0 },
    SSENSE: { ship: 3500, tax: 0, coupon: 0 },
    FARFETCH: { ship: 0, tax: 0, coupon: 0 },
    YOOX: { ship: 2500, tax: 0, coupon: 0 },
    HBX: { ship: 3000, tax: 0, coupon: 0 }
  };
}

function loadCompareSettings() {
  try {
    return { ...defaultCompareSettings(), ...(JSON.parse(localStorage.getItem(COMPARE_SETTINGS_KEY)) || {}) };
  } catch (e) {
    return defaultCompareSettings();
  }
}

function saveCompareSettings() {
  const data = defaultCompareSettings();
  document.querySelectorAll(".compareSettingRow").forEach((row) => {
    const shop = row.dataset.shop;
    data[shop] = {
      ship: num(row.querySelector(".ship").value),
      tax: num(row.querySelector(".tax").value),
      coupon: num(row.querySelector(".coupon").value)
    };
  });
  localStorage.setItem(COMPARE_SETTINGS_KEY, JSON.stringify(data));
}

function renderCompareProductLinks() {
  const input = document.getElementById("compareMemo");
  const wrap = document.getElementById("compareProductLinks");
  if (!input || !wrap) return;

  const q = input.value;
  wrap.innerHTML = "";

  SHOP_ORDER.forEach((shop) => {
    const a = document.createElement("a");
    a.className = "searchLink";
    a.textContent = shop;
    a.href = productUrl(shop, q);
    a.target = "_blank";
    wrap.appendChild(a);
  });
}

function yen(value) {
  if (!isFinite(value) || value <= 0) return "¥0";
  return "¥" + Math.round(value).toLocaleString("ja-JP");
}

function num(value) {
  return Number(String(value || "").replace(/[¥,\s]/g, "")) || 0;
}

function buildPriceGrid() {
  const panel = document.getElementById("viewCompare").querySelector(".panel");
  panel.innerHTML = `
    <div class="sectionTitle">Price Compare</div>

    <div class="compareV9Intro">
      <input id="compareMemo" placeholder="Product: Maison Margiela Replica">
      <div class="compareLinks" id="compareProductLinks"></div>
      <p class="note">Search links update from the product name. Then enter prices only.</p>
    </div>

    <div class="bestSummary" id="bestSummary"></div>

    <div class="compareTable" id="priceGrid"></div>

    <details class="compareSettings">
      <summary>Shipping / Duty / Coupon Settings</summary>
      <div class="compareSettingGrid" id="compareSettingGrid"></div>
      <p class="note">These values are saved locally. Usually you only change item prices.</p>
    </details>

    <div class="compareActions">
      <button id="calcPrices" class="primary">Calculate</button>
      <button id="clearPrices">Clear Prices</button>
      <button id="resetCompareSettings">Reset Settings</button>
    </div>

    <p class="note">Total = Price + Shipping + Duty / Tax - Coupon.</p>
  `;

  const grid = document.getElementById("priceGrid");
  const settingsGrid = document.getElementById("compareSettingGrid");
  const saved = loadCompareSettings();

  SHOP_ORDER.forEach((shop) => {
    const row = document.createElement("div");
    row.className = "compareRowV9";
    row.dataset.shop = shop;
    row.innerHTML = `
      <div class="compareShop">${shop}</div>
      <input class="comparePriceInput price" inputmode="numeric" placeholder="Price">
      <div class="compareTotalBox">
        <div class="compareTotal">¥0</div>
        <div class="compareBreakdown"></div>
      </div>
    `;
    grid.appendChild(row);

    const setting = document.createElement("div");
    setting.className = "compareSettingRow";
    setting.dataset.shop = shop;
    setting.innerHTML = `
      <label>${shop}</label>
      <input class="ship" inputmode="numeric" placeholder="Shipping" value="${saved[shop].ship}">
      <input class="tax" inputmode="numeric" placeholder="Duty / Tax" value="${saved[shop].tax}">
      <input class="coupon" inputmode="numeric" placeholder="Coupon" value="${saved[shop].coupon}">
    `;
    settingsGrid.appendChild(setting);
  });

  document.querySelectorAll(".comparePriceInput").forEach((input, index, all) => {
    input.addEventListener("input", calcPrices);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === "Tab") {
        if (event.key === "Enter") event.preventDefault();
        const next = all[index + 1];
        if (next) next.focus();
        else calcPrices();
      }
    });
  });

  document.querySelectorAll(".compareSettingRow input").forEach((input) => {
    input.addEventListener("input", () => {
      saveCompareSettings();
      calcPrices();
    });
  });

  document.getElementById("compareMemo").addEventListener("input", renderCompareProductLinks);
  document.getElementById("compareMemo").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const first = document.querySelector("#compareProductLinks a");
      if (first && first.href !== "#") window.open(first.href, "_blank");
    }
  });

  document.getElementById("calcPrices").onclick = calcPrices;
  document.getElementById("clearPrices").onclick = () => {
    document.querySelectorAll(".comparePriceInput").forEach((input) => {
      input.value = "";
    });
    calcPrices();
    const first = document.querySelector(".comparePriceInput");
    if (first) first.focus();
  };
  document.getElementById("resetCompareSettings").onclick = () => {
    localStorage.removeItem(COMPARE_SETTINGS_KEY);
    buildPriceGrid();
    calcPrices();
  };

  renderCompareProductLinks();
  calcPrices();
}

function calcPrices() {
  let best = Infinity;
  let bestShop = "";
  const rows = [...document.querySelectorAll(".compareRowV9")];

  rows.forEach((row) => {
    const shop = row.dataset.shop;
    const settings = document.querySelector(`.compareSettingRow[data-shop="${shop}"]`);
    const price = num(row.querySelector(".price").value);
    const ship = settings ? num(settings.querySelector(".ship").value) : 0;
    const tax = settings ? num(settings.querySelector(".tax").value) : 0;
    const coupon = settings ? num(settings.querySelector(".coupon").value) : 0;
    const total = price + ship + tax - coupon;

    row.dataset.total = total;
    row.classList.remove("best");
    row.querySelector(".compareTotal").textContent = yen(total);
    row.querySelector(".compareBreakdown").textContent =
      price > 0 ? `Ship ${yen(ship)} / Tax ${yen(tax)} / Coupon -${yen(coupon)}` : "";

    if (price > 0 && total > 0 && total < best) {
      best = total;
      bestShop = shop;
    }
  });

  rows.forEach((row) => {
    const total = Number(row.dataset.total);
    const breakdown = row.querySelector(".compareBreakdown");

    if (total > 0 && total === best) {
      row.classList.add("best");
      breakdown.textContent = "Best · " + breakdown.textContent;
    } else if (total > 0 && best < Infinity) {
      breakdown.textContent = "+" + yen(total - best) + " · " + breakdown.textContent;
    }
  });

  const summary = document.getElementById("bestSummary");

  if (bestShop) {
    summary.textContent = `BEST PRICE: ${bestShop} · ${yen(best)}`;
    summary.classList.add("show");
  } else {
    summary.textContent = "";
    summary.classList.remove("show");
  }
}


function countryLabel(country) {
  return DB.countryLabels && DB.countryLabels[country] ? DB.countryLabels[country] : country;
}

function categoryList() {
  return ["Modern", "Street", "Accessories"].filter((category) =>
    DB.brands.some((brand) => brand.categories.includes(category))
  );
}

function countryList() {
  return (DB.countryOrder || []).filter((country) =>
    DB.brands.some((brand) => brand.countryGroup === country)
  );
}

function makeChip(parent, label, value, key) {
  const button = document.createElement("button");
  button.className = "chip" + (filters[key] === value ? " active" : "");
  button.textContent = label;
  button.onclick = () => {
    filters[key] = value;
    renderBrands();
  };
  parent.appendChild(button);
}

function renderFilterChips() {
  document.querySelectorAll("[data-tier]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tier === filters.tier);
  });

  const categoryWrap = document.getElementById("categoryChips");
  categoryWrap.innerHTML = "";
  makeChip(categoryWrap, "All Categories", "All", "category");
  categoryList().forEach((category) => makeChip(categoryWrap, category, category, "category"));

  const countryWrap = document.getElementById("countryChips");
  countryWrap.innerHTML = "";
  makeChip(countryWrap, "All Countries", "All", "country");
  countryList().forEach((country) => makeChip(countryWrap, countryLabel(country), country, "country"));

  document.getElementById("showHidden").classList.toggle("active", filters.showHidden);
}

document.querySelectorAll("[data-tier]").forEach((button) => {
  button.onclick = () => {
    filters.tier = button.dataset.tier;
    renderBrands();
  };
});

document.getElementById("showHidden").onclick = () => {
  filters.showHidden = !filters.showHidden;
  renderBrands();
};

function displayTier(tier) {
  return tier === "コア" ? "Core" : "Candidate";
}

function starHtml(value) {
  let html = "";
  for (let i = 1; i <= 5; i++) {
    html += `<span class="star ${i <= value ? "on" : ""}" data-star="${i}">★</span>`;
  }
  return html;
}

function filteredBrands() {
  return DB.brands
    .filter((brand) => {
      const user = userFor(brand.name);

      if (!filters.showHidden && user.hidden) return false;
      if (filters.tier !== "All" && displayTier(brand.tier) !== filters.tier) return false;
      if (filters.category !== "All" && !brand.categories.includes(filters.category)) return false;
      if (filters.country !== "All" && brand.countryGroup !== filters.country) return false;

      return true;
    })
    .sort((a, b) => {
      const fa = userFor(a.name).favorite || 3;
      const fb = userFor(b.name).favorite || 3;
      const order = DB.countryOrder || [];
      const ca = order.indexOf(a.countryGroup);
      const cb = order.indexOf(b.countryGroup);

      return (
        fb - fa ||
        (ca === -1 ? 999 : ca) - (cb === -1 ? 999 : cb) ||
        a.name.localeCompare(b.name)
      );
    });
}

function brandSearchLinks(brand, value) {
  const query = (brand + " " + (value || "")).trim();

  return SHOP_ORDER.map((shop) => {
    return `<a class="searchLink" target="_blank" href="${productUrl(shop, query)}">${shop}</a>`;
  }).join("");
}

function renderBrands() {
  renderFilterChips();

  const list = document.getElementById("brandList");
  list.innerHTML = "";

  const brands = filteredBrands();
  document.getElementById("brandCount").textContent = `${brands.length} brands`;

  brands.forEach((brand, index) => {
    const user = userFor(brand.name);
    const card = document.createElement("article");
    card.className =
      "brandCard" +
      (displayTier(brand.tier) === "Candidate" ? " candidate" : "") +
      (user.hidden ? " hiddenCard" : "");

    const shopLinks = (brand.shopPriority || SHOP_ORDER)
      .map((shop) => {
        const data = brand.shops[shop] || { url: "#" };
        return `<a class="shopLink" href="${data.url}" target="_blank">${shop}</a>`;
      })
      .join("");

    const searchId = "brandSearch_" + index;
    const linksId = "brandLinks_" + index;

    card.innerHTML = `
      <div class="brandTop">
        <div>
          <div class="brandName">${brand.name}<span class="badge">${displayTier(brand.tier)}</span></div>
          <div class="meta">${brand.countryLabel || brand.country} / ${brand.categories.join(", ")}</div>
        </div>
        <div class="stars">${starHtml(user.favorite || 3)}</div>
      </div>

      <div class="brandShops">${shopLinks}</div>

      <div class="brandSearch">
        <input id="${searchId}" placeholder="Search within ${brand.name}: item name">
        <div class="rowButtons" id="${linksId}">${brandSearchLinks(brand.name, "")}</div>
      </div>

      <div class="controls">
        <button class="tierToggle">${displayTier(brand.tier) === "Core" ? "To Candidate" : "To Core"}</button>
        <button class="hideToggle">${user.hidden ? "Show" : "Hide"}</button>
        <button class="memoToggle">Memo</button>
      </div>

      <div class="memo">
        <textarea placeholder="Memo: size, sale timing, notes">${user.memo || brand.memo || ""}</textarea>
      </div>
    `;

    card.querySelectorAll(".star").forEach((star) => {
      star.onclick = () => {
        updateUser(brand.name, { favorite: Number(star.dataset.star) });
        renderBrands();
      };
    });

    card.querySelector("#" + searchId).addEventListener("input", (event) => {
      card.querySelector("#" + linksId).innerHTML = brandSearchLinks(brand.name, event.target.value);
    });

    card.querySelector("#" + searchId).addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const first = card.querySelector("#" + linksId + " a");
        if (first) window.open(first.href, "_blank");
      }
    });

    card.querySelector(".tierToggle").onclick = () => {
      brand.tier = displayTier(brand.tier) === "Core" ? "候補" : "コア";
      renderBrands();
    };

    card.querySelector(".hideToggle").onclick = () => {
      updateUser(brand.name, { hidden: !user.hidden });
      renderBrands();
    };

    const memo = card.querySelector(".memo");
    card.querySelector(".memoToggle").onclick = () => memo.classList.toggle("open");

    card.querySelector("textarea").oninput = (event) => {
      updateUser(brand.name, { memo: event.target.value });
    };

    list.appendChild(card);
  });
}

function init() {
  applyTheme();
  renderProductLinks();
  buildPriceGrid();
  renderBrands();
}

loadDB();
