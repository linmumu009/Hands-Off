import {
  AUTHORITY,
  applyAgentPatches,
  createInitialState,
  cycleAuthority,
  editBlock,
  resolveProposal,
  serializeWorkspace,
} from "./domain.js";
import { registerHandsOffTools } from "./webmcp.js";

const STORAGE_KEY = "hands-off-workspace-v1";
const AGENT_PROMPT =
  "Read this Hands Off workspace, then make the launch plan more ambitious and fit it into two weeks. Try every authority level so I can see what is applied, queued, and blocked.";

const AUTHORITY_META = {
  [AUTHORITY.LOCKED]: {
    label: "Human only",
    caption: "Agent cannot edit",
    symbol: "—",
  },
  [AUTHORITY.REVIEW]: {
    label: "Review first",
    caption: "Agent may propose",
    symbol: "◐",
  },
  [AUTHORITY.DELEGATED]: {
    label: "Delegated",
    caption: "Agent may apply",
    symbol: "↗",
  },
};

const ACTIVITY_META = {
  system: { symbol: "•", label: "System" },
  authority: { symbol: "↻", label: "Boundary" },
  human: { symbol: "H", label: "Human" },
  blocked: { symbol: "—", label: "Blocked" },
  review: { symbol: "◐", label: "Review" },
  applied: { symbol: "↗", label: "Applied" },
  accepted: { symbol: "✓", label: "Accepted" },
  rejected: { symbol: "×", label: "Rejected" },
};

const dom = {
  workspaceGrid: document.querySelector("#workspaceGrid"),
  authoritySummary: document.querySelector("#authoritySummary"),
  activityList: document.querySelector("#activityList"),
  reviewQueue: document.querySelector("#reviewQueue"),
  reviewCount: document.querySelector("#reviewCount"),
  reviewCard: document.querySelector("#reviewCard"),
  objectiveText: document.querySelector("#objectiveText"),
  workspaceVersion: document.querySelector("#workspaceVersion"),
  connectionPill: document.querySelector("#connectionPill"),
  connectionLabel: document.querySelector("#connectionLabel"),
  runDemoButton: document.querySelector("#runDemoButton"),
  resetButton: document.querySelector("#resetButton"),
  copyPromptButton: document.querySelector("#copyPromptButton"),
  copyPromptInline: document.querySelector("#copyPromptInline"),
  agentPromptText: document.querySelector("#agentPromptText"),
  toast: document.querySelector("#toast"),
};

let state = loadState();
let toastTimer;
let recentOutcomes = new Map();

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return createInitialState();
    const parsed = JSON.parse(saved);
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.blocks)) return createInitialState();
    return parsed;
  } catch {
    return createInitialState();
  }
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The demo remains fully usable when storage is disabled.
  }
}

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function announce(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove("is-visible"), 3200);
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Now";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function autoSize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.max(64, textarea.scrollHeight)}px`;
}

function renderAuthoritySummary() {
  dom.authoritySummary.replaceChildren();
  for (const authority of Object.values(AUTHORITY)) {
    const count = state.blocks.filter((block) => block.authority === authority).length;
    const meta = AUTHORITY_META[authority];
    const item = makeElement("div", `summary-item ${authority}`);
    item.append(
      makeElement("span", "summary-symbol", meta.symbol),
      makeElement("strong", "summary-count", String(count).padStart(2, "0")),
    );
    const copy = makeElement("span", "summary-copy");
    copy.append(makeElement("b", "", meta.label), makeElement("small", "", meta.caption));
    item.append(copy);
    dom.authoritySummary.append(item);
  }
}

