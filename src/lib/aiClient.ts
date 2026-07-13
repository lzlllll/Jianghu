import type { AISettings } from "@/data/types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const MAX_REQUEST_BODY_SIZE = 15 * 1024 * 1024;
const DEFAULT_TIMEOUT = 300000;

const PROXY_MAP: Record<string, string> = {
  "https://api.deepseek.com/v1": "/api/deepseek",
  "https://api.openai.com/v1": "/api/openai",
  "https://open.bigmodel.cn/api/paas/v4": "/api/glm",
  "https://dashscope.aliyuncs.com/compatible-mode/v1": "/api/qwen",
};

function isDevMode(): boolean {
  return import.meta.env.DEV;
}

function buildEndpoint(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, "");

  if (isDevMode() && PROXY_MAP[url]) {
    url = PROXY_MAP[url];
    console.debug(`[aiClient] Development mode detected, using proxy: ${url}`);
  }

  if (!/\/chat\/completions$/.test(url)) {
    url += "/chat/completions";
  }
  return url;
}

function logRequestInfo(model: string, messages: ChatMessage[], bodySize: number, endpoint: string): void {
  const systemLen = messages.find((m) => m.role === "system")?.content.length ?? 0;
  const userLen = messages.find((m) => m.role === "user")?.content.length ?? 0;
  console.debug(`[aiClient] === 请求开始 ===`);
  console.debug(`[aiClient] Endpoint: ${endpoint}`);
  console.debug(`[aiClient] Model: ${model}`);
  console.debug(`[aiClient] Request body size: ${(bodySize / 1024).toFixed(2)} KB`);
  console.debug(`[aiClient] System prompt: ${systemLen} chars`);
  console.debug(`[aiClient] User prompt: ${userLen} chars`);
  console.debug(`[aiClient] Total messages: ${messages.length}`);
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
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT;
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

    logRequestInfo(requestBody.model, messages, bodySize, endpoint);
    checkRequestSize(bodySize);

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: bodyStr,
      signal: controller.signal,
    });

    console.debug(`[aiClient] Response status: ${resp.status}`);

    // 连接已建立，清除超时计时器，让响应读取不受限
    clearTimeout(timer);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      const errorDetail = errText.slice(0, 300) || resp.statusText;
      console.error(`[aiClient] API Error ${resp.status}: ${errorDetail}`);
      throw new Error(`接口返回 ${resp.status}：${errorDetail}`);
    }

    let data: any;
    try {
      data = await resp.json();
    } catch (jsonErr) {
      const text = await resp.text().catch(() => "");
      console.error(`[aiClient] JSON parse error in chatComplete:`, jsonErr);
      console.error(`[aiClient] Response text (first 500 chars):`, text.slice(0, 500));

      if (text.startsWith("<") || text.includes("<!DOCTYPE") || text.includes("<html")) {
        throw new Error(`接口返回非 JSON 数据（可能是错误页面）。\n\n响应内容预览：${text.slice(0, 300)}\n\n请检查：1. Base URL 是否正确 2. 模型名称是否有效 3. API Key 是否正确`);
      }

      throw new Error(`JSON 解析失败：${(jsonErr as Error).message}\n\n响应内容：${text.slice(0, 300)}`);
    }

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
      console.error("[aiClient] === 网络错误诊断 === ");
      console.error("[aiClient] Endpoint:", endpoint);
      console.error("[aiClient] Base URL:", settings.baseUrl);
      console.error("[aiClient] Possible causes:");
      console.error("[aiClient] 1. CORS restriction - browser blocks direct API calls");
      console.error("[aiClient] 2. Network timeout - request body too large");
      console.error("[aiClient] 3. DNS resolution failure");
      console.error("[aiClient] 4. Firewall/proxy blocking the connection");
      console.error("[aiClient] === 诊断结束 ===");
      throw new Error(
        `网络请求失败：${e.message}\n\n目标地址：${endpoint}\n\n可能原因：\n1. CORS 跨域限制（浏览器安全策略阻止直接调用）\n2. 网络超时（请求体过大或网络不稳定）\n3. DNS 解析失败\n4. 防火墙/代理拦截\n\n解决方案：\n- 开发环境：运行 npm run dev 使用 Vite 代理\n- 生产环境：配置支持 CORS 的反向代理\n- 更换为支持浏览器直连的 API 服务商`,
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
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT;

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

      logRequestInfo(model, messages, bodySize, endpoint);
      checkRequestSize(bodySize);

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: bodyStr,
        signal: controller.signal,
      });

      console.debug(`[aiClient] Response status (attempt ${attempt}): ${resp.status}`);

      // 连接已建立，清除超时计时器，让响应读取不受限
      clearTimeout(timer);

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

      let data: any;
      try {
        data = await resp.json();
      } catch (jsonErr) {
        const text = await resp.text().catch(() => "");
        console.error(`[aiClient] JSON parse error (attempt ${attempt}):`, jsonErr);
        console.error(`[aiClient] Response text (first 500 chars):`, text.slice(0, 500));

        if (text.startsWith("<") || text.includes("<!DOCTYPE") || text.includes("<html")) {
          console.error(`[aiClient] Server returned HTML instead of JSON. This usually means:`);
          console.error(`[aiClient] 1. The API endpoint is incorrect`);
          console.error(`[aiClient] 2. The model name is not recognized by the server`);
          console.error(`[aiClient] 3. Authentication failed`);
          console.error(`[aiClient] 4. CORS error`);
          throw new Error(`接口返回非 JSON 数据（可能是错误页面）。\n\n响应内容预览：${text.slice(0, 300)}\n\n请检查：1. Base URL 是否正确 2. 模型名称是否有效 3. API Key 是否正确`);
        }

        throw new Error(`JSON 解析失败：${(jsonErr as Error).message}\n\n响应内容：${text.slice(0, 300)}`);
      }

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
          `网络请求失败（已重试 ${maxRetries} 次）：${e.message}\n\n目标地址：${endpoint}\n模型：${model}\n请求体大小：${(new Blob([JSON.stringify({ model, messages })]).size / 1024).toFixed(2)} KB\n\n可能原因：\n1. CORS 跨域限制（浏览器安全策略阻止直接调用）\n2. 网络超时或不稳定\n3. DNS 解析失败\n4. 防火墙/代理拦截\n\n解决方案：\n- 开发环境：使用 npm run dev 启动（已内置代理，可绕过 CORS）\n- 如果开发环境已运行但仍失败，请检查 API Key 是否正确\n- 尝试更换 Base URL 或模型`,
        );
      }

      console.error(`[aiClient] Error (attempt ${attempt}):`, e);
      throw e;
    }
  }

  throw new Error("请求失败，已达到最大重试次数。");
}
