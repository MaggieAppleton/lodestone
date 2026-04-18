import { useMemo } from "react";
import { useEditorContext } from "../contexts/EditorContext";
import { LABEL_CONFIGS } from "../types/labels";

/**
 * Sidebar of label buttons. With a non-empty selection, clicking a label
 * wraps the selection in an entity-reference mark. Shows a "remove"
 * button when the caret sits inside an existing highlight.
 */
export function HighlightToolbar() {
	const { editor, highlights, addHighlightAtSelection, removeHighlight } =
		useEditorContext();
	const state = editor.getState();

	const hasSelection = !state.selection.empty;

	// Find the highlight (if any) overlapping the current caret / selection.
	const highlightAtCursor = useMemo(() => {
		const { from, to } = state.selection;
		return highlights.find((h) => h.from < to && h.to > from);
	}, [highlights, state.selection]);

	const addHighlight = (labelType: string) => {
		addHighlightAtSelection(labelType);
	};

	const removeCurrent = () => {
		if (!highlightAtCursor) return;
		removeHighlight(highlightAtCursor.id);
	};

	return (
		<aside className="flex flex-col gap-4 rounded-md border border-neutral-200 bg-white p-4">
			<div>
				<h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
					Labels
				</h2>
				<div className="flex flex-col gap-2">
					{LABEL_CONFIGS.map((label) => (
						<button
							key={label.id}
							type="button"
							disabled={!hasSelection}
							onClick={() => addHighlight(label.id)}
							className="flex items-center gap-2 rounded border border-neutral-200 px-3 py-1.5 text-left text-sm text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
							title={label.description}
						>
							<span
								aria-hidden
								className="inline-block h-3 w-3 rounded-sm"
								style={{ backgroundColor: label.color }}
							/>
							{label.name}
						</button>
					))}
				</div>
				{!hasSelection && (
					<p className="mt-2 text-xs text-neutral-500">
						Select text to add a label.
					</p>
				)}
			</div>

			{highlightAtCursor && (
				<div className="border-t border-neutral-200 pt-4">
					<h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
						Selected highlight
					</h2>
					<p className="mb-2 text-xs text-neutral-600">
						{highlightAtCursor.labelType} ·{" "}
						<span className="italic">
							"{highlightAtCursor.text.slice(0, 40)}
							{highlightAtCursor.text.length > 40 ? "…" : ""}"
						</span>
					</p>
					<button
						type="button"
						onClick={removeCurrent}
						className="w-full rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 transition hover:bg-red-100"
					>
						Remove highlight
					</button>
				</div>
			)}
		</aside>
	);
}
