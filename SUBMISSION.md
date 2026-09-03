# Hands Off — submission kit

## Links

- Live app: https://linmumu009.github.io/Hands-Off/
- Source: https://github.com/linmumu009/Hands-Off

## One-line pitch

Hands Off turns every interface object into an enforceable agent permission: human-only, review-first, or delegated.

## Short description

Today, people control agents in two fragile ways: they repeat boundaries in prompts, or approve actions one interruption at a time. Hands Off introduces a third model. Every object in a shared WebMCP workspace visibly declares how much authority the agent has. The human sets the mandate once; the application enforces it every time.

When an agent submits a batch of changes, one request can produce three outcomes at once. Protected blocks are rejected, review-first blocks become inspectable proposals, and delegated blocks update immediately. This makes autonomy legible without making it all-or-nothing.

## Inspiration

Agent interfaces currently treat permission as a global setting or a stream of confirmation dialogs. Neither matches how people delegate in real life. We usually retain control over a few consequential decisions, ask to review subjective work, and delegate routine execution. Hands Off makes that mental model visible in the interface.

## What it does

- Lets humans switch any workspace block among three authority levels.
- Exposes the live authority map and versioned content through `read_workspace`.
- Routes each operation in `submit_patch` through application-enforced policy.
- Shows blocked actions, queued proposals, accepted changes and autonomous edits in a shared authority log.
- Provides a deterministic preview demo in browsers without WebMCP support.

## How it was built

Hands Off is a dependency-free static web application. Its two site tools are registered with the imperative WebMCP JavaScript API on the top-level page. A pure policy engine handles validation, optimistic concurrency, proposal lifecycle and immutable state transitions. Browser local storage keeps the canvas available across refreshes.

No model API, backend or database is required: the visiting agent provides intelligence, while the application retains authority over the WebMCP write path.

## The 60-second demo

**0–07s — Problem**  
“Agent permissions are either buried in prompts or reduced to endless confirmation dialogs.”

**07–15s — Set the mandate**  
Show the launch canvas. Point to the locked date and budget, review-first positioning, and delegated execution blocks. Change one authority by clicking its badge.

**15–25s — Invite the agent**  
Paste: “Read this workspace, make the launch bolder, and try every authority level.” Show `read_workspace` and the agent's single batch submission.

**25–42s — The reveal**  
The two locked cards shake but do not change. The positioning card glows purple and appears in Human review. The delegated sprint and risk cards update in green. Say: “One request, three levels of agency—enforced by the application.”

**42–51s — Human judgment**  
Open the proposed positioning diff and select **Accept change**. The authority log records the human-approved agent edit.

**51–60s — Thesis**  
“Future interfaces shouldn't only describe what users can do. They should describe what their agents are allowed to do. Paint the boundary. Delegate the rest.”

## Suggested screenshots

1. Hero and untouched authority canvas.
2. Post-demo canvas showing orange blocked, purple review and green applied states together.
3. Human review diff immediately before acceptance.

## Future direction

The same object-level authority primitive can extend to documents, spreadsheets, design canvases, project plans, dashboards and commerce flows. A later version could add time-limited mandates, monetary limits, organizational policy inheritance and portable authority profiles.
