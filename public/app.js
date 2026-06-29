const app = document.querySelector("#app");
const modal = document.querySelector("#modal");
const studioName = document.querySelector("#studioName");
const projectFilter = document.querySelector("#projectFilter");
const currentPerson = document.querySelector("#currentPerson");

const ui = {
  data: null,
  view: localStorage.getItem("view") || "assets",
  selectedAssetId: localStorage.getItem("selectedAssetId") || "",
  search: "",
  category: "",
  status: "",
  projectId: localStorage.getItem("projectId") || "all",
  currentPersonId: localStorage.getItem("currentPersonId") || ""
};

const escapeMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
};

init();

async function init() {
  bindEvents();
  await loadState();
}

function bindEvents() {
  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
  app.addEventListener("submit", onSubmit);
  modal.addEventListener("submit", onModalSubmit);
}

async function loadState() {
  ui.data = await api("/api/state");
  ui.currentPersonId = validId(ui.data.people, ui.currentPersonId) || ui.data.people[0]?.id || "";
  ui.projectId = ui.projectId === "all" || validId(ui.data.projects, ui.projectId) ? ui.projectId : "all";
  render();
}

function render() {
  studioName.textContent = ui.data.settings.studioName;
  renderTopControls();
  document.querySelectorAll(".tabs button").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.view === ui.view));
  });

  if (ui.view === "schedule") {
    renderSchedule();
  } else if (ui.view === "team") {
    renderTeam();
  } else {
    renderAssets();
  }
}

function renderTopControls() {
  projectFilter.innerHTML = [
    `<option value="all">所有项目</option>`,
    ...ui.data.projects.map((project) => (
      `<option value="${esc(project.id)}"${project.id === ui.projectId ? " selected" : ""}>${esc(project.name)}</option>`
    ))
  ].join("");

  currentPerson.innerHTML = ui.data.people.map((person) => (
    `<option value="${esc(person.id)}"${person.id === ui.currentPersonId ? " selected" : ""}>${esc(person.name)}</option>`
  )).join("");
}

