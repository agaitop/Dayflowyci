"use strict";

const STORAGE_KEY = "dayflow_tasks_v1";
const FOOD_KEY = "dayflow_food_log_v1";
const CUSTOM_KEY = "dayflow_custom_products_v1";
const GOALS_KEY = "dayflow_nutrition_goals";

const CATEGORIES = {
  study:    { label: "Учёба",   icon: "i-book" },
  sport:    { label: "Спорт",   icon: "i-bolt" },
  work:     { label: "Работа",  icon: "i-case" },
  rest:     { label: "Отдых",   icon: "i-smile" },
  personal: { label: "Личное",  icon: "i-heart" },
  ideas:    { label: "Идеи",    icon: "i-star" }
};

const STATUSES = {
  todo:      { label: "Не начато",  cls: "st-todo",      color: "#9aa2b1" },
  doing:     { label: "В процессе", cls: "st-doing",     color: "#4388e8" },
  done:      { label: "Выполнено",  cls: "st-done",      color: "#20a36a" },
  cancelled: { label: "Отменено",   cls: "st-cancelled", color: "#df5555" }
};

const PRIORITIES = {
  high:   { label: "Высокий", cls: "pr-high",   order: 0 },
  normal: { label: "Обычный", cls: "pr-normal", order: 1 },
  low:    { label: "Низкий",  cls: "pr-low",    order: 2 }
};

/* ===== БАЗА ПРОДУКТОВ (на 100 г) ===== */
const FOOD_DB = [
  { id: "chicken",  name: "Куриная грудка",   cat: "meat",    kcal: 165, p: 31,   f: 3.6,  c: 0 },
  { id: "beef",     name: "Говядина",         cat: "meat",    kcal: 187, p: 18.9, f: 12.4, c: 0 },
  { id: "egg",      name: "Яйцо куриное",     cat: "meat",    kcal: 157, p: 12.7, f: 11.5, c: 0.7 },
  { id: "salmon",   name: "Лосось",           cat: "fish",    kcal: 208, p: 20,   f: 13,   c: 0 },
  { id: "tuna",     name: "Тунец консерв.",   cat: "fish",    kcal: 96,  p: 21,   f: 1,    c: 0 },
  { id: "rice",     name: "Рис (сухой)",      cat: "grains",  kcal: 344, p: 6.7,  f: 0.7,  c: 78.9 },
  { id: "buckwheat",name: "Гречка (сухая)",   cat: "grains",  kcal: 343, p: 12.6, f: 3.3,  c: 71.5 },
  { id: "oats",     name: "Овсянка (сухая)",  cat: "grains",  kcal: 366, p: 11.9, f: 7.2,  c: 69.3 },
  { id: "pasta",    name: "Макароны (сухие)", cat: "grains",  kcal: 350, p: 12,   f: 1.5,  c: 70 },
  { id: "bread",    name: "Хлеб цельнозерн.", cat: "grains",  kcal: 247, p: 13,   f: 3.4,  c: 41 },
  { id: "milk",     name: "Молоко 2.5%",      cat: "dairy",   kcal: 52,  p: 2.8,  f: 2.5,  c: 4.7 },
  { id: "cottage",  name: "Творог 5%",        cat: "dairy",   kcal: 121, p: 17.2, f: 5,    c: 1.8 },
  { id: "yogurt",   name: "Йогурт натур.",    cat: "dairy",   kcal: 60,  p: 4,    f: 1.5,  c: 7 },
  { id: "cheese",   name: "Сыр твёрдый",      cat: "dairy",   kcal: 364, p: 24,   f: 29,   c: 0.3 },
  { id: "kefir",    name: "Кефир 1%",         cat: "dairy",   kcal: 40,  p: 3,    f: 1,    c: 4 },
  { id: "banana",   name: "Банан",            cat: "fruit",   kcal: 95,  p: 1.5,  f: 0.2,  c: 21.8 },
  { id: "apple",    name: "Яблоко",           cat: "fruit",   kcal: 47,  p: 0.4,  f: 0.4,  c: 9.8 },
  { id: "orange",   name: "Апельсин",         cat: "fruit",   kcal: 43,  p: 0.9,  f: 0.2,  c: 8.1 },
  { id: "potato",   name: "Картофель",        cat: "veg",     kcal: 77,  p: 2,    f: 0.4,  c: 16.3 },
  { id: "tomato",   name: "Помидор",          cat: "veg",     kcal: 20,  p: 1.1,  f: 0.2,  c: 3.7 },
  { id: "cucumber", name: "Огурец",           cat: "veg",     kcal: 15,  p: 0.8,  f: 0.1,  c: 2.8 },
  { id: "broccoli", name: "Брокколи",         cat: "veg",     kcal: 34,  p: 2.8,  f: 0.4,  c: 6.6 },
  { id: "nuts",     name: "Орехи (микс)",     cat: "snacks",  kcal: 607, p: 20,   f: 54,   c: 21 },
  { id: "chocolate",name: "Шоколад тёмный",   cat: "snacks",  kcal: 546, p: 6.2,  f: 35,   c: 48 },
  { id: "honey",    name: "Мёд",              cat: "snacks",  kcal: 329, p: 0.8,  f: 0,    c: 81 },
  { id: "oil",      name: "Масло оливковое",  cat: "other",   kcal: 884, p: 0,    f: 100,  c: 0 },
  { id: "butter",   name: "Масло сливочное",  cat: "other",   kcal: 748, p: 0.5,  f: 82.5, c: 0.8 }
];

