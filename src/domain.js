export const AUTHORITY = Object.freeze({
  LOCKED: "locked",
  REVIEW: "review",
  DELEGATED: "delegated",
});

export const AUTHORITY_ORDER = Object.freeze([
  AUTHORITY.LOCKED,
  AUTHORITY.REVIEW,
  AUTHORITY.DELEGATED,
]);

const MAX_PATCHES = 12;
const MAX_CONTENT_LENGTH = 4000;

const STARTER_BLOCKS = Object.freeze([
  {
    id: "launch-date",
    eyebrow: "Milestone",
    title: "Launch date",
    content: "September 18, 2026",
    authority: AUTHORITY.LOCKED,
  },
  {
    id: "budget-cap",
    eyebrow: "Constraint",
    title: "Launch budget",
    content: "$18,000 hard cap",
    authority: AUTHORITY.LOCKED,
  },
  {
    id: "positioning",
    eyebrow: "Message",
    title: "Positioning",
    content: "The calmest way for small teams to ship ambitious work.",
    authority: AUTHORITY.REVIEW,
  },
  {
    id: "sprint-plan",
    eyebrow: "Execution",
    title: "Two-week sprint",
    content: "Week 1 — polish the core workflow\nWeek 2 — onboard five design partners\nLaunch day — publish the field notes",
    authority: AUTHORITY.DELEGATED,
  },
  {
    id: "risk-register",
    eyebrow: "Operations",
    title: "Risk register",
    content: "• Scope expands beyond the core workflow\n• Review queue becomes a bottleneck",
    authority: AUTHORITY.DELEGATED,
  },
]);

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function timestamp(now) {
  return now().toISOString();
}

function nextIdentifier(state, prefix) {
  const id = `${prefix}-${state.nextId}`;
  state.nextId += 1;
  return id;
}

function addActivity(state, entry, now) {
  state.activity.unshift({
    id: nextIdentifier(state, "event"),
    at: timestamp(now),
    ...entry,
  });
  state.activity = state.activity.slice(0, 30);
}

function safeReason(reason) {
  if (typeof reason !== "string" || !reason.trim()) {
    return "No reason supplied";
  }
  return reason.trim().slice(0, 240);
}

function validatePatch(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return "Patch must be an object.";
  }
  if (typeof patch.blockId !== "string" || !patch.blockId.trim()) {
    return "blockId is required.";
  }
  if (typeof patch.content !== "string" || !patch.content.trim()) {
    return "content must be a non-empty string.";
  }
  if (patch.content.length > MAX_CONTENT_LENGTH) {
    return `content must be ${MAX_CONTENT_LENGTH} characters or fewer.`;
  }
  if (!Number.isInteger(patch.expectedVersion) || patch.expectedVersion < 1) {
    return "expectedVersion is required and must be a positive integer.";
  }
  return null;
}

export function createInitialState() {
  return {
    schemaVersion: 1,
    workspaceVersion: 1,
    nextId: 2,
    objective: "Compress the launch into two weeks and make the positioning bolder.",
    blocks: STARTER_BLOCKS.map((block) => ({
      ...block,
      version: 1,
      updatedBy: "human",
    })),
    proposals: [],
    activity: [
      {
        id: "event-1",
        at: "2026-09-03T00:00:00.000Z",
        kind: "system",
        title: "Authority map ready",
        detail: "Two blocks locked, one review-first, two delegated.",
      },
    ],
  };
}

export function cycleAuthority(state, blockId, now = () => new Date()) {
  const next = clone(state);
  const block = next.blocks.find((candidate) => candidate.id === blockId);
  if (!block) return { state: next, changed: false };

  const currentIndex = AUTHORITY_ORDER.indexOf(block.authority);
  block.authority = AUTHORITY_ORDER[(currentIndex + 1) % AUTHORITY_ORDER.length];
  block.version += 1;
  block.updatedBy = "human";
  next.workspaceVersion += 1;

  addActivity(
    next,
    {
      kind: "authority",
      title: `${block.title} authority changed`,
      detail: `The human set this block to ${block.authority}.`,
      blockId,
    },
    now,
  );

  return { state: next, changed: true, authority: block.authority };
}

export function editBlock(state, blockId, content, now = () => new Date()) {
  if (typeof content !== "string" || !content.trim() || content.length > MAX_CONTENT_LENGTH) {
    return { state: clone(state), changed: false, error: "Invalid content." };
  }

  const next = clone(state);
  const block = next.blocks.find((candidate) => candidate.id === blockId);
  if (!block || block.content === content) return { state: next, changed: false };

  block.content = content;
  block.version += 1;
  block.updatedBy = "human";
  next.workspaceVersion += 1;

  addActivity(
    next,
    {
      kind: "human",
      title: `${block.title} edited by human`,
      detail: "Human edits are always allowed, independent of agent authority.",
      blockId,
    },
    now,
  );

  return { state: next, changed: true };
}