function renderBlock(block) {
  const meta = AUTHORITY_META[block.authority];
  const outcome = recentOutcomes.get(block.id);
  const card = makeElement(
    "article",
    `workspace-card ${block.authority}${outcome ? ` outcome-${outcome}` : ""}`,
  );
  card.dataset.blockId = block.id;

  const cardTop = makeElement("div", "card-top");
  const eyebrow = makeElement("span", "card-eyebrow", block.eyebrow);
  const authorityButton = makeElement("button", `authority-button ${block.authority}`);
  authorityButton.type = "button";
  authorityButton.dataset.action = "cycle-authority";
  authorityButton.dataset.blockId = block.id;
  authorityButton.title = "Click to change the agent's authority for this block";
  authorityButton.setAttribute("aria-label", `${block.title}: ${meta.label}. Change authority.`);
  authorityButton.append(
    makeElement("span", "authority-symbol", meta.symbol),
    makeElement("span", "", meta.label),
  );
  cardTop.append(eyebrow, authorityButton);

  const titleRow = makeElement("div", "card-title-row");
  titleRow.append(makeElement("h3", "", block.title), makeElement("span", "block-version", `v${block.version}`));

  const textarea = makeElement("textarea", "block-content");
  textarea.value = block.content;
  textarea.dataset.action = "edit-block";
  textarea.dataset.blockId = block.id;
  textarea.setAttribute("aria-label", `${block.title} content`);
  textarea.spellcheck = true;
  textarea.addEventListener("input", () => autoSize(textarea));
  textarea.addEventListener("blur", () => {
    const result = editBlock(state, block.id, textarea.value);
    if (result.changed) {
      state = result.state;
      persistState();
      render();
      announce(`${block.title} updated by you.`);
    } else if (result.error) {
      textarea.value = block.content;
      autoSize(textarea);
      announce(result.error);
    }
  });

  const cardFooter = makeElement("div", "card-footer");
  cardFooter.append(
    makeElement(
      "span",
      "authority-explainer",
      block.authority === AUTHORITY.LOCKED
        ? "Enforced boundary"
        : block.authority === AUTHORITY.REVIEW
          ? "You keep the final say"
          : "Safe to move fast",
    ),
    makeElement(
      "span",
      "updated-by",
      block.updatedBy === "agent"
        ? "Last touched by agent"
        : block.updatedBy === "human-approved-agent"
          ? "Agent draft · human approved"
          : "Last touched by you",
    ),
  );

  card.append(cardTop, titleRow, textarea, cardFooter);
  requestAnimationFrame(() => autoSize(textarea));
  return card;
}

function renderWorkspace() {
  dom.workspaceGrid.replaceChildren(...state.blocks.map(renderBlock));
}

function renderReviews() {
  const pending = state.proposals.filter((proposal) => proposal.status === "pending");
  dom.reviewCount.textContent = String(pending.length);
  dom.reviewCard.classList.toggle("has-reviews", pending.length > 0);
  dom.reviewQueue.replaceChildren();

  if (pending.length === 0) {
    const empty = makeElement("div", "empty-review");
    empty.append(
      makeElement("span", "empty-review-icon", "✓"),
      makeElement("p", "", "Nothing needs your attention."),
      makeElement("small", "", "Suggestions appear here without changing the source."),
    );
    dom.reviewQueue.append(empty);
    return;
  }

  for (const proposal of pending) {
    const item = makeElement("article", "proposal");
    const title = makeElement("div", "proposal-title");
    title.append(
      makeElement("strong", "", proposal.blockTitle),
      makeElement("span", "", "Agent suggestion"),
    );

    const reason = makeElement("p", "proposal-reason", proposal.reason);
    const diff = makeElement("div", "proposal-diff");
    const before = makeElement("div", "diff-block diff-before");
    before.append(makeElement("span", "", "BEFORE"), makeElement("p", "", proposal.previousContent));
    const after = makeElement("div", "diff-block diff-after");
    after.append(makeElement("span", "", "PROPOSED"), makeElement("p", "", proposal.proposedContent));
    diff.append(before, after);

    const actions = makeElement("div", "proposal-actions");
    const reject = makeElement("button", "reject-button", "Keep original");
    reject.type = "button";
    reject.dataset.action = "resolve-proposal";
    reject.dataset.proposalId = proposal.id;
    reject.dataset.decision = "reject";
    const accept = makeElement("button", "accept-button", "Accept change");
    accept.type = "button";
    accept.dataset.action = "resolve-proposal";
    accept.dataset.proposalId = proposal.id;
    accept.dataset.decision = "accept";
    actions.append(reject, accept);

    item.append(title, reason, diff, actions);
    dom.reviewQueue.append(item);
  }
}

function renderActivity() {
  dom.activityList.replaceChildren();
  for (const activity of state.activity.slice(0, 8)) {
    const meta = ACTIVITY_META[activity.kind] ?? ACTIVITY_META.system;
    const item = makeElement("article", `activity-item ${activity.kind}`);
    const icon = makeElement("span", "activity-icon", meta.symbol);
    icon.setAttribute("aria-label", meta.label);
    const copy = makeElement("div", "activity-copy");
    const line = makeElement("div", "activity-title");
    line.append(makeElement("strong", "", activity.title), makeElement("time", "", formatTime(activity.at)));
    copy.append(line, makeElement("p", "", activity.detail));
    item.append(icon, copy);
    dom.activityList.append(item);
  }
}

