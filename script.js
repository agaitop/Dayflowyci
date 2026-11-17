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
  initNutrition();

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

/* === NUTRITION PAGE (DayFlow) — ручной ввод + база продуктов, без AI === */
const NUTRITION_KEY = "dayflow_nutrition_v1";

/* Стандартные дневные цели — анкеты и ввод личных данных не нужны. */
const NUTRITION_GOALS = { kcal: 2200, protein: 140, fat: 70, carbs: 250 };

/* База продуктов: значения на 100 г (ккал, белки, жиры, углеводы). Ориентировочные. */
const FOOD_DB = [
  { name: "Куриная грудка (варёная)", kcal: 165, protein: 31, fat: 3.6, carbs: 0 },
  { name: "Куриная грудка (жареная)", kcal: 197, protein: 29, fat: 8, carbs: 0.5 },
  { name: "Куриная грудка (запечённая)", kcal: 175, protein: 30, fat: 5, carbs: 0.5 },
  { name: "Куриное бедро (жареное)", kcal: 232, protein: 25, fat: 14, carbs: 0 },
  { name: "Котлеты куриные (жареные)", kcal: 222, protein: 18, fat: 14, carbs: 6 },
  { name: "Тефтели говяжьи", kcal: 208, protein: 15, fat: 13, carbs: 8 },
  { name: "Суп куриный с лапшой", kcal: 45, protein: 2.5, fat: 1.5, carbs: 5 },
  { name: "Борщ", kcal: 49, protein: 1.6, fat: 2.2, carbs: 5.5 },
  { name: "Плов с курицей", kcal: 160, protein: 8, fat: 6, carbs: 18 },
  { name: "Говядина (варёная)", kcal: 254, protein: 25.8, fat: 16.8, carbs: 0 },
  { name: "Говядина (жареная)", kcal: 290, protein: 26, fat: 20, carbs: 0 },
  { name: "Яйцо куриное (варёное)", kcal: 157, protein: 12.7, fat: 11.5, carbs: 0.7 },
  { name: "Яичница (жареная)", kcal: 196, protein: 12.9, fat: 15.3, carbs: 0.8 },
  { name: "Омлет", kcal: 184, protein: 9.6, fat: 15.4, carbs: 1.9 },
  { name: "Творог 5%", kcal: 121, protein: 17.2, fat: 5, carbs: 1.8 },
  { name: "Сырники (жареные)", kcal: 220, protein: 14, fat: 10, carbs: 18 },
  { name: "Рис (варёный)", kcal: 116, protein: 2.2, fat: 0.5, carbs: 24.9 },
  { name: "Гречка (варёная)", kcal: 110, protein: 4.2, fat: 1.1, carbs: 21.3 },
  { name: "Овсянка (на воде)", kcal: 88, protein: 3, fat: 1.7, carbs: 15 },
  { name: "Макароны (варёные)", kcal: 112, protein: 3.5, fat: 0.4, carbs: 23.2 },
  { name: "Картофель (варёный)", kcal: 82, protein: 2, fat: 0.4, carbs: 16.7 },
  { name: "Картофель жареный", kcal: 192, protein: 2.8, fat: 9.5, carbs: 23.4 },
  { name: "Картофельное пюре", kcal: 106, protein: 2.2, fat: 3.3, carbs: 16.8 },
  { name: "Хлеб белый", kcal: 265, protein: 7.6, fat: 3.3, carbs: 49 },
  { name: "Хлеб цельнозерновой", kcal: 247, protein: 8.5, fat: 3.4, carbs: 41 },
  { name: "Банан", kcal: 96, protein: 1.5, fat: 0.5, carbs: 21 },
  { name: "Яблоко", kcal: 47, protein: 0.4, fat: 0.4, carbs: 9.8 },
  { name: "Молоко 2.5%", kcal: 52, protein: 2.8, fat: 2.5, carbs: 4.7 },
  { name: "Кефир 1%", kcal: 40, protein: 3, fat: 1, carbs: 4 },
  { name: "Сыр (российский)", kcal: 363, protein: 24.1, fat: 29.5, carbs: 0.3 },
  { name: "Лосось (запечённый)", kcal: 208, protein: 20, fat: 13, carbs: 0 },
  { name: "Рыба (жареная)", kcal: 185, protein: 19, fat: 10, carbs: 4 },
  { name: "Тунец (консерв. в собств. соку)", kcal: 96, protein: 21, fat: 1, carbs: 0 },
  { name: "Огурец", kcal: 15, protein: 0.8, fat: 0.1, carbs: 2.8 },
  { name: "Помидор", kcal: 20, protein: 1.1, fat: 0.2, carbs: 3.7 },
  { name: "Брокколи (варёная)", kcal: 35, protein: 2.4, fat: 0.4, carbs: 7.2 },
  { name: "Авокадо", kcal: 160, protein: 2, fat: 14.7, carbs: 8.5 },
  { name: "Миндаль", kcal: 579, protein: 21.2, fat: 49.9, carbs: 21.6 },
  { name: "Арахисовая паста", kcal: 588, protein: 25, fat: 50, carbs: 20 },
  { name: "Масло оливковое", kcal: 884, protein: 0, fat: 100, carbs: 0 },
  { name: "Масло сливочное", kcal: 748, protein: 0.5, fat: 82.5, carbs: 0.8 },
  { name: "Мёд", kcal: 329, protein: 0.8, fat: 0, carbs: 81 },
  { name: "Шоколад тёмный 70%", kcal: 540, protein: 6.2, fat: 35, carbs: 48 }
];