const FOOD_CATS = {
  meat: "Мясо и яйца", fish: "Рыба", grains: "Крупы и хлеб",
  dairy: "Молочное", fruit: "Фрукты", veg: "Овощи",
  snacks: "Снеки", other: "Другое", custom: "Мои продукты"
};

const MEALS = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин", snack: "Перекус" };

/* ===== ХЕЛПЕРЫ ===== */
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");
const dateISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => dateISO(new Date());
const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : "t-" + Date.now().toString(36) + "-" + Math.random().toString(16).slice(2);

function escapeHTML(v = "") {
  return String(v).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function readJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch { return fallback; }
}

function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { showToast("Хранилище переполнено", "error"); return false; }
}

/* ===== СОСТОЯНИЕ ===== */
let tasks = readJSON(STORAGE_KEY, []);
if (!Array.isArray(tasks)) tasks = [];
tasks = tasks
  .filter(t => t && typeof t.title === "string" && typeof t.date === "string")
  .map(t => ({
    id: typeof t.id === "string" ? t.id : uid(),
    title: t.title,
    description: t.description || "",
    category: CATEGORIES[t.category] ? t.category : "personal",
    date: t.date,
    time: t.time || "",
    priority: PRIORITIES[t.priority] ? t.priority : "normal",
    status: STATUSES[t.status] ? t.status : "todo",
    sportType: t.sportType || "",
    sportGoal: t.sportGoal || "",
    notified: !!t.notified,
    createdAt: t.createdAt || Date.now()
  }));

let foodLog = readJSON(FOOD_KEY, {});
if (typeof foodLog !== "object" || Array.isArray(foodLog)) foodLog = {};

let customProducts = readJSON(CUSTOM_KEY, []);
if (!Array.isArray(customProducts)) customProducts = [];

const goalsRaw = readJSON(GOALS_KEY, null);
let nutritionGoals = {
  kcal: Number(goalsRaw?.kcal) > 0 ? Number(goalsRaw.kcal) : 2200,
  p:    Number(goalsRaw?.p)    > 0 ? Number(goalsRaw.p)    : 140,
  f:    Number(goalsRaw?.f)    > 0 ? Number(goalsRaw.f)    : 70,
  c:    Number(goalsRaw?.c)    > 0 ? Number(goalsRaw.c)    : 250
};

let selectedDate = todayISO();
let activeStatus = "all";
let searchQuery = "";
let sortMode = "priority";

const urlCat = new URLSearchParams(location.search).get("category");
let activeCategory = (urlCat && CATEGORIES[urlCat]) ? urlCat : "all";

function saveTasks() { writeJSON(STORAGE_KEY, tasks); }

function pluralTasks(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "задача";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "задачи";
  return "задач";
}

function formatDate(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("ru-RU",
    { day: "numeric", month: "long", year: "numeric" });
}

/* ===== УВЕДОМЛЕНИЯ ===== */
const TOAST_ICONS = { success: "i-check-circle", error: "i-x", info: "i-info", reminder: "i-clock" };

