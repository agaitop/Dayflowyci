const STORAGE_KEY = "dayflow_tasks_v1";
const CATEGORIES = {
  study: ["Учёба", "⌘"], sport: ["Спорт", "⚡"], work: ["Работа", "▣"],
  rest: ["Отдых", "☕"], personal: ["Личное", "♡"], ideas: ["Идеи", "✦"]
};
const STATUSES = {
  todo: ["Не начато", "todo", "#9aa2b1"],
  doing: ["В процессе", "doing", "#4388e8"],
  done: ["Выполнено", "done", "#20a36a"],
  cancelled: ["Отменено", "cancelled", "#df5555"]
};
const PRIORITIES = {
  high: ["Высокий", "priority-high"],
  normal: ["Обычный", "priority-normal"],
  low: ["Низкий", "priority-low"]
};
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

function saveTasks(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
function escapeHTML(value=""){
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function formatDate(iso){
  return new Date(iso+"T12:00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"});
}
function pluralTasks(n){
  const mod10=n%10, mod100=n%100;
  if(mod10===1 && mod100!==11) return "задача";
  if(mod10>=2 && mod10<=4 && (mod100<12 || mod100>14)) return "задачи";
  return "задач";
}
function setDate(date){
  selectedDate=date;
  if($("selectedDate")) $("selectedDate").value=date;
  renderTasks();
  renderWeekStrip();
  updateNoteForDate();
}
function openModal(category="study", task=null){
  if(!$("taskModal")) return;
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
  $("taskModal").classList.remove("hidden");
  $("taskTitle").focus();
}
function closeModal(){ $("taskModal")?.classList.add("hidden"); }
function toggleSportFields(){ $("sportFields")?.classList.toggle("hidden", $("taskCategory").value!=="sport"); }

function renderWeekStrip(){
  const strip=$("weekStrip");
  if(!strip) return;
  const selected=new Date(selectedDate+"T12:00:00");
  const monday=new Date(selected);
  const day=(monday.getDay()+6)%7;
  monday.setDate(monday.getDate()-day);
  const names=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
  strip.innerHTML=names.map((name,i)=>{
    const d=new Date(monday); d.setDate(monday.getDate()+i);
    const iso=dateISO(d);
    const count=tasks.filter(t=>t.date===iso).length;
    return `<button type="button" class="week-day ${iso===selectedDate?"selected":""} ${iso===todayISO()?"is-today":""}" data-week-date="${iso}">
      <span>${name}</span><strong>${d.getDate()}</strong><small>${count ? count+" "+(count===1?"дело":"дел") : "—"}</small>
    </button>`;
  }).join("");
}
function renderTasks(){
  if(!$("taskList")) return;
  const dayTasks=tasks.filter(t=>t.date===selectedDate);
  const filtered=dayTasks.filter(t=>{
    const matchesStatus=activeStatus==="all"||t.status===activeStatus;
    const matchesCategory=activeCategory==="all"||t.category===activeCategory;
    const q=searchQuery.toLocaleLowerCase("ru");
    const matchesSearch=!q || [t.title,t.description,t.sportType,t.sportGoal].some(v=>String(v||"").toLocaleLowerCase("ru").includes(q));
    return matchesStatus && matchesCategory && matchesSearch;
  }).sort((a,b)=>{
    const priorityOrder={high:0,normal:1,low:2};
    return (priorityOrder[a.priority||"normal"]-priorityOrder[b.priority||"normal"]) ||
      (a.time||"99:99").localeCompare(b.time||"99:99");
  });
  const done=dayTasks.filter(t=>t.status==="done").length;
  const doing=dayTasks.filter(t=>t.status==="doing").length;
  const remaining=dayTasks.filter(t=>t.status==="todo").length;
  if($("totalCount")) $("totalCount").textContent=dayTasks.length;
  if($("doneCount")) $("doneCount").textContent=done;
  if($("progressCount")) $("progressCount").textContent=doing;
  if($("remainingCount")) $("remainingCount").textContent=remaining;
  const percent=dayTasks.length?Math.round(done/dayTasks.length*100):0;
  if($("progressPercent")) $("progressPercent").textContent=percent+"%";
  if($("progressBar")) $("progressBar").style.width=percent+"%";
  if($("taskCountHint")) $("taskCountHint").textContent=`Показано ${filtered.length} из ${dayTasks.length} ${pluralTasks(dayTasks.length)}`;
  $("taskList").innerHTML=filtered.map(t=>{
    const cat=CATEGORIES[t.category]||CATEGORIES.personal;
    const status=STATUSES[t.status]||STATUSES.todo;
    const priority=PRIORITIES[t.priority]||PRIORITIES.normal;
    const extra=t.category==="sport" && (t.sportType||t.sportGoal)
      ? `<div class="task-description">${escapeHTML(t.sportType||"Активность")}${t.sportGoal?" · цель: "+escapeHTML(t.sportGoal):""}</div>`:"";
    return `<article class="task-item">
      <div class="task-color" style="background:${status[2]}"></div>
      <div class="task-main">
        <div class="task-title">${escapeHTML(t.title)}</div>
        ${t.description?`<div class="task-description">${escapeHTML(t.description)}</div>`:""}${extra}
        <div class="task-meta">
          <span class="category-pill">${cat[1]} ${cat[0]}</span>
          <span class="status-pill ${status[1]}">${status[0]}</span>
          <span class="priority-pill ${priority[1]}">${priority[0]} приоритет</span>
          ${t.time?`<span class="task-time">◷ ${escapeHTML(t.time)}</span>`:""}
        </div>
      </div>
      <div class="task-actions">
        <select class="status-select" aria-label="Статус задачи" data-status-id="${t.id}">
          ${Object.entries(STATUSES).map(([key,val])=>`<option value="${key}" ${t.status===key?"selected":""}>${val[0]}</option>`).join("")}
        </select>
        <button class="mini-action" title="Редактировать" aria-label="Редактировать задачу" data-edit-id="${t.id}">✎</button>
        <button class="mini-action delete-action" title="Удалить" aria-label="Удалить задачу" data-delete-id="${t.id}">×</button>
      </div>
    </article>`;
  }).join("");
  if($("emptyState")){
    const hasDayTasks=dayTasks.length>0;
    $("emptyState").classList.toggle("hidden",filtered.length>0);
    $("taskList").classList.toggle("hidden",filtered.length===0);
    const title=$("emptyState").querySelector("h3");
    const desc=$("emptyState").querySelector("p");
    if(title && desc){
      title.textContent=hasDayTasks?"Ничего не найдено":"Пока задач нет";
      desc.textContent=hasDayTasks?"Попробуй изменить поиск или фильтры.":"Добавь первое дело — оно появится здесь.";
    }
  }
  if($("fullDate")) $("fullDate").textContent="ТВОЙ ПЛАН · "+formatDate(selectedDate).toLocaleUpperCase("ru-RU");
  renderWeekStrip();
}
function renderCategoryCounts(){
  Object.keys(CATEGORIES).forEach(key=>{
    const el=$("count-"+key);
    if(el){
      const count=tasks.filter(t=>t.category===key).length;
      el.textContent=`${count} ${pluralTasks(count)}`;
    }
  });
}
function updateHeader(){
  const now=new Date();
  if($("headerDate")) $("headerDate").textContent=now.toLocaleDateString("ru-RU",{weekday:"short",day:"numeric",month:"short"});
}
function applyTheme(){
  const dark=localStorage.getItem("dayflow_theme")==="dark";
  document.body.classList.toggle("dark",dark);
  const icon=$("themeIcon");
  if(icon) icon.textContent=dark?"☀":"☾";
  const toggle=$("themeToggle");
  if(toggle) toggle.innerHTML=`<span id="themeIcon">${dark?"☀":"☾"}</span> ${dark?"Светлая тема":"Тёмная тема"}`;
}
function toggleTheme(){
  localStorage.setItem("dayflow_theme",document.body.classList.contains("dark")?"light":"dark");
  applyTheme();
}
function updateNoteForDate(){
  const note=$("dailyNote");
  if(!note) return;
  note.value=localStorage.getItem("dayflow_note_"+selectedDate)||"";
}
function init(){
  updateHeader(); applyTheme(); renderTasks(); renderCategoryCounts(); renderWeekStrip();
  if($("selectedDate")){
    $("selectedDate").value=selectedDate;
    $("selectedDate").addEventListener("change",e=>{if(e.target.value)setDate(e.target.value);});
  }
  $("addTaskTop")?.addEventListener("click",()=>openModal());
  $("emptyAdd")?.addEventListener("click",()=>openModal());
  $("closeModal")?.addEventListener("click",closeModal);
  $("cancelModal")?.addEventListener("click",closeModal);
  $("taskCategory")?.addEventListener("change",toggleSportFields);
  $("taskModal")?.addEventListener("click",e=>{if(e.target===$("taskModal"))closeModal();});
  $("taskForm")?.addEventListener("submit",e=>{
    e.preventDefault();
    const title=$("taskTitle").value.trim();
    if(title.length<2){$("taskTitle").setCustomValidity("Введите название хотя бы из двух символов.");$("taskTitle").reportValidity();return;}
    $("taskTitle").setCustomValidity("");
    const id=$("taskId").value;
    const item={
      ...(tasks.find(t=>t.id===id)||{}),
      id:id||crypto.randomUUID(),
      title,
      description:$("taskDescription").value.trim(),
      category:$("taskCategory").value,
      date:$("taskDate").value,
      time:$("taskTime").value,
      priority:$("taskPriority").value,
      status:$("taskStatus").value,
      sportType:$("sportType").value,
      sportGoal:$("sportGoal").value.trim()
    };
    if(id) tasks=tasks.map(t=>t.id===id?item:t); else tasks.push(item);
    saveTasks();
    selectedDate=item.date;
    activeCategory="all"; activeStatus="all"; searchQuery="";
    if($("selectedDate")) $("selectedDate").value=selectedDate;
    if($("taskSearch")) $("taskSearch").value="";
    document.querySelectorAll("[data-status]").forEach(b=>b.classList.toggle("selected",b.dataset.status==="all"));
    closeModal(); renderTasks(); renderCategoryCounts(); updateNoteForDate();
  });
  $("taskList")?.addEventListener("change",e=>{
    const id=e.target.dataset.statusId;
    if(!id)return;
    const task=tasks.find(t=>t.id===id);
    if(task){task.status=e.target.value;saveTasks();renderTasks();}
  });
  $("taskList")?.addEventListener("click",e=>{
    const edit=e.target.closest("[data-edit-id]");
    const del=e.target.closest("[data-delete-id]");
    if(edit){const task=tasks.find(t=>t.id===edit.dataset.editId);if(task)openModal(task.category,task);}
    if(del){
      const task=tasks.find(t=>t.id===del.dataset.deleteId);
      if(task&&confirm(`Удалить задачу «${task.title}»?`)){
        tasks=tasks.filter(t=>t.id!==task.id);saveTasks();renderTasks();renderCategoryCounts();
      }
    }
  });
  $("weekStrip")?.addEventListener("click",e=>{
    const btn=e.target.closest("[data-week-date]");
    if(btn)setDate(btn.dataset.weekDate);
  });
  $("taskSearch")?.addEventListener("input",e=>{searchQuery=e.target.value.trim();renderTasks();});
  document.querySelectorAll("[data-status]").forEach(btn=>btn.addEventListener("click",()=>{
    activeStatus=btn.dataset.status;
    document.querySelectorAll("[data-status]").forEach(b=>b.classList.toggle("selected",b===btn));
    renderTasks();
  }));
  document.querySelectorAll("[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{
    activeCategory=btn.dataset.filter;activeStatus="all";
    document.querySelectorAll("[data-status]").forEach(b=>b.classList.toggle("selected",b.dataset.status==="all"));
    document.querySelectorAll("[data-filter]").forEach(b=>b.classList.toggle("active",b===btn));
    renderTasks();
    $("taskList")?.scrollIntoView({behavior:"smooth",block:"nearest"});
  }));
  document.querySelectorAll("[data-category]").forEach(btn=>btn.addEventListener("click",()=>openModal(btn.dataset.category)));
  $("prevDay")?.addEventListener("click",()=>{
    const d=new Date(selectedDate+"T12:00:00");d.setDate(d.getDate()-1);setDate(dateISO(d));
  });
  $("nextDay")?.addEventListener("click",()=>{
    const d=new Date(selectedDate+"T12:00:00");d.setDate(d.getDate()+1);setDate(dateISO(d));
  });
  $("themeToggle")?.addEventListener("click",toggleTheme);
  $("themeToggleTop")?.addEventListener("click",toggleTheme);
  const sidebar=$("sidebar");
  const backdrop=$("navBackdrop");
  const closeMenu=()=>{
    sidebar?.classList.remove("open");
    backdrop?.classList.remove("visible");
    $("menuToggle")?.setAttribute("aria-expanded","false");
  };
  $("menuToggle")?.addEventListener("click",()=>{
    const isOpen=sidebar?.classList.toggle("open");
    backdrop?.classList.toggle("visible",!!isOpen);
    $("menuToggle")?.setAttribute("aria-expanded",String(!!isOpen));
  });
  backdrop?.addEventListener("click",closeMenu);
  sidebar?.querySelectorAll("a,button").forEach(item=>item.addEventListener("click",()=>{
    if(window.matchMedia("(max-width: 700px)").matches) closeMenu();
  }));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeMenu();});
  const note=$("dailyNote");
  if(note){
    updateNoteForDate();
    note.addEventListener("input",()=>{
      localStorage.setItem("dayflow_note_"+selectedDate,note.value);
      $("noteSaved").textContent="Сохранено автоматически";
    });
  }
  // Highlight category navigation when a category filter is active.
  document.querySelectorAll("[data-filter]").forEach(b=>b.classList.toggle("active",b.dataset.filter===activeCategory));
}
document.addEventListener("DOMContentLoaded",init);
