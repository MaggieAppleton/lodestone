import type { RemirrorJSON } from "remirror";
import type { ObjectMark } from "@remirror/core-types";
import type { Highlight, LLMAnalysisResult } from "../types";

const ENTITY_MARK = "entity-reference";

type Mark = ObjectMark;

function cloneDoc(doc: RemirrorJSON): RemirrorJSON {
	return JSON.parse(JSON.stringify(doc)) as RemirrorJSON;
}

function getParagraphText(para: RemirrorJSON): string {
	if (!para.content) return "";
	return para.content
		.map((node) => (node.type === "text" ? (node.text ?? "") : ""))
		.join("");
}

/**
 * Extract all highlights from a Remirror document by walking its marks.
 * Returns a deduplicated array of Highlight objects with ProseMirror positions.
 *
 * Adjacent text nodes with the same entity-reference id are merged.
 * Non-adjacent occurrences of the same id are deduped (first wins).
 */
export function extractHighlights(doc: RemirrorJSON): Highlight[] {
	const byId = new Map<string, Highlight>();
	let pos = 0;

	function walk(node: RemirrorJSON): void {
		if (node.type === "text") {
			const text = node.text ?? "";
			const len = text.length;
			const start = pos;
			const end = pos + len;
			const marks = (node.marks ?? []) as Mark[];

			for (const mark of marks) {
				if (mark.type !== ENTITY_MARK || !mark.attrs) continue;
				const attrs = mark.attrs;
				const rawId = attrs.id;
				if (rawId === undefined || rawId === null) continue;
				const id = String(rawId);
				const labelType = String(
					attrs.labelType ?? attrs.type ?? "",
				);
				const confidence =
					typeof attrs.confidence === "number"
						? attrs.confidence
						: undefined;

				const existing = byId.get(id);
				if (existing) {
					// Merge adjacent splits (ProseMirror may split text nodes
					// at mark boundaries when other marks change).
					if (existing.to === start) {
						existing.to = end;
						existing.text = existing.text + text;
					}
					// Non-adjacent duplicates: keep first (dedupe).
				} else {
					byId.set(id, {
						id,
						labelType,
						text,
						from: start,
						to: end,
						...(confidence !== undefined ? { confidence } : {}),
					});
				}
			}

			pos = end;
			return;
		}

		const isBlock = node.type !== "doc";
		if (isBlock) pos += 1;
		if (node.content) {
			for (const child of node.content) walk(child);
		}
		if (isBlock) pos += 1;
	}

	walk(doc);
	return Array.from(byId.values());
}

interface ParagraphMatch {
	offset: number;
	length: number;
	id: string;
	labelType: string;
}

function applyMatchesToParagraph(
	para: RemirrorJSON,
	matches: ParagraphMatch[],
): RemirrorJSON {
	const text = getParagraphText(para);
	if (matches.length === 0 || text.length === 0) return para;

	const sorted = [...matches].sort((a, b) => a.offset - b.offset);

	// Collect all breakpoints and build segments between them.
	const breaks = new Set<number>([0, text.length]);
	for (const m of sorted) {
		breaks.add(m.offset);
		breaks.add(m.offset + m.length);
	}
	const sortedBreaks = Array.from(breaks).sort((a, b) => a - b);

	const segments: RemirrorJSON[] = [];
	for (let i = 0; i < sortedBreaks.length - 1; i++) {
		const start = sortedBreaks[i];
		const end = sortedBreaks[i + 1];
		if (start === end) continue;

		const covering = sorted.filter(
			(m) => m.offset <= start && m.offset + m.length >= end,
		);

		const segment: RemirrorJSON = {
			type: "text",
			text: text.slice(start, end),
		};
		if (covering.length > 0) {
			segment.marks = covering.map((m) => ({
				type: ENTITY_MARK,
				attrs: {
					id: m.id,
					labelType: m.labelType,
					type: m.labelType,
				},
			}));
		}
		segments.push(segment);
	}

	return { ...para, content: segments };
}

