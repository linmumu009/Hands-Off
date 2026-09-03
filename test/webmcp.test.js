import test from "node:test";
import assert from "node:assert/strict";

import { registerHandsOffTools, toolDefinitions } from "../src/webmcp.js";

test("registers exactly two WebMCP tools with narrow schemas", async () => {
  const registered = [];
  globalThis.document = {
    modelContext: {
      registerTool: async (tool) => registered.push(tool),
    },
  };

  const controller = {
    readWorkspace: () => ({ workspaceVersion: 1 }),
    submitPatch: (input) => ({ received: input }),
  };
  const connection = await registerHandsOffTools(controller);

  assert.equal(connection.supported, true);
  assert.deepEqual(
    registered.map((tool) => tool.name),
    ["read_workspace", "submit_patch"],
  );
  assert.equal(registered[0].annotations.readOnlyHint, true);
  assert.equal(registered[1].annotations.readOnlyHint, false);
  assert.equal(registered[1].annotations.destructiveHint, true);
  assert.equal(registered[1].inputSchema.additionalProperties, false);
  assert.equal("objective" in registered[1].inputSchema.properties, false);
  assert.equal(registered[1].inputSchema.properties.operations.maxItems, 12);

  assert.deepEqual(await registered[0].execute({}), { workspaceVersion: 1 });
  assert.deepEqual(await registered[1].execute({ operations: [] }), {
    received: { operations: [] },
  });

  delete globalThis.document;
});

test("returns preview mode when WebMCP is unavailable", async () => {
  globalThis.document = {};
  const connection = await registerHandsOffTools({});
  assert.equal(connection.supported, false);
  assert.match(connection.message, /Preview mode/i);
  delete globalThis.document;
});

test("tool descriptions make enforcement and verification explicit", () => {
  assert.match(toolDefinitions.readWorkspace.description, /Read.*before/i);
  assert.match(toolDefinitions.submitPatch.description, /application.*enforces authority/i);
  assert.match(toolDefinitions.submitPatch.description, /never claim.*applied/i);
});
