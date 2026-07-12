import type { AISettings } from "@/data/types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const MAX_REQUEST_BODY_SIZE = 15 * 1024 * 1024;

function buildEndpoint(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, "");
  if (!/\/chat\/completions$/.test(url)) {
    url += "/chat/completions";
  }
  return url;
}

function logRequestInfo(model: string, messages: ChatMessage[], bodySize: number): void {
  const systemLen = messages.find((m) => m.role === "system")?.content.length ?? 0;
  const userLen = messages.find((m) => m.role === "user")?.content.length ?? 0;
  console.debug(`[aiClient] Calling model: ${model}`);
  console.debug(`[aiClient] Request body size: ${(bodySize / 1024).toFixed(2)} KB`);
  console.debug(`[aiClient] System prompt: ${systemLen} chars`);
  console.debug(`[aiClient] User prompt: ${userLen} chars`);
}

function checkRequestSize(bodySize: number): void {
  if (bodySize > MAX_REQUEST_BODY_SIZE) {
    console.warn(`[aiClient] Request body too large: ${(bodySize / 1024 / 1024).toFixed(2)} MB, max allowed: ${MAX_REQUEST_BODY_SIZE / 1024 / 1024} MB`);
  }
}

/** 调用 OpenAI 兼容的 chat/completions 接口，返回助手消息文本 */
export async function chatComplete(
  settings: AISettings,
  messages: ChatMessage[],
  opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<string> {
  if (!settings.apiKey) {
    throw new Error("尚未配置 API Key，请先在设置中填写。");
  }
  const endpoint = buildEndpoint(settings.baseUrl);
  const controller = new AbortController();
  const timeout = opts.timeoutMs ?? 90000;
  const timer = setTimeout(() => controller.abort(), timeout);
  if (opts.signal) {
    opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const requestBody = {
      model: messages[0]?.role === "system" ? inferModel(messages, settings) : settings.proModel,
      messages,
      temperature: settings.temperature,
      stream: false,
      max_tokens: 8192,
    };
    const bodyStr = JSON.stringify(requestBody);
    const bodySize = new Blob([bodyStr]).size;

    logRequestInfo(requestBody.model, messages, bodySize);
    checkRequestSize(bodySize);

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Length": String(bodySize),
      },
      body: bodyStr,
      signal: controller.signal,
      keepalive: true,
    });

    console.debug(`[aiClient] Response status: ${resp.status}`);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      const errorDetail = errText.slice(0, 300) || resp.statusText;
      console.error(`[aiClient] API Error ${resp.status}: ${errorDetail}`);
      throw new Error(`接口返回 ${resp.status}：${errorDetail}`);
    }

    const data = await resp.json();
    const content: string =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      "";
    if (!content) {
      throw new Error("接口返回空内容，请检查模型名称与配额。");
    }
    if (content.length > 100000) {
      console.warn(`[aiClient] Response too large (${content.length} chars), truncating`);
      return content.slice(0, 100000);
    }
    return content;
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === "AbortError") {
      console.warn("[aiClient] Request timed out or aborted");
      throw new Error("请求超时或已取消。");
    }
    if (e instanceof TypeError) {
      console.error("[aiClient] Network error:", e);
      throw new Error(
        "网络请求失败，可能为 CORS 跨域限制或 Base URL 不可达。可尝试更换 Base URL 或使用支持浏览器直连的服务商。",
      );
    }
    console.error("[aiClient] Unexpected error:", e);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function inferModel(_messages: ChatMessage[], settings: AISettings): string {
  return settings.proModel;
}

/** 显式指定模型调用 */
export async function chatWithModel(
  settings: AISettings,
  model: string,
  messages: ChatMessage[],
  opts: { timeoutMs?: number; signal?: AbortSignal; retries?: number } = {},
): Promise<string> {
  if (!settings.apiKey) {
    throw new Error("尚未配置 API Key，请先在设置中填写。");
  }
  const endpoint = buildEndpoint(settings.baseUrl);
  const maxRetries = opts.retries ?? 2;
  const timeout = opts.timeoutMs ?? 90000;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    if (opts.signal) {
      opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
      const requestBody = {
        model,
        messages,
        temperature: settings.temperature,
        stream: false,
        max_tokens: 8192,
      };
      const bodyStr = JSON.stringify(requestBody);
      const bodySize = new Blob([bodyStr]).size;

      logRequestInfo(model, messages, bodySize);
      checkRequestSize(bodySize);

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`,
          "Content-Length": String(bodySize),
        },
        body: bodyStr,
        signal: controller.signal,
        keepalive: true,
      });

      console.debug(`[aiClient] Response status (attempt ${attempt}): ${resp.status}`);

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        const errorDetail = errText.slice(0, 300) || resp.statusText;
        console.error(`[aiClient] API Error ${resp.status} (attempt ${attempt}): ${errorDetail}`);

        if (attempt <= maxRetries && (resp.status >= 500 || resp.status === 429)) {
          console.warn(`[aiClient] Retrying (attempt ${attempt}/${maxRetries}) after error: ${resp.status}`);
          clearTimeout(timer);
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }

        throw new Error(`接口返回 ${resp.status}：${errorDetail}`);
      }

      const data = await resp.json();
      const content: string =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.text ??
        "";
      if (!content) {
        throw new Error("接口返回空内容，请检查模型名称与配额。");
      }
      if (content.length > 100000) {
        console.warn(`[chatWithModel] Response too large (${content.length} chars), truncating`);
        return content.slice(0, 100000);
      }
      return content;
    } catch (e: unknown) {
      clearTimeout(timer);

      if (e instanceof DOMException && e.name === "AbortError") {
        console.warn(`[aiClient] Request timed out (attempt ${attempt})`);
        if (attempt <= maxRetries) {
          console.warn(`[aiClient] Retrying (attempt ${attempt}/${maxRetries}) after timeout`);
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          continue;
        }
        throw new Error("请求超时或已取消。");
      }

      if (e instanceof TypeError) {
        console.error(`[aiClient] Network error (attempt ${attempt}):`, e);
        if (attempt <= maxRetries) {
          console.warn(`[aiClient] Retrying (attempt ${attempt}/${maxRetries}) after network error`);
          await new Promise((r) => setTimeout(r, 3000 * attempt));
          continue;
        }
        throw new Error(
          "网络请求失败，可能为 CORS 跨域限制或 Base URL 不可达。可尝试更换 Base URL 或使用支持浏览器直连的服务商。",
        );
      }

      console.error(`[aiClient] Error (attempt ${attempt}):`, e);
      throw e;
    }
  }

  throw new Error("请求失败，已达到最大重试次数。");
}
