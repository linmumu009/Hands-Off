import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  html: new URL("../index.html", import.meta.url),
  css: new URL("../src/styles.css", import.meta.url),
  app: new URL("../src/app.js", import.meta.url),
  webmcp: new URL("../src/webmcp.js", import.meta.url),
};

test("entry page references only local application assets", async () => {
  const html = await readFile(files.html, "utf8");
  assert.match(html, /href="\.\/src\/styles\.css"/);
  assert.match(html, /src="\.\/src\/app\.js"/);
  assert.doesNotMatch(html, /https?:\/\//);
});

test("every DOM id queried by the app exists in the page", async () => {
  const [html, app] = await Promise.all([
    readFile(files.html, "utf8"),
    readFile(files.app, "utf8"),
  ]);
  const queriedIds = [...app.matchAll(/querySelector\("#([A-Za-z0-9_-]+)"\)/g)].map(
    (match) => match[1],
  );

  assert.ok(queriedIds.length > 10, "expected the UI to query its required elements");
  for (const id of queriedIds) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
});

test("responsive and reduced-motion styles are present", async () => {
  const css = await readFile(files.css, "utf8");
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("WebMCP is registered imperatively on the top-level document", async () => {
  const source = await readFile(files.webmcp, "utf8");
  assert.match(source, /document\.modelContext\?\.registerTool/);
  assert.doesNotMatch(source, /iframe/i);
});

test("agent patches cannot change the human-owned workspace objective", async () => {
  const [app, webmcp] = await Promise.all([
    readFile(files.app, "utf8"),
    readFile(files.webmcp, "utf8"),
  ]);

  assert.doesNotMatch(app, /input\.objective/);
  assert.doesNotMatch(webmcp, /objective\s*:/);
});
