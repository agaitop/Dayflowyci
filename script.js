/* DayFlow — client-side planner. Works on GitHub Pages (HTTPS). */
"use strict";

const STORAGE_KEY = "dayflow_tasks_v1";
const CATEGORIES = {
  study: "Учёба", sport: "Спорт", work: "Работа",
  rest: "Отдых", personal: "Личное", ideas: "Идеи"
};
const STATUSES = {
  todo: "Не начато",
  doing: "В работе",
  done: "Готово",
  cancelled: "Отменено"
};

const $ = id => document.getElementById(id);
const pad = value => String(value).padStart(2, "0");
const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};
const dateISO = date =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function readStorage(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (error) {
    console.error("DayFlow: не удалось прочитать localStorage.", error);
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error("DayFlow: не удалось сохранить данные.", error);
    showToast("Не удалось сохранить данные. Проверьте свободное место в браузере.", "error");
    return false;
  }
}

function normalizeTasks(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(task =>
    task && typeof task === "object" &&
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.date === "string"
  ).map(task => ({
    ...task,
    category: CATEGORIES[task.category] ? task.category : "personal",
    status: STATUSES[task.status] ? task.status : "todo",
    priority: ["high", "normal", "low"].includes(task.priority) ? task.priority : "normal",
    description: String(task.description || ""),
    time: String(task.time || ""),
    notified: Boolean(task.notified)
  }));
}

function loadTasks() {
  try {
    const raw = readStorage(STORAGE_KEY, "[]");
    return normalizeTasks(JSON.parse(raw));
  } catch (error) {
    console.error("DayFlow: повреждён список задач.", error);
    showToast("Не удалось прочитать список задач. Проверьте данные браузера.", "error");
    return [];
  }
}

let tasks = loadTasks();
let selectedDate = todayISO();
let activeStatus = "all";
let activeCategory = new URLSearchParams(location.search).get("category") || "all";
let searchQuery = "";
let notificationTimer = null;

if (!Object.hasOwn(CATEGORIES, activeCategory)) activeCategory = "all";