let nutritionDate = todayISO();
let nutritionEntries = [];
let mealPhotoData = null; // фото приёма пищи (dataURL), хранится как память
let selectedFoodIndex = null; // индекс продукта из базы или null

function loadNutrition() {
  try {
    const raw = readStorage(NUTRITION_KEY, "{}");
    const data = JSON.parse(raw);
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch (error) {
    console.error("DayFlow: повреждены данные питания.", error);
    showToast("Не удалось прочитать данные питания.", "error");
    return {};
  }
}

function saveNutritionDay() {
  const all = loadNutrition();
  if (nutritionEntries.length) all[nutritionDate] = nutritionEntries;
  else delete all[nutritionDate];
  return writeStorage(NUTRITION_KEY, JSON.stringify(all));
}

function setNutritionDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  nutritionDate = date;
  const input = $("nutritionDate");
  if (input) input.value = date;
  const all = loadNutrition();
  nutritionEntries = Array.isArray(all[date]) ? all[date] : [];
  renderNutrition();
}

function calcEntryTotals(entry) {
  const factor = entry.grams / 100;
  return {
    kcal: entry.kcal * factor,
    protein: entry.protein * factor,
    fat: entry.fat * factor,
    carbs: entry.carbs * factor
  };
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

/* Кольцо прогресса: value — съедено, goal — дневная цель. */
function ringHTML(value, goal, variant, centerTop, centerBottom) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const ratio = goal > 0 ? Math.min(Math.max(value / goal, 0), 1) : 0;
  const offset = circumference * (1 - ratio);
  return `<div class="ring ${variant}" role="img" aria-label="${escapeHTML(centerTop)} ${escapeHTML(centerBottom)}">
    <svg viewBox="0 0 100 100">
      <circle class="ring-track" cx="50" cy="50" r="${radius}"></circle>
      <circle class="ring-fill" cx="50" cy="50" r="${radius}"
        stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>
    </svg>
    <div class="ring-center"><strong>${escapeHTML(centerTop)}</strong><small>${escapeHTML(centerBottom)}</small></div>
  </div>`;
}