export function applyAgentPatches(state, patches, now = () => new Date()) {
  const next = clone(state);
  const items = Array.isArray(patches) ? patches.slice(0, MAX_PATCHES) : [];
  const results = [];

  if (!Array.isArray(patches) || patches.length === 0) {
    return {
      state: next,
      results: [
        {
          status: "invalid",
          message: "operations must contain at least one patch.",
        },
      ],
    };
  }

  for (const patch of items) {
    const validationError = validatePatch(patch);
    if (validationError) {
      results.push({
        blockId: patch?.blockId ?? null,
        status: "invalid",
        message: validationError,
      });
      continue;
    }

    const block = next.blocks.find((candidate) => candidate.id === patch.blockId);
    if (!block) {
      results.push({
        blockId: patch.blockId,
        status: "invalid",
        message: "Unknown blockId.",
      });
      continue;
    }

    if (patch.expectedVersion !== block.version) {
      results.push({
        blockId: block.id,
        status: "conflict",
        message: `Expected version ${patch.expectedVersion}, found ${block.version}. Read the workspace again before retrying.`,
      });
      addActivity(
        next,
        {
          kind: "blocked",
          title: `${block.title} patch was stale`,
          detail: "The workspace changed after the agent read it.",
          blockId: block.id,
        },
        now,
      );
      continue;
    }

    if (block.authority === AUTHORITY.LOCKED) {
      results.push({
        blockId: block.id,
        status: "blocked",
        message: "Human-only boundary enforced. Content was not changed.",
      });
      addActivity(
        next,
        {
          kind: "blocked",
          title: `${block.title} stayed locked`,
          detail: safeReason(patch.reason),
          blockId: block.id,
        },
        now,
      );
      continue;
    }

    if (block.authority === AUTHORITY.REVIEW) {
      const existing = next.proposals.find(
        (proposal) => proposal.blockId === block.id && proposal.status === "pending",
      );
      if (existing) existing.status = "superseded";

      const proposal = {
        id: nextIdentifier(next, "proposal"),
        blockId: block.id,
        blockTitle: block.title,
        previousContent: block.content,
        proposedContent: patch.content,
        reason: safeReason(patch.reason),
        baseVersion: block.version,
        status: "pending",
        createdAt: timestamp(now),
      };
      next.proposals.unshift(proposal);
      results.push({
        blockId: block.id,
        status: "needs_review",
        proposalId: proposal.id,
        message: "Proposal queued. The current content was not changed.",
      });
      addActivity(
        next,
        {
          kind: "review",
          title: `${block.title} needs a human`,
          detail: safeReason(patch.reason),
          blockId: block.id,
        },
        now,
      );
      next.workspaceVersion += 1;
      continue;
    }

    if (block.authority !== AUTHORITY.DELEGATED) {
      results.push({
        blockId: block.id,
        status: "invalid",
        message: "Unknown authority state. Content was not changed.",
      });
      addActivity(
        next,
        {
          kind: "blocked",
          title: `${block.title} authority was invalid`,
          detail: "The policy engine failed closed without changing content.",
          blockId: block.id,
        },
        now,
      );
      continue;
    }

    block.content = patch.content;
    block.version += 1;
    block.updatedBy = "agent";
    next.workspaceVersion += 1;
    results.push({
      blockId: block.id,
      status: "applied",
      version: block.version,
      message: "Delegated change applied.",
    });
    addActivity(
      next,
      {
        kind: "applied",
        title: `${block.title} updated by agent`,
        detail: safeReason(patch.reason),
        blockId: block.id,
      },
      now,
    );
  }

  if (patches.length > MAX_PATCHES) {
    results.push({
      status: "invalid",
      message: `Only the first ${MAX_PATCHES} operations were evaluated.`,
    });
  }

  return { state: next, results };
}

export function resolveProposal(state, proposalId, decision, now = () => new Date()) {
  const next = clone(state);
  const proposal = next.proposals.find((candidate) => candidate.id === proposalId);

  if (!proposal || proposal.status !== "pending") {
    return { state: next, changed: false, error: "Pending proposal not found." };
  }
  if (decision !== "accept" && decision !== "reject") {
    return { state: next, changed: false, error: "Decision must be accept or reject." };
  }

  const block = next.blocks.find((candidate) => candidate.id === proposal.blockId);
  if (!block) return { state: next, changed: false, error: "Target block not found." };

  if (decision === "accept" && block.version !== proposal.baseVersion) {
    proposal.status = "conflict";
    next.workspaceVersion += 1;
    addActivity(
      next,
      {
        kind: "blocked",
        title: `${block.title} proposal expired`,
        detail: "The block changed after this proposal was created.",
        blockId: block.id,
      },
      now,
    );
    return { state: next, changed: true, error: "Proposal is stale." };
  }

  proposal.status = decision === "accept" ? "accepted" : "rejected";
  proposal.resolvedAt = timestamp(now);
  next.workspaceVersion += 1;

  if (decision === "accept") {
    block.content = proposal.proposedContent;
    block.version += 1;
    block.updatedBy = "human-approved-agent";
  }

  addActivity(
    next,
    {
      kind: decision === "accept" ? "accepted" : "rejected",
      title: `${block.title} proposal ${proposal.status}`,
      detail:
        decision === "accept"
          ? "A human approved the agent's suggestion."
          : "A human kept the original content.",
      blockId: block.id,
    },
    now,
  );

  return { state: next, changed: true, decision };
}

export function serializeWorkspace(state) {
  return {
    concept: "Every block carries an enforceable agent authority level.",
    instruction:
      "Read before writing. Respect each block's authority. Locked changes are rejected, review changes are queued, and delegated changes apply immediately.",
    objective: state.objective,
    workspaceVersion: state.workspaceVersion,
    blocks: state.blocks.map(({ id, title, eyebrow, content, authority, version }) => ({
      id,
      title,
      type: eyebrow,
      content,
      authority,
      version,
    })),
    pendingReviews: state.proposals
      .filter((proposal) => proposal.status === "pending")
      .map(({ id, blockId, blockTitle, proposedContent, reason, baseVersion }) => ({
        id,
        blockId,
        blockTitle,
        proposedContent,
        reason,
        baseVersion,
      })),
  };
}
