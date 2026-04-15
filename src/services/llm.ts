import type { LLMAnalysisResult } from "../types";

export type ModelId = "gpt-4o" | "gpt-4o-mini" | "claude-sonnet-4-20250514";

export interface LLMConfig {
	model: ModelId;
	apiKey: string;
}

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

function isAnthropicModel(model: ModelId): boolean {
	return model.startsWith("claude-");
}

interface OpenAIChatResponse {
	choices?: Array<{ message?: { content?: string } }>;
}

interface AnthropicMessageResponse {
	content?: Array<{ type?: string; text?: string }>;
}

async function callOpenAI(
	prompt: string,
	config: LLMConfig,
): Promise<string> {
	const response = await fetch(OPENAI_ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${config.apiKey}`,
		},
		body: JSON.stringify({
			model: config.model,
			messages: [{ role: "user", content: prompt }],
			response_format: { type: "json_object" },
		}),
	});
	if (!response.ok) {
		const body = await response.text();
		throw new Error(
			`OpenAI request failed: ${response.status} ${response.statusText} — ${body}`,
		);
	}
	const data = (await response.json()) as OpenAIChatResponse;
	const content = data.choices?.[0]?.message?.content;
	if (!content) {
		throw new Error("OpenAI response missing message content");
	}
	return content;
}

async function callAnthropic(
	prompt: string,
	config: LLMConfig,
): Promise<string> {
	const response = await fetch(ANTHROPIC_ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": config.apiKey,
			"anthropic-version": ANTHROPIC_API_VERSION,
			"anthropic-dangerous-direct-browser-access": "true",
		},
		body: JSON.stringify({
			model: config.model,
			max_tokens: 4096,
			messages: [{ role: "user", content: prompt }],
		}),
	});
	if (!response.ok) {
		const body = await response.text();
		throw new Error(
			`Anthropic request failed: ${response.status} ${response.statusText} — ${body}`,
		);
	}
	const data = (await response.json()) as AnthropicMessageResponse;
	const text = data.content?.find((c) => c.type === "text")?.text;
	if (!text) {
		throw new Error("Anthropic response missing text content");
	}
	return text;
}

/**
 * Extract the first JSON object/array from a string. Anthropic sometimes wraps
 * JSON in prose or fenced code blocks even when asked not to.
 */
function extractJSON(raw: string): string {
	const trimmed = raw.trim();
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fenced) return fenced[1].trim();
	const firstBrace = trimmed.indexOf("{");
	const lastBrace = trimmed.lastIndexOf("}");
	if (firstBrace !== -1 && lastBrace > firstBrace) {
		return trimmed.slice(firstBrace, lastBrace + 1);
	}
	return trimmed;
}

export async function analyseText(
	text: string,
	prompt: string,
	config: LLMConfig,
): Promise<LLMAnalysisResult> {
	// Fully wired in Phase 4. The module exists now so Phase 3 can import
	// sibling exports without circular stubs.
	void text;
	void prompt;
	void config;
	throw new Error("analyseText not implemented (Phase 4)");
}

export async function generateQuestions(
	_text: string,
	prompt: string,
	config: LLMConfig,
): Promise<string[]> {
	const raw = isAnthropicModel(config.model)
		? await callAnthropic(prompt, config)
		: await callOpenAI(prompt, config);

	const json = extractJSON(raw);
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch (error) {
		throw new Error(
			`generateQuestions: failed to parse JSON response: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}

	// Accept either { questions: string[] } or a bare string[].
	const questions =
		Array.isArray(parsed) && parsed.every((q) => typeof q === "string")
			? (parsed as string[])
			: isQuestionsObject(parsed)
				? parsed.questions
				: null;

	if (!questions) {
		throw new Error(
			"generateQuestions: response did not contain a questions array",
		);
	}
	return questions.filter((q) => q.trim().length > 0);
}

function isQuestionsObject(value: unknown): value is { questions: string[] } {
	if (!value || typeof value !== "object") return false;
	const questions = (value as { questions?: unknown }).questions;
	return (
		Array.isArray(questions) && questions.every((q) => typeof q === "string")
	);
}

export function getApiKey(model: ModelId): string | undefined {
	if (isAnthropicModel(model)) {
		return import.meta.env.VITE_ANTHROPIC_API_KEY;
	}
	return import.meta.env.VITE_OPENAI_API_KEY;
}

export function getAvailableModels(): ModelId[] {
	const available: ModelId[] = [];
	if (import.meta.env.VITE_OPENAI_API_KEY) {
		available.push("gpt-4o", "gpt-4o-mini");
	}
	if (import.meta.env.VITE_ANTHROPIC_API_KEY) {
		available.push("claude-sonnet-4-20250514");
	}
	return available;
}
