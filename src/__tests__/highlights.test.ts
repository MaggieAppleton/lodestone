import { describe, it, expect } from "vitest";
import type { RemirrorJSON } from "remirror";
import {
	extractHighlights,
	applyHighlightsToDocument,
	addHighlightToDocument,
	removeHighlightFromDocument,
} from "../utils/highlights";
import type { LLMAnalysisResult } from "../types";

function makeDoc(paragraphs: RemirrorJSON[]): RemirrorJSON {
	return { type: "doc", content: paragraphs };
}

function plainParagraph(text: string): RemirrorJSON {
	return {
		type: "paragraph",
		content: [{ type: "text", text }],
	};
}

function markedText(
	text: string,
	id: string,
	labelType: string,
): RemirrorJSON {
	return {
		type: "text",
		text,
		marks: [
			{
				type: "entity-reference",
				attrs: { id, labelType, type: labelType },
			},
		],
	};
}

describe("extractHighlights", () => {
	it("returns empty array for an unmarked document", () => {
		const doc = makeDoc([plainParagraph("Hello world")]);
		expect(extractHighlights(doc)).toEqual([]);
	});

	it("returns correct highlights for a doc with a single mark", () => {
		const doc = makeDoc([
			{
				type: "paragraph",
				content: [
					{ type: "text", text: "Hello " },
					markedText("world", "h1", "claim"),
				],
			},
		]);
		const highlights = extractHighlights(doc);
		expect(highlights).toHaveLength(1);
		expect(highlights[0]).toMatchObject({
			id: "h1",
			labelType: "claim",
			text: "world",
		});
		// "Hello " is 6 chars; paragraph opens at 0, text starts at 1
		// So "world" is at positions 7..12
		expect(highlights[0].from).toBe(7);
		expect(highlights[0].to).toBe(12);
	});

	it("handles overlapping marks on the same text (two labels)", () => {
		const doc = makeDoc([
			{
				type: "paragraph",
				content: [
					{
						type: "text",
						text: "overlap",
						marks: [
							{
								type: "entity-reference",
								attrs: {
									id: "a",
									labelType: "claim",
									type: "claim",
								},
							},
							{
								type: "entity-reference",
								attrs: {
									id: "b",
									labelType: "evidence",
									type: "evidence",
								},
							},
						],
					},
				],
			},
		]);
		const highlights = extractHighlights(doc);
		expect(highlights).toHaveLength(2);
		const ids = highlights.map((h) => h.id).sort();
		expect(ids).toEqual(["a", "b"]);
		// Both should cover the same positions
		expect(highlights[0].from).toBe(highlights[1].from);
		expect(highlights[0].to).toBe(highlights[1].to);
	});

	it("merges adjacent text nodes that share the same mark id", () => {
		// ProseMirror may split text nodes at mark boundaries; extraction
		// must merge them back.
		const doc = makeDoc([
			{
				type: "paragraph",
				content: [
					{
						type: "text",
						text: "hel",
						marks: [
							{
								type: "entity-reference",
								attrs: {
									id: "same",
									labelType: "claim",
									type: "claim",
								},
							},
						],
					},
					{
						type: "text",
						text: "lo",
						marks: [
							{
								type: "entity-reference",
								attrs: {
									id: "same",
									labelType: "claim",
									type: "claim",
								},
							},
							{
								type: "entity-reference",
								attrs: {
									id: "other",
									labelType: "evidence",
									type: "evidence",
								},
							},
						],
					},
				],
			},
		]);
		const highlights = extractHighlights(doc);
		const same = highlights.find((h) => h.id === "same");
		expect(same).toBeDefined();
		expect(same!.text).toBe("hello");
		expect(same!.from).toBe(1);
		expect(same!.to).toBe(6);
	});
});

describe("applyHighlightsToDocument", () => {
	it("adds marks at correct positions for exact substring match", () => {
		const doc = makeDoc([plainParagraph("The sky is blue.")]);
		const result: LLMAnalysisResult = {
			highlights: [{ id: "h1", labelType: "claim", text: "sky is blue" }],
			relationships: [],
		};
		const annotated = applyHighlightsToDocument(doc, result);
		const highlights = extractHighlights(annotated);
		expect(highlights).toHaveLength(1);
		expect(highlights[0]).toMatchObject({
			id: "h1",
			labelType: "claim",
			text: "sky is blue",
		});
	});

	it("uses the first match when the highlight text appears multiple times", () => {
		const doc = makeDoc([plainParagraph("foo bar foo baz")]);
		const result: LLMAnalysisResult = {
			highlights: [{ id: "h1", labelType: "claim", text: "foo" }],
			relationships: [],
		};
		const annotated = applyHighlightsToDocument(doc, result);
		const highlights = extractHighlights(annotated);
		expect(highlights).toHaveLength(1);
		// The first "foo" is at offset 0 in the paragraph → position 1
		expect(highlights[0].from).toBe(1);
		expect(highlights[0].to).toBe(4);
		expect(highlights[0].text).toBe("foo");
	});

	it("skips highlights whose text isn't found in the document", () => {
		const doc = makeDoc([plainParagraph("Hello world")]);
		const result: LLMAnalysisResult = {
			highlights: [
				{ id: "h1", labelType: "claim", text: "not present" },
				{ id: "h2", labelType: "evidence", text: "Hello" },
			],
			relationships: [],
		};
		const annotated = applyHighlightsToDocument(doc, result);
		const highlights = extractHighlights(annotated);
		expect(highlights).toHaveLength(1);
		expect(highlights[0].id).toBe("h2");
	});
});

describe("removeHighlightFromDocument", () => {
	it("removes only the targeted mark and preserves others", () => {
		const doc = makeDoc([
			{
				type: "paragraph",
				content: [
					markedText("keep", "a", "claim"),
					{ type: "text", text: " " },
					markedText("remove", "b", "evidence"),
				],
			},
		]);
		const stripped = removeHighlightFromDocument(doc, "b");
		const highlights = extractHighlights(stripped);
		expect(highlights).toHaveLength(1);
		expect(highlights[0].id).toBe("a");
	});
});

describe("round-trip: extract ∘ apply", () => {
	it("produces highlights matching the analysis result (id, labelType, text)", () => {
		const doc = makeDoc([
			plainParagraph(
				"Climate change is real. Sea levels are rising fast.",
			),
		]);
		const result: LLMAnalysisResult = {
			highlights: [
				{ id: "h1", labelType: "claim", text: "Climate change is real" },
				{
					id: "h2",
					labelType: "evidence",
					text: "Sea levels are rising fast",
				},
			],
			relationships: [],
		};
		const annotated = applyHighlightsToDocument(doc, result);
		const extracted = extractHighlights(annotated);

		expect(extracted).toHaveLength(2);
		for (const expected of result.highlights) {
			const found = extracted.find((h) => h.id === expected.id);
			expect(found).toBeDefined();
			expect(found!.labelType).toBe(expected.labelType);
			expect(found!.text).toBe(expected.text);
		}
	});
});

describe("addHighlightToDocument", () => {
	it("adds a mark at the given positions that extracts back correctly", () => {
		const doc = makeDoc([plainParagraph("Hello world")]);
		// "world" is at positions 7..12 (paragraph opens at 0, content at 1)
		const annotated = addHighlightToDocument(doc, "x", "claim", 7, 12);
		const highlights = extractHighlights(annotated);
		expect(highlights).toHaveLength(1);
		expect(highlights[0]).toMatchObject({
			id: "x",
			labelType: "claim",
			text: "world",
		});
	});
});
