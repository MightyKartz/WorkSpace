import crypto from "node:crypto";
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "public");

const staticTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

export function freshDb() {
  const now = new Date().toISOString();

  return {
    version: 1,
    updatedAt: now,
    settings: {
      studioName: "本地制作板",
      categories: ["角色", "场景", "道具"],
      statuses: ["待处理", "进行中", "待审核", "已完成"],
      taskStatuses: ["待认领", "进行中", "待审核", "已完成"],
      tags: []
    },
    people: [
      { id: "person_producer", name: "制片", role: "统筹", color: "#277a61" },
      { id: "person_artist", name: "美术", role: "资产", color: "#5d6fb2" }
    ],
    projects: [
      { id: "project_default", name: "当前项目", color: "#277a61", createdAt: now }
    ],
    assets: [],
    tasks: []
  };
}

export function createApp(options = {}) {
  const runtime = createRuntime(options);

  return http.createServer((req, res) => {
    handleRequest(req, res, runtime).catch((error) => {
      if (error.code !== "ECONNRESET") {
        console.error(error);
      }
      sendJson(res, error.statusCode || 500, {
        error: error.expose ? error.message : "Server error"
      });
    });
  });
}

function createRuntime(options) {
  const dataDir = path.resolve(
    options.dataDir || process.env.LOCAL_KITSU_DATA_DIR || path.join(__dirname, "data")
  );
  const maxUploadMb = Number(options.maxUploadMb || process.env.MAX_UPLOAD_MB || 200);

  return {
    dataDir,
    dbPath: path.join(dataDir, "db.json"),
    uploadDir: path.join(dataDir, "uploads"),
    maxBodyBytes: Math.max(1, maxUploadMb) * 1024 * 1024,
    writeQueue: Promise.resolve()
  };
}

async function handleRequest(req, res, runtime) {
  const url = new URL(req.url || "/", "http://localhost");
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith("/api/")) {
    await handleApi(req, res, runtime, pathname);
    return;
  }

  if (pathname.startsWith("/uploads/")) {
    await sendUpload(res, runtime, pathname);
    return;
  }

  await sendStatic(res, pathname);
}

async function handleApi(req, res, runtime, pathname) {
  const method = req.method || "GET";
  const parts = pathname.split("/").filter(Boolean);

  if (method === "GET" && pathname === "/api/state") {
    const db = await readDb(runtime);
    sendJson(res, 200, withRuntimeInfo(db, runtime));
    return;
  }

  if (method === "POST" && pathname === "/api/assets") {
    const body = await readJson(req, runtime.maxBodyBytes);
    const db = await mutateDb(runtime, async (draft) => {
      const asset = await makeAsset(runtime, draft, body);
      draft.assets.unshift(asset);
      mergeTags(draft, asset.tags);
    });
    sendJson(res, 201, withRuntimeInfo(db, runtime));
    return;
  }

  if (parts[1] === "assets" && parts[2]) {
    if (method === "PATCH") {
      const body = await readJson(req, runtime.maxBodyBytes);
      const db = await mutateDb(runtime, (draft) => {
        const asset = requireById(draft.assets, parts[2], "Asset");
        patchAsset(draft, asset, body);
      });
      sendJson(res, 200, withRuntimeInfo(db, runtime));
      return;
    }

    if (method === "DELETE") {
      const removed = await mutateDb(runtime, (draft) => {
        const index = draft.assets.findIndex((asset) => asset.id === parts[2]);
        if (index === -1) {
          throw httpError(404, "Asset not found");
        }
        const [asset] = draft.assets.splice(index, 1);
        draft.tasks = draft.tasks.filter((task) => task.assetId !== asset.id);
        return asset;
      });
      await removeUpload(runtime, removed.file?.storedName);
      const db = await readDb(runtime);
      sendJson(res, 200, withRuntimeInfo(db, runtime));
      return;
    }
  }

  if (method === "POST" && pathname === "/api/tasks") {
    const body = await readJson(req, runtime.maxBodyBytes);
    const db = await mutateDb(runtime, (draft) => {
      draft.tasks.unshift(makeTask(draft, body));
    });
    sendJson(res, 201, withRuntimeInfo(db, runtime));
    return;
  }

  if (parts[1] === "tasks" && parts[2]) {
    if (method === "PATCH") {
      const body = await readJson(req, runtime.maxBodyBytes);
      const db = await mutateDb(runtime, (draft) => {
        const task = requireById(draft.tasks, parts[2], "Task");
        patchTask(draft, task, body);
      });
      sendJson(res, 200, withRuntimeInfo(db, runtime));
      return;
    }

    if (method === "DELETE") {
      const db = await mutateDb(runtime, (draft) => {
        const index = draft.tasks.findIndex((task) => task.id === parts[2]);
        if (index === -1) {
          throw httpError(404, "Task not found");
        }
        draft.tasks.splice(index, 1);
      });
      sendJson(res, 200, withRuntimeInfo(db, runtime));
      return;
    }
  }

  if (method === "POST" && pathname === "/api/people") {
    const body = await readJson(req, runtime.maxBodyBytes);
    const db = await mutateDb(runtime, (draft) => {
      draft.people.push(makePerson(body));
    });
    sendJson(res, 201, withRuntimeInfo(db, runtime));
    return;
  }

  if (parts[1] === "people" && parts[2] && method === "PATCH") {
    const body = await readJson(req, runtime.maxBodyBytes);
    const db = await mutateDb(runtime, (draft) => {
      const person = requireById(draft.people, parts[2], "Person");
      patchPerson(person, body);
    });
    sendJson(res, 200, withRuntimeInfo(db, runtime));
    return;
  }

  if (method === "POST" && pathname === "/api/projects") {
    const body = await readJson(req, runtime.maxBodyBytes);
    const db = await mutateDb(runtime, (draft) => {
      draft.projects.push(makeProject(body));
    });
    sendJson(res, 201, withRuntimeInfo(db, runtime));
    return;
  }

  if (method === "POST" && pathname === "/api/categories") {
    const body = await readJson(req, runtime.maxBodyBytes);
    const db = await mutateDb(runtime, (draft) => {
      const name = cleanText(body.name);
      if (!name) {
        throw httpError(400, "Category name is required");
      }
      addUnique(draft.settings.categories, name);
    });
    sendJson(res, 201, withRuntimeInfo(db, runtime));
    return;
  }

  throw httpError(404, "Not found");
}