function showToast(message, type = "info", action = null) {
  const container = $("toast-container");
  if (!container) return;
  while (container.children.length >= 3) container.firstChild.remove();

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML =
    `<svg class="icon" aria-hidden="true"><use href="#${TOAST_ICONS[type] || "i-info"}"></use></svg>` +
    `<span>${escapeHTML(message)}</span>`;

  let removed = false;
  const dismiss = () => {
    if (removed) return;
    removed = true;
    toast.style.animation = "toastOut .25s forwards";
    setTimeout(() => toast.remove(), 260);
  };

  if (action) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast-action";
    btn.textContent = action.label;
    btn.addEventListener("click", () => { action.onClick(); dismiss(); });
    toast.appendChild(btn);
  }

  container.appendChild(toast);
  setTimeout(dismiss, action ? 6000 : 3500);
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function sendBrowserNotification(title, body) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch { /* iOS без PWA */ }
}

function checkReminders() {
  const today = todayISO();
  const time = nowTime();
  let changed = false;

  tasks.forEach(t => {
    if (t.date === today && t.time && !t.notified &&
        (t.status === "todo" || t.status === "doing") && t.time <= time) {
      showToast(`Напоминание: ${t.title}`, "reminder");
      sendBrowserNotification("DayFlow — напоминание", `Пора начать: ${t.title}`);
      t.notified = true;
      changed = true;
    }
  });

  if (changed) { saveTasks(); renderTasks(); }
}

/* ===== ТЕМА ===== */
function applyTheme() {
  const dark = localStorage.getItem("dayflow_theme") === "dark";
  document.body.classList.toggle("dark", dark);
  document.querySelectorAll(".icon-moon").forEach(el => el.classList.toggle("hidden", dark));
  document.querySelectorAll(".icon-sun").forEach(el => el.classList.toggle("hidden", !dark));
  const label = $("themeLabel");
  if (label) label.textContent = dark ? "Светлая тема" : "Тёмная тема";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#111a27" : "#f3f5f8");
}

function toggleTheme() {
  localStorage.setItem("dayflow_theme",
    document.body.classList.contains("dark") ? "light" : "dark");
  applyTheme();
  showToast("Тема изменена", "success");
}

/* ===== РЕНДЕР ЗАДАЧ ===== */
function setTxt(id, val) { const el = $(id); if (el) el.textContent = val; }

function renderWeekStrip() {
  const strip = $("weekStrip");
  if (!strip) return;
  const sel = new Date(selectedDate + "T12:00:00");
  const mon = new Date(sel);
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const today = todayISO();

  strip.innerHTML = names.map((name, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    const iso = dateISO(d);
    const count = tasks.filter(t => t.date === iso).length;
    const cls = ["week-day",
      iso === selectedDate ? "selected" : "",
      iso === today ? "is-today" : ""].filter(Boolean).join(" ");
    return `<button type="button" class="${cls}" data-week-date="${iso}">
      <span>${name}</span><strong>${d.getDate()}</strong><small>${count || "—"}</small>
    </button>`;
  }).join("");
}

function sortTasks(list) {
  const arr = [...list];
  if (sortMode === "time") arr.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
  else if (sortMode === "title") arr.sort((a, b) => a.title.localeCompare(b.title, "ru"));
  else if (sortMode === "created") arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  else arr.sort((a, b) =>
    (PRIORITIES[a.priority].order - PRIORITIES[b.priority].order) ||
    (a.time || "99:99").localeCompare(b.time || "99:99"));
  return arr;
}

