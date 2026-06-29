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

function yen(value) {
  if (!isFinite(value) || value <= 0) return "¥0";
  return "¥" + Math.round(value).toLocaleString("ja-JP");
}

function num(value) {
  return Number(String(value || "").replace(/[¥,\s]/g, "")) || 0;
}

function buildPriceGrid() {
  const grid = document.getElementById("priceGrid");
  grid.innerHTML = "";

  SHOP_ORDER.forEach((shop) => {
    const row = document.createElement("div");
    row.className = "priceRow";
    row.dataset.shop = shop;
    row.innerHTML = `
      <div class="shopName">${shop}</div>
      <div class="priceFields">
        <input class="price" inputmode="numeric" placeholder="Price">
        <input class="ship" inputmode="numeric" placeholder="Shipping">
        <input class="tax" inputmode="numeric" placeholder="Duty / Tax">
        <input class="coupon" inputmode="numeric" placeholder="Coupon">
      </div>
      <div class="totalsBox">
        <div class="total">¥0</div>
        <div class="diff"></div>
      </div>
    `;
    grid.appendChild(row);
  });

  document.querySelectorAll(".priceRow input").forEach((input) => {
    input.addEventListener("input", calcPrices);
  });
}

function calcPrices() {
  let best = Infinity;
  let bestShop = "";
  const rows = [...document.querySelectorAll(".priceRow")];

  rows.forEach((row) => {
    const total =
      num(row.querySelector(".price").value) +
      num(row.querySelector(".ship").value) +
      num(row.querySelector(".tax").value) -
      num(row.querySelector(".coupon").value);

    row.dataset.total = total;
    row.querySelector(".total").textContent = yen(total);
    row.classList.remove("best");

    if (total > 0 && total < best) {
      best = total;
      bestShop = row.dataset.shop;
    }
  });

  rows.forEach((row) => {
    const total = Number(row.dataset.total);
    const diff = row.querySelector(".diff");

    if (total > 0 && total === best) {
      row.classList.add("best");
      diff.textContent = "Best";
    } else if (total > 0 && best < Infinity) {
      diff.textContent = "+" + yen(total - best);
    } else {
      diff.textContent = "";
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

document.getElementById("calcPrices").onclick = calcPrices;
document.getElementById("clearPrices").onclick = () => {
  document.getElementById("compareMemo").value = "";
  document.querySelectorAll(".priceRow input").forEach((input) => {
    input.value = "";
  });
  calcPrices();
};

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
