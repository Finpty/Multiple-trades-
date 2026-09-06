import type { AdapterConfig, AIProviderAdapter, AITextRequest } from "./types";

async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs = 60_000): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${(await res.text()).slice(0, 500)}`);
  return res.json();
}

const anthropic: AIProviderAdapter = {
  id: "anthropic",
  label: "Anthropic",
  requiresApiKey: true,
  defaultBaseUrl: "https://api.anthropic.com",
  defaultModels: ["claude-sonnet-5", "claude-haiku-4-5-20251001"],
  async generateText(req, cfg) {
    const data = (await postJson(
      `${cfg.baseUrl ?? this.defaultBaseUrl}/v1/messages`,
      { "x-api-key": cfg.apiKey ?? "", "anthropic-version": "2023-06-01" },
      {
        model: cfg.model,
        max_tokens: req.maxTokens ?? 1024,
        temperature: req.temperature,
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
      },
    )) as { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
    return {
      text: (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join(""),
      model: cfg.model,
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    };
  },
};

function openAiCompatible(id: string, label: string, defaultBaseUrl: string | null, defaultModels: string[], requiresApiKey = true): AIProviderAdapter {
  return {
    id,
    label,
    requiresApiKey,
    defaultBaseUrl,
    defaultModels,
    async generateText(req: AITextRequest, cfg: AdapterConfig) {
      const base = (cfg.baseUrl ?? defaultBaseUrl ?? "").replace(/\/$/, "");
      if (!base) throw new Error("Base URL is required for this provider");
      const messages = [] as Array<{ role: string; content: string }>;
      if (req.system) messages.push({ role: "system", content: req.system });
      messages.push({ role: "user", content: req.prompt });
      const data = (await postJson(
        `${base}/chat/completions`,
        cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {},
        {
          model: cfg.model,
          messages,
          max_tokens: req.maxTokens ?? 1024,
          temperature: req.temperature,
          ...(req.json ? { response_format: { type: "json_object" } } : {}),
        },
      )) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      return {
        text: data.choices?.[0]?.message?.content ?? "",
        model: cfg.model,
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      };
    },
  };
}

const google: AIProviderAdapter = {
  id: "google",
  label: "Google Gemini",
  requiresApiKey: true,
  defaultBaseUrl: "https://generativelanguage.googleapis.com",
  defaultModels: ["gemini-2.5-flash", "gemini-2.5-pro"],
  async generateText(req, cfg) {
    const url = `${cfg.baseUrl ?? this.defaultBaseUrl}/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey ?? "")}`;
    const data = (await postJson(
      url,
      {},
      {
        ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
        contents: [{ role: "user", parts: [{ text: req.prompt }] }],
        generationConfig: { maxOutputTokens: req.maxTokens ?? 1024, temperature: req.temperature, ...(req.json ? { responseMimeType: "application/json" } : {}) },
      },
    )) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
    return {
      text: data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "",
      model: cfg.model,
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  },
};

export const AI_ADAPTERS: Record<string, AIProviderAdapter> = {
  anthropic,
  openai: openAiCompatible("openai", "OpenAI", "https://api.openai.com/v1", ["gpt-5", "gpt-5-mini"]),
  google,
  openai_compatible: openAiCompatible("openai_compatible", "OpenAI-compatible (Mistral, Groq, Together, …)", null, []),
  local: openAiCompatible("local", "Local model (Ollama, LM Studio, vLLM)", "http://localhost:11434/v1", ["llama3.1", "qwen2.5"], false),
};

export function getAdapter(provider: string): AIProviderAdapter | null {
  return AI_ADAPTERS[provider] ?? null;
}