function renderTasks() {
  const list = $("taskList");
  if (!list) return;

  const dayTasks = tasks.filter(t => t.date === selectedDate);
  const q = searchQuery.toLowerCase();
  const filtered = sortTasks(dayTasks.filter(t => {
    const okStatus = activeStatus === "all" || t.status === activeStatus;
    const okCat = activeCategory === "all" || t.category === activeCategory;
    const okSearch = !q || [t.title, t.description, t.sportType, t.sportGoal]
      .some(v => String(v || "").toLowerCase().includes(q));
    return okStatus && okCat && okSearch;
  }));

  const done = dayTasks.filter(t => t.status === "done").length;
  const doing = dayTasks.filter(t => t.status === "doing").length;
  const todo = dayTasks.filter(t => t.status === "todo").length;

  setTxt("totalCount", dayTasks.length);
  setTxt("doneCount", done);
  setTxt("progressCount", doing);
  setTxt("remainingCount", todo);

  const pct = dayTasks.length ? Math.round(done / dayTasks.length * 100) : 0;
  setTxt("progressPercent", pct + "%");
  const bar = $("progressBar"); if (bar) bar.style.width = pct + "%";
  setTxt("taskCountHint", `Показано ${filtered.length} из ${dayTasks.length}`);

  list.innerHTML = filtered.map(t => {
    const cat = CATEGORIES[t.category];
    const st = STATUSES[t.status];
    const pr = PRIORITIES[t.priority];
    const sport = t.category === "sport" && (t.sportType || t.sportGoal)
      ? `<div class="task-description">${escapeHTML(t.sportType || "Активность")}${t.sportGoal ? " · цель: " + escapeHTML(t.sportGoal) : ""}</div>` : "";

    return `<article class="task-item">
      <div class="task-color" style="background:${st.color}"></div>
      <div class="task-main">
        <div class="task-title">${escapeHTML(t.title)}</div>
        ${t.description ? `<div class="task-description">${escapeHTML(t.description)}</div>` : ""}${sport}
        <div class="task-meta">
          <span class="pill cat-${t.category}">${cat.label}</span>
          <span class="pill ${st.cls}">${st.label}</span>
          <span class="pill ${pr.cls}">${pr.label}</span>
          ${t.time ? `<span class="task-time"><svg class="icon"><use href="#i-clock"></use></svg>${escapeHTML(t.time)}</span>` : ""}
        </div>
      </div>
      <div class="task-actions">
        <select class="status-select" aria-label="Статус задачи" data-status-id="${t.id}">
          ${Object.entries(STATUSES).map(([key, s]) =>
            `<option value="${key}" ${t.status === key ? "selected" : ""}>${s.label}</option>`).join("")}
        </select>
        <button type="button" class="mini-action" title="Изменить" aria-label="Изменить задачу" data-edit-id="${t.id}">
          <svg class="icon"><use href="#i-edit"></use></svg>
        </button>
        <button type="button" class="mini-action delete-action" title="Удалить" aria-label="Удалить задачу" data-delete-id="${t.id}">
          <svg class="icon"><use href="#i-trash"></use></svg>
        </button>
      </div>
    </article>`;
  }).join("");

  const empty = $("emptyState");
  if (empty) {
    const hasDay = dayTasks.length > 0;
    empty.classList.toggle("hidden", filtered.length > 0);
    list.classList.toggle("hidden", filtered.length === 0);
    const h = empty.querySelector("h3"), p = empty.querySelector("p");
    if (h && p) {
      h.textContent = hasDay ? "Ничего не найдено" : "Список пуст";
      p.textContent = hasDay ? "Попробуй изменить поиск или фильтры." : "Добавь первую задачу — она появится здесь.";
    }
  }

  setTxt("fullDate", "План · " + formatDate(selectedDate));
  renderWeekStrip();
}

function renderCategoryCounts() {
  Object.keys(CATEGORIES).forEach(key => {
    const el = $("count-" + key);
    if (el) {
      const n = tasks.filter(t => t.category === key).length;
      el.textContent = `${n} ${pluralTasks(n)}`;
    }
  });
}

function updateHeader() {
  setTxt("headerDate", new Date().toLocaleDateString("ru-RU",
    { weekday: "short", day: "numeric", month: "short" }));
  const g = $("greeting");
  if (g) {
    const h = new Date().getHours();
    const word = h >= 5 && h < 12 ? "Доброе утро"
      : h >= 12 && h < 18 ? "Добрый день"
      : h >= 18 && h < 23 ? "Добрый вечер" : "Доброй ночи";
    g.textContent = `${word}, Ибрагим.`;
  }
}

function updateNoteForDate() {
  const note = $("dailyNote");
  if (note) note.value = localStorage.getItem("dayflow_note_" + selectedDate) || "";
}

function setDate(date) {
  selectedDate = date;
  const inp = $("selectedDate"); if (inp) inp.value = date;
  renderTasks();
  updateNoteForDate();
  renderNutritionSummary();
}

/* ===== ПИТАНИЕ ===== */
function allProducts() {
  return [...FOOD_DB, ...customProducts.map(p => ({ ...p, cat: "custom" }))];
}

function dayTotals(iso) {
  const entries = foodLog[iso] || [];
  return entries.reduce((acc, e) => {
    acc.kcal += e.kcal; acc.p += e.p; acc.f += e.f; acc.c += e.c;
    return acc;
  }, { kcal: 0, p: 0, f: 0, c: 0 });
}

