import { zeroShotClassification } from "@huggingface/inference";
import { LABEL_CONFIGS } from "../types/labels";
import type { LLMAnalysisResult, ValidatedAnalysisResult } from "../types";

export const CLASSIFIER_MODEL = "facebook/bart-large-mnli";
export const CONFIDENCE_THRESHOLD = 0.5;

export interface ClassifySpanResult {
	topLabelId: string;
	topScore: number;
	scores: Record<string, number>;
}

/**
 * Classify a piece of text against the full LABEL_CONFIGS set.
 * Uses each label's human-readable *description* as the candidate text
 * (richer than the short id) then maps the classifier's winning description
 * back to our label id.
 */
export async function classifySpan(
	text: string,
	apiKey: string,
): Promise<ClassifySpanResult> {
	const descriptions = LABEL_CONFIGS.map((l) => l.description);
	const descriptionToId = new Map(
		LABEL_CONFIGS.map((l) => [l.description, l.id]),
	);

	const output = await zeroShotClassification({
		model: CLASSIFIER_MODEL,
		accessToken: apiKey,
		inputs: text,
		parameters: { candidate_labels: descriptions },
	});

	// HF returns a parallel array of { label, score } sorted descending.
	const scores: Record<string, number> = {};
	let topLabelId = LABEL_CONFIGS[0].id;
	let topScore = -Infinity;

	for (const item of output) {
		const id = descriptionToId.get(item.label);
		if (!id) continue;
		scores[id] = item.score;
		if (item.score > topScore) {
			topScore = item.score;
			topLabelId = id;
		}
	}

	// Ensure every label has a score, even if HF omits one (it shouldn't).
	for (const l of LABEL_CONFIGS) {
		if (!(l.id in scores)) scores[l.id] = 0;
	}

	return { topLabelId, topScore, scores };
}

/**
 * Validate every LLM-assigned highlight with the zero-shot classifier.
 * Runs all calls in parallel. Each highlight gets one of three outcomes:
 *   - Agreement: keep LLM label, record classifier confidence.
 *   - Disagreement, classifier confidence >= threshold: classifier label wins.
 *   - Disagreement, classifier confidence < threshold: keep LLM label.
 *
 * Throws if the underlying API call rejects — callers (runAnalysis) decide
 * whether to fall back to the raw LLM result.
 */
export async function validateHighlights(
	llmResult: LLMAnalysisResult,
	apiKey: string,
): Promise<ValidatedAnalysisResult> {
	const classifications = await Promise.all(
		llmResult.highlights.map((h) => classifySpan(h.text, apiKey)),
	);

	const validatedHighlights = llmResult.highlights.map((h, i) => {
		const c = classifications[i];
		const agrees = c.topLabelId === h.labelType;
		const classifierWins = !agrees && c.topScore >= CONFIDENCE_THRESHOLD;

		const finalLabel = classifierWins ? c.topLabelId : h.labelType;
		// Confidence reflects the classifier's belief in the *chosen* label.
		const finalConfidence = c.scores[finalLabel] ?? c.topScore;

		return {
			id: h.id,
			labelType: finalLabel,
			text: h.text,
			confidence: finalConfidence,
		};
	});

	return {
		highlights: validatedHighlights,
		relationships: llmResult.relationships,
	};
}

