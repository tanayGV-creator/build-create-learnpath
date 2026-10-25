// Provider-agnostic AI interface. Keys are read server-side only (never import this in client code).

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
}

export interface CompletionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  provider: string; // "anthropic" | "mock"
  model: string;
  simulated: boolean; // true => NOT a real model response
}

export interface AIProvider {
  readonly name: string;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private apiKey: string;
  private model: string;
  private fetchImpl: typeof fetch;

  constructor(apiKey: string, model: string, fetchImpl: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.model = model;
    this.fetchImpl = fetchImpl;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const res = await this.fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: req.messages,
      }),
    });
    if (!res.ok) {
      // Do not echo the response body: it could contain request details.
      throw new Error(`AI provider error: HTTP ${res.status}`);
    }
    const data: any = await res.json();
    const text = Array.isArray(data.content)
      ? data.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n")
      : "";
    return {
      text,
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      provider: "anthropic",
      model: this.model,
      simulated: false,
    };
  }
}

/** Development stand-in. Always labelled; never presented as a real AI answer. */
export class MockProvider implements AIProvider {
  readonly name = "mock";
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const last = req.messages[req.messages.length - 1]?.content ?? "";
    const ctx = req.system.match(/\[S1\][^\n]*\n([^\n]+)/);
    const hint = ctx
      ? `From your notes: "${ctx[1].slice(0, 220)}${ctx[1].length > 220 ? "…" : ""}"\n\nTry this: what is the question asking for, and which fact from the note could you use first?`
      : "I don't have an approved note for that yet. What have you tried so far?";
    const text = `[MOCK TUTOR — no AI key configured, this is not a real AI response]\n\nYou asked: "${last.slice(0, 120)}"\n\n${hint}`;
    return { text, inputTokens: 0, outputTokens: 0, provider: "mock", model: "mock", simulated: true };
  }
}

export function getProvider(env: Record<string, string | undefined> = process.env): AIProvider {
  const key = env.ANTHROPIC_API_KEY?.trim();
  if (key) return new AnthropicProvider(key, env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5");
  return new MockProvider();
}