function showToast(message, type = "info") {
  const container = $("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast${type === "error" ? " toast-error" : ""}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.textContent = message;
  container.appendChild(toast);
  window.setTimeout(() => {
    toast.style.animation = "toastOut 0.3s forwards";
    window.setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function saveTasks() {
  return writeStorage(STORAGE_KEY, JSON.stringify(tasks));
}

function requestNotificationPermission() {
  if (!("Notification" in window) || !window.isSecureContext) {
    showToast("Браузерные уведомления доступны на защищённом HTTPS-сайте.");
    return;
  }
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(error => {
      console.warn("DayFlow: разрешение на уведомления не получено.", error);
    });
  }
}

function sendBrowserNotification(title, body) {
  if (!("Notification" in window) || !window.isSecureContext ||
      Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch (error) {
    console.warn("DayFlow: уведомление недоступно.", error);
  }
}

function checkDueTasks() {
  const now = new Date();
  const today = todayISO();
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  let changed = false;

  tasks.forEach(task => {
    if (task.date !== today || !task.time ||
        ["done", "cancelled"].includes(task.status) || task.notified) return;

    if (task.time <= currentTime) {
      showToast(`⏰ Пора: ${task.title}`);
      sendBrowserNotification("DayFlow", `Время задачи: ${task.title}`);
      task.notified = true;
      changed = true;
    }
  });

  if (changed) {
    saveTasks();
    renderTasks();
    renderCategoryCounts();
  }
}

function startNotificationChecks() {
  checkDueTasks();
  if (notificationTimer !== null) window.clearInterval(notificationTimer);
  notificationTimer = window.setInterval(checkDueTasks, 30000);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function formatDate(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric"
  });
}

function pluralTasks(number) {
  const last = number % 10;
  const lastTwo = number % 100;
  if (last === 1 && lastTwo !== 11) return "задача";
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return "задачи";
  return "задач";
}

function setDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  selectedDate = date;
  const input = $("selectedDate");
  if (input) input.value = date;
  renderTasks();
  updateNoteForDate();
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openModal(category = "study", task = null) {
  const modal = $("taskModal");
  const form = $("taskForm");
  if (!modal || !form) return;

  form.reset();
  $("taskId").value = task?.id || "";
  $("modalTitle").textContent = task ? "Редактировать задачу" : "Новая задача";
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
  $("taskTitle")?.focus();
}

function closeModal() {
  $("taskModal")?.classList.add("hidden");
}

function toggleSportFields() {
  $("sportFields")?.classList.toggle("hidden", $("taskCategory")?.value !== "sport");
}

function renderWeekStrip() {
  const strip = $("weekStrip");
  if (!strip) return;

  const selected = new Date(`${selectedDate}T12:00:00`);
  const monday = new Date(selected);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  strip.innerHTML = names.map((name, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const iso = dateISO(date);
    const count = tasks.filter(task => task.date === iso).length;
    return `<button type="button" class="week-day ${iso === selectedDate ? "selected" : ""}"
      data-week-date="${iso}" aria-pressed="${iso === selectedDate}">
      <span>${name}</span><strong>${date.getDate()}</strong><small>${count || "—"}</small>
    </button>`;
  }).join("");
}

function renderTasks() {
  const list = $("taskList");
  if (!list) return;

  const dayTasks = tasks.filter(task => task.date === selectedDate);
  const query = searchQuery.toLocaleLowerCase("ru");
  const filtered = dayTasks.filter(task => {
    const matchesStatus = activeStatus === "all" || task.status === activeStatus;
    const matchesCategory = activeCategory === "all" || task.category === activeCategory;
    const matchesQuery = !query ||
      [task.title, task.description].some(value =>
        String(value || "").toLocaleLowerCase("ru").includes(query));
    return matchesStatus && matchesCategory && matchesQuery;
  }).sort((a, b) => {
    const order = { high: 0, normal: 1, low: 2 };
    return order[a.priority] - order[b.priority] ||
      (a.time || "99:99").localeCompare(b.time || "99:99");
  });

  const done = dayTasks.filter(task => task.status === "done").length;
  const doing = dayTasks.filter(task => task.status === "doing").length;
  const remaining = dayTasks.filter(task => task.status === "todo").length;
  const setText = (id, value) => { const element = $(id); if (element) element.textContent = value; };

  setText("totalCount", dayTasks.length);
  setText("doneCount", done);
  setText("progressCount", doing);
  setText("remainingCount", remaining);

  const percent = dayTasks.length ? Math.round(done / dayTasks.length * 100) : 0;
  setText("progressPercent", `${percent}%`);
  const bar = $("progressBar");
  if (bar) bar.style.width = `${percent}%`;
  setText("taskCountHint", `${filtered.length} из ${dayTasks.length} ${pluralTasks(dayTasks.length)}`);

  list.innerHTML = filtered.map(task => {
    const categoryName = CATEGORIES[task.category] || CATEGORIES.personal;
    const statusName = STATUSES[task.status] || STATUSES.todo;
    const extra = task.category === "sport" && (task.sportType || task.sportGoal)
      ? `<div class="task-description">${escapeHTML(task.sportType)}${task.sportGoal ? ` · ${escapeHTML(task.sportGoal)}` : ""}</div>`
      : "";
    const statusOptions = Object.entries(STATUSES).map(([key, label]) =>
      `<option value="${key}" ${task.status === key ? "selected" : ""}>${label}</option>`
    ).join("");

    return `<article class="task-item">
      <div class="task-main">
        <div class="task-title">${escapeHTML(task.title)}</div>
        ${task.description ? `<div class="task-description">${escapeHTML(task.description)}</div>` : ""}
        ${extra}
        <div class="task-meta">
          <span class="pill">${escapeHTML(categoryName)}</span>
          <span class="task-time">${task.time ? `◷ ${escapeHTML(task.time)}` : ""}</span>
        </div>
      </div>
      <label class="status-control">
        <span class="hidden">Статус задачи ${escapeHTML(task.title)}</span>
        <select class="task-status-select status-${task.status}" data-task-status="${escapeHTML(task.id)}"
          aria-label="Статус задачи: ${escapeHTML(task.title)}">
          ${statusOptions}
        </select>
      </label>
      <div class="task-actions">
        <button type="button" class="mini-action" data-edit-id="${escapeHTML(task.id)}"
          title="Изменить" aria-label="Изменить задачу">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button type="button" class="mini-action delete-action" data-delete-id="${escapeHTML(task.id)}"
          title="Удалить" aria-label="Удалить задачу">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </article>`;
  }).join("");

  const emptyState = $("emptyState");
  if (emptyState) {
    const hasTasks = dayTasks.length > 0;
    emptyState.classList.toggle("hidden", filtered.length > 0);
    list.classList.toggle("hidden", filtered.length === 0);
    const heading = emptyState.querySelector("h3");
    const paragraph = emptyState.querySelector("p");
    if (heading) heading.textContent = hasTasks ? "Ничего не найдено" : "Список пуст";
    if (paragraph) paragraph.textContent = hasTasks
      ? "Измените фильтры или поисковый запрос."
      : "Добавьте первую задачу.";
  }

  const fullDate = $("fullDate");
  if (fullDate) fullDate.textContent = formatDate(selectedDate).toUpperCase();
  renderWeekStrip();
}

function renderCategoryCounts() {
  Object.keys(CATEGORIES).forEach(key => {
    const element = $(`count-${key}`);
    if (element) {
      const count = tasks.filter(task => task.category === key).length;
      element.textContent = `${count} ${pluralTasks(count)}`;
    }
  });
}

function updateHeader() {
  const element = $("headerDate");
  if (element) element.textContent = new Date().toLocaleDateString("ru-RU", {
    weekday: "short", day: "numeric", month: "short"
  });
}

function applyTheme() {
  const dark = readStorage("dayflow_theme", "light") === "dark";
  document.body.classList.toggle("dark", dark);
  document.querySelectorAll(".icon-moon").forEach(icon => icon.classList.toggle("hidden", dark));
  document.querySelectorAll(".icon-sun").forEach(icon => icon.classList.toggle("hidden", !dark));
  const label = $("themeLabel");
  if (label) label.textContent = dark ? "Светлая тема" : "Тёмная тема";
}

function toggleTheme() {
  const nextTheme = document.body.classList.contains("dark") ? "light" : "dark";
  if (writeStorage("dayflow_theme", nextTheme)) {
    applyTheme();
    showToast("Тема изменена");
  }
}

function updateNoteForDate() {
  const note = $("dailyNote");
  if (note) note.value = readStorage(`dayflow_note_${selectedDate}`, "");
}

function closeMenu() {
  $("sidebar")?.classList.remove("open");
  $("navBackdrop")?.classList.remove("visible");
  $("menuToggle")?.setAttribute("aria-expanded", "false");
}

function setStatusFilter(status) {
  activeStatus = status;
  document.querySelectorAll("[data-status]").forEach(button => {
    button.classList.toggle("selected", button.dataset.status === status);
    button.setAttribute("aria-pressed", String(button.dataset.status === status));
  });
}

function init() {
  updateHeader();
  applyTheme();
  renderTasks();
  renderCategoryCounts();
  updateNoteForDate();
  startNotificationChecks();

  const dateInput = $("selectedDate");
  if (dateInput) {
    dateInput.value = selectedDate;
    dateInput.addEventListener("change", event => {
      if (event.target.value) setDate(event.target.value);
    });
  }

  $("addTaskTop")?.addEventListener("click", () => openModal());
  $("emptyAdd")?.addEventListener("click", () => openModal());
  $("closeModal")?.addEventListener("click", closeModal);
  $("cancelModal")?.addEventListener("click", closeModal);
  $("taskCategory")?.addEventListener("change", toggleSportFields);
  $("taskModal")?.addEventListener("click", event => {
    if (event.target === $("taskModal")) closeModal();
  });

  $("taskForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const titleInput = $("taskTitle");
    const title = titleInput.value.trim();
    if (title.length < 2) {
      titleInput.setCustomValidity("Введите не менее двух символов.");
      titleInput.reportValidity();
      titleInput.addEventListener("input", () => titleInput.setCustomValidity(""), { once: true });
      return;
    }
    titleInput.setCustomValidity("");

    const id = $("taskId").value;
    const date = $("taskDate").value;
    if (!date) {
      $("taskDate").reportValidity();
      return;
    }

    const previous = tasks.find(task => task.id === id);
    const item = {
      ...(previous || {}),
      id: id || createId(),
      title,
      description: $("taskDescription").value.trim(),
      category: $("taskCategory").value,
      date,
      time: $("taskTime").value,
      priority: $("taskPriority").value,
      status: $("taskStatus").value,
      sportType: $("sportType").value,
      sportGoal: $("sportGoal").value.trim(),
      notified: previous && previous.date === date && previous.time === $("taskTime").value
        ? previous.notified : false
    };

    const previousTasks = tasks;
    tasks = id ? tasks.map(task => task.id === id ? item : task) : [...tasks, item];
    if (!saveTasks()) {
      tasks = previousTasks;
      return;
    }

    showToast(id ? "Задача обновлена" : "Задача создана");
    if (item.time) requestNotificationPermission();

    selectedDate = item.date;
    activeCategory = "all";
    setStatusFilter("all");
    searchQuery = "";
    if (dateInput) dateInput.value = selectedDate;
    if ($("taskSearch")) $("taskSearch").value = "";
    closeModal();
    renderTasks();
    renderCategoryCounts();
    updateNoteForDate();
  });

  $("taskList")?.addEventListener("change", event => {
    const select = event.target.closest("[data-task-status]");
    if (!select) return;
    const task = tasks.find(item => item.id === select.dataset.taskStatus);
    if (!task || !STATUSES[select.value]) return;
    const oldStatus = task.status;
    task.status = select.value;
    if (!saveTasks()) {
      task.status = oldStatus;
      renderTasks();
      return;
    }
    showToast(`Статус изменён: ${STATUSES[task.status]}`);
    renderTasks();
    renderCategoryCounts();
  });

  $("taskList")?.addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit-id]");
    const deleteButton = event.target.closest("[data-delete-id]");

    if (editButton) {
      const task = tasks.find(item => item.id === editButton.dataset.editId);
      if (task) openModal(task.category, task);
    }

    if (deleteButton) {
      const task = tasks.find(item => item.id === deleteButton.dataset.deleteId);
      if (task && window.confirm("Удалить задачу?")) {
        const previousTasks = tasks;
        tasks = tasks.filter(item => item.id !== task.id);
        if (!saveTasks()) {
          tasks = previousTasks;
          return;
        }
        renderTasks();
        renderCategoryCounts();
        showToast("Задача удалена");
      }
    }
  });

  $("weekStrip")?.addEventListener("click", event => {
    const button = event.target.closest("[data-week-date]");
    if (button) setDate(button.dataset.weekDate);
  });

  $("taskSearch")?.addEventListener("input", event => {
    searchQuery = event.target.value.trim();
    renderTasks();
  });

  document.querySelectorAll("[data-status]").forEach(button => {
    button.addEventListener("click", () => {
      setStatusFilter(button.dataset.status);
      renderTasks();
    });
  });

  document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.filter;
      setStatusFilter("all");
      document.querySelectorAll("[data-filter]").forEach(item =>
        item.classList.toggle("active", item === button));
      renderTasks();
      closeMenu();
    });
  });

  document.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => openModal(button.dataset.category));
  });

  $("prevDay")?.addEventListener("click", () => {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() - 1);
    setDate(dateISO(date));
  });
  $("nextDay")?.addEventListener("click", () => {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + 1);
    setDate(dateISO(date));
  });

  $("themeToggle")?.addEventListener("click", toggleTheme);
  $("themeToggleTop")?.addEventListener("click", toggleTheme);

  $("menuToggle")?.addEventListener("click", () => {
    const sidebar = $("sidebar");
    const isOpen = sidebar?.classList.toggle("open");
    $("navBackdrop")?.classList.toggle("visible", Boolean(isOpen));
    $("menuToggle")?.setAttribute("aria-expanded", String(Boolean(isOpen)));
  });
  $("navBackdrop")?.addEventListener("click", closeMenu);
  $("sidebar")?.querySelectorAll("a, button").forEach(item => {
    item.addEventListener("click", () => {
      if (window.innerWidth <= 768) closeMenu();
    });
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMenu();
      closeModal();
    }
  });

  const note = $("dailyNote");
  if (note) {
    let saveTimeout;
    note.addEventListener("input", () => {
      window.clearTimeout(saveTimeout);
      const hint = $("noteSaved");
      if (hint) hint.textContent = "Сохранение…";
      saveTimeout = window.setTimeout(() => {
        if (writeStorage(`dayflow_note_${selectedDate}`, note.value) && hint) {
          hint.textContent = "Сохранено";
        }
      }, 450);
    });
  }

  // Ошибки JS видны в консоли и не остаются незамеченными пользователем.
  window.addEventListener("error", event => {
    console.error("DayFlow: ошибка JavaScript.", event.error || event.message);
    showToast("Возникла ошибка интерфейса. Обновите страницу.", "error");
  });
  window.addEventListener("unhandledrejection", event => {
    console.error("DayFlow: необработанная ошибка операции.", event.reason);
    showToast("Не удалось выполнить операцию.", "error");
  });
}

