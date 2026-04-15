import { generateQuestions as llmGenerateQuestions } from "./llm";

export interface QuestionGenerationConfig {
	minCharsBeforeGeneration: number;
	minTimeBetweenCalls: number;
	debounceMs: number;
}

export const DEFAULT_CONFIG: QuestionGenerationConfig = {
	minCharsBeforeGeneration: 100,
	minTimeBetweenCalls: 30_000,
	debounceMs: 2_000,
};

export const DEFAULT_QUESTIONS: string[] = [
	"What is the main claim or argument you're trying to make?",
	"What evidence do you have to support your main points?",
	"What assumptions are you making that might need to be examined?",
];

function buildPrompt(params: {
	text: string;
	topic: string;
	previousQuestions: string[];
}): string {
	const recent = params.previousQuestions.slice(-6);
	const recentBlock =
		recent.length > 0
			? `\n\nAvoid repeating or closely paraphrasing these previous questions:\n${recent
					.map((q) => `- ${q}`)
					.join("\n")}`
			: "";

	return `You are a thoughtful writing assistant helping a writer develop their ideas on the topic: "${params.topic}".

Read the writer's current draft below and generate 3 open-ended, probing questions that will help them clarify their thinking, surface hidden assumptions, or strengthen their argument. The questions should be specific to what they've actually written — not generic writing prompts.

Draft:
"""
${params.text}
"""${recentBlock}

Respond with a JSON object of the form: { "questions": ["...", "...", "..."] }. No prose, no code fences.`;
}

/**
 * Generate fresh questions for the current draft text. Pure function — no
 * database access, no rate-limiting. The caller (DynamicQuestionsPanel) owns
 * all timing/state decisions.
 */
export async function generateQuestions(params: {
	text: string;
	topic: string;
	previousQuestions: string[];
	apiKey: string;
}): Promise<string[]> {
	const prompt = buildPrompt(params);
	return llmGenerateQuestions(params.text, prompt, {
		model: "gpt-4o-mini",
		apiKey: params.apiKey,
	});
}
