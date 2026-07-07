import type { AISettings } from "@/data/types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function buildEndpoint(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, "");
  if (!/\/chat\/completions$/.test(url)) {
    url += "/chat/completions";
  }
  return url;
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
  // 若外部传入 signal，串联取消
  if (opts.signal) {
    opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: messages[0]?.role === "system" ? inferModel(messages, settings) : settings.proModel,
        messages,
        temperature: settings.temperature,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`接口返回 ${resp.status}：${errText.slice(0, 200) || resp.statusText}`);
    }

    const data = await resp.json();
    const content: string =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      "";
    if (!content) {
      throw new Error("接口返回空内容，请检查模型名称与配额。");
    }
    return content;
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("请求超时或已取消。");
    }
    if (e instanceof TypeError) {
      // 网络错误 / CORS
      throw new Error(
        "网络请求失败，可能为 CORS 跨域限制或 Base URL 不可达。可尝试更换 Base URL 或使用支持浏览器直连的服务商。",
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// 简化：直接按调用方传入的 model 决定，避免依赖 system role 推断
function inferModel(_messages: ChatMessage[], settings: AISettings): string {
  return settings.proModel;
}

/** 显式指定模型调用 */
export async function chatWithModel(
  settings: AISettings,
  model: string,
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
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: settings.temperature,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`接口返回 ${resp.status}：${errText.slice(0, 200) || resp.statusText}`);
    }

    const data = await resp.json();
    const content: string =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      "";
    if (!content) {
      throw new Error("接口返回空内容，请检查模型名称与配额。");
    }
    return content;
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("请求超时或已取消。");
    }
    if (e instanceof TypeError) {
      throw new Error(
        "网络请求失败，可能为 CORS 跨域限制或 Base URL 不可达。可尝试更换 Base URL 或使用支持浏览器直连的服务商。",
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