document.addEventListener("DOMContentLoaded", init);


/* ============================================================
   NUTRITION MODULE — добавлено отдельно.
   Использует общие helpers выше ($, readStorage, writeStorage,
   showToast, escapeHTML, createId, todayISO, dateISO, pad).
   Своих имён, конфликтующих с планировщиком, не создаёт.
   ============================================================ */

const NUTRI_MEALS_KEY = "dayflow_meals_v1";
const NUTRI_GOALS_KEY = "dayflow_goals_v1";
const NUTRI_CUSTOM_KEY = "dayflow_custom_foods_v1";
const NUTRI_DEFAULT_GOALS = { cal: 2200, pro: 140, fat: 70, carb: 250 };

const FOOD_CATS = {
  meat: "Мясо, рыба, яйца",
  dairy: "Молочное",
  grains: "Крупы и гарниры",
  veg: "Овощи",
  fruit: "Фрукты и ягоды",
  other: "Орехи, хлеб и другое"
};

/* Значения на 100 г: [ккал, белки, жиры, углеводы] */
const FOOD_DB = [
  { id: "chicken_breast", name: "Куриная грудка", cat: "meat", cal: 165, pro: 31, fat: 3.6, carb: 0 },
  { id: "chicken_thigh", name: "Куриное бедро", cat: "meat", cal: 209, pro: 26, fat: 11, carb: 0 },
  { id: "turkey", name: "Индейка", cat: "meat", cal: 189, pro: 29, fat: 7, carb: 0 },
  { id: "beef", name: "Говядина", cat: "meat", cal: 250, pro: 26, fat: 15, carb: 0 },
  { id: "pork", name: "Свинина", cat: "meat", cal: 242, pro: 27, fat: 14, carb: 0 },
  { id: "salmon", name: "Лосось", cat: "meat", cal: 208, pro: 20, fat: 13, carb: 0 },
  { id: "tuna", name: "Тунец", cat: "meat", cal: 132, pro: 28, fat: 1, carb: 0 },
  { id: "cod", name: "Треска", cat: "meat", cal: 82, pro: 18, fat: 0.7, carb: 0 },
  { id: "shrimp", name: "Креветки", cat: "meat", cal: 99, pro: 24, fat: 0.3, carb: 0.2 },
  { id: "egg", name: "Яйцо куриное (1 шт ≈ 60 г)", cat: "meat", cal: 155, pro: 13, fat: 11, carb: 1.1 },
  { id: "egg_white", name: "Яичный белок", cat: "meat", cal: 52, pro: 11, fat: 0.2, carb: 0.7 },
  { id: "milk", name: "Молоко 2.5%", cat: "dairy", cal: 52, pro: 2.8, fat: 2.5, carb: 4.7 },
  { id: "kefir", name: "Кефир 1%", cat: "dairy", cal: 40, pro: 3, fat: 1, carb: 4 },
  { id: "cottage", name: "Творог 5%", cat: "dairy", cal: 121, pro: 17, fat: 5, carb: 1.8 },
  { id: "cottage0", name: "Творог 0%", cat: "dairy", cal: 71, pro: 16, fat: 0.5, carb: 1.3 },
  { id: "yogurt", name: "Йогурт натуральный", cat: "dairy", cal: 60, pro: 4, fat: 1.5, carb: 7 },
  { id: "cheese", name: "Сыр твёрдый", cat: "dairy", cal: 360, pro: 24, fat: 29, carb: 0 },
  { id: "sour15", name: "Сметана 15%", cat: "dairy", cal: 158, pro: 2.6, fat: 15, carb: 3 },
  { id: "oats", name: "Овсянка (сухая)", cat: "grains", cal: 366, pro: 12, fat: 6, carb: 62 },
  { id: "buckwheat", name: "Гречка (сухая)", cat: "grains", cal: 343, pro: 13, fat: 3.4, carb: 72 },
  { id: "rice", name: "Рис (сухой)", cat: "grains", cal: 344, pro: 6.7, fat: 0.7, carb: 78 },
  { id: "rice_cooked", name: "Рис отварной", cat: "grains", cal: 116, pro: 2.2, fat: 0.5, carb: 25 },
  { id: "buckwheat_cooked", name: "Гречка отварная", cat: "grains", cal: 110, pro: 4, fat: 1, carb: 21 },
  { id: "pasta", name: "Макароны (сухие)", cat: "grains", cal: 350, pro: 12, fat: 1.5, carb: 72 },
  { id: "pasta_cooked", name: "Макароны отварные", cat: "grains", cal: 158, pro: 5, fat: 1, carb: 31 },
  { id: "potato", name: "Картофель", cat: "grains", cal: 77, pro: 2, fat: 0.1, carb: 17 },
  { id: "potato_boiled", name: "Картофель отварной", cat: "grains", cal: 82, pro: 2, fat: 0.4, carb: 17 },
  { id: "lentils", name: "Чечевица (сухая)", cat: "grains", cal: 352, pro: 24, fat: 1, carb: 60 },
  { id: "chickpeas", name: "Нут (сухой)", cat: "grains", cal: 364, pro: 19, fat: 6, carb: 61 },
  { id: "beans", name: "Фасоль (сухая)", cat: "grains", cal: 333, pro: 21, fat: 1.2, carb: 60 },
  { id: "tomato", name: "Помидор", cat: "veg", cal: 18, pro: 0.9, fat: 0.2, carb: 3.9 },
  { id: "cucumber", name: "Огурец", cat: "veg", cal: 15, pro: 0.7, fat: 0.1, carb: 3.6 },
  { id: "cabbage", name: "Капуста", cat: "veg", cal: 25, pro: 1.3, fat: 0.1, carb: 5.8 },
  { id: "carrot", name: "Морковь", cat: "veg", cal: 41, pro: 0.9, fat: 0.2, carb: 10 },
  { id: "beet", name: "Свёкла", cat: "veg", cal: 43, pro: 1.6, fat: 0.2, carb: 9 },
  { id: "onion", name: "Лук", cat: "veg", cal: 40, pro: 1.1, fat: 0.1, carb: 9 },
  { id: "pepper", name: "Перец болгарский", cat: "veg", cal: 27, pro: 1, fat: 0.3, carb: 6 },
  { id: "broccoli", name: "Брокколи", cat: "veg", cal: 34, pro: 2.8, fat: 0.4, carb: 7 },
  { id: "spinach", name: "Шпинат", cat: "veg", cal: 23, pro: 2.9, fat: 0.4, carb: 3.6 },
  { id: "zucchini", name: "Кабачок", cat: "veg", cal: 17, pro: 1.2, fat: 0.3, carb: 3.1 },
  { id: "avocado", name: "Авокадо", cat: "veg", cal: 160, pro: 2, fat: 15, carb: 9 },
  { id: "banana", name: "Банан", cat: "fruit", cal: 89, pro: 1.1, fat: 0.3, carb: 23 },
  { id: "apple", name: "Яблоко", cat: "fruit", cal: 52, pro: 0.3, fat: 0.2, carb: 14 },
  { id: "orange", name: "Апельсин", cat: "fruit", cal: 47, pro: 0.9, fat: 0.1, carb: 12 },
  { id: "grape", name: "Виноград", cat: "fruit", cal: 69, pro: 0.7, fat: 0.2, carb: 18 },
  { id: "strawberry", name: "Клубника", cat: "fruit", cal: 32, pro: 0.7, fat: 0.3, carb: 8 },
  { id: "blueberry", name: "Черника", cat: "fruit", cal: 57, pro: 0.7, fat: 0.3, carb: 14 },
  { id: "pear", name: "Груша", cat: "fruit", cal: 57, pro: 0.4, fat: 0.1, carb: 15 },
  { id: "kiwi", name: "Киви", cat: "fruit", cal: 61, pro: 1.1, fat: 0.5, carb: 15 },
  { id: "watermelon", name: "Арбуз", cat: "fruit", cal: 30, pro: 0.6, fat: 0.2, carb: 8 },
  { id: "walnut", name: "Грецкий орех", cat: "other", cal: 654, pro: 15, fat: 65, carb: 14 },
  { id: "almond", name: "Миндаль", cat: "other", cal: 579, pro: 21, fat: 50, carb: 22 },
  { id: "sunflower_seed", name: "Семечки подсолнуха", cat: "other", cal: 584, pro: 21, fat: 51, carb: 20 },
  { id: "peanut_butter", name: "Арахисовая паста", cat: "other", cal: 588, pro: 25, fat: 50, carb: 20 },
  { id: "bread_white", name: "Хлеб белый", cat: "other", cal: 265, pro: 9, fat: 3.2, carb: 49 },
  { id: "bread_rye", name: "Хлеб ржаной", cat: "other", cal: 259, pro: 8.5, fat: 3.3, carb: 48 },
  { id: "chocolate", name: "Шоколад тёмный", cat: "other", cal: 546, pro: 5, fat: 31, carb: 61 },
  { id: "honey", name: "Мёд", cat: "other", cal: 304, pro: 0.3, fat: 0, carb: 82 },
  { id: "sugar", name: "Сахар", cat: "other", cal: 387, pro: 0, fat: 0, carb: 100 },
  { id: "oil_olive", name: "Масло оливковое", cat: "other", cal: 884, pro: 0, fat: 100, carb: 0 },
  { id: "oil_sun", name: "Масло подсолнечное", cat: "other", cal: 884, pro: 0, fat: 100, carb: 0 },
  { id: "butter", name: "Масло сливочное", cat: "other", cal: 717, pro: 0.9, fat: 81, carb: 0.1 }
];

