export type BackendType = "claude" | "gemini" | "codex";

export interface BackendResponse {
  result: string;
  sessionId: string;
  durationMs: number;
  costUsd: number;
}

export interface BackendRunOpts {
  timeoutMs?: number;
  model?: string;
  autoApprove?: boolean;
}

export interface BackendRunner {
  readonly name: BackendType;
  run(message: string, fromUserId: string, opts?: BackendRunOpts): Promise<BackendResponse>;
  resetSession(fromUserId: string): void;
}
