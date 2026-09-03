import test from "node:test";
import assert from "node:assert/strict";

import {
  AUTHORITY,
  applyAgentPatches,
  createInitialState,
  cycleAuthority,
  editBlock,
  resolveProposal,
  serializeWorkspace,
} from "../src/domain.js";

const fixedNow = () => new Date("2026-09-03T12:00:00.000Z");

test("locked patches are rejected without changing content", () => {
  const initial = createInitialState();
  const before = initial.blocks.find((block) => block.id === "launch-date").content;

  const { state, results } = applyAgentPatches(
    initial,
    [
      {
        blockId: "launch-date",
        content: "September 12, 2026",
        expectedVersion: 1,
        reason: "Move faster",
      },
    ],
    fixedNow,
  );

  assert.equal(results[0].status, "blocked");
  assert.equal(state.blocks.find((block) => block.id === "launch-date").content, before);
  assert.equal(initial.activity.length, 1, "input state stays immutable");
});

test("review patches create proposals without changing content", () => {
  const initial = createInitialState();
  const before = initial.blocks.find((block) => block.id === "positioning").content;

  const { state, results } = applyAgentPatches(
    initial,
    [
      {
        blockId: "positioning",
        content: "Small teams. Unreasonably ambitious launches.",
        expectedVersion: 1,
        reason: "Bolder",
      },
    ],
    fixedNow,
  );

  assert.equal(results[0].status, "needs_review");
  assert.equal(state.blocks.find((block) => block.id === "positioning").content, before);
  assert.equal(state.proposals[0].status, "pending");
});

test("delegated patches apply immediately and increment block version", () => {
  const initial = createInitialState();
  const { state, results } = applyAgentPatches(
    initial,
    [{ blockId: "sprint-plan", content: "Day 1 — ship the core", expectedVersion: 1 }],
    fixedNow,
  );

  assert.equal(results[0].status, "applied");
  assert.equal(state.blocks.find((block) => block.id === "sprint-plan").content, "Day 1 — ship the core");
  assert.equal(state.blocks.find((block) => block.id === "sprint-plan").version, 2);
});

test("stale writes are rejected even for delegated blocks", () => {
  const initial = createInitialState();
  const { results } = applyAgentPatches(
    initial,
    [{ blockId: "sprint-plan", content: "Replace it", expectedVersion: 9 }],
    fixedNow,
  );

  assert.equal(results[0].status, "conflict");
});

test("missing versions are rejected before delegated content can change", () => {
  const initial = createInitialState();
  const before = initial.blocks.find((block) => block.id === "sprint-plan").content;
  const { state, results } = applyAgentPatches(
    initial,
    [{ blockId: "sprint-plan", content: "Replace it without a version" }],
    fixedNow,
  );

  assert.equal(results[0].status, "invalid");
  assert.match(results[0].message, /expectedVersion is required/);
  assert.equal(state.blocks.find((block) => block.id === "sprint-plan").content, before);
});

test("unknown authority states fail closed instead of behaving as delegated", () => {
  const initial = createInitialState();
  const target = initial.blocks.find((block) => block.id === "sprint-plan");
  const before = target.content;
  target.authority = "unknown";

  const { state, results } = applyAgentPatches(
    initial,
    [{ blockId: "sprint-plan", content: "This must not apply", expectedVersion: 1 }],
    fixedNow,
  );

  assert.equal(results[0].status, "invalid");
  assert.match(results[0].message, /Unknown authority/);
  assert.equal(state.blocks.find((block) => block.id === "sprint-plan").content, before);
});

test("accepting a proposal applies it while rejection preserves the block", () => {
  const initial = createInitialState();
  const queued = applyAgentPatches(
    initial,
    [{ blockId: "positioning", content: "A sharper promise.", expectedVersion: 1 }],
    fixedNow,
  ).state;

  const accepted = resolveProposal(queued, queued.proposals[0].id, "accept", fixedNow);
  assert.equal(accepted.state.blocks.find((block) => block.id === "positioning").content, "A sharper promise.");
  assert.equal(accepted.state.proposals[0].status, "accepted");

  const queuedAgain = applyAgentPatches(
    accepted.state,
    [{ blockId: "positioning", content: "Another promise.", expectedVersion: 2 }],
    fixedNow,
  ).state;
  const rejected = resolveProposal(queuedAgain, queuedAgain.proposals[0].id, "reject", fixedNow);
  assert.equal(rejected.state.blocks.find((block) => block.id === "positioning").content, "A sharper promise.");
});

test("humans can edit any block and cycle its agent authority", () => {
  const initial = createInitialState();
  const edited = editBlock(initial, "launch-date", "September 19, 2026", fixedNow);
  assert.equal(edited.state.blocks.find((block) => block.id === "launch-date").content, "September 19, 2026");

  const cycled = cycleAuthority(edited.state, "launch-date", fixedNow);
  assert.equal(cycled.authority, AUTHORITY.REVIEW);
});

test("serialized workspace excludes internal activity and exposes pending reviews", () => {
  const state = createInitialState();
  const serialized = serializeWorkspace(state);
  assert.equal(serialized.blocks.length, 5);
  assert.equal("activity" in serialized, false);
  assert.deepEqual(serialized.pendingReviews, []);
});