const MEAL_TYPES = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин", snack: "Перекус" };

let nutriMeals = [];
let nutriGoals = { ...NUTRI_DEFAULT_GOALS };
let nutriCustom = [];
let nutriDate = todayISO();
let nutriDraft = [];
let nutriPhoto = "";

function nutriNum(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function nutriRound(value) { return Math.round(value); }
function nutriOne(value) { return Math.round(value * 10) / 10; }

function nutriLoadJSON(key, fallback) {
  try {
    const parsed = JSON.parse(readStorage(key, "null"));
    return parsed === null ? fallback : parsed;
  } catch (error) {
    console.error("DayFlow nutrition: повреждены данные.", error);
    return fallback;
  }
}

function nutriLoadState() {
  const meals = nutriLoadJSON(NUTRI_MEALS_KEY, []);
  nutriMeals = Array.isArray(meals) ? meals.filter(m =>
    m && typeof m.id === "string" && typeof m.date === "string" && Array.isArray(m.items)
  ) : [];

  const goals = nutriLoadJSON(NUTRI_GOALS_KEY, null);
  nutriGoals = {
    cal: nutriNum(goals?.cal) || NUTRI_DEFAULT_GOALS.cal,
    pro: nutriNum(goals?.pro) || NUTRI_DEFAULT_GOALS.pro,
    fat: nutriNum(goals?.fat) || NUTRI_DEFAULT_GOALS.fat,
    carb: nutriNum(goals?.carb) || NUTRI_DEFAULT_GOALS.carb
  };

  const custom = nutriLoadJSON(NUTRI_CUSTOM_KEY, []);
  nutriCustom = Array.isArray(custom) ? custom.filter(f =>
    f && typeof f.id === "string" && typeof f.name === "string"
  ) : [];
}

function nutriSaveMeals() { return writeStorage(NUTRI_MEALS_KEY, JSON.stringify(nutriMeals)); }
function nutriSaveGoals() { return writeStorage(NUTRI_GOALS_KEY, JSON.stringify(nutriGoals)); }
function nutriSaveCustom() { return writeStorage(NUTRI_CUSTOM_KEY, JSON.stringify(nutriCustom)); }

function nutriAllFoods() { return FOOD_DB.concat(nutriCustom); }
function nutriFindFood(id) { return nutriAllFoods().find(f => f.id === id); }
function nutriCatLabel(cat) { return FOOD_CATS[cat] || "Своё"; }

function nutriItemMacros(item) {
  const factor = (Number(item.grams) || 0) / 100;
  return {
    cal: (Number(item.cal) || 0) * factor,
    pro: (Number(item.pro) || 0) * factor,
    fat: (Number(item.fat) || 0) * factor,
    carb: (Number(item.carb) || 0) * factor
  };
}
function nutriSumItems(items) {
  const total = { cal: 0, pro: 0, fat: 0, carb: 0 };
  (items || []).forEach(item => {
    const m = nutriItemMacros(item);
    total.cal += m.cal; total.pro += m.pro; total.fat += m.fat; total.carb += m.carb;
  });
  return total;
}
function nutriDayTotals(date) {
  const total = { cal: 0, pro: 0, fat: 0, carb: 0 };
  nutriMeals.filter(m => m.date === date).forEach(meal => {
    const m = nutriSumItems(meal.items);
    total.cal += m.cal; total.pro += m.pro; total.fat += m.fat; total.carb += m.carb;
  });
  return total;
}

function nutriSetRing(id, value, goal) {
  const circle = $(id);
  if (!circle) return;
  const radius = Number(circle.getAttribute("r")) || 52;
  const circumference = 2 * Math.PI * radius;
  const ratio = goal > 0 ? value / goal : 0;
  const clamped = Math.max(0, Math.min(ratio, 1));
  circle.style.strokeDasharray = `${circumference}`;
  circle.style.strokeDashoffset = `${circumference * (1 - clamped)}`;
  circle.style.stroke = ratio > 1 ? "var(--over-color)" : "";
}

function nutriRenderDashboard() {
  const total = nutriDayTotals(nutriDate);
  const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };

  setText("calValue", nutriRound(total.cal));
  setText("calGoal", nutriGoals.cal);
  const left = nutriGoals.cal - total.cal;
  setText("calRemaining", left >= 0 ? `Осталось ${nutriRound(left)} ккал` : `Перебор ${nutriRound(-left)} ккал`);
  nutriSetRing("ringCal", total.cal, nutriGoals.cal);

  setText("proValue", nutriRound(total.pro));
  setText("fatValue", nutriRound(total.fat));
  setText("carbValue", nutriRound(total.carb));
  setText("proGoal", `цель ${nutriGoals.pro} г`);
  setText("fatGoal", `цель ${nutriGoals.fat} г`);
  setText("carbGoal", `цель ${nutriGoals.carb} г`);
  nutriSetRing("ringPro", total.pro, nutriGoals.pro);
  nutriSetRing("ringFat", total.fat, nutriGoals.fat);
  nutriSetRing("ringCarb", total.carb, nutriGoals.carb);
}

