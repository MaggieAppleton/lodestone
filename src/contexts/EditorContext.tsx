import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	type ReactNode,
} from "react";
import type { RemirrorJSON } from "remirror";
import {
	Remirror,
	useRemirror,
	useRemirrorContext,
	useEditorState,
	type ReactFrameworkOutput,
} from "@remirror/react";
import {
	EntityReferenceExtension,
	PlaceholderExtension,
	EventsExtension,
	findMinMaxRange,
	type EntityReferenceMetaData,
} from "remirror/extensions";
import { Decoration } from "@remirror/pm/view";
import type { EditorState } from "@remirror/pm/state";
import type { Highlight } from "../types";
import { extractHighlights } from "../utils/highlights";
import { getHighlightStyle } from "../utils/decorateHighlights";
import { LABEL_CONFIGS } from "../types/labels";

type EditorExtensions =
	| EntityReferenceExtension
	| PlaceholderExtension
	| EventsExtension;

type EditorFrameworkOutput = ReactFrameworkOutput<EditorExtensions>;

interface EditorContextValue {
	editor: EditorFrameworkOutput;
	highlights: Highlight[];
}

const EditorContext = createContext<EditorContextValue | null>(null);

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

interface EditorProviderProps {
	initialContent: RemirrorJSON;
	editable?: boolean;
	children: ReactNode;
}

/**
 * Hosts a single Remirror editor instance that is shared across views
 * (text / graph / claims in analysis mode). Exposes the framework
 * output and a derived highlights array via context.
 */
export function EditorProvider({
	initialContent,
	editable = true,
	children,
}: EditorProviderProps) {
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
			new PlaceholderExtension({ placeholder: "" }),
			new EventsExtension({}),
		],
		content: initialContent,
	});

	const handleChange = useCallback(
		(parameter: { state: EditorState }) => setState(parameter.state),
		[setState],
	);

	return (
		<Remirror
			manager={manager}
			state={state}
			onChange={handleChange}
			editable={editable}
		>
			<InnerProvider>{children}</InnerProvider>
		</Remirror>
	);
}

function InnerProvider({ children }: { children: ReactNode }) {
	const editor = useRemirrorContext<EditorExtensions>();
	const state = useEditorState();
	const highlights = useMemo<Highlight[]>(
		() => extractHighlights(state.doc.toJSON() as RemirrorJSON),
		[state],
	);

	const value: EditorContextValue = { editor, highlights };

	return (
		<EditorContext.Provider value={value}>{children}</EditorContext.Provider>
	);
}

export function useEditorContext(): EditorContextValue {
	const ctx = useContext(EditorContext);
	if (!ctx) {
		throw new Error(
			"useEditorContext must be used inside <EditorProvider>",
		);
	}
	return ctx;
}
