const STORAGE_KEY = "dayflow_tasks_v1";
const CATEGORIES = {
  study: ["Учёба", "⌘"], sport: ["Спорт", "⚡"], work: ["Работа", "▣"],
  rest: ["Отдых", "☕"], personal: ["Личное", "♡"], ideas: ["Идеи", "✦"]
};
const STATUSES = {
  todo: ["Не начато", "todo", "#9aa2b1"], doing: ["В процессе", "doing", "#4388e8"],
  done: ["Выполнено", "done", "#20a36a"], cancelled: ["Отменено", "cancelled", "#df5555"]
};
const PRIORITIES = { high: ["Высокий", "priority-high"], normal: ["Обычный", "priority-normal"], low: ["Низкий", "priority-low"] };

const $ = id => document.getElementById(id);
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const dateISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

const safeTasks = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

let tasks = safeTasks();
let selectedDate = todayISO();
let activeStatus = "all";
let activeCategory = new URLSearchParams(location.search).get("category") || "all";
let searchQuery = "";

// === СИСТЕМА УВЕДОМЛЕНИЙ ===
function showToast(message, type = "info") {
  const container = $("toast-container");
  if (!container) return;
  
  const icons = { success: "✓", error: "×", info: "ℹ" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || "ℹ"}</span><span>${message}</span>`;
  
  container.appendChild(toast);
  
  // Автоматическое удаление через 3.5 секунды
  setTimeout(() => {
    toast.style.animation = "toastFadeOut 0.3s forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function sendBrowserNotification(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { 
      body, 
      icon: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png", // Иконка планировщика
      badge: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png"
    });
  }
}

// Проверка задач каждую минуту для напоминаний
setInterval(() => {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const today = todayISO();
  let changed = false;

  tasks.forEach(t => {
    if (t.date === today && t.time === currentTime && t.status !== "done" && t.status !== "cancelled" && !t.notified) {
      sendBrowserNotification("DayFlow: Напоминание ⏰", `Пора начать: ${t.title}`);
      showToast(`Напоминание: ${t.title}`, "info");
      t.notified = true; // Помечаем, чтобы не спамить
      changed = true;
    }
  });

  if (changed) saveTasks();
}, 30000); // Проверка каждые 30 секунд
// ================================

function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }

function escapeHTML(value="") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function formatDate(iso) {
  return new Date(iso+"T12:00:00").toLocaleDateString("ru-RU", {day:"numeric", month:"long", year:"numeric"});
}

function pluralTasks(n) {
  const mod10=n%10, mod100=n%100;
  if(mod10===1 && mod100!==11) return "задача";
  if(mod10>=2 && mod10<=4 && (mod100<12 || mod100>14)) return "задачи";
  return "задач";
}

function setDate(date) {
  selectedDate = date;
  const dateInput = $("selectedDate");
  if (dateInput) dateInput.value = date;
  renderTasks();
  renderWeekStrip();
  updateNoteForDate();
}

function openModal(category="study", task=null) {
  const modal = $("taskModal");
  if (!modal) return;
  $("taskForm").reset();
  $("taskId").value = task?.id || "";
  $("modalTitle").textContent = task ? "Изменить задачу" : "Добавить задачу";
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
  $("taskTitle").focus();
}

function closeModal() { 
  const modal = $("taskModal");
  if (modal) modal.classList.add("hidden"); 
}

function toggleSportFields() { 
  const sf = $("sportFields");
  const tc = $("taskCategory");
  if (sf && tc) sf.classList.toggle("hidden", tc.value !== "sport"); 
}

function renderWeekStrip() {
  const strip = $("weekStrip");
  if (!strip) return;
  const selected = new Date(selectedDate + "T12:00:00");
  const monday = new Date(selected);
  const day = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - day);
  const names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  
  strip.innerHTML = names.map((name, i) => {
    const d = new Date(monday); 
    d.setDate(monday.getDate() + i);
    const iso = dateISO(d);
    const count = tasks.filter(t => t.date === iso).length;
    return `<button type="button" class="week-day ${iso === selectedDate ? "selected" : ""} ${iso === todayISO() ? "is-today" : ""}" data-week-date="${iso}">
      <span>${name}</span><strong>${d.getDate()}</strong><small>${count ? count + " " + (count === 1 ? "дело" : "дел") : "—"}</small>
    </button>`;
  }).join("");
}

function renderTasks() {
  const taskList = $("taskList");
  if (!taskList) return;
  
  const dayTasks = tasks.filter(t => t.date === selectedDate);
  const filtered = dayTasks.filter(t => {
    const matchesStatus = activeStatus === "all" || t.status === activeStatus;
    const matchesCategory = activeCategory === "all" || t.category === activeCategory;
    const q = searchQuery.toLocaleLowerCase("ru");
    const matchesSearch = !q || [t.title, t.description, t.sportType, t.sportGoal].some(v => String(v || "").toLocaleLowerCase("ru").includes(q));
    return matchesStatus && matchesCategory && matchesSearch;
  }).sort((a, b) => {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    return (priorityOrder[a.priority || "normal"] - priorityOrder[b.priority || "normal"]) || (a.time || "99:99").localeCompare(b.time || "99:99");
  });

  const done = dayTasks.filter(t => t.status === "done").length;
  const doing = dayTasks.filter(t => t.status === "doing").length;
  const remaining = dayTasks.filter(t => t.status === "todo").length;

  const elTotal = $("totalCount"); if (elTotal) elTotal.textContent = dayTasks.length;
  const elDone = $("doneCount"); if (elDone) elDone.textContent = done;
  const elProgress = $("progressCount"); if (elProgress) elProgress.textContent = doing;
  const elRemaining = $("remainingCount"); if (elRemaining) elRemaining.textContent = remaining;
  
  const percent = dayTasks.length ? Math.round((done / dayTasks.length) * 100) : 0;
  const elPercent = $("progressPercent"); if (elPercent) elPercent.textContent = percent + "%";
  const elBar = $("progressBar"); if (elBar) elBar.style.width = percent + "%";
  
  const elHint = $("taskCountHint"); 
  if (elHint) elHint.textContent = `Показано ${filtered.length} из ${dayTasks.length} ${pluralTasks(dayTasks.length)}`;

  taskList.innerHTML = filtered.map(t => {
    const cat = CATEGORIES[t.category] || CATEGORIES.personal;
    const status = STATUSES[t.status] || STATUSES.todo;
    const priority = PRIORITIES[t.priority] || PRIORITIES.normal;
    const extra = t.category === "sport" && (t.sportType || t.sportGoal)
      ? `<div class="task-description">${escapeHTML(t.sportType || "Активность")}${t.sportGoal ? " · цель: " + escapeHTML(t.sportGoal) : ""}</div>` : "";
    
    return `<article class="task-item">
      <div class="task-color" style="background:${status[2]}"></div>
      <div class="task-main">
        <div class="task-title">${escapeHTML(t.title)}</div>
        ${t.description ? `<div class="task-description">${escapeHTML(t.description)}</div>` : ""}${extra}
        <div class="task-meta">
          <span class="category-pill">${cat[1]} ${cat[0]}</span>
          <span class="status-pill ${status[1]}">${status[0]}</span>
          <span class="priority-pill ${priority[1]}">${priority[0]} приоритет</span>
          ${t.time ? `<span class="task-time">◷ ${escapeHTML(t.time)}</span>` : ""}
        </div>
      </div>
      <div class="task-actions">
        <select class="status-select" aria-label="Статус задачи" data-status-id="${t.id}">
          ${Object.entries(STATUSES).map(([key, val]) => `<option value="${key}" ${t.status === key ? "selected" : ""}>${val[0]}</option>`).join("")}
        </select>
        <button class="mini-action" title="Редактировать" aria-label="Редактировать задачу" data-edit-id="${t.id}">✎</button>
        <button class="mini-action delete-action" title="Удалить" aria-label="Удалить задачу" data-delete-id="${t.id}">×</button>
      </div>
    </article>`;
  }).join("");

  const emptyState = $("emptyState");
  if (emptyState) {
    const hasDayTasks = dayTasks.length > 0;
    emptyState.classList.toggle("hidden", filtered.length > 0);
    taskList.classList.toggle("hidden", filtered.length === 0);
    const title = emptyState.querySelector("h3");
    const desc = emptyState.querySelector("p");
    if (title && desc) {
      title.textContent = hasDayTasks ? "Ничего не найдено" : "Пока задач нет";
      desc.textContent = hasDayTasks ? "Попробуй изменить поиск или фильтры." : "Добавь первое дело — оно появится здесь.";
    }
  }
  
  const fullDate = $("fullDate");
  if (fullDate) fullDate.textContent = "ТВОЙ ПЛАН · " + formatDate(selectedDate).toLocaleUpperCase("ru-RU");
  
  renderWeekStrip();
}

function renderCategoryCounts() {
  Object.keys(CATEGORIES).forEach(key => {
    const el = $("count-" + key);
    if (el) {
      const count = tasks.filter(t => t.category === key).length;
      el.textContent = `${count} ${pluralTasks(count)}`;
    }
  });
}

function updateHeader() {
  const now = new Date();
  const el = $("headerDate");
  if (el) el.textContent = now.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
}

function applyTheme() {
  const dark = localStorage.getItem("dayflow_theme") === "dark";
  document.body.classList.toggle("dark", dark);
  const icon = $("themeIcon");
  if (icon) icon.textContent = dark ? "☀" : "☾";
  const toggle = $("themeToggle");
  if (toggle) toggle.innerHTML = `<span id="themeIcon">${dark ? "☀" : "☾"}</span> ${dark ? "Светлая тема" : "Тёмная тема"}`;
}

function toggleTheme() {
  localStorage.setItem("dayflow_theme", document.body.classList.contains("dark") ? "light" : "dark");
  applyTheme();
  showToast("Тема изменена", "success");
}

function updateNoteForDate() {
  const note = $("dailyNote");
  if (!note) return;
  note.value = localStorage.getItem("dayflow_note_" + selectedDate) || "";
}

function closeMenu() {
  const sidebar = $("sidebar");
  const backdrop = $("navBackdrop");
  const menuBtn = $("menuToggle");
  if (sidebar) sidebar.classList.remove("open");
  if (backdrop) backdrop.classList.remove("visible");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
}

function init() {
  updateHeader(); 
  applyTheme(); 
  renderTasks(); 
  renderCategoryCounts(); 
  renderWeekStrip();
  
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
  
  const modal = $("taskModal");
  if (modal) {
    modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
  }

  const taskForm = $("taskForm");
  if (taskForm) {
    taskForm.addEventListener("submit", e => {
      e.preventDefault();
      const titleInput = $("taskTitle");
      const title = titleInput.value.trim();
      if (title.length < 2) {
        titleInput.setCustomValidity("Введите название хотя бы из двух символов.");
        titleInput.reportValidity();
        return;
      }
      titleInput.setCustomValidity("");
      
      const id = $("taskId").value;
      const item = {
        ...(tasks.find(t => t.id === id) || {}),
        id: id || crypto.randomUUID(),
        title,
        description: $("taskDescription").value.trim(),
        category: $("taskCategory").value,
        date: $("taskDate").value,
        time: $("taskTime").value,
        priority: $("taskPriority").value,
        status: $("taskStatus").value,
        sportType: $("sportType").value,
        sportGoal: $("sportGoal").value.trim(),
        notified: false // Сбрасываем флаг уведомления при редактировании
      };
      
      if (id) {
        tasks = tasks.map(t => t.id === id ? item : t);
        showToast("Задача обновлена", "success");
      } else {
        tasks.push(item);
        showToast("Задача успешно добавлена", "success");
      }
      
      // Запрашиваем разрешение на уведомления, если указано время
      if (item.time) {
        requestNotificationPermission();
      }

      saveTasks();
      selectedDate = item.date;
      activeCategory = "all"; 
      activeStatus = "all"; 
      searchQuery = "";
      
      if (dateInput) dateInput.value = selectedDate;
      const searchInput = $("taskSearch");
      if (searchInput) searchInput.value = "";
      
      document.querySelectorAll("[data-status]").forEach(b => b.classList.toggle("selected", b.dataset.status === "all"));
      closeModal(); 
      renderTasks(); 
      renderCategoryCounts(); 
      updateNoteForDate();
    });
  }

  const taskList = $("taskList");
  if (taskList) {
    taskList.addEventListener("change", e => {
      const id = e.target.dataset.statusId;
      if (!id) return;
      const task = tasks.find(t => t.id === id);
      if (task) { 
        task.status = e.target.value; 
        if (task.status === "done") showToast("Отличная работа! Задача выполнена", "success");
        saveTasks(); 
        renderTasks(); 
      }
    });
    
    taskList.addEventListener("click", e => {
      const edit = e.target.closest("[data-edit-id]");
      const del = e.target.closest("[data-delete-id]");
      if (edit) {
        const task = tasks.find(t => t.id === edit.dataset.editId);
        if (task) openModal(task.category, task);
      }
      if (del) {
        const task = tasks.find(t => t.id === del.dataset.deleteId);
        if (task && confirm(`Удалить задачу «${task.title}»?`)) {
          tasks = tasks.filter(t => t.id !== task.id);
          saveTasks(); 
          renderTasks(); 
          renderCategoryCounts();
          showToast("Задача удалена", "error");
        }
      }
    });
  }

  $("weekStrip")?.addEventListener("click", e => {
    const btn = e.target.closest("[data-week-date]");
    if (btn) setDate(btn.dataset.weekDate);
  });

  $("taskSearch")?.addEventListener("input", e => {
    searchQuery = e.target.value.trim();
    renderTasks();
  });

  document.querySelectorAll("[data-status]").forEach(btn => btn.addEventListener("click", () => {
    activeStatus = btn.dataset.status;
    document.querySelectorAll("[data-status]").forEach(b => b.classList.toggle("selected", b === btn));
    renderTasks();
  }));

  document.querySelectorAll("[data-filter]").forEach(btn => btn.addEventListener("click", () => {
    activeCategory = btn.dataset.filter;
    activeStatus = "all";
    document.querySelectorAll("[data-status]").forEach(b => b.classList.toggle("selected", b.dataset.status === "all"));
    document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b === btn));
    renderTasks();
    const tl = $("taskList");
    if (tl) tl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }));

  document.querySelectorAll("[data-category]").forEach(btn => btn.addEventListener("click", () => openModal(btn.dataset.category)));

  $("prevDay")?.addEventListener("click", () => {
    const d = new Date(selectedDate + "T12:00:00"); d.setDate(d.getDate() - 1); setDate(dateISO(d));
  });
  $("nextDay")?.addEventListener("click", () => {
    const d = new Date(selectedDate + "T12:00:00"); d.setDate(d.getDate() + 1); setDate(dateISO(d));
  });

  $("themeToggle")?.addEventListener("click", toggleTheme);
  $("themeToggleTop")?.addEventListener("click", toggleTheme);

  const menuBtn = $("menuToggle");
  const backdrop = $("navBackdrop");
  
  menuBtn?.addEventListener("click", () => {
    const sidebar = $("sidebar");
    const isOpen = sidebar?.classList.toggle("open");
    if (backdrop) backdrop.classList.toggle("visible", !!isOpen);
    if (menuBtn) menuBtn.setAttribute("aria-expanded", String(!!isOpen));
  });
  
  backdrop?.addEventListener("click", closeMenu);
  
  const sidebar = $("sidebar");
  sidebar?.querySelectorAll("a, button").forEach(item => item.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 768px)").matches) closeMenu();
  }));
  
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeMenu(); });

  const note = $("dailyNote");
  if (note) {
    updateNoteForDate();
    let saveTimeout;
    note.addEventListener("input", () => {
      clearTimeout(saveTimeout);
      const hint = $("noteSaved");
      if (hint) hint.textContent = "Сохранение...";
      
      saveTimeout = setTimeout(() => {
        localStorage.setItem("dayflow_note_" + selectedDate, note.value);
        if (hint) {
          hint.textContent = "✓ Сохранено автоматически";
          showToast("Заметка сохранена", "success");
          setTimeout(() => { if (hint) hint.textContent = "Заметка сохраняется автоматически"; }, 2000);
        }
      }, 800); // Debounce для сохранения
    });
  }

  document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b.dataset.filter === activeCategory));
}

document.addEventListener("DOMContentLoaded", init);