function nutriRenderMeals() {
  const list = $("mealList");
  const empty = $("mealEmpty");
  if (!list) return;

  const meals = nutriMeals
    .filter(m => m.date === nutriDate)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  list.innerHTML = meals.map(meal => {
    const total = nutriSumItems(meal.items);
    const items = meal.items.map(item => {
      const m = nutriItemMacros(item);
      return `<li><span>${escapeHTML(item.name)} · ${nutriRound(item.grams)} г</span><span>${nutriRound(m.cal)} ккал</span></li>`;
    }).join("");
    const photo = meal.photo
      ? `<img class="meal-photo" src="${meal.photo}" alt="Фото: ${escapeHTML(MEAL_TYPES[meal.type] || "Приём пищи")}">`
      : "";
    return `<article class="meal-card">
      <div class="meal-head">
        ${photo}
        <div class="meal-head-main">
          <strong>${escapeHTML(MEAL_TYPES[meal.type] || "Приём пищи")}</strong>
          <span class="meal-kcal">${nutriRound(total.cal)} ккал</span>
        </div>
        <button type="button" class="mini-action delete-action" data-meal-delete="${escapeHTML(meal.id)}" aria-label="Удалить приём">
          <svg class="icon"><use href="#i-trash"></use></svg>
        </button>
      </div>
      <ul class="meal-items">${items}</ul>
      <div class="meal-macros">
        <span>Б ${nutriOne(total.pro)}</span>
        <span>Ж ${nutriOne(total.fat)}</span>
        <span>У ${nutriOne(total.carb)}</span>
      </div>
    </article>`;
  }).join("");

  if (empty) empty.classList.toggle("hidden", meals.length > 0);
  list.classList.toggle("hidden", meals.length === 0);
}