function renderNutritionSummary() {
  const el = $("nutritionSummary");
  if (!el) return;
  const t = dayTotals(selectedDate);
  el.textContent = `${Math.round(t.kcal)} / ${nutritionGoals.kcal} ккал`;
  const ring = $("kcalRingMini");
  if (ring) {
    const pct = Math.min(t.kcal / nutritionGoals.kcal, 1);
    ring.style.strokeDashoffset = String(100 * (1 - pct));
  }
}

function initNutritionPage() {
  const page = $("nutritionPage");
  if (!page) return;

  const dateInput = $("foodDate");
  if (dateInput) {
    dateInput.value = selectedDate;
    dateInput.addEventListener("change", e => {
      if (e.target.value) { selectedDate = e.target.value; renderNutritionPage(); }
    });
  }

  $("addFoodBtn")?.addEventListener("click", openFoodModal);
  $("goalsBtn")?.addEventListener("click", openGoalsModal);
  $("closeFoodModal")?.addEventListener("click", () => $("foodModal")?.classList.add("hidden"));
  $("cancelFoodModal")?.addEventListener("click", () => $("foodModal")?.classList.add("hidden"));
  $("foodModal")?.addEventListener("click", e => { if (e.target === $("foodModal")) $("foodModal").classList.add("hidden"); });
  $("closeGoalsModal")?.addEventListener("click", () => $("goalsModal")?.classList.add("hidden"));
  $("goalsModal")?.addEventListener("click", e => { if (e.target === $("goalsModal")) $("goalsModal").classList.add("hidden"); });

  $("foodSearch")?.addEventListener("input", renderFoodPicker);
  $("foodCatFilter")?.addEventListener("change", renderFoodPicker);

  $("foodForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const productId = $("foodProductSelect").value;
    const grams = Number($("foodGrams").value);
    const meal = $("foodMeal").value;
    const product = allProducts().find(p => p.id === productId);
    if (!product || !(grams > 0)) { showToast("Выбери продукт и граммы", "error"); return; }

    const k = grams / 100;
    const entry = {
      id: uid(), meal,
      name: product.name, grams,
      kcal: Math.round(product.kcal * k),
      p: +(product.p * k).toFixed(1),
      f: +(product.f * k).toFixed(1),
      c: +(product.c * k).toFixed(1),
      photo: pendingPhoto || ""
    };

    if (!foodLog[selectedDate]) foodLog[selectedDate] = [];
    foodLog[selectedDate].push(entry);
    if (writeJSON(FOOD_KEY, foodLog)) {
      showToast("Приём пищи добавлен", "success");
      pendingPhoto = "";
      $("foodModal").classList.add("hidden");
      renderNutritionPage();
    } else {
      foodLog[selectedDate].pop();
    }
  });

  $("customProductForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const name = $("cpName").value.trim();
    const kcal = Number($("cpKcal").value);
    if (name.length < 2 || !(kcal >= 0)) { showToast("Заполни название и калории", "error"); return; }
    customProducts.push({
      id: uid(), name,
      kcal,
      p: Number($("cpP").value) || 0,
      f: Number($("cpF").value) || 0,
      c: Number($("cpC").value) || 0
    });
    writeJSON(CUSTOM_KEY, customProducts);
    showToast("Продукт добавлен в твою базу", "success");
    $("customProductForm").reset();
    renderFoodPicker();
  });

  $("goalsForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const g = {
      kcal: Number($("goalKcal").value),
      p: Number($("goalP").value),
      f: Number($("goalF").value),
      c: Number($("goalC").value)
    };
    if (!(g.kcal > 0 && g.p > 0 && g.f > 0 && g.c > 0)) { showToast("Все нормы должны быть больше нуля", "error"); return; }
    nutritionGoals = g;
    writeJSON(GOALS_KEY, g);
    showToast("Нормы обновлены", "success");
    $("goalsModal").classList.add("hidden");
    renderNutritionPage();
  });

  $("foodPhoto")?.addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingPhoto = await compressPhoto(file);
    const prev = $("photoPreview");
    if (prev) { prev.src = pendingPhoto; prev.classList.remove("hidden"); }
  });

  $("foodLogList")?.addEventListener("click", e => {
    const del = e.target.closest("[data-food-del]");
    if (!del) return;
    const entries = foodLog[selectedDate] || [];
    const idx = entries.findIndex(x => x.id === del.dataset.foodDel);
    if (idx === -1) return;
    const [removed] = entries.splice(idx, 1);
    writeJSON(FOOD_KEY, foodLog);
    renderNutritionPage();
    showToast("Запись удалена", "error", {
      label: "Вернуть",
      onClick: () => {
        entries.splice(Math.min(idx, entries.length), 0, removed);
        writeJSON(FOOD_KEY, foodLog);
        renderNutritionPage();
        showToast("Запись восстановлена", "success");
      }
    });
  });

  renderNutritionPage();
}