async function makeAsset(runtime, draft, body) {
  const now = new Date().toISOString();
  const id = makeId("asset");
  const tags = normalizeTags(body.tags);
  const category = cleanText(body.category) || draft.settings.categories[0] || "资产";
  const file = body.fileData
    ? await saveUpload(runtime, id, body.fileName, body.fileData)
    : null;

  addUnique(draft.settings.categories, category);

  return {
    id,
    name: cleanText(body.name) || "未命名资产",
    category,
    projectId: validId(draft.projects, body.projectId) || draft.projects[0]?.id || "",
    status: cleanChoice(body.status, draft.settings.statuses) || draft.settings.statuses[0],
    assigneeId: validId(draft.people, body.assigneeId) || "",
    tags,
    description: cleanText(body.description),
    file,
    createdAt: now,
    updatedAt: now
  };
}

function patchAsset(draft, asset, body) {
  asset.name = cleanText(body.name ?? asset.name) || asset.name;
  asset.category = cleanText(body.category ?? asset.category) || asset.category;
  asset.projectId = validId(draft.projects, body.projectId) || asset.projectId;
  asset.status = cleanChoice(body.status, draft.settings.statuses) || asset.status;
  asset.assigneeId = validId(draft.people, body.assigneeId) || "";
  asset.tags = normalizeTags(body.tags ?? asset.tags);
  asset.description = cleanText(body.description ?? asset.description);
  asset.updatedAt = new Date().toISOString();
  addUnique(draft.settings.categories, asset.category);
  mergeTags(draft, asset.tags);
}

function makeTask(draft, body) {
  const now = new Date().toISOString();
  const assetId = validId(draft.assets, body.assetId) || "";

  return {
    id: makeId("task"),
    title: cleanText(body.title) || "未命名任务",
    assetId,
    projectId:
      validId(draft.projects, body.projectId) ||
      draft.assets.find((asset) => asset.id === assetId)?.projectId ||
      draft.projects[0]?.id ||
      "",
    assigneeId: validId(draft.people, body.assigneeId) || "",
    status: cleanChoice(body.status, draft.settings.taskStatuses) || draft.settings.taskStatuses[0],
    startDate: cleanDate(body.startDate),
    dueDate: cleanDate(body.dueDate),
    notes: cleanText(body.notes),
    createdAt: now,
    updatedAt: now
  };
}

function patchTask(draft, task, body) {
  task.title = cleanText(body.title ?? task.title) || task.title;
  task.assetId = validId(draft.assets, body.assetId) || "";
  task.projectId = validId(draft.projects, body.projectId) || task.projectId;
  task.assigneeId = validId(draft.people, body.assigneeId) || "";
  task.status = cleanChoice(body.status, draft.settings.taskStatuses) || task.status;
  task.startDate = cleanDate(body.startDate ?? task.startDate);
  task.dueDate = cleanDate(body.dueDate ?? task.dueDate);
  task.notes = cleanText(body.notes ?? task.notes);
  task.updatedAt = new Date().toISOString();
}

function makePerson(body) {
  return {
    id: makeId("person"),
    name: cleanText(body.name) || "新成员",
    role: cleanText(body.role),
    color: cleanColor(body.color) || randomColor()
  };
}

function patchPerson(person, body) {
  person.name = cleanText(body.name ?? person.name) || person.name;
  person.role = cleanText(body.role ?? person.role);
  person.color = cleanColor(body.color ?? person.color) || person.color;
}

