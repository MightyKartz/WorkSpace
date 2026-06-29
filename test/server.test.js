import assert from "node:assert/strict";
import { once } from "node:events";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApp } from "../server.js";

test("stores an uploaded asset and serves it back", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "local-kitsu-lite-"));
  const server = createApp({ dataDir, maxUploadMb: 2 });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const created = await postJson(`${baseUrl}/api/assets`, {
      name: "罗兰-布雷特",
      category: "角色",
      tags: "老人 hero",
      fileName: "ref.txt",
      fileData: "data:text/plain;base64,SGVsbG8="
    });

    assert.equal(created.assets.length, 1);
    assert.deepEqual(created.assets[0].tags, ["老人", "hero"]);
    assert.equal(created.assets[0].category, "角色");

    const uploaded = await fetch(`${baseUrl}${created.assets[0].file.url}`);
    assert.equal(await uploaded.text(), "Hello");

    const rawDb = JSON.parse(await fs.readFile(path.join(dataDir, "db.json"), "utf8"));
    assert.equal(rawDb.assets[0].name, "罗兰-布雷特");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true);
  return response.json();
}
