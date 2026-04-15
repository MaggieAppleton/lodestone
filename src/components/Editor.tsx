import { useCallback, useRef } from "react";
import type { RemirrorJSON } from "remirror";
import { Remirror, useRemirror, EditorComponent } from "@remirror/react";
import {
	EntityReferenceExtension,
	PlaceholderExtension,
	EventsExtension,
	findMinMaxRange,
	type EntityReferenceMetaData,
} from "remirror/extensions";
import { Decoration } from "@remirror/pm/view";
import type { EditorState } from "@remirror/pm/state";
import { getHighlightStyle } from "../utils/decorateHighlights";
import { LABEL_CONFIGS } from "../types/labels";

interface EditorProps {
	initialContent: RemirrorJSON;
	placeholder?: string;
	editable?: boolean;
	onBlur?: (content: RemirrorJSON) => void;
}

function getStyle(references: EntityReferenceMetaData[][]): Decoration[] {
	return references
		.map((group) => {
			if (group.length === 0) return null;
			const labelTypes = group
				.map((ref) => {
					const attrs = ref.attrs as
						| { labelType?: unknown; type?: unknown }
						| undefined;
					const raw = attrs?.labelType ?? attrs?.type;
					return raw === undefined || raw === null
						? ""
						: String(raw);
				})
				.filter((t) => t.length > 0);
			const color = getHighlightStyle(labelTypes, LABEL_CONFIGS);
			const [from, to] = findMinMaxRange(group);
			return Decoration.inline(from, to, {
				style: `background-color: ${color};`,
			});
		})
		.filter((d): d is Decoration => d !== null);
}

export function Editor({
	initialContent,
	placeholder,
	editable = true,
	onBlur,
}: EditorProps) {
	const { manager, state, setState } = useRemirror({
		extensions: () => [
			new EntityReferenceExtension({
				getStyle,
				extraAttributes: {
					labelType: { default: null },
					type: { default: null },
					confidence: { default: null },
				},
			}),
			new PlaceholderExtension({ placeholder: placeholder ?? "" }),
			new EventsExtension({}),
		],
		content: initialContent,
	});

	// Keep a ref to the most recent state so the blur handler
	// reads the current document, not the one captured at mount.
	const stateRef = useRef<EditorState>(state);
	stateRef.current = state;

	const handleChange = useCallback(
		(parameter: { state: EditorState }) => {
			setState(parameter.state);
			stateRef.current = parameter.state;
		},
		[setState],
	);

	const handleBlur = useCallback((): boolean => {
		if (onBlur) {
			onBlur(stateRef.current.doc.toJSON() as RemirrorJSON);
		}
		return false;
	}, [onBlur]);

	return (
		<div className="remirror-theme">
			<Remirror
				manager={manager}
				state={state}
				onChange={handleChange}
				editable={editable}
				onBlur={handleBlur}
			>
				<EditorComponent />
			</Remirror>
		</div>
	);
}