/**
 * Apply LLM analysis results to a Remirror document.
 * Finds exact substring matches and adds entity-reference marks.
 *
 * Rules:
 * - First paragraph containing the text wins.
 * - Text spanning multiple paragraphs is skipped.
 * - First match within a paragraph wins when the text repeats.
 * - Returns a new RemirrorJSON (does not mutate input).
 */
export function applyHighlightsToDocument(
	doc: RemirrorJSON,
	analysisResult: LLMAnalysisResult,
): RemirrorJSON {
	const clone = cloneDoc(doc);
	if (!clone.content) return clone;

	const paragraphMatches = new Map<number, ParagraphMatch[]>();

	for (const highlight of analysisResult.highlights) {
		if (!highlight.text) continue;
		for (let i = 0; i < clone.content.length; i++) {
			const para = clone.content[i];
			if (para.type !== "paragraph") continue;
			const paraText = getParagraphText(para);
			const idx = paraText.indexOf(highlight.text);
			if (idx !== -1) {
				const list = paragraphMatches.get(i) ?? [];
				list.push({
					offset: idx,
					length: highlight.text.length,
					id: highlight.id,
					labelType: highlight.labelType,
				});
				paragraphMatches.set(i, list);
				break;
			}
		}
	}

	for (const [idx, matches] of paragraphMatches) {
		clone.content[idx] = applyMatchesToParagraph(
			clone.content[idx],
			matches,
		);
	}

	return clone;
}

/**
 * Add a single entity-reference mark to the document at the given
 * ProseMirror positions. Splits text nodes at the boundaries as needed.
 */
export function addHighlightToDocument(
	doc: RemirrorJSON,
	id: string,
	labelType: string,
	from: number,
	to: number,
): RemirrorJSON {
	if (from >= to) return cloneDoc(doc);
	const clone = cloneDoc(doc);
	let pos = 0;

	function walk(node: RemirrorJSON): RemirrorJSON[] {
		if (node.type === "text") {
			const text = node.text ?? "";
			const len = text.length;
			const nodeStart = pos;
			const nodeEnd = pos + len;
			pos = nodeEnd;

			if (to <= nodeStart || from >= nodeEnd) return [node];

			const relFrom = Math.max(from, nodeStart) - nodeStart;
			const relTo = Math.min(to, nodeEnd) - nodeStart;
			const parts: RemirrorJSON[] = [];

			if (relFrom > 0) {
				parts.push({ ...node, text: text.slice(0, relFrom) });
			}
			const middle: RemirrorJSON = {
				...node,
				text: text.slice(relFrom, relTo),
				marks: [
					...((node.marks ?? []) as Mark[]),
					{
						type: ENTITY_MARK,
						attrs: { id, labelType, type: labelType },
					},
				],
			};
			parts.push(middle);
			if (relTo < len) {
				parts.push({ ...node, text: text.slice(relTo) });
			}
			return parts;
		}

		const isBlock = node.type !== "doc";
		if (isBlock) pos += 1;
		if (node.content) {
			const newContent: RemirrorJSON[] = [];
			for (const child of node.content) {
				newContent.push(...walk(child));
			}
			node.content = newContent;
		}
		if (isBlock) pos += 1;
		return [node];
	}

	walk(clone);
	return clone;
}

/**
 * Remove every mark with the given entity-reference id from the document.
 */
export function removeHighlightFromDocument(
	doc: RemirrorJSON,
	highlightId: string,
): RemirrorJSON {
	const clone = cloneDoc(doc);

	function walk(node: RemirrorJSON): void {
		if (node.type === "text" && node.marks) {
			const marks = (node.marks as Mark[]).filter(
				(m) =>
					!(
						m.type === ENTITY_MARK &&
						m.attrs?.id !== undefined &&
						String(m.attrs.id) === highlightId
					),
			);
			if (marks.length === 0) {
				delete node.marks;
			} else {
				node.marks = marks;
			}
		}
		if (node.content) {
			for (const child of node.content) walk(child);
		}
	}

	walk(clone);
	return clone;
}
