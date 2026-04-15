import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LLMAnalysisResult } from "../types";
import { LABEL_CONFIGS } from "../types/labels";

// Mock the HF SDK before importing the module under test.
vi.mock("@huggingface/inference", () => ({
	zeroShotClassification: vi.fn(),
}));

import { zeroShotClassification } from "@huggingface/inference";
import { validateHighlights } from "../services/classifier";

const mockedZSC = zeroShotClassification as unknown as ReturnType<
	typeof vi.fn
>;

const DESC = Object.fromEntries(
	LABEL_CONFIGS.map((l) => [l.id, l.description]),
);

/**
 * Build a classifier response where `winnerId` gets `winnerScore` and
 * the remaining probability mass is split evenly across the other labels.
 */
function mockClassifier(winnerId: string, winnerScore: number) {
	const others = LABEL_CONFIGS.filter((l) => l.id !== winnerId);
	const rest = (1 - winnerScore) / others.length;
	const items = [
		{ label: DESC[winnerId], score: winnerScore },
		...others.map((l) => ({ label: l.description, score: rest })),
	];
	// HF returns sorted descending — sort for realism.
	return items.sort((a, b) => b.score - a.score);
}

function llmResult(highlights: LLMAnalysisResult["highlights"]): LLMAnalysisResult {
	return { highlights, relationships: [] };
}

describe("validateHighlights", () => {
	beforeEach(() => {
		mockedZSC.mockReset();
	});

	it("keeps the LLM label when the classifier agrees, and records the classifier's confidence", async () => {
		mockedZSC.mockResolvedValueOnce(mockClassifier("claim", 0.92));

		const result = await validateHighlights(
			llmResult([{ id: "h1", labelType: "claim", text: "AI will change work" }]),
			"key",
		);

		expect(result.highlights).toHaveLength(1);
		expect(result.highlights[0].labelType).toBe("claim");
		expect(result.highlights[0].confidence).toBeCloseTo(0.92, 5);
	});

	it("uses the classifier's label when it disagrees with high confidence", async () => {
		mockedZSC.mockResolvedValueOnce(mockClassifier("evidence", 0.81));

		const result = await validateHighlights(
			llmResult([
				{ id: "h1", labelType: "claim", text: "Arctic ice has decreased by 13%" },
			]),
			"key",
		);

		expect(result.highlights[0].labelType).toBe("evidence");
		expect(result.highlights[0].confidence).toBeCloseTo(0.81, 5);
	});

	it("keeps the LLM label when the classifier disagrees with low confidence", async () => {
		// Classifier's top is "evidence" at 0.3 — below threshold (0.5).
		mockedZSC.mockResolvedValueOnce(mockClassifier("evidence", 0.3));

		const result = await validateHighlights(
			llmResult([{ id: "h1", labelType: "claim", text: "A soft prediction" }]),
			"key",
		);

		expect(result.highlights[0].labelType).toBe("claim");
		// Confidence is the classifier's score *for the chosen (LLM) label*.
		// With winnerScore=0.3 and 6 others, each other gets 0.7/6 ≈ 0.1167.
		expect(result.highlights[0].confidence).toBeLessThan(0.5);
	});

	it("propagates errors when the HuggingFace API throws", async () => {
		mockedZSC.mockRejectedValueOnce(new Error("HF rate limit"));

		await expect(
			validateHighlights(
				llmResult([{ id: "h1", labelType: "claim", text: "foo" }]),
				"key",
			),
		).rejects.toThrow("HF rate limit");
	});

	it("classifies multiple highlights in parallel", async () => {
		// Use deferred promises: every call gets a pending promise we control.
		// Assert that all calls started before any resolves.
		const resolvers: Array<(v: unknown) => void> = [];
		mockedZSC.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolvers.push(resolve);
				}),
		);

		const promise = validateHighlights(
			llmResult([
				{ id: "h1", labelType: "claim", text: "one" },
				{ id: "h2", labelType: "evidence", text: "two" },
				{ id: "h3", labelType: "question", text: "three" },
			]),
			"key",
		);

		// Let the three classifySpan calls fire.
		await Promise.resolve();
		await Promise.resolve();

		expect(mockedZSC).toHaveBeenCalledTimes(3);
		expect(resolvers).toHaveLength(3);

		// Now resolve all three.
		resolvers[0](mockClassifier("claim", 0.9));
		resolvers[1](mockClassifier("evidence", 0.9));
		resolvers[2](mockClassifier("question", 0.9));

		const result = await promise;
		expect(result.highlights.map((h) => h.labelType)).toEqual([
			"claim",
			"evidence",
			"question",
		]);
	});
});