function nutriRender() {
  nutriRenderDashboard();
  nutriRenderMeals();
}

function nutriSetDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  nutriDate = date;
  const input = $("nutriDate");
  if (input) input.value = date;
  nutriRender();
}

/* --- Модалка приёма пищи --- */
function nutriFillFoodCats() {
  const select = $("foodCat");
  if (!select) return;
  select.innerHTML = `<option value="all">Все категории</option>` +
    Object.entries(FOOD_CATS).map(([key, label]) =>
      `<option value="${key}">${escapeHTML(label)}</option>`).join("");
}

function nutriRenderFoodResults() {
  const box = $("foodResults");
  if (!box) return;
  const query = ($("foodSearch")?.value || "").trim().toLocaleLowerCase("ru");
  const cat = $("foodCat")?.value || "all";

  const matches = nutriAllFoods().filter(food => {
    const okCat = cat === "all" || food.cat === cat;
    const okQuery = !query ||
      food.name.toLocaleLowerCase("ru").includes(query) ||
      nutriCatLabel(food.cat).toLocaleLowerCase("ru").includes(query);
    return okCat && okQuery;
  }).slice(0, 50);

  if (!matches.length) {
    box.innerHTML = `<div class="food-empty">Ничего не найдено. Добавь свой продукт ниже.</div>`;
    return;
  }
  box.innerHTML = matches.map(food =>
    `<button type="button" class="food-row" data-food-add="${escapeHTML(food.id)}">
      <span class="food-row-main">
        <strong>${escapeHTML(food.name)}</strong>
        <small>${escapeHTML(nutriCatLabel(food.cat))} · ${food.cal} ккал / 100 г</small>
      </span>
      <span class="food-row-add"><svg class="icon"><use href="#i-plus"></use></svg></span>
    </button>`
  ).join("");
}

