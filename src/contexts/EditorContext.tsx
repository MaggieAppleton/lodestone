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
	/** Wrap the current selection in a new entity-reference mark. Returns the new id, or null if the selection is empty. */
	addHighlightAtSelection: (labelType: string) => string | null;
	/** Append `text` (with an entity-reference mark) as a new paragraph at the end of the document. Returns the new id. */
	appendHighlight: (text: string, labelType: string) => string;
	/** Replace the text under an existing entity-reference mark, preserving the mark. */
	updateHighlightText: (id: string, newText: string) => void;
	/** Remove an entity-reference mark from the document. */
	removeHighlight: (id: string) => void;
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

const ENTITY_MARK = "entity-reference";

function InnerProvider({ children }: { children: ReactNode }) {
	const editor = useRemirrorContext<EditorExtensions>();
	const state = useEditorState();
	const highlights = useMemo<Highlight[]>(
		() => extractHighlights(state.doc.toJSON() as RemirrorJSON),
		[state],
	);

	const addHighlightAtSelection = useCallback(
		(labelType: string): string | null => {
			const current = editor.getState();
			if (current.selection.empty) return null;
			const id = crypto.randomUUID();
			editor.commands.addEntityReference(id, {
				id,
				labelType,
				type: labelType,
			});
			return id;
		},
		[editor],
	);

	const appendHighlight = useCallback(
		(text: string, labelType: string): string => {
			const id = crypto.randomUUID();
			const current = editor.getState();
			const { schema, tr, doc } = current;
			const markType = schema.marks[ENTITY_MARK];
			const paragraphType = schema.nodes.paragraph;
			if (!markType || !paragraphType) {
				throw new Error("Editor schema missing paragraph or entity-reference mark");
			}
			const mark = markType.create({ id, labelType, type: labelType });
			const textNode = schema.text(text, [mark]);
			const paragraph = paragraphType.create(null, textNode);
			const transaction = tr.insert(doc.content.size, paragraph);
			editor.manager.view.dispatch(transaction);
			return id;
		},
		[editor],
	);

	const updateHighlightText = useCallback(
		(id: string, newText: string): void => {
			if (!newText) return;
			const current = editor.getState();
			const doc = current.doc;
			const fresh = extractHighlights(doc.toJSON() as RemirrorJSON);
			const target = fresh.find((h) => h.id === id);
			if (!target) return;
			const markType = current.schema.marks[ENTITY_MARK];
			if (!markType) return;
			// Reuse the same attrs so labelType/confidence survive the edit.
			const existingNode = doc.nodeAt(target.from);
			const existingMark = existingNode?.marks.find(
				(m) => m.type.name === ENTITY_MARK && m.attrs.id === id,
			);
			const attrs = existingMark?.attrs ?? {
				id,
				labelType: target.labelType,
				type: target.labelType,
			};
			const mark = markType.create(attrs);
			const textNode = current.schema.text(newText, [mark]);
			const tr = current.tr.replaceWith(target.from, target.to, textNode);
			editor.manager.view.dispatch(tr);
		},
		[editor],
	);

	const removeHighlight = useCallback(
		(id: string): void => {
			editor.commands.removeEntityReference(id);
		},
		[editor],
	);

	const value: EditorContextValue = {
		editor,
		highlights,
		addHighlightAtSelection,
		appendHighlight,
		updateHighlightText,
		removeHighlight,
	};

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