let pendingPhoto = "";

function compressPhoto(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 800;
      const scale = Math.min(max / img.width, max / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(""); };
    img.src = url;
  });
}

function renderFoodPicker() {
  const wrap = $("foodPickerList");
  if (!wrap) return;
  const q = ($("foodSearch")?.value || "").trim().toLowerCase();
  const cat = $("foodCatFilter")?.value || "all";
  const list = allProducts().filter(p =>
    (cat === "all" || p.cat === cat) && (!q || p.name.toLowerCase().includes(q)));

  wrap.innerHTML = list.map(p =>
    `<button type="button" class="food-pick ${$("foodProductSelect")?.value === p.id ? "selected" : ""}" data-pick="${p.id}">
      <span>${escapeHTML(p.name)}</span>
      <small>${p.kcal} ккал · Б ${p.p} · Ж ${p.f} · У ${p.c}</small>
    </button>`).join("") || `<p class="muted">Ничего не найдено</p>`;

  const select = $("foodProductSelect");
  if (select) {
    select.innerHTML = allProducts().map(p =>
      `<option value="${p.id}">${escapeHTML(p.name)}</option>`).join("");
  }

  wrap.querySelectorAll("[data-pick]").forEach(btn => btn.addEventListener("click", () => {
    if (select) select.value = btn.dataset.pick;
    wrap.querySelectorAll(".food-pick").forEach(b => b.classList.toggle("selected", b === btn));
    $("foodGrams")?.focus();
  }));
}

function openFoodModal() {
  const modal = $("foodModal");
  if (!modal) return;
  $("foodForm").reset();
  pendingPhoto = "";
  $("photoPreview")?.classList.add("hidden");
  renderFoodPicker();
  modal.classList.remove("hidden");
}

function openGoalsModal() {
  const modal = $("goalsModal");
  if (!modal) return;
  $("goalKcal").value = nutritionGoals.kcal;
  $("goalP").value = nutritionGoals.p;
  $("goalF").value = nutritionGoals.f;
  $("goalC").value = nutritionGoals.c;
  modal.classList.remove("hidden");
}

function renderNutritionPage() {
  const t = dayTotals(selectedDate);
  const C = 2 * Math.PI * 52;

  const ring = $("kcalRing");
  if (ring) {
    ring.style.strokeDasharray = String(C);
    ring.style.strokeDashoffset = String(C * (1 - Math.min(t.kcal / nutritionGoals.kcal, 1)));
  }
  setTxt("kcalText", `${Math.round(t.kcal)}`);
  setTxt("kcalGoalText", `из ${nutritionGoals.kcal} ккал`);

  const macro = (id, val, goal) => {
    const bar = $(id + "Bar");
    if (bar) bar.style.width = Math.min(val / goal * 100, 100) + "%";
    setTxt(id + "Text", `${Math.round(val)} / ${goal} г`);
  };
  macro("macroP", t.p, nutritionGoals.p);
  macro("macroF", t.f, nutritionGoals.f);
  macro("macroC", t.c, nutritionGoals.c);

  const list = $("foodLogList");
  if (list) {
    const entries = foodLog[selectedDate] || [];
    if (!entries.length) {
      list.innerHTML = `<p class="muted" style="padding:16px 0">Пока нет записей. Добавь первый приём пищи.</p>`;
    } else {
      list.innerHTML = Object.keys(MEALS).map(meal => {
        const items = entries.filter(e => e.meal === meal);
        if (!items.length) return "";
        return `<div class="meal-group">
          <h3>${MEALS[meal]}</h3>
          ${items.map(e => `<div class="food-entry">
            ${e.photo ? `<img src="${e.photo}" alt="" class="food-thumb">` : ""}
            <div class="food-entry-main">
              <strong>${escapeHTML(e.name)} · ${e.grams} г</strong>
              <small>${e.kcal} ккал · Б ${e.p} · Ж ${e.f} · У ${e.c}</small>
            </div>
            <button type="button" class="mini-action delete-action" data-food-del="${e.id}" aria-label="Удалить запись">
              <svg class="icon"><use href="#i-trash"></use></svg>
            </button>
          </div>`).join("")}
        </div>`;
      }).join("");
    }
  }

  setTxt("foodDateLabel", formatDate(selectedDate));
  renderNutritionSummary();
}

