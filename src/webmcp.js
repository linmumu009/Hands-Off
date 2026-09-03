const READ_WORKSPACE_TOOL = {
  name: "read_workspace",
  description:
    "Read the live Hands Off workspace before proposing any change. Returns every block's stable ID, content, version, and enforceable authority: locked blocks cannot be changed, review blocks require human approval, and delegated blocks may be updated immediately.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
};

const SUBMIT_PATCH_TOOL = {
  name: "submit_patch",
  description:
    "Submit narrow, block-level changes to the Hands Off workspace. The application—not the agent—enforces authority. A locked block is rejected, a review block becomes a visible proposal, and a delegated block is applied. Include expectedVersion from read_workspace to prevent stale writes. The response reports each outcome and is the source of truth; never claim a blocked or queued change was applied.",
  inputSchema: {
    type: "object",
    properties: {
      operations: {
        type: "array",
        minItems: 1,
        maxItems: 12,
        items: {
          type: "object",
          properties: {
            blockId: {
              type: "string",
              description: "A stable block ID returned by read_workspace.",
            },
            content: {
              type: "string",
              description: "The complete replacement content for this block.",
              minLength: 1,
              maxLength: 4000,
            },
            reason: {
              type: "string",
              description: "A concise, human-readable reason for the change.",
              maxLength: 240,
            },
            expectedVersion: {
              type: "integer",
              description: "The block version observed in read_workspace.",
              minimum: 1,
            },
          },
          required: ["blockId", "content", "expectedVersion"],
          additionalProperties: false,
        },
      },
    },
    required: ["operations"],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
};

export async function registerHandsOffTools(controller) {
  if (typeof document.modelContext?.registerTool !== "function") {
    return {
      supported: false,
      message: "Preview mode · open in a WebMCP browser for live site tools",
    };
  }

  try {
    await document.modelContext.registerTool({
      ...READ_WORKSPACE_TOOL,
      execute: async () => controller.readWorkspace(),
    });

    await document.modelContext.registerTool({
      ...SUBMIT_PATCH_TOOL,
      execute: async (input) => controller.submitPatch(input),
    });

    return {
      supported: true,
      message: "WebMCP connected · 2 site tools",
    };
  } catch (error) {
    return {
      supported: false,
      message: "Site tools unavailable · preview mode active",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const toolDefinitions = Object.freeze({
  readWorkspace: READ_WORKSPACE_TOOL,
  submitPatch: SUBMIT_PATCH_TOOL,
});