function nutriRenderDraft() {
  const list = $("draftList");
  if (!list) return;
  if (!nutriDraft.length) {
    list.innerHTML = `<div class="draft-empty">Выбери продукты из списка выше.</div>`;
  } else {
    list.innerHTML = nutriDraft.map(item =>
      `<div class="draft-row" data-draft-row="${escapeHTML(item.id)}">
        <span class="draft-name">${escapeHTML(item.name)}</span>
        <span class="draft-grams">
          <input type="number" min="1" step="1" inputmode="numeric" value="${nutriRound(item.grams)}" data-draft-grams="${escapeHTML(item.id)}" aria-label="Граммы: ${escapeHTML(item.name)}">
          <span>г</span>
        </span>
        <span class="draft-kcal" data-draft-kcal>${nutriRound(nutriItemMacros(item).cal)} ккал</span>
        <button type="button" class="mini-action delete-action" data-draft-remove="${escapeHTML(item.id)}" aria-label="Убрать продукт">
          <svg class="icon"><use href="#i-x"></use></svg>
        </button>
      </div>`
    ).join("");
  }
  nutriUpdatePreview();
}

function nutriUpdatePreview() {
  const preview = $("draftPreview");
  if (!preview) return;
  const total = nutriSumItems(nutriDraft);
  preview.textContent = `${nutriRound(total.cal)} ккал · Б ${nutriOne(total.pro)} · Ж ${nutriOne(total.fat)} · У ${nutriOne(total.carb)}`;
}

function nutriAddFood(id) {
  const food = nutriFindFood(id);
  if (!food) return;
  nutriDraft.push({
    id: createId(),
    foodId: food.id,
    name: food.name,
    grams: 100,
    cal: food.cal, pro: food.pro, fat: food.fat, carb: food.carb
  });
  nutriRenderDraft();
}

function nutriOpenMeal() {
  const modal = $("mealModal");
  if goalsRaw = nutriLoadJSON(NUTRI_GOALS_KEY, null);
  const goals = {
    cal: nutriNum(goalsRaw?.cal) || NUTRI_DEFAULT_GOALS.cal
  };
  const mealsRaw = nutriLoadJSON(NUTRI_MEALS_KEY, []);
  const meals = Array.isArray(mealsRaw) ? mealsRaw : [];
  const total = { cal: 0, pro: 0, fat: 0, carb: 0 };
  meals.filter(m => m && m.date === todayISO() && Array.isArray(m.items)).forEach(meal => {
    const m = nutriSumItems(meal.items);
    total.cal += m.cal; total.pro += m.pro; total.fat += m.fat; total.carb += m.carb;
  });
  const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  setText("nsCal", nutriRound(total.cal));
  setText("nsGoal", goals.cal);
  setText("nsP", nutriRound(total.pro));
  setText("nsF", nutriRound(total.fat));
  setText("nsC", nutriRound(total.carb));
  nutriSetRing("nsRing", total.cal, goals.cal);
}

