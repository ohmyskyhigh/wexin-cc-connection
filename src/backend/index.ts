import type { BackendRunner, BackendType } from "./types.js";
import { createClaudeRunner } from "./claude.js";
import { createGeminiRunner } from "./gemini.js";
import { createCodexRunner } from "./codex.js";

export type { BackendRunner, BackendResponse, BackendRunOpts, BackendType } from "./types.js";

const VALID_BACKENDS: BackendType[] = ["claude", "gemini", "codex"];

export function createBackend(type: BackendType): BackendRunner {
  switch (type) {
    case "claude":
      return createClaudeRunner();
    case "gemini":
      return createGeminiRunner();
    case "codex":
      return createCodexRunner();
    default:
      throw new Error(
        `Unknown CLI backend: "${type}". Supported: ${VALID_BACKENDS.join(", ")}`,
      );
  }
}
