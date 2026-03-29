#!/usr/bin/env node
import { Command } from "commander";
import { loginWithQR } from "./ilink/login.js";
import { saveAccount, getDefaultAccount } from "./state.js";
import { startBridge } from "./bridge.js";
import { createBackend, type BackendType } from "./backend/index.js";
import { logger } from "./logger.js";

const DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";

async function doLogin(): Promise<{ accountId: string; token: string; baseUrl: string }> {
  console.log("🔗 WeChat ↔ Code CLI Bridge — Login\n");

  const result = await loginWithQR({ apiBaseUrl: DEFAULT_BASE_URL });
  console.log(`\n${result.message}`);

  if (!result.connected || !result.botToken || !result.accountId) {
    console.error("Login failed.");
    process.exit(1);
  }

  const id = saveAccount(result.accountId, {
    token: result.botToken,
    baseUrl: result.baseUrl,
    userId: result.userId,
  });
  console.log(`Account saved: ${id}\n`);

  return {
    accountId: id,
    token: result.botToken,
    baseUrl: result.baseUrl ?? DEFAULT_BASE_URL,
  };
}

const program = new Command();

program
  .name("wcc")
  .description("Bridge WeChat messages to code CLIs (Claude Code, Gemini, Codex) via iLink protocol")
  .version("0.1.0");

program
  .command("login")
  .description("Scan QR code to connect WeChat (without starting bridge)")
  .action(async () => {
    await doLogin();
  });

program
  .command("start", { isDefault: true })
  .description("Start the message bridge (auto-login if needed)")
  .option("--cli <name>", "Code CLI to use: claude, gemini, codex", "claude")
  .option("--yolo", "Skip all permission prompts", false)
  .option("-m, --model <model>", "Model override (e.g. sonnet, gemini-2.5-flash, gpt-5.2-codex)")
  .action(async (options: { cli: string; yolo: boolean; model?: string }) => {
    const cliName = (process.env.WEIXIN_CC_CLI ?? options.cli) as string;
    const validBackends = ["claude", "gemini", "codex"];
    if (!validBackends.includes(cliName)) {
      console.error(`Unknown CLI backend: "${cliName}". Supported: ${validBackends.join(", ")}`);
      process.exit(1);
    }

    const backendType = cliName as BackendType;
    const backend = createBackend(backendType);

    // Auto-login if no account or token
    let account = getDefaultAccount();
    if (!account || !account.data.token) {
      console.log("No account found. Starting login...\n");
      const loginResult = await doLogin();
      account = {
        accountId: loginResult.accountId,
        data: { token: loginResult.token, baseUrl: loginResult.baseUrl },
      };
    }

    const model = options.model ?? process.env.WEIXIN_CC_MODEL;

    console.log("🔗 WeChat ↔ Code CLI Bridge — Starting\n");
    console.log(`  Account:     ${account.accountId}`);
    console.log(`  CLI:         ${backendType}`);
    console.log(`  BaseURL:     ${account.data.baseUrl ?? DEFAULT_BASE_URL}`);
    if (model) {
      console.log(`  Model:       ${model}`);
    }
    if (options.yolo) {
      console.log(`  Permissions: SKIPPED (auto-approve)`);
    }
    console.log("");

    const controller = new AbortController();

    const shutdown = () => {
      console.log("\nShutting down...");
      controller.abort();
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    try {
      await startBridge({
        baseUrl: account.data.baseUrl ?? DEFAULT_BASE_URL,
        token: account.data.token!,
        accountId: account.accountId,
        abortSignal: controller.signal,
        model,
        autoApprove: options.yolo,
        backend,
        onSessionExpired: async () => {
          const creds = await doLogin();
          return creds;
        },
      });
    } catch (err) {
      if (controller.signal.aborted) {
        logger.info("Bridge shut down gracefully");
      } else {
        logger.error(`Bridge crashed: ${String(err)}`);
        process.exit(1);
      }
    }
  });

program.parse();
