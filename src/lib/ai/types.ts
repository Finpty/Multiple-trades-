/**
 * Internal AI contract. Business code calls `AIService`; it never imports a
 * vendor SDK. Adapters translate this contract to a provider's HTTP API.
 */
export interface AITextRequest {
  /** Feature key for usage accounting, e.g. "service.description" */
  feature: string;
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /** Ask the model for JSON; the service validates it is parseable. */
  json?: boolean;
}

export interface AITextResult {
  text: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface AdapterConfig {
  provider: string;
  model: string;
  apiKey: string | null;
  baseUrl: string | null;
  settings: Record<string, unknown>;
}

export interface AIProviderAdapter {
  readonly id: string;
  readonly label: string;
  readonly requiresApiKey: boolean;
  readonly defaultBaseUrl: string | null;
  readonly defaultModels: string[];
  generateText(request: AITextRequest, config: AdapterConfig): Promise<Omit<AITextResult, "provider" | "latencyMs">>;
}

export class AIUnavailableError extends Error {
  readonly reason: "disabled" | "no_provider" | "limit_reached" | "provider_error";
  constructor(reason: AIUnavailableError["reason"], message?: string) {
    super(message ?? aiUnavailableMessage(reason));
    this.name = "AIUnavailableError";
    this.reason = reason;
  }
}

export function aiUnavailableMessage(reason: AIUnavailableError["reason"]): string {
  switch (reason) {
    case "disabled":
      return "AI assistance is turned off. You can continue manually.";
    case "no_provider":
      return "No AI provider is configured. You can continue manually.";
    case "limit_reached":
      return "The AI usage limit for this period has been reached. You can continue manually.";
    default:
      return "The AI provider returned an error. You can continue manually.";
  }
}
