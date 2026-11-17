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