function makeProject(body) {
  return {
    id: makeId("project"),
    name: cleanText(body.name) || "新项目",
    color: cleanColor(body.color) || randomColor(),
    createdAt: new Date().toISOString()
  };
}

async function saveUpload(runtime, assetId, fileName, dataUrl) {
  const match = String(dataUrl).match(/^data:([^;,]+)?;base64,(.+)$/);
  if (!match) {
    throw httpError(400, "File payload must be a data URL");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) {
    throw httpError(400, "File is empty");
  }

  await fs.mkdir(runtime.uploadDir, { recursive: true });
  const safeName = sanitizeFileName(fileName || "asset.bin");
  const storedName = `${assetId}-${safeName}`;
  const target = path.join(runtime.uploadDir, storedName);
  await fs.writeFile(target, buffer);

  return {
    name: cleanText(fileName) || safeName,
    storedName,
    mime: match[1] || "application/octet-stream",
    size: buffer.length,
    url: `/uploads/${encodeURIComponent(storedName)}`
  };
}

async function removeUpload(runtime, storedName) {
  if (!storedName) {
    return;
  }
  await fs.rm(path.join(runtime.uploadDir, path.basename(storedName)), { force: true });
}

async function mutateDb(runtime, update) {
  const operation = runtime.writeQueue.then(async () => {
    const draft = await readDb(runtime);
    const result = await update(draft);
    draft.updatedAt = new Date().toISOString();
    await writeDb(runtime, draft);
    return result || draft;
  });

  runtime.writeQueue = operation.catch(() => {});
  return operation;
}

async function readDb(runtime) {
  await ensureData(runtime);
  const text = await fs.readFile(runtime.dbPath, "utf8");
  return JSON.parse(text);
}

async function writeDb(runtime, db) {
  await fs.mkdir(runtime.dataDir, { recursive: true });
  const temp = `${runtime.dbPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(db, null, 2)}\n`);
  await fs.rename(temp, runtime.dbPath);
}

async function ensureData(runtime) {
  await fs.mkdir(runtime.uploadDir, { recursive: true });
  try {
    await fs.access(runtime.dbPath);
  } catch {
    await writeDb(runtime, freshDb());
  }
}

function withRuntimeInfo(db, runtime) {
  return {
    ...db,
    runtime: {
      dataDir: runtime.dataDir,
      uploadDir: runtime.uploadDir,
      maxUploadMb: Math.round(runtime.maxBodyBytes / 1024 / 1024)
    }
  };
}

async function readJson(req, limit) {
  const chunks = [];
  let size = 0;

  return new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(httpError(413, "Request is too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(httpError(400, "Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

async function sendStatic(res, pathname) {
  const requestPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(publicDir, `.${requestPath}`);

  if (!filePath.startsWith(`${publicDir}${path.sep}`)) {
    throw httpError(403, "Forbidden");
  }

  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": staticTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    });
    res.end(data);
  } catch {
    throw httpError(404, "Not found");
  }
}

async function sendUpload(res, runtime, pathname) {
  const storedName = path.basename(pathname);
  const filePath = path.join(runtime.uploadDir, storedName);

  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": staticTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "private, max-age=3600"
    });
    res.end(data);
  } catch {
    throw httpError(404, "Not found");
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function requireById(items, id, label) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) {
    throw httpError(404, `${label} not found`);
  }
  return item;
}

function validId(items, id) {
  return items.some((item) => item.id === id) ? id : "";
}

function cleanChoice(value, choices) {
  const text = cleanText(value);
  return choices.includes(text) ? text : "";
}

function cleanDate(value) {
  const text = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function cleanText(value) {
  return String(value ?? "").trim().slice(0, 2000);
}

function cleanColor(value) {
  const text = cleanText(value);
  return /^#[0-9a-f]{6}$/i.test(text) ? text : "";
}

function normalizeTags(value) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(/[\s,，、]+/);
  return [...new Set(source.map((tag) => cleanText(tag).slice(0, 40)).filter(Boolean))];
}

function mergeTags(draft, tags) {
  for (const tag of tags) {
    addUnique(draft.settings.tags, tag);
  }
}

function addUnique(list, value) {
  if (value && !list.includes(value)) {
    list.push(value);
  }
}

function sanitizeFileName(value) {
  const safe = String(value)
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return safe || "asset.bin";
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function randomColor() {
  const colors = ["#277a61", "#5d6fb2", "#a05d2f", "#7a568b", "#3f7a90", "#8a6b25"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = statusCode < 500;
  return error;
}

export async function start() {
  const app = createApp();
  const host = process.env.HOST || "0.0.0.0";
  const port = Number(process.env.PORT || 4173);
  app.listen(port, host, () => {
    const dataDir = process.env.LOCAL_KITSU_DATA_DIR || path.join(__dirname, "data");
    console.log(`Local Kitsu Lite: http://${host}:${port}`);
    console.log(`Data directory: ${path.resolve(dataDir)}`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  start().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
