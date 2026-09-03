# Hands Off

> **Paint the boundary. Delegate the rest.**

**Live demo:** [linmumu009.github.io/Hands-Off](https://linmumu009.github.io/Hands-Off/)

Hands Off is a WebMCP-native authority canvas where every object declares how much authority an AI agent has. Instead of repeating constraints in prompts or approving every individual action, a human sets a persistent, visible mandate on the objects themselves.

## The interaction model

Every workspace block has one of three enforceable authority levels:

| Authority | Agent behavior | Human experience |
| --- | --- | --- |
| **Human only** | A write is rejected by application code | The boundary visibly holds |
| **Review first** | A write becomes a proposal | The human accepts or rejects a diff |
| **Delegated** | A valid write is applied immediately | Routine work moves without friction |

The important distinction is enforcement. These levels are not instructions that an agent may forget. The `submit_patch` tool routes every operation according to the current authority stored in the live page.

## Try it

Open the app in a WebMCP-capable browser, keep the page visible beside ChatGPT or Codex, and send:

> Read this Hands Off workspace, then make the launch plan more ambitious and fit it into two weeks. Try every authority level so I can see what is applied, queued, and blocked.

The agent should call `read_workspace` first and then `submit_patch`. The launch date and budget remain protected, positioning goes to human review, and delegated execution blocks update immediately.

In a regular browser, select **Run the 20-second demo** to execute the same deterministic authority path without an agent.

For the real WebMCP check, use the ChatGPT desktop app's integrated browser with GPT-5.6 Sol or GPT-5.6 Terra. Confirm that the connection pill reports two site tools, run the prompt above, and inspect the browser's recent site-tool activity after the canvas changes.

## Site tools

### `read_workspace`

Returns the objective plus each block's stable ID, complete content, authority and version. It is read-only and idempotent.

### `submit_patch`

Accepts up to 12 narrow block replacements. Every operation includes the `expectedVersion` observed during the read, preventing stale agent writes. The result explicitly reports `applied`, `needs_review`, `blocked`, `conflict` or `invalid`; a queued proposal is never represented as applied.

Both tools are registered imperatively through `document.modelContext.registerTool` on the top-level page. The app has no model API, backend, account system or external runtime dependency.

Hands Off demonstrates application-enforced authority for writes submitted through its WebMCP tool. It does not replace browser, account, identity or operating-system security; the integrated browser's normal safety review remains a separate layer.

## Run locally

Any static server works:

```sh
python -m http.server 4173
```

Then open [http://localhost:4173](http://localhost:4173).

## Test

The project uses Node's built-in test runner, so no dependency install is required:

```sh
npm test
npm run check
```

The test suite covers:

- locked, review-first and delegated patch routing;
- optimistic concurrency and stale proposal rejection;
- human edits and authority changes;
- safe WebMCP tool registration and annotations;
- local-only assets, required DOM targets and responsive/reduced-motion styles.

## Architecture

```text
Human changes authority in the page
                ↓
Agent calls read_workspace
                ↓
Agent submits narrow, versioned patches
                ↓
Application policy engine routes each patch
        ↙               ↓               ↘
     blocked        human review       applied
```

Application state is stored locally in the browser. All content is rendered through DOM text properties rather than HTML injection.

## Why WebMCP

WebMCP gives the human and the agent access to the same live page and the same transient state. Hands Off uses that shared context to make authority spatial, persistent and enforceable—the interface communicates not only what exists, but what the agent is allowed to change.

Built for the OpenAI WebMCP Challenge.