function renderNutrition() {
  const list = $("mealList");
  if (!list) return;

  const totals = nutritionEntries.reduce((sum, entry) => {
    const t = calcEntryTotals(entry);
    sum.kcal += t.kcal; sum.protein += t.protein; sum.fat += t.fat; sum.carbs += t.carbs;
    return sum;
  }, { kcal: 0, protein: 0, fat: 0, carbs: 0 });

  const kcalDone = Math.round(totals.kcal);
  const remaining = Math.max(NUTRITION_GOALS.kcal - kcalDone, 0);

  const rings = $("nutritionRings");
  if (rings) {
    rings.innerHTML = `
      <div class="ring-block ring-main">
        ${ringHTML(kcalDone, NUTRITION_GOALS.kcal, "ring-kcal", String(kcalDone), `из ${NUTRITION_GOALS.kcal} ккал`)}
        <span class="ring-caption">${remaining > 0 ? `Осталось ${remaining} ккал` : "Дневная норма закрыта"}</span>
      </div>
      <div class="ring-block">
        ${ringHTML(totals.protein, NUTRITION_GOALS.protein, "ring-protein", String(round1(totals.protein)), "г")}
        <span class="ring-name"><i class="dot dot-protein"></i>Белки</span>
        <span class="ring-goal">цель ${NUTRITION_GOALS.protein} г</span>
      </div>
      <div class="ring-block">
        ${ringHTML(totals.fat, NUTRITION_GOALS.fat, "ring-fat", String(round1(totals.fat)), "г")}
        <span class="ring-name"><i class="dot dot-fat"></i>Жиры</span>
        <span class="ring-goal">цель ${NUTRITION_GOALS.fat} г</span>
      </div>
      <div class="ring-block">
        ${ringHTML(totals.carbs, NUTRITION_GOALS.carbs, "ring-carbs", String(round1(totals.carbs)), "г")}
        <span class="ring-name"><i class="dot dot-carbs"></i>Углеводы</span>
        <span class="ring-goal">цель ${NUTRITION_GOALS.carbs} г</span>
      </div>`;
  }

  list.innerHTML = nutritionEntries.map(entry => {
    const t = calcEntryTotals(entry);
    return `<article class="task-item meal-item">
      ${entry.photo ? `<img class="meal-thumb" src="${entry.photo}" alt="Фото: ${escapeHTML(entry.name)}">` : ""}
      <div class="task-main">
        <div class="task-title">${escapeHTML(entry.name)}</div>
        <div class="task-description">${entry.grams} г · ${Math.round(t.kcal)} ккал</div>
        <div class="task-meta">
          <span class="pill macro-protein">Б ${round1(t.protein)} г</span>
          <span class="pill macro-fat">Ж ${round1(t.fat)} г</span>
          <span class="pill macro-carbs">У ${round1(t.carbs)} г</span>
        </div>
      </div>
      <div class="task-actions">
        <button type="button" class="mini-action delete-action" data-meal-delete="${escapeHTML(entry.id)}"
          title="Удалить" aria-label="Удалить продукт">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </article>`;
  }).join("");

  const empty = $("mealEmpty");
  if (empty) empty.classList.toggle("hidden", nutritionEntries.length > 0);
  list.classList.toggle("hidden", nutritionEntries.length === 0);
}

/* === Честный поиск еды: только реальные данные, без выдуманных цифр === */
function normalizeFoodText(value) {
  return String(value || "").toLocaleLowerCase("ru").replace(/ё/g, "е").trim().replace(/\s+/g, " ");
}

function findFoodMatches(query) {
  const q = normalizeFoodText(query);
  if (q.length < 2) return [];
  const words = q.split(" ").filter(word => word.length >= 2);
  if (!words.length) return [];
  return FOOD_DB
    .map((food, index) => ({ food, index }))
    .filter(item => {
      const name = normalizeFoodText(item.food.name);
      return words.every(word => name.includes(word));
    });
}

function renderFoodSuggestions() {
  const box = $("foodSuggestions");
  const input = $("foodNameInput");
  if (!box || !input) return;
  const matches = findFoodMatches(input.value);
  if (!matches.length || selectedFoodIndex !== null) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  box.innerHTML = matches.slice(0, 8).map(item =>
    `<button type="button" class="food-suggestion" data-food-index="${item.index}">
      <span>${escapeHTML(item.food.name)}</span>
      <small>${item.food.kcal} ккал · Б ${item.food.protein} · Ж ${item.food.fat} · У ${item.food.carbs} / 100 г</small>
    </button>`
  ).join("");
  box.classList.remove("hidden");
}