/* ===== МОДАЛКА ЗАДАЧ ===== */
function toggleSportFields() {
  const sf = $("sportFields"), tc = $("taskCategory");
  if (sf && tc) sf.classList.toggle("hidden", tc.value !== "sport");
}

function openModal(category = "study", task = null) {
  const modal = $("taskModal");
  if (!modal) return;
  $("taskForm").reset();
  $("taskTitle").setCustomValidity("");
  $("taskId").value = task?.id || "";
  $("modalTitle").textContent = task ? "Изменить задачу" : "Новая задача";
  $("taskTitle").value = task?.title || "";
  $("taskDescription").value = task?.description || "";
  $("taskCategory").value = task?.category || category;
  $("taskDate").value = task?.date || selectedDate;
  $("taskTime").value = task?.time || "";
  $("taskPriority").value = task?.priority || "normal";
  $("taskStatus").value = task?.status || "todo";
  $("sportType").value = task?.sportType || "Бег";
  $("sportGoal").value = task?.sportGoal || "";
  toggleSportFields();
  modal.classList.remove("hidden");
  setTimeout(() => $("taskTitle").focus(), 50);
}

function closeModal() { $("taskModal")?.classList.add("hidden"); }

function closeMenu() {
  $("sidebar")?.classList.remove("open");
  $("navBackdrop")?.classList.remove("visible");
  $("menuToggle")?.setAttribute("aria-expanded", "false");
}

