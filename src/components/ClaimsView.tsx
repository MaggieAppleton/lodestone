import { useMemo } from "react";
import { useEditorContext } from "../contexts/EditorContext";
import { useSession } from "../contexts/SessionContext";
import type { Highlight, Relationship } from "../types";
import { ClaimCard } from "./ClaimCard";

export function ClaimsView() {
	const {
		editor,
		highlights,
		updateHighlightText,
		removeHighlight,
	} = useEditorContext();
	const { session, saveRelationships, saveContent } = useSession();

	const relationships = session?.relationships ?? [];

	const claims = useMemo<Highlight[]>(
		() => highlights.filter((h) => h.labelType === "claim"),
		[highlights],
	);

	const highlightsById = useMemo(() => {
		const map = new Map<string, Highlight>();
		for (const h of highlights) map.set(h.id, h);
		return map;
	}, [highlights]);

	const evidenceForClaim = (claimId: string): Highlight[] => {
		return relationships
			.filter((r) => r.targetHighlightId === claimId)
			.map((r) => highlightsById.get(r.sourceHighlightId))
			.filter((h): h is Highlight => h !== undefined);
	};

	const persistDoc = () => saveContent(editor.getState().doc.toJSON());

	const handleEditText = (id: string, next: string) => {
		updateHighlightText(id, next);
		void persistDoc();
	};

	const handleDeleteClaim = (id: string) => {
		removeHighlight(id);
		const pruned: Relationship[] = relationships.filter(
			(r) => r.sourceHighlightId !== id && r.targetHighlightId !== id,
		);
		if (pruned.length !== relationships.length) {
			void saveRelationships(pruned);
		}
		void persistDoc();
	};

	const handleRemoveEvidence = (claimId: string, evidenceId: string) => {
		const pruned: Relationship[] = relationships.filter(
			(r) =>
				!(
					r.sourceHighlightId === evidenceId &&
					r.targetHighlightId === claimId
				),
		);
		if (pruned.length !== relationships.length) {
			void saveRelationships(pruned);
		}
	};

	if (claims.length === 0) {
		return (
			<section className="min-h-[60vh] rounded-md border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
				No claims yet. Label a passage as a claim in the text view to
				see it here.
			</section>
		);
	}

	return (
		<section className="grid min-h-[60vh] grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
			{claims.map((claim) => (
				<ClaimCard
					key={claim.id}
					claim={claim}
					evidence={evidenceForClaim(claim.id)}
					onEditText={handleEditText}
					onDeleteClaim={handleDeleteClaim}
					onRemoveEvidence={handleRemoveEvidence}
				/>
			))}
		</section>
	);
}
