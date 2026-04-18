import { useState } from "react";
import { LABEL_CONFIGS } from "../types/labels";
import type { Highlight } from "../types";

interface ClaimCardProps {
	claim: Highlight;
	evidence: Highlight[];
	onEditText: (id: string, newText: string) => void;
	onDeleteClaim: (id: string) => void;
	onRemoveEvidence: (claimId: string, evidenceId: string) => void;
}

function labelColor(labelType: string): string {
	return LABEL_CONFIGS.find((l) => l.id === labelType)?.color ?? "#999";
}

interface EditableTextProps {
	value: string;
	onCommit: (next: string) => void;
	className?: string;
	placeholder?: string;
}

function EditableText({ value, onCommit, className, placeholder }: EditableTextProps) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value);

	if (!editing) {
		return (
			<button
				type="button"
				onClick={() => {
					setDraft(value);
					setEditing(true);
				}}
				className={`w-full cursor-text whitespace-pre-wrap break-words text-left ${className ?? ""}`}
				title="Click to edit"
			>
				{value || (
					<span className="italic text-neutral-400">
						{placeholder ?? "Empty"}
					</span>
				)}
			</button>
		);
	}

	const commit = () => {
		setEditing(false);
		const next = draft.trim();
		if (next && next !== value) onCommit(next);
	};

	return (
		<textarea
			autoFocus
			value={draft}
			onChange={(e) => setDraft(e.target.value)}
			onBlur={commit}
			onKeyDown={(e) => {
				if (e.key === "Enter" && !e.shiftKey) {
					e.preventDefault();
					commit();
				} else if (e.key === "Escape") {
					setEditing(false);
					setDraft(value);
				}
			}}
			className={`w-full rounded border border-neutral-200 p-1 outline-none focus:border-neutral-400 ${className ?? ""}`}
			rows={Math.max(2, Math.ceil(draft.length / 60))}
		/>
	);
}

export function ClaimCard({
	claim,
	evidence,
	onEditText,
	onDeleteClaim,
	onRemoveEvidence,
}: ClaimCardProps) {
	const claimBorder = labelColor("claim");

	return (
		<article
			className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm"
			style={{ borderTopColor: claimBorder, borderTopWidth: 4 }}
		>
			<header className="mb-2 flex items-start justify-between gap-2">
				<span
					className="text-[10px] font-medium uppercase tracking-wide"
					style={{ color: claimBorder }}
				>
					Claim
				</span>
				<button
					type="button"
					onClick={() => onDeleteClaim(claim.id)}
					className="text-xs text-neutral-400 hover:text-red-600"
					aria-label="Delete claim"
				>
					Delete
				</button>
			</header>
			<EditableText
				value={claim.text}
				onCommit={(next) => onEditText(claim.id, next)}
				className="text-sm font-medium text-neutral-900"
			/>

			<div className="mt-4">
				<h4 className="mb-2 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
					Evidence ({evidence.length})
				</h4>
				{evidence.length === 0 ? (
					<p className="text-xs italic text-neutral-400">
						No supporting evidence linked yet. Connect nodes in the graph view.
					</p>
				) : (
					<ul className="flex flex-col gap-2">
						{evidence.map((e) => (
							<li
								key={e.id}
								className="rounded border border-neutral-200 bg-neutral-50 p-2"
								style={{ borderLeftColor: labelColor(e.labelType), borderLeftWidth: 3 }}
							>
								<div className="mb-1 flex items-center justify-between gap-2">
									<span
										className="text-[9px] font-medium uppercase tracking-wide"
										style={{ color: labelColor(e.labelType) }}
									>
										{e.labelType}
									</span>
									<button
										type="button"
										onClick={() => onRemoveEvidence(claim.id, e.id)}
										className="text-[10px] text-neutral-400 hover:text-red-600"
										aria-label="Unlink evidence"
									>
										Unlink
									</button>
								</div>
								<EditableText
									value={e.text}
									onCommit={(next) => onEditText(e.id, next)}
									className="text-xs text-neutral-800"
								/>
							</li>
						))}
					</ul>
				)}
			</div>
		</article>
	);
}
