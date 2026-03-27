import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildClaudeArgs, parseClaudeOutput } from "../claude.js";
import { buildGeminiArgs, parseGeminiOutput } from "../gemini.js";
import { buildCodexArgs, parseCodexOutput } from "../codex.js";
import { createBackend } from "../index.js";

// ---------------------------------------------------------------------------
// Claude: arg building
// ---------------------------------------------------------------------------

describe("Claude arg building", () => {
  it("builds basic args", () => {
    const args = buildClaudeArgs("hello");
    assert.deepStrictEqual(args, ["-p", "hello", "--output-format", "json"]);
  });

  it("adds --dangerously-skip-permissions for autoApprove", () => {
    const args = buildClaudeArgs("hi", { autoApprove: true });
    assert.ok(args.includes("--dangerously-skip-permissions"));
  });

  it("adds --resume for existing session", () => {
    const args = buildClaudeArgs("hi", undefined, "sess-123");
    assert.ok(args.includes("--resume"));
    assert.ok(args.includes("sess-123"));
  });

  it("adds --model", () => {
    const args = buildClaudeArgs("hi", { model: "sonnet" });
    assert.ok(args.includes("--model"));
    assert.ok(args.includes("sonnet"));
  });

  it("adds --add-dir for each directory", () => {
    const args = buildClaudeArgs("hi", undefined, undefined, ["/a", "/b"]);
    const addDirIndices = args.reduce<number[]>((acc, v, i) => v === "--add-dir" ? [...acc, i] : acc, []);
    assert.strictEqual(addDirIndices.length, 2);
    assert.strictEqual(args[addDirIndices[0] + 1], "/a");
    assert.strictEqual(args[addDirIndices[1] + 1], "/b");
  });

  it("combines all flags", () => {
    const args = buildClaudeArgs("test", { autoApprove: true, model: "haiku" }, "sess-1", ["/dir"]);
    assert.ok(args.includes("--dangerously-skip-permissions"));
    assert.ok(args.includes("--resume"));
    assert.ok(args.includes("--model"));
    assert.ok(args.includes("--add-dir"));
  });
});

// ---------------------------------------------------------------------------
// Claude: output parsing
// ---------------------------------------------------------------------------

describe("Claude output parsing", () => {
  it("parses standard response", () => {
    const out = JSON.stringify({
      result: "Hello!",
      session_id: "abc-123",
      duration_ms: 500,
      total_cost_usd: 0.01,
    });
    const parsed = parseClaudeOutput(out);
    assert.strictEqual(parsed.result, "Hello!");
    assert.strictEqual(parsed.sessionId, "abc-123");
    assert.strictEqual(parsed.costUsd, 0.01);
    assert.strictEqual(parsed.isError, false);
  });

  it("parses error response", () => {
    const out = JSON.stringify({
      result: "Something went wrong",
      is_error: true,
      total_cost_usd: 0,
    });
    const parsed = parseClaudeOutput(out);
    assert.strictEqual(parsed.isError, true);
    assert.strictEqual(parsed.result, "Something went wrong");
  });

  it("handles missing fields", () => {
    const parsed = parseClaudeOutput("{}");
    assert.strictEqual(parsed.result, "");
    assert.strictEqual(parsed.sessionId, "");
    assert.strictEqual(parsed.costUsd, 0);
  });
});

// ---------------------------------------------------------------------------
// Gemini: arg building
// ---------------------------------------------------------------------------

describe("Gemini arg building", () => {
  it("builds basic args", () => {
    const args = buildGeminiArgs("hello");
    assert.deepStrictEqual(args, ["-p", "hello", "--output-format", "json"]);
  });

  it("adds --yolo for autoApprove", () => {
    const args = buildGeminiArgs("hi", { autoApprove: true });
    assert.ok(args.includes("--yolo"));
    assert.ok(!args.includes("--dangerously-skip-permissions"));
  });

  it("uses -m for model", () => {
    const args = buildGeminiArgs("hi", { model: "gemini-2.5-pro" });
    assert.ok(args.includes("-m"));
    assert.ok(args.includes("gemini-2.5-pro"));
    assert.ok(!args.includes("--model"));
  });

  it("uses --include-directories with comma-separated dirs", () => {
    const args = buildGeminiArgs("hi", undefined, undefined, ["/a", "/b"]);
    const idx = args.indexOf("--include-directories");
    assert.ok(idx !== -1);
    assert.strictEqual(args[idx + 1], "/a,/b");
  });

  it("adds --resume for session", () => {
    const args = buildGeminiArgs("hi", undefined, "sess-456");
    assert.ok(args.includes("--resume"));
    assert.ok(args.includes("sess-456"));
  });
});

