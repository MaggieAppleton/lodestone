import type { RemirrorJSON } from "remirror";
import type { LLMAnalysisResult } from "../types";
import type { PromptTemplate } from "../evals/prompts";
import { analyseText, getApiKey, type ModelId } from "./llm";
import { validateHighlights } from "./classifier";
import { applyHighlightsToDocument } from "../utils/highlights";
import { extractText } from "../utils/text";
import * as sessions from "../db/sessions";

export interface RunAnalysisArgs {
	sessionId: number;
	content: RemirrorJSON;
	model: ModelId;
	promptTemplate: PromptTemplate;
}

export interface RunAnalysisResult {
	content: RemirrorJSON;
	validatedWithClassifier: boolean;
}

/**
 * Full analysis pipeline: LLM -> (optional) classifier validation ->
 * apply highlight marks to the document -> persist.
 *
 * If the HuggingFace API key is missing or validation throws, we log and
 * fall back to the raw LLM output. The text pipeline is worth shipping
 * even without a validator.
 */
export async function runAnalysis({
	sessionId,
	content,
	model,
	promptTemplate,
}: RunAnalysisArgs): Promise<RunAnalysisResult> {
	const text = extractText(content);
	const prompt = promptTemplate.template.replace("{{text}}", text);

	const llmApiKey = getApiKey(model);
	if (!llmApiKey) {
		throw new Error(`Missing API key for model ${model}`);
	}

	const llmResult = await analyseText(text, prompt, {
		model,
		apiKey: llmApiKey,
	});

	const hfKey = import.meta.env.VITE_HUGGINGFACE_API_KEY;
	let finalResult: LLMAnalysisResult = llmResult;
	let validatedWithClassifier = false;

	if (hfKey && llmResult.highlights.length > 0) {
		try {
			const validated = await validateHighlights(llmResult, hfKey);
			// applyHighlightsToDocument wants an LLMAnalysisResult-shaped input.
			// Map the validated highlights back (they may have new labelTypes).
			finalResult = {
				highlights: validated.highlights.map((h) => ({
					id: h.id,
					labelType: h.labelType,
					text: h.text,
				})),
				relationships: validated.relationships,
			};
			validatedWithClassifier = true;
		} catch (error) {
			console.error(
				"Classifier validation failed, falling back to raw LLM output:",
				error,
			);
		}
	}

	const annotatedContent = applyHighlightsToDocument(content, finalResult);

	await sessions.saveAnalysis(sessionId, annotatedContent, finalResult.relationships, {
		modelName: model,
		promptId: promptTemplate.id,
	});

	return {
		content: annotatedContent,
		validatedWithClassifier,
	};
}