function selectFood(index) {
  const food = FOOD_DB[index];
  if (!food) return;
  selectedFoodIndex = index;
  const input = $("foodNameInput");
  if (input) input.value = food.name;
  const chip = $("selectedFoodChip");
  if (chip) {
    chip.innerHTML = `<span>${escapeHTML(food.name)} — ${food.kcal} ккал · Б ${food.protein} · Ж ${food.fat} · У ${food.carbs} на 100 г</span>
      <button type="button" class="mini-action" id="clearSelectedFood" aria-label="Сбросить выбор">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    chip.classList.remove("hidden");
  }
  $("foodSuggestions")?.classList.add("hidden");
  hideUnknownFoodNotice();
  closeCustomFields();
  updateFoodPreview();
}

function clearSelectedFood() {
  selectedFoodIndex = null;
  $("selectedFoodChip")?.classList.add("hidden");
  const input = $("foodNameInput");
  if (input) { input.value = ""; input.focus(); }
  updateFoodPreview();
}

function getCustomPer100() {
  const fields = ["customKcal", "customProtein", "customFat", "customCarbs"];
  const values = fields.map(id => parseFloat($(id)?.value));
  if (values.some(v => !Number.isFinite(v) || v < 0)) return null;
  const [kcal, protein, fat, carbs] = values;
  if (kcal > 900 || protein > 100 || fat > 100 || carbs > 100) return null;
  return { kcal, protein, fat, carbs };
}

function updateFoodPreview() {
  const preview = $("foodPreview");
  if (!preview) return;
  const grams = parseFloat($("foodGrams")?.value);
  const customVisible = $("customFields") && !$("customFields").classList.contains("hidden");

  let per100 = null;
  if (selectedFoodIndex !== null) per100 = FOOD_DB[selectedFoodIndex] || null;
  else if (customVisible) per100 = getCustomPer100();

  if (!per100 || !Number.isFinite(grams) || grams <= 0) { preview.textContent = ""; return; }
  const f = grams / 100;
  preview.textContent = `${Math.round(per100.kcal * f)} ккал · Б ${round1(per100.protein * f)} · Ж ${round1(per100.fat * f)} · У ${round1(per100.carbs * f)}`;
}

function showUnknownFoodNotice(name) {
  const notice = $("unknownFoodNotice");
  if (!notice) return;
  notice.innerHTML = `<strong>Извините, но «${escapeHTML(name)}» нет в моей базе.</strong>
    Я не знаю КБЖУ этого блюда и не буду выдумывать цифры. Введите значения на 100 г ниже (например, с упаковки) — и я посчитаю всё точно.`;
  notice.classList.remove("hidden");
}

function hideUnknownFoodNotice() {
  $("unknownFoodNotice")?.classList.add("hidden");
}

function openCustomFields() {
  $("customFields")?.classList.remove("hidden");
  $("dbHint")?.classList.add("hidden");
}

function closeCustomFields() {
  $("customFields")?.classList.add("hidden");
  $("dbHint")?.classList.remove("hidden");
}

function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image"));
      img.onload = () => {
        try {
          const max = 480;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        } catch (error) { reject(error); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function initNutrition() {
  const form = $("mealForm");
  if (!form) return; // страница питания не открыта — выходим

  const nameInput = $("foodNameInput");
  nameInput?.addEventListener("input", () => {
    selectedFoodIndex = null;
    $("selectedFoodChip")?.classList.add("hidden");
    hideUnknownFoodNotice();
    closeCustomFields();
    renderFoodSuggestions();
    updateFoodPreview();
  });

  $("foodSuggestions")?.addEventListener("click", event => {
    const button = event.target.closest("[data-food-index]");
    if (button) selectFood(Number(button.dataset.foodIndex));
  });

  $("selectedFoodChip")?.addEventListener("click", event => {
    if (event.target.closest("#clearSelectedFood")) clearSelectedFood();
  });

  $("addOwnFoodBtn")?.addEventListener("click", () => {
    selectedFoodIndex = null;
    $("selectedFoodChip")?.classList.add("hidden");
    hideUnknownFoodNotice();
    openCustomFields();
    $("customKcal")?.focus();
  });

  const dateInput = $("nutritionDate");
  if (dateInput) {
    dateInput.value = nutritionDate;
    dateInput.addEventListener("change", event => {
      if (event.target.value) setNutritionDate(event.target.value);
    });
  }
  $("nutritionPrevDay")?.addEventListener("click", () => {
    const d = new Date(`${nutritionDate}T12:00:00`);
    d.setDate(d.getDate() - 1);
    setNutritionDate(dateISO(d));
  });
  $("nutritionNextDay")?.addEventListener("click", () => {
    const d = new Date(`${nutritionDate}T12:00:00`);
    d.setDate(d.getDate() + 1);
    setNutritionDate(dateISO(d));
  });

  ["foodGrams", "customKcal", "customProtein", "customFat", "customCarbs"].forEach(id => {
    $(id)?.addEventListener("input", updateFoodPreview);
  });

  const photoInput = $("mealPhoto");
  photoInput?.addEventListener("change", async () => {
    const file = photoInput.files && photoInput.files[0];
    mealPhotoData = null;
    const previewWrap = $("photoPreviewWrap");
    const previewImg = $("photoPreview");
    if (!file) {
      previewWrap?.classList.add("hidden");
      return;
    }
    if (!file.type.startsWith("image/")) {
      showToast("Можно прикрепить только изображение.", "error");
      photoInput.value = "";
      return;
    }
    try {
      mealPhotoData = await compressPhoto(file);
      if (previewImg) previewImg.src = mealPhotoData;
      previewWrap?.classList.remove("hidden");
    } catch (error) {
      console.error("DayFlow: не удалось обработать фото.", error);
      showToast("Не удалось обработать фото.", "error");
      photoInput.value = "";
    }
  });
  $("removePhoto")?.addEventListener("click", () => {
    mealPhotoData = null;
    if (photoInput) photoInput.value = "";
    $("photoPreviewWrap")?.classList.add("hidden");
  });

  form.addEventListener("submit", event => {
    event.preventDefault();

    const name = nameInput ? nameInput.value.trim() : "";
    if (name.length < 2) { showToast("Напишите название еды.", "error"); return; }

    const grams = parseFloat($("foodGrams").value);
    if (!Number.isFinite(grams) || grams <= 0 || grams > 5000) {
      showToast("Укажите граммы от 1 до 5000.", "error");
      return;
    }

    let entryBase = null;
    const customVisible = $("customFields") && !$("customFields").classList.contains("hidden");

    if (selectedFoodIndex !== null) {
      entryBase = FOOD_DB[selectedFoodIndex];
    } else if (customVisible) {
      const per100 = getCustomPer100();
      if (!per100) {
        showToast("Заполните КБЖУ на 100 г корректными числами (с упаковки или рецепта).", "error");
        return;
      }
      entryBase = { name, ...per100 };
    } else {
      const exact = FOOD_DB.find(food => normalizeFoodText(food.name) === normalizeFoodText(name));
      if (exact) {
        entryBase = exact;
      } else {
        // Честный отказ: продукт неизвестен — цифры не выдумываем.
        showUnknownFoodNotice(name);
        openCustomFields();
        showToast("Этого блюда нет в базе — введите КБЖУ на 100 г, чтобы расчёт был честным.", "error");
        return;
      }
    }
    if (!entryBase) { showToast("Не удалось определить продукт.", "error"); return; }

    const entry = {
      id: createId(),
      name: entryBase.name,
      grams: Math.round(grams),
      kcal: entryBase.kcal,
      protein: entryBase.protein,
      fat: entryBase.fat,
      carbs: entryBase.carbs,
      photo: mealPhotoData || ""
    };

    const previous = nutritionEntries;
    nutritionEntries = [...nutritionEntries, entry];
    if (!saveNutritionDay()) {
      nutritionEntries = previous;
      return;
    }

    showToast("Продукт добавлен");
    form.reset();
    selectedFoodIndex = null;
    mealPhotoData = null;
    $("selectedFoodChip")?.classList.add("hidden");
    $("foodSuggestions")?.classList.add("hidden");
    $("photoPreviewWrap")?.classList.add("hidden");
    hideUnknownFoodNotice();
    closeCustomFields();
    updateFoodPreview();
    renderNutrition();
  });

  $("mealList")?.addEventListener("click", event => {
    const button = event.target.closest("[data-meal-delete]");
    if (!button) return;
    const previous = nutritionEntries;
    nutritionEntries = nutritionEntries.filter(entry => entry.id !== button.dataset.mealDelete);
    if (!saveNutritionDay()) {
      nutritionEntries = previous;
      return;
    }
    renderNutrition();
    showToast("Продукт удалён");
  });

  setNutritionDate(nutritionDate);
}