// ---------------------------------------------------------------------------
// Gemini: output parsing
// ---------------------------------------------------------------------------

describe("Gemini output parsing", () => {
  it("parses result field", () => {
    const out = JSON.stringify({ result: "Gemini says hi", session_id: "g-1" });
    const parsed = parseGeminiOutput(out);
    assert.strictEqual(parsed.result, "Gemini says hi");
    assert.strictEqual(parsed.sessionId, "g-1");
  });

  it("falls back to response field", () => {
    const out = JSON.stringify({ response: "alt response" });
    const parsed = parseGeminiOutput(out);
    assert.strictEqual(parsed.result, "alt response");
  });

  it("detects error field", () => {
    const out = JSON.stringify({ error: "something broke" });
    const parsed = parseGeminiOutput(out);
    assert.strictEqual(parsed.isError, true);
  });
});

// ---------------------------------------------------------------------------
// Codex: arg building
// ---------------------------------------------------------------------------

describe("Codex arg building", () => {
  it("builds basic exec args", () => {
    const args = buildCodexArgs("hello");
    assert.deepStrictEqual(args, ["exec", "--json", "hello"]);
  });

  it("adds --full-auto for autoApprove", () => {
    const args = buildCodexArgs("hi", { autoApprove: true });
    assert.ok(args.includes("--full-auto"));
    assert.ok(!args.includes("--yolo"));
    assert.ok(!args.includes("--dangerously-skip-permissions"));
  });

  it("uses -m for model", () => {
    const args = buildCodexArgs("hi", { model: "gpt-5" });
    assert.ok(args.includes("-m"));
    assert.ok(args.includes("gpt-5"));
  });

  it("builds resume args with session ID", () => {
    const args = buildCodexArgs("follow-up", undefined, "sess-789");
    assert.deepStrictEqual(args, ["exec", "resume", "sess-789", "--json", "follow-up"]);
  });

  it("adds --add-dir for each directory", () => {
    const args = buildCodexArgs("hi", undefined, undefined, ["/x", "/y"]);
    const addDirIndices = args.reduce<number[]>((acc, v, i) => v === "--add-dir" ? [...acc, i] : acc, []);
    assert.strictEqual(addDirIndices.length, 2);
  });
});

// ---------------------------------------------------------------------------
// Codex: output parsing
// ---------------------------------------------------------------------------

describe("Codex output parsing", () => {
  it("parses JSONL with turn.completed event", () => {
    const lines = [
      JSON.stringify({ type: "thread.started", session_id: "codex-sess-1" }),
      JSON.stringify({ type: "turn.started" }),
      JSON.stringify({ type: "turn.completed", message: { content: "Done!", role: "assistant" } }),
    ].join("\n");

    const parsed = parseCodexOutput(lines);
    assert.strictEqual(parsed.result, "Done!");
    assert.strictEqual(parsed.sessionId, "codex-sess-1");
  });

  it("parses item.completed with content array", () => {
    const lines = [
      JSON.stringify({ type: "item.completed", item: { content: [{ type: "text", text: "Result text" }] }, session_id: "s1" }),
    ].join("\n");

    const parsed = parseCodexOutput(lines);
    assert.strictEqual(parsed.result, "Result text");
    assert.strictEqual(parsed.sessionId, "s1");
  });

  it("falls back to single JSON object", () => {
    const out = JSON.stringify({ result: "simple result", session_id: "s2" });
    const parsed = parseCodexOutput(out);
    assert.strictEqual(parsed.result, "simple result");
    assert.strictEqual(parsed.sessionId, "s2");
  });

  it("falls back to plain text", () => {
    const parsed = parseCodexOutput("Just plain text output");
    assert.strictEqual(parsed.result, "Just plain text output");
  });

  it("detects error in single JSON", () => {
    const out = JSON.stringify({ error: "oops", output: "fail" });
    const parsed = parseCodexOutput(out);
    assert.strictEqual(parsed.isError, true);
  });
});

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

describe("createBackend factory", () => {
  it("creates claude backend", () => {
    const b = createBackend("claude");
    assert.strictEqual(b.name, "claude");
  });

  it("creates gemini backend", () => {
    const b = createBackend("gemini");
    assert.strictEqual(b.name, "gemini");
  });

  it("creates codex backend", () => {
    const b = createBackend("codex");
    assert.strictEqual(b.name, "codex");
  });

  it("throws for unknown backend", () => {
    assert.throws(() => createBackend("unknown" as any), /Unknown CLI backend/);
  });
});