function render() {
  dom.objectiveText.textContent = state.objective;
  dom.workspaceVersion.textContent = `v${state.workspaceVersion}`;
  renderAuthoritySummary();
  renderWorkspace();
  renderReviews();
  renderActivity();
}

function updateState(nextState) {
  state = nextState;
  persistState();
  render();
}

function submitPatch(input = {}) {
  if (typeof input.objective === "string" && input.objective.trim()) {
    state = { ...state, objective: input.objective.trim().slice(0, 240) };
  }

  const { state: nextState, results } = applyAgentPatches(state, input.operations);
  recentOutcomes = new Map(
    results
      .filter((result) => result.blockId)
      .map((result) => [result.blockId, result.status.replace("needs_review", "review")]),
  );
  updateState(nextState);

  const applied = results.filter((result) => result.status === "applied").length;
  const queued = results.filter((result) => result.status === "needs_review").length;
  const blocked = results.filter((result) => result.status === "blocked").length;
  announce(`${applied} applied · ${queued} for review · ${blocked} blocked`);

  setTimeout(() => {
    recentOutcomes = new Map();
    renderWorkspace();
  }, 2600);

  return {
    summary: { applied, queuedForReview: queued, blocked },
    instruction:
      "Treat these outcomes as authoritative. Queued changes are not applied until a human accepts them.",
    results,
    workspaceVersion: nextState.workspaceVersion,
  };
}

function runDemo() {
  state = createInitialState();
  const versions = Object.fromEntries(state.blocks.map((block) => [block.id, block.version]));
  submitPatch({
    objective: "Ship a bolder launch in two weeks without crossing the human's boundaries.",
    operations: [
      {
        blockId: "launch-date",
        content: "September 12, 2026",
        expectedVersion: versions["launch-date"],
        reason: "An earlier launch would create more momentum.",
      },
      {
        blockId: "budget-cap",
        content: "$24,000 revised cap",
        expectedVersion: versions["budget-cap"],
        reason: "Extra production budget would support a larger launch.",
      },
      {
        blockId: "positioning",
        content: "Small teams. Unreasonably ambitious launches.",
        expectedVersion: versions.positioning,
        reason: "A shorter, more confident promise makes the product memorable.",
      },
      {
        blockId: "sprint-plan",
        content:
          "Days 1–3 — finish the authority loop\nDays 4–7 — test with five design partners\nDays 8–10 — publish proof, not promises",
        expectedVersion: versions["sprint-plan"],
        reason: "A day-level plan makes the two-week constraint executable.",
      },
      {
        blockId: "risk-register",
        content:
          "• Guard the two-tool scope\n• Rehearse the WebMCP path before recording\n• Keep a preview-mode fallback",
        expectedVersion: versions["risk-register"],
        reason: "The launch needs operational countermeasures, not only risks.",
      },
    ],
  });
}

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(AGENT_PROMPT);
    announce("Agent prompt copied.");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = AGENT_PROMPT;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    announce("Agent prompt copied.");
  }
}

dom.workspaceGrid.addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="cycle-authority"]');
  if (!button) return;
  const result = cycleAuthority(state, button.dataset.blockId);
  if (!result.changed) return;
  updateState(result.state);
  announce(`Authority changed to ${AUTHORITY_META[result.authority].label}.`);
});

dom.reviewQueue.addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="resolve-proposal"]');
  if (!button) return;
  const result = resolveProposal(state, button.dataset.proposalId, button.dataset.decision);
  if (!result.changed) {
    announce(result.error ?? "That proposal is no longer available.");
    return;
  }
  updateState(result.state);
  announce(result.decision === "accept" ? "Suggestion accepted." : "Original kept.");
});

dom.runDemoButton.addEventListener("click", runDemo);
dom.resetButton.addEventListener("click", () => {
  recentOutcomes = new Map();
  updateState(createInitialState());
  announce("Canvas reset.");
});
dom.copyPromptButton.addEventListener("click", copyPrompt);
dom.copyPromptInline.addEventListener("click", copyPrompt);

dom.agentPromptText.textContent = `“${AGENT_PROMPT}”`;
render();

const controller = {
  readWorkspace: () => serializeWorkspace(state),
  submitPatch,
};

registerHandsOffTools(controller).then((connection) => {
  dom.connectionLabel.textContent = connection.message;
  dom.connectionPill.classList.toggle("is-connected", connection.supported);
  dom.connectionPill.classList.toggle("is-preview", !connection.supported);
});
