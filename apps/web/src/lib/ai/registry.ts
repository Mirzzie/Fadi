import "server-only";

import { serverEnv } from "@/lib/env.server";

import { AnthropicProvider } from "./providers/anthropic";
import { OpenAIProvider } from "./providers/openai";
import type { AIProvider, ProviderCapability, ProviderConfig } from "./providers/types";

// ─── Registry ─────────────────────────────────────────────────────────────────

class ProviderRegistry {
  private providers = new Map<string, AIProvider>();
  private defaultId: string | null = null;

  register(provider: AIProvider, isDefault = false): this {
    this.providers.set(provider.id, provider);
    if (isDefault || this.defaultId === null) {
      this.defaultId = provider.id;
    }
    return this;
  }

  get(id: string): AIProvider | null {
    return this.providers.get(id) ?? null;
  }

  getDefault(): AIProvider {
    const provider = this.defaultId ? this.providers.get(this.defaultId) : null;
    if (!provider) throw new Error("No AI providers are registered.");
    return provider;
  }

  getForCapability(capability: ProviderCapability): AIProvider[] {
    return Array.from(this.providers.values()).filter(
      (p) => p.isConfigured && p.capabilities.includes(capability),
    );
  }

  getConfigured(): AIProvider[] {
    return Array.from(this.providers.values()).filter((p) => p.isConfigured);
  }

  list(): { id: string; name: string; model: string; isConfigured: boolean; capabilities: ProviderCapability[] }[] {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      model: p.model,
      isConfigured: p.isConfigured,
      capabilities: p.capabilities,
    }));
  }
}

// ─── Singleton registry built from server env ─────────────────────────────────

let _registry: ProviderRegistry | null = null;

export function getProviderRegistry(): ProviderRegistry {
  if (_registry) return _registry;

  _registry = new ProviderRegistry();

  const defaultProvider = serverEnv.AI_PROVIDER ?? "openai";

  // OpenAI
  _registry.register(
    new OpenAIProvider(serverEnv.OPENAI_API_KEY, serverEnv.OPENAI_MODEL),
    defaultProvider === "openai",
  );

  // Anthropic
  _registry.register(
    new AnthropicProvider(serverEnv.ANTHROPIC_API_KEY, serverEnv.ANTHROPIC_MODEL),
    defaultProvider === "anthropic",
  );

  return _registry;
}

/**
 * Create a one-off provider from a user-supplied config (BYOK).
 * Used when the user has configured their own API key in settings.
 */
export function createUserProvider(config: ProviderConfig): AIProvider | null {
  const model = config.model;
  switch (config.id) {
    case "openai":
      return new OpenAIProvider(config.apiKey, model ?? "gpt-4.1-mini");
    case "anthropic":
      return new AnthropicProvider(config.apiKey, model ?? "claude-sonnet-4-6");
    case "groq":
      return new OpenAIProvider(config.apiKey, model ?? "llama-3.3-70b-versatile", {
        id: "groq",
        name: "Groq",
        baseURL: "https://api.groq.com/openai/v1",
      });
    case "google":
      return new OpenAIProvider(config.apiKey, model ?? "gemini-2.0-flash", {
        id: "google",
        name: "Google",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      });
    case "ollama":
      return new OpenAIProvider(config.apiKey, model ?? "llama3.2", {
        id: "ollama",
        name: "Ollama",
        baseURL: config.baseURL || "http://localhost:11434/v1",
        keyless: true,
      });
    default:
      return null;
  }
}

/**
 * Resolve the best provider for a user — prefers their personal key if configured.
 * Falls back to server-configured default.
 */
export function resolveProviderForUser(userConfig?: ProviderConfig | null): AIProvider {
  if (userConfig) {
    const userProvider = createUserProvider(userConfig);
    if (userProvider?.isConfigured) return userProvider;
  }
  return getProviderRegistry().getDefault();
}

// ─── Convenience ──────────────────────────────────────────────────────────────

export function getAIProvider(id?: string): AIProvider {
  const registry = getProviderRegistry();
  if (id) return registry.get(id) ?? registry.getDefault();
  return registry.getDefault();
}

export function resetRegistry(): void {
  _registry = null;
}