function initNutrition() {
  nutriRenderSummary();

  if (!$("nutriDate")) return; // не страница питания — дальше не идём

  nutriLoadState();
  const dateInput = $("nutriDate");
  dateInput.value = nutriDate;
  nutriRender();

  dateInput.addEventListener("change", event => {
    if (event.target.value) nutriSetDate(event.target.value);
  });
  $("nutriPrevDay")?.addEventListener("click", () => {
    const d = new Date(`${nutriDate}T12:00:00`); d.setDate(d.getDate() - 1); nutriSetDate(dateISO(d));
  });
  $("nutriNextDay")?.addEventListener("click", () => {
    const d = new Date(`${nutriDate}T12:00:00`); d.setDate(d.getDate() + 1); nutriSetDate(dateISO(d));
  });

  $("nutriAddMeal")?.addEventListener("click", nutriOpenMeal);
  $("mealClose")?.addEventListener("click", nutriCloseMeal);
  $("mealCancel")?.addEventListener("click", nutriCloseMeal);
  $("mealModal")?.addEventListener("click", event => {
    if (event.target === $("mealModal")) nutriCloseMeal();
  });

  $("foodSearch")?.addEventListener("input", nutriRenderFoodResults);
  $("foodSearch")?.addEventListener("keydown", event => {
    if (event.key === "Enter") event.preventDefault();
  });
  $("foodCat")?.addEventListener("change", nutriRenderFoodResults);

  $("foodResults")?.addEventListener("click", event => {
    const button = event.target.closest("[data-food-add]");
    if (button) nutriAddFood(button.dataset.foodAdd);
  });

  $("draftList")?.addEventListener("input", event => {
    const input = event.target.closest("[data-draft-grams]");
    if (!input) return;
    const item = nutriDraft.find(d => d.id === input.dataset.draftGrams);
    if (!item) return;
    item.grams = Math.max(0, Number(input.value) || 0);
    const row = input.closest("[data-draft-row]");
    const kcal = row?.querySelector("[data-draft-kcal]");
    if (kcal) kcal.textContent = `${nutriRound(nutriItemMacros(item).cal)} ккал`;
    nutriUpdatePreview();
  });
  $("draftList")?.addEventListener("click", event => {
    const button = event.target.closest("[data-draft-remove]");
    if (!button) return;
    nutriDraft = nutriDraft.filter(d => d.id !== button.dataset.draftRemove);
    nutriRenderDraft();
  });

  $("customToggle")?.addEventListener("click", () => $("customForm")?.classList.toggle("hidden"));
  $("cfAdd")?.addEventListener("click", () => {
    const name = $("cfName").value.trim();
    const cal = nutriNum($("cfCal").value);
    const pro = nutriNum($("cfPro").value);
    const fat = nutriNum($("cfFat").value);
    const carb = nutriNum($("cfCarb").value);
    if (name.length < 2) { showToast("Введите название продукта", "error"); return; }
    if (cal <= 0) { showToast("Укажите калорийность на 100 г", "error"); return; }
    const food = { id: "custom-" + createId(), name, cat: "custom", cal, pro, fat, carb };
    nutriCustom.push(food);
    if (!nutriSaveCustom()) { nutriCustom.pop(); return; }
    nutriAddFood(food.id);
    $("cfName").value = ""; $("cfCal").value = ""; $("cfPro").value = ""; $("cfFat").value = ""; $("cfCarb").value = "";
    $("customForm")?.classList.add("hidden");
    showToast("Продукт добавлен в базу");
  });

  $("mealPhoto")?.addEventListener("change", async event => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      nutriPhoto = await nutriCompressPhoto(file);
      const img = $("photoImg");
      if (img) img.src = nutriPhoto;
      $("photoPreview")?.classList.remove("hidden");
    } catch (error) {
      console.warn("DayFlow nutrition: фото не обработано.", error);
      showToast("Не удалось обработать фото", "error");
    }
  });
  $("photoRemove")?.addEventListener("click", () => {
    nutriPhoto = "";
    $("photoPreview")?.classList.add("hidden");
  });

  $("mealForm")?.addEventListener("submit", event => {
    event.preventDefault();
    if (!nutriDraft.length) { showToast("Добавьте хотя бы один продукт", "error"); return; }
    const items = nutriDraft
      .filter(d => Number(d.grams) > 0)
      .map(d => ({
        foodId: d.foodId, name: d.name, grams: Number(d.grams),
        cal: d.cal, pro: d.pro, fat: d.fat, carb: d.carb
      }));
    if (!items.length) { showToast("Укажите граммы больше нуля", "error"); return; }

    const meal = {
      id: createId(),
      date: nutriDate,
      type: $("mealType").value,
      items,
      photo: nutriPhoto,
      createdAt: Date.now()
    };
    nutriMeals.push(meal);
    if (!nutriSaveMeals()) { nutriMeals.pop(); return; }
    nutriCloseMeal();
    nutriRender();
    showToast("Приём пищи добавлен");
  });

  $("mealList")?.addEventListener("click", event => {
    const button = event.target.closest("[data-meal-delete]");
    if (!button) return;
    const id = button.dataset.mealDelete;
    if (!window.confirm("Удалить приём пищи?")) return;
    const previous = nutriMeals;
    nutriMeals = nutriMeals.filter(m => m.id !== id);
    if (!nutriSaveMeals()) { nutriMeals = previous; return; }
    nutriRender();
    showToast("Приём пищи удалён");
  });

  $("nutriGoalsBtn")?.addEventListener("click", nutriOpenGoals);
  $("goalsClose")?.addEventListener("click", nutriCloseGoals);
  $("goalsCancel")?.addEventListener("click", nutriCloseGoals);
  $("goalsModal")?.addEventListener("click", event => {
    if (event.target === $("goalsModal")) nutriCloseGoals();
  });
  $("goalsForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const cal = nutriNum($("goalCal").value);
    const pro = nutriNum($("goalPro").value);
    const fat = nutriNum($("goalFat").value);
    const carb = nutriNum($("goalCarb").value);
    if (cal <= 0 || pro <= 0 || fat <= 0 || carb <= 0) {
      showToast("Все нормы должны быть больше нуля", "error");
      return;
    }
    const previous = { ...nutriGoals };
    nutriGoals = { cal, pro, fat, carb };
    if (!nutriSaveGoals()) { nutriGoals = previous; return; }
    nutriCloseGoals();
    nutriRender();
    showToast("Нормы сохранены");
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") { nutriCloseMeal(); nutriCloseGoals(); }
  });
}

document.addEventListener("DOMContentLoaded", initNutrition);
