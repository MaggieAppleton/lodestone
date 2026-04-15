import type { RemirrorJSON } from "remirror";

/**
 * Recursively extract plain text from a Remirror document.
 * Paragraphs are joined with newlines.
 */
export function extractText(doc: RemirrorJSON): string {
	if (!doc) return "";

	if (doc.type === "text" && typeof doc.text === "string") {
		return doc.text;
	}

	if (!doc.content || doc.content.length === 0) {
		return "";
	}

	if (doc.type === "paragraph") {
		return doc.content.map(extractText).join("");
	}

	// For root doc and other block-level nodes, join children with newlines.
	return doc.content.map(extractText).join("\n");
}