function renderAssets() {
  const assets = filteredAssets();
  if (!assets.some((asset) => asset.id === ui.selectedAssetId)) {
    ui.selectedAssetId = assets[0]?.id || "";
  }
  const selected = ui.data.assets.find((asset) => asset.id === ui.selectedAssetId);
  localStorage.setItem("selectedAssetId", ui.selectedAssetId);

  app.innerHTML = `
    ${renderSummary()}
    <section class="toolbar" aria-label="资产筛选">
      <input id="assetSearch" type="search" value="${esc(ui.search)}" placeholder="搜索名称、标签、说明" />
      <select id="categoryFilter">
        <option value="">全部母层级</option>
        ${ui.data.settings.categories.map((category) => (
          `<option value="${esc(category)}"${category === ui.category ? " selected" : ""}>${esc(category)}</option>`
        )).join("")}
      </select>
      <select id="statusFilter">
        <option value="">全部状态</option>
        ${ui.data.settings.statuses.map((status) => (
          `<option value="${esc(status)}"${status === ui.status ? " selected" : ""}>${esc(status)}</option>`
        )).join("")}
      </select>
      <button type="button" class="primary" data-action="new-asset">添加资产</button>
    </section>
    <div class="workspace">
      <section class="panel list-panel">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width: 96px;">预览</th>
                <th>名称</th>
                <th style="width: 110px;">母层级</th>
                <th style="width: 170px;">标签</th>
                <th style="width: 100px;">状态</th>
                <th style="width: 110px;">负责人</th>
              </tr>
            </thead>
            <tbody>
              ${assets.length ? assets.map(renderAssetRow).join("") : `<tr><td colspan="6"><div class="empty">暂无资产</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
      <aside class="panel inspector">
        ${selected ? renderAssetInspector(selected) : `<div class="empty">选择或添加一个资产</div>`}
      </aside>
    </div>
  `;
}

function renderSummary() {
  const assets = visibleProjectAssets();
  const tasks = visibleProjectTasks();
  const doneAssets = assets.filter((asset) => asset.status === "已完成").length;
  const openTasks = tasks.filter((task) => task.status !== "已完成").length;

  return `
    <section class="summary" aria-label="总览">
      <div class="metric"><b>${assets.length}</b><span>资产</span></div>
      <div class="metric"><b>${openTasks}</b><span>未完成任务</span></div>
      <div class="metric"><b>${doneAssets}</b><span>已完成资产</span></div>
      <div class="metric"><b>${ui.data.people.length}</b><span>成员</span></div>
    </section>
  `;
}

function renderAssetRow(asset) {
  return `
    <tr data-asset-id="${esc(asset.id)}" class="${asset.id === ui.selectedAssetId ? "is-selected" : ""}">
      <td>${renderThumb(asset)}</td>
      <td>
        <div class="asset-title">
          <strong>${esc(asset.name)}</strong>
          <span>${esc(projectName(asset.projectId))}</span>
        </div>
      </td>
      <td>${esc(asset.category)}</td>
      <td><div class="tags">${renderTags(asset.tags)}</div></td>
      <td>${renderStatus(asset.status)}</td>
      <td>${esc(personName(asset.assigneeId) || "未分配")}</td>
    </tr>
  `;
}

function renderAssetInspector(asset) {
  const tasks = ui.data.tasks.filter((task) => task.assetId === asset.id);

  return `
    <div class="preview">
      ${renderPreview(asset)}
    </div>
    <div class="inspector-body">
      <form class="form-grid" data-asset-form="${esc(asset.id)}">
        <label class="wide"><span>名称</span><input name="name" value="${esc(asset.name)}" required /></label>
        <label><span>母层级</span>${renderCategorySelect(asset.category)}</label>
        <label><span>状态</span>${renderSelect("status", ui.data.settings.statuses, asset.status)}</label>
        <label><span>负责人</span>${renderPersonSelect(asset.assigneeId, true)}</label>
        <label><span>项目</span>${renderProjectSelect(asset.projectId)}</label>
        <label class="wide"><span>标签</span><input name="tags" value="${esc(asset.tags.join(", "))}" /></label>
        <label class="wide"><span>说明</span><textarea name="description">${esc(asset.description)}</textarea></label>
        <div class="actions wide">
          ${asset.file ? `<a class="quiet" href="${esc(asset.file.url)}" target="_blank" rel="noreferrer">${esc(asset.file.name)}</a>` : ""}
          <button type="button" class="danger" data-action="delete-asset" data-id="${esc(asset.id)}">删除</button>
          <button type="submit" class="primary">保存</button>
        </div>
      </form>
      <section class="stack">
        <div class="actions">
          <button type="button" data-action="new-task" data-asset-id="${esc(asset.id)}">添加任务</button>
        </div>
        <div class="task-list">
          ${tasks.length ? tasks.map(renderMiniTask).join("") : `<div class="quiet">暂无任务</div>`}
        </div>
      </section>
    </div>
  `;
}

function renderMiniTask(task) {
  return `
    <article class="mini-task">
      <header>
        <strong>${esc(task.title)}</strong>
        ${renderStatus(task.status)}
      </header>
      <div class="task-meta">
        <span>${esc(personName(task.assigneeId) || "未认领")}</span>
        ${task.dueDate ? `<span>${esc(task.dueDate)}</span>` : ""}
      </div>
      <div class="actions">
        ${!task.assigneeId ? `<button type="button" data-action="claim-task" data-id="${esc(task.id)}">认领</button>` : ""}
        ${renderTaskStatusSelect(task)}
      </div>
    </article>
  `;
}

function renderSchedule() {
  const tasks = visibleProjectTasks();
  const lanes = ui.data.settings.taskStatuses;

  app.innerHTML = `
    ${renderSummary()}
    <section class="toolbar" aria-label="日程操作">
      <input id="assetSearch" type="search" value="${esc(ui.search)}" placeholder="搜索任务、资产、说明" />
      <select id="categoryFilter">
        <option value="">全部母层级</option>
        ${ui.data.settings.categories.map((category) => (
          `<option value="${esc(category)}"${category === ui.category ? " selected" : ""}>${esc(category)}</option>`
        )).join("")}
      </select>
      <span></span>
      <button type="button" class="primary" data-action="new-task">添加任务</button>
    </section>
    <section class="board" aria-label="任务看板">
      ${lanes.map((lane) => `
        <div class="lane">
          <h2>${esc(lane)} · ${tasks.filter((task) => task.status === lane).length}</h2>
          ${tasks.filter((task) => task.status === lane).map(renderTaskCard).join("") || `<div class="quiet">空</div>`}
        </div>
      `).join("")}
    </section>
  `;
}

function renderTaskCard(task) {
  const asset = ui.data.assets.find((item) => item.id === task.assetId);

  return `
    <article class="task-card">
      <header>
        <strong>${esc(task.title)}</strong>
        ${renderStatus(task.status)}
      </header>
      <div class="task-meta">
        <span>${esc(asset?.name || "无资产")}</span>
        <span>${esc(personName(task.assigneeId) || "未认领")}</span>
        ${task.dueDate ? `<span>截止 ${esc(task.dueDate)}</span>` : ""}
      </div>
      ${task.notes ? `<p class="quiet">${esc(task.notes)}</p>` : ""}
      <div class="actions">
        ${!task.assigneeId ? `<button type="button" data-action="claim-task" data-id="${esc(task.id)}">认领</button>` : ""}
        ${renderTaskStatusSelect(task)}
        <button type="button" class="danger" data-action="delete-task" data-id="${esc(task.id)}">删除</button>
      </div>
    </article>
  `;
}

function renderTeam() {
  app.innerHTML = `
    <section class="split">
      <div class="panel inspector-body">
        <h2>成员</h2>
        <div class="stack">
          ${ui.data.people.map((person) => `
            <div class="person-row">
              <span class="dot" style="background:${esc(person.color)}"></span>
              <div>
                <strong>${esc(person.name)}</strong>
                <div class="quiet">${esc(person.role || "未设置角色")}</div>
              </div>
            </div>
          `).join("")}
        </div>
        <form class="form-grid" data-person-form>
          <label><span>姓名</span><input name="name" required /></label>
          <label><span>职责</span><input name="role" /></label>
          <label><span>颜色</span><input type="color" name="color" value="#277a61" /></label>
          <div class="actions"><button type="submit" class="primary">添加成员</button></div>
        </form>
      </div>
      <div class="panel inspector-body">
        <h2>本地设置</h2>
        <div class="settings-row">
          <strong>母层级</strong>
          <div class="tags">${renderTags(ui.data.settings.categories)}</div>
          <form class="form-grid" data-category-form>
            <label><span>名称</span><input name="name" placeholder="车辆 / 特效 / 镜头" required /></label>
            <div class="actions"><button type="submit">添加</button></div>
          </form>
        </div>
        <div class="settings-row">
          <strong>项目</strong>
          <div class="tags">${ui.data.projects.map((project) => `<span class="tag">${esc(project.name)}</span>`).join("")}</div>
          <form class="form-grid" data-project-form>
            <label><span>项目名</span><input name="name" required /></label>
            <label><span>颜色</span><input type="color" name="color" value="#4d66a4" /></label>
            <div class="actions wide"><button type="submit">添加项目</button></div>
          </form>
        </div>
        <div class="settings-row">
          <strong>存储</strong>
          <div class="quiet">${esc(ui.data.runtime.storageLabel || "数据目录已配置")}</div>
          <div class="quiet">完整路径已隐藏，避免在局域网页面暴露本机信息。</div>
          <div class="quiet">上传上限 ${esc(ui.data.runtime.maxUploadMb)} MB</div>
        </div>
      </div>
    </section>
  `;
}

async function onClick(event) {
  const tab = event.target.closest("[data-view]");
  if (tab) {
    ui.view = tab.dataset.view;
    localStorage.setItem("view", ui.view);
    render();
    return;
  }

  const row = event.target.closest("tr[data-asset-id]");
  if (row) {
    ui.selectedAssetId = row.dataset.assetId;
    render();
    return;
  }

  const action = event.target.closest("[data-action]");
  if (!action) {
    return;
  }

  if (action.dataset.action === "new-asset") {
    openAssetModal();
  }
  if (action.dataset.action === "new-task") {
    openTaskModal(action.dataset.assetId || "");
  }
  if (action.dataset.action === "claim-task") {
    await patchTask(action.dataset.id, { assigneeId: ui.currentPersonId, status: "进行中" });
  }
  if (action.dataset.action === "delete-task" && confirm("删除这个任务？")) {
    ui.data = await api(`/api/tasks/${action.dataset.id}`, { method: "DELETE" });
    render();
  }
  if (action.dataset.action === "delete-asset" && confirm("删除这个资产和关联任务？")) {
    ui.data = await api(`/api/assets/${action.dataset.id}`, { method: "DELETE" });
    ui.selectedAssetId = "";
    render();
  }
  if (action.dataset.action === "close-modal") {
    modal.close();
  }
}

async function onChange(event) {
  if (event.target.id === "projectFilter") {
    ui.projectId = event.target.value;
    localStorage.setItem("projectId", ui.projectId);
    render();
  }
  if (event.target.id === "currentPerson") {
    ui.currentPersonId = event.target.value;
    localStorage.setItem("currentPersonId", ui.currentPersonId);
  }
  if (event.target.id === "assetSearch") {
    ui.search = event.target.value;
    render();
  }
  if (event.target.id === "categoryFilter") {
    ui.category = event.target.value;
    render();
  }
  if (event.target.id === "statusFilter") {
    ui.status = event.target.value;
    render();
  }
  if (event.target.matches("[data-task-status]")) {
    await patchTask(event.target.dataset.taskStatus, { status: event.target.value });
  }
}

async function onSubmit(event) {
  if (event.target.matches("[data-asset-form]")) {
    event.preventDefault();
    const form = new FormData(event.target);
    ui.data = await api(`/api/assets/${event.target.dataset.assetForm}`, {
      method: "PATCH",
      body: formObject(form)
    });
    render();
  }

  if (event.target.matches("[data-person-form]")) {
    event.preventDefault();
    ui.data = await api("/api/people", {
      method: "POST",
      body: formObject(new FormData(event.target))
    });
    render();
  }

  if (event.target.matches("[data-category-form]")) {
    event.preventDefault();
    ui.data = await api("/api/categories", {
      method: "POST",
      body: formObject(new FormData(event.target))
    });
    render();
  }

  if (event.target.matches("[data-project-form]")) {
    event.preventDefault();
    ui.data = await api("/api/projects", {
      method: "POST",
      body: formObject(new FormData(event.target))
    });
    render();
  }
}

async function onModalSubmit(event) {
  event.preventDefault();
  const form = event.target;

  if (form.dataset.modal === "asset") {
    const data = formObject(new FormData(form));
    const file = form.file.files[0];
    if (file) {
      data.fileName = file.name;
      data.fileData = await fileToDataUrl(file);
    }
    ui.data = await api("/api/assets", { method: "POST", body: data });
    ui.selectedAssetId = ui.data.assets[0]?.id || "";
    modal.close();
    render();
  }

  if (form.dataset.modal === "task") {
    ui.data = await api("/api/tasks", {
      method: "POST",
      body: formObject(new FormData(form))
    });
    modal.close();
    render();
  }
}

function openAssetModal() {
  modal.innerHTML = `
    <form data-modal="asset">
      <h2>添加资产</h2>
      <label><span>名称</span><input name="name" required autofocus /></label>
      <div class="form-grid">
        <label><span>母层级</span>${renderCategorySelect(ui.category || ui.data.settings.categories[0])}</label>
        <label><span>项目</span>${renderProjectSelect(ui.projectId === "all" ? ui.data.projects[0]?.id : ui.projectId)}</label>
        <label><span>负责人</span>${renderPersonSelect("", true)}</label>
        <label><span>状态</span>${renderSelect("status", ui.data.settings.statuses, ui.data.settings.statuses[0])}</label>
      </div>
      <label><span>标签</span><input name="tags" placeholder="main, wip" /></label>
      <label><span>说明</span><textarea name="description"></textarea></label>
      <label><span>文件</span><input name="file" type="file" /></label>
      <div class="actions">
        <button type="button" data-action="close-modal">取消</button>
        <button type="submit" class="primary">创建</button>
      </div>
    </form>
  `;
  modal.showModal();
}

function openTaskModal(assetId) {
  const asset = ui.data.assets.find((item) => item.id === assetId);
  modal.innerHTML = `
    <form data-modal="task">
      <h2>添加任务</h2>
      <label><span>任务</span><input name="title" required autofocus /></label>
      <div class="form-grid">
        <label><span>资产</span>${renderAssetSelect(assetId)}</label>
        <label><span>项目</span>${renderProjectSelect(asset?.projectId || (ui.projectId === "all" ? ui.data.projects[0]?.id : ui.projectId))}</label>
        <label><span>认领人</span>${renderPersonSelect("", true)}</label>
        <label><span>状态</span>${renderSelect("status", ui.data.settings.taskStatuses, ui.data.settings.taskStatuses[0])}</label>
        <label><span>开始</span><input type="date" name="startDate" /></label>
        <label><span>截止</span><input type="date" name="dueDate" /></label>
      </div>
      <label><span>备注</span><textarea name="notes"></textarea></label>
      <div class="actions">
        <button type="button" data-action="close-modal">取消</button>
        <button type="submit" class="primary">创建</button>
      </div>
    </form>
  `;
  modal.showModal();
}

async function patchTask(id, patch) {
  ui.data = await api(`/api/tasks/${id}`, { method: "PATCH", body: patch });
  render();
}

function filteredAssets() {
  return visibleProjectAssets().filter((asset) => {
    const text = `${asset.name} ${asset.category} ${asset.tags.join(" ")} ${asset.description}`.toLowerCase();
    const matchesSearch = !ui.search || text.includes(ui.search.toLowerCase());
    const matchesCategory = !ui.category || asset.category === ui.category;
    const matchesStatus = !ui.status || asset.status === ui.status;
    return matchesSearch && matchesCategory && matchesStatus;
  });
}

function visibleProjectAssets() {
  return ui.data.assets.filter((asset) => ui.projectId === "all" || asset.projectId === ui.projectId);
}

function visibleProjectTasks() {
  const query = ui.search.toLowerCase();

  return ui.data.tasks.filter((task) => {
    const asset = ui.data.assets.find((item) => item.id === task.assetId);
    const projectOk = ui.projectId === "all" || task.projectId === ui.projectId;
    const categoryOk = !ui.category || asset?.category === ui.category;
    const searchOk = !query || `${task.title} ${task.notes} ${asset?.name || ""}`.toLowerCase().includes(query);
    return projectOk && categoryOk && searchOk;
  });
}

function renderThumb(asset) {
  if (isImage(asset)) {
    return `<span class="thumb"><img src="${esc(asset.file.url)}" alt="${esc(asset.name)}" loading="lazy" /></span>`;
  }
  return `<span class="thumb">${asset.file ? "FILE" : "NO FILE"}</span>`;
}

function renderPreview(asset) {
  if (isImage(asset)) {
    return `<img src="${esc(asset.file.url)}" alt="${esc(asset.name)}" />`;
  }
  return `
    <div class="file-preview">
      <strong>${asset.file ? "FILE" : "NO FILE"}</strong>
      <span>${esc(asset.file?.name || "未上传文件")}</span>
    </div>
  `;
}

function renderTags(tags) {
  return tags.length ? tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("") : `<span class="quiet">无</span>`;
}

function renderStatus(status) {
  const klass = status === "已完成" ? "done" : status.includes("审") ? "warn" : "";
  return `<span class="status ${klass}">${esc(status)}</span>`;
}

function renderTaskStatusSelect(task) {
  return `<select data-task-status="${esc(task.id)}" aria-label="任务状态">${ui.data.settings.taskStatuses.map((status) => (
    `<option value="${esc(status)}"${status === task.status ? " selected" : ""}>${esc(status)}</option>`
  )).join("")}</select>`;
}

function renderCategorySelect(value) {
  return `<select name="category">${ui.data.settings.categories.map((category) => (
    `<option value="${esc(category)}"${category === value ? " selected" : ""}>${esc(category)}</option>`
  )).join("")}</select>`;
}

function renderProjectSelect(value) {
  return `<select name="projectId">${ui.data.projects.map((project) => (
    `<option value="${esc(project.id)}"${project.id === value ? " selected" : ""}>${esc(project.name)}</option>`
  )).join("")}</select>`;
}

function renderPersonSelect(value, allowEmpty) {
  return `<select name="assigneeId">
    ${allowEmpty ? `<option value="">未分配</option>` : ""}
    ${ui.data.people.map((person) => (
      `<option value="${esc(person.id)}"${person.id === value ? " selected" : ""}>${esc(person.name)}</option>`
    )).join("")}
  </select>`;
}

function renderAssetSelect(value) {
  return `<select name="assetId">
    <option value="">无资产</option>
    ${visibleProjectAssets().map((asset) => (
      `<option value="${esc(asset.id)}"${asset.id === value ? " selected" : ""}>${esc(asset.name)}</option>`
    )).join("")}
  </select>`;
}

function renderSelect(name, options, value) {
  return `<select name="${esc(name)}">${options.map((item) => (
    `<option value="${esc(item)}"${item === value ? " selected" : ""}>${esc(item)}</option>`
  )).join("")}</select>`;
}

function formObject(formData) {
  return Object.fromEntries([...formData.entries()].filter(([, value]) => !(value instanceof File)));
}

async function api(url, options = {}) {
  const init = { method: options.method || "GET", headers: options.headers || {} };
  if (options.body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function isImage(asset) {
  return asset.file?.mime?.startsWith("image/");
}

function personName(id) {
  return ui.data.people.find((person) => person.id === id)?.name || "";
}

function projectName(id) {
  return ui.data.projects.find((project) => project.id === id)?.name || "";
}

function validId(items, id) {
  return items.some((item) => item.id === id) ? id : "";
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => escapeMap[char]);
}