/* ===== INIT ===== */
function init() {
  updateHeader();
  applyTheme();
  renderTasks();
  renderCategoryCounts();
  updateNoteForDate();
  renderNutritionSummary();
  initNutritionPage();
  checkReminders();
  setInterval(checkReminders, 25000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkReminders(); });

  const dateInput = $("selectedDate");
  if (dateInput) {
    dateInput.value = selectedDate;
    dateInput.addEventListener("change", e => { if (e.target.value) setDate(e.target.value); });
  }

  $("addTaskTop")?.addEventListener("click", () => openModal());
  $("emptyAdd")?.addEventListener("click", () => openModal());
  $("closeModal")?.addEventListener("click", closeModal);
  $("cancelModal")?.addEventListener("click", closeModal);
  $("taskCategory")?.addEventListener("change", toggleSportFields);
  $("taskModal")?.addEventListener("click", e => { if (e.target === $("taskModal")) closeModal(); });
  $("taskTitle")?.addEventListener("input", e => e.target.setCustomValidity(""));

  $("taskForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const titleInput = $("taskTitle");
    const title = titleInput.value.trim();
    if (title.length < 2) {
      titleInput.setCustomValidity("Введите название хотя бы из двух символов.");
      titleInput.reportValidity();
      return;
    }
    if (!$("taskDate").value) { $("taskDate").reportValidity(); return; }

    const id = $("taskId").value;
    const prev = tasks.find(t => t.id === id);
    const date = $("taskDate").value;
    const time = $("taskTime").value;

    const item = {
      id: id || uid(),
      title,
      description: $("taskDescription").value.trim(),
      category: $("taskCategory").value,
      date, time,
      priority: $("taskPriority").value,
      status: $("taskStatus").value,
      sportType: $("sportType").value,
      sportGoal: $("sportGoal").value.trim(),
      notified: (prev && prev.date === date && prev.time === time) ? prev.notified : false,
      createdAt: prev?.createdAt || Date.now()
    };

    if (id) {
      tasks = tasks.map(t => t.id === id ? item : t);
      showToast("Задача обновлена", "success");
    } else {
      tasks.push(item);
      showToast("Задача создана", "success");
    }

    if (item.time) requestNotificationPermission();
    saveTasks();

    selectedDate = item.date;
    activeCategory = "all";
    activeStatus = "all";
    searchQuery = "";
    if (dateInput) dateInput.value = selectedDate;
    const search = $("taskSearch"); if (search) search.value = "";
    document.querySelectorAll("[data-status]").forEach(b =>
      b.classList.toggle("selected", b.dataset.status === "all"));
    document.querySelectorAll("[data-filter]").forEach(b =>
      b.classList.toggle("active", b.dataset.filter === "all"));

    closeModal();
    renderTasks();
    renderCategoryCounts();
    updateNoteForDate();
  });

  $("taskList")?.addEventListener("change", e => {
    const id = e.target.dataset.statusId;
    if (!id) return;
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    task.status = e.target.value;
    saveTasks();
    renderTasks();
    if (task.status === "done") showToast("Задача выполнена. Отличная работа", "success");
    if (task.status === "cancelled") showToast("Задача отменена", "info");
  });

  $("taskList")?.addEventListener("click", e => {
    const editBtn = e.target.closest("[data-edit-id]");
    const delBtn = e.target.closest("[data-delete-id]");

    if (editBtn) {
      const task = tasks.find(t => t.id === editBtn.dataset.editId);
      if (task) openModal(task.category, task);
      return;
    }

    if (delBtn) {
      const index = tasks.findIndex(t => t.id === delBtn.dataset.deleteId);
      if (index === -1) return;
      const [removed] = tasks.splice(index, 1);
      saveTasks();
      renderTasks();
      renderCategoryCounts();
      showToast("Задача удалена", "error", {
        label: "Вернуть",
        onClick: () => {
          tasks.splice(Math.min(index, tasks.length), 0, removed);
          saveTasks();
          renderTasks();
          renderCategoryCounts();
          showToast("Задача восстановлена", "success");
        }
      });
    }
  });

  $("weekStrip")?.addEventListener("click", e => {
    const btn = e.target.closest("[data-week-date]");
    if (btn) setDate(btn.dataset.weekDate);
  });

  $("taskSearch")?.addEventListener("input", e => { searchQuery = e.target.value.trim(); renderTasks(); });
  $("taskSort")?.addEventListener("change", e => { sortMode = e.target.value; renderTasks(); });

  document.querySelectorAll("[data-status]").forEach(btn => btn.addEventListener("click", () => {
    activeStatus = btn.dataset.status;
    document.querySelectorAll("[data-status]").forEach(b => b.classList.toggle("selected", b === btn));
    renderTasks();
  }));

  document.querySelectorAll("[data-filter]").forEach(btn => btn.addEventListener("click", () => {
    activeCategory = btn.dataset.filter;
    activeStatus = "all";
    document.querySelectorAll("[data-status]").forEach(b =>
      b.classList.toggle("selected", b.dataset.status === "all"));
    document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b === btn));
    renderTasks();
    $("taskList")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }));
  document.querySelectorAll("[data-filter]").forEach(b =>
    b.classList.toggle("active", b.dataset.filter === activeCategory));

  document.querySelectorAll("[data-category]").forEach(btn =>
    btn.addEventListener("click", () => openModal(btn.dataset.category)));

  $("prevDay")?.addEventListener("click", () => {
    const d = new Date(selectedDate + "T12:00:00"); d.setDate(d.getDate() - 1); setDate(dateISO(d));
  });
  $("nextDay")?.addEventListener("click", () => {
    const d = new Date(selectedDate + "T12:00:00"); d.setDate(d.getDate() + 1); setDate(dateISO(d));
  });

  $("themeToggle")?.addEventListener("click", toggleTheme);
  $("themeToggleTop")?.addEventListener("click", toggleTheme);

  $("menuToggle")?.addEventListener("click", () => {
    const open = $("sidebar")?.classList.toggle("open");
    $("navBackdrop")?.classList.toggle("visible", !!open);
    $("menuToggle")?.setAttribute("aria-expanded", String(!!open));
  });
  $("navBackdrop")?.addEventListener("click", closeMenu);
  $("sidebar")?.querySelectorAll("a, button").forEach(el =>
    el.addEventListener("click", () => { if (window.innerWidth <= 768) closeMenu(); }));

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeMenu(); closeModal();
      $("foodModal")?.classList.add("hidden");
      $("goalsModal")?.classList.add("hidden");
    }
  });

  const note = $("dailyNote");
  if (note) {
    let timer;
    note.addEventListener("input", () => {
      clearTimeout(timer);
      const hint = $("noteSaved");
      if (hint) hint.textContent = "Сохранение...";
      timer = setTimeout(() => {
        try { localStorage.setItem("dayflow_note_" + selectedDate, note.value); } catch {}
        if (hint) hint.textContent = "Сохранено";
        showToast("Заметка сохранена", "success");
        setTimeout(() => { if (hint) hint.textContent = "Сохраняется автоматически"; }, 2200);
      }, 700);
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
