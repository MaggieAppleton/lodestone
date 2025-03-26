import {
	useCallback,
	forwardRef,
	useImperativeHandle,
	useEffect,
	useState,
} from "react";
import {
	useRemirror,
	EditorComponent,
	Remirror,
	ReactFrameworkOutput,
} from "@remirror/react";
import type { RemirrorJSON } from "remirror";
import { EntityReferenceExtension } from "remirror/extensions";
import { PlaceholderExtension } from "remirror/extensions";
import type {
	RemirrorEventListener,
	RemirrorEventListenerProps,
} from "@remirror/core";
import { clearHighlights, setHighlight } from "../utils/highlightMap";
import { decorateHighlights } from "../utils/decorateHighlights";
import type { Relationship } from "../utils/relationshipTypes";
import type { HighlightWithText } from "../services/models/types";
import { HighlightButtons } from "./HighlightButtons";

type EditorProps = {
	initialContent?: RemirrorJSON;
	placeholder?: string;
	showHighlightButtons?: boolean;
	highlights?: HighlightWithText[];
	relationships?: Relationship[];
	onChange?: RemirrorEventListener<EntityReferenceExtension>;
	onChangeJSON?: (
		json: RemirrorJSON,
		options?: { skipExtraction?: boolean }
	) => void;
	renderSidebar?: boolean;
};

const Editor = forwardRef<
	ReactFrameworkOutput<EntityReferenceExtension>,
	EditorProps
>((props: EditorProps, ref) => {
	const { onChange, onChangeJSON } = props;
	const [errorState, setErrorState] = useState<string | null>(null);
	const [isEntityModificationInProgress, setIsEntityModificationInProgress] =
		useState(false);

	// Create the Remirror manager and state
	const { manager, state, setState, getContext } = useRemirror({
		extensions: () => [
			new EntityReferenceExtension({
				getStyle: decorateHighlights,
				extraAttributes: {
					labelType: {
						default: null,
					},
					type: {
						default: null,
					},
				},
			}),
			new PlaceholderExtension({
				placeholder: props.placeholder || "Start typing...",
			}),
		],
		content: props.initialContent ?? {
			type: "doc",
			content: [{ type: "paragraph" }],
		},
		stringHandler: "html",
		onError: ({ json }) => {
			setErrorState("Invalid content detected. Resetting to empty document.");
			// Return a valid empty document if we can't handle the content
			return {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{
								type: "text",
								text: json.content?.[0]?.content?.[0]?.text || "",
							},
						],
					},
				],
			};
		},
	});

	// Expose the editor context to the parent component
	useImperativeHandle(
		ref,
		() => getContext() as ReactFrameworkOutput<EntityReferenceExtension>,
		[getContext]
	);

	// Reinitialize editor when initialContent changes substantially
	useEffect(() => {
		if (!manager || !props.initialContent) return;

		try {
			// Create a new state with the updated content
			const newState = manager.createState({
				content: props.initialContent,
				stringHandler: "html",
			});

			// Update the editor state
			setState(newState);

			// Make sure to clear and repopulate the highlight map
			clearHighlights();

			// Populate the highlight map from the props
			props.highlights?.forEach((highlight) => {
				if (highlight.id && highlight.labelType) {
					setHighlight(highlight.id, highlight.labelType);
				}
			});
		} catch (error) {
			console.error("❌ [Editor] Error reinitializing editor:", error);
			setErrorState("Error loading content. Please refresh the page.");
		}
	}, [props.initialContent, props.highlights, manager, setState]);

	// Combined useEffect for initialization and highlight syncing
	useEffect(() => {
		if (!state || !manager) return;

		// Clear error state if there was one
		if (errorState) {
			setErrorState(null);
		}

		try {
			// Sync highlight map with document marks
			clearHighlights();

			// Populate the highlight map from document marks
			state.doc.descendants((node) => {
				if (node.marks && node.isText) {
					const entityMarks = node.marks.filter(
						(mark) => mark.type.name === "entity-reference" && mark.attrs.id
					);

					entityMarks.forEach((mark) => {
						const labelType =
							mark.attrs.labelType || mark.attrs.type || "claim";
						setHighlight(String(mark.attrs.id), String(labelType));
					});
				}
				return true;
			});
		} catch (error) {
			console.error("Error syncing highlight map:", error);
			setErrorState("Error syncing highlights. Please refresh the page.");
		}
	}, [state, manager, errorState]);

	// Handle editor changes and save content
	const handleChange: RemirrorEventListener<EntityReferenceExtension> =
		useCallback(
			(parameter: RemirrorEventListenerProps<EntityReferenceExtension>) => {
				try {
					// Check if this is just a selection change
					const isSelectionChangeOnly =
						parameter.tr?.selectionSet && !parameter.tr?.docChanged;

					// Always update the editor state
					setState(parameter.state);
					onChange?.(parameter);

					// Don't process changes if it's just a selection change
					if (isSelectionChangeOnly) {
						return;
					}

					// Check if this is likely an entity reference modification
					// by inspecting transaction steps
					let isEntityModification = false;

					if (parameter.tr) {
						parameter.tr.steps.forEach((step) => {
							// Try to identify entity reference modifications
							// We need to use a type assertion because the Step class is complex
							const stepAny = step as unknown as {
								mark?: {
									type?: {
										name?: string;
									};
								};
								slice?: {
									content?: {
										toString?: () => string;
									};
								};
								from?: number;
								to?: number;
							};

							// Check if this step is removing an entity reference
							const isMarkRemoval =
								stepAny.mark?.type?.name === "entity-reference" &&
								stepAny.from !== undefined &&
								stepAny.to !== undefined;

							if (isMarkRemoval) {
								isEntityModification = true;
								setIsEntityModificationInProgress(true);

								// Reset the flag after a short delay
								setTimeout(() => {
									setIsEntityModificationInProgress(false);
								}, 100);
							} else if (
								stepAny.mark?.type?.name === "entity-reference" ||
								(stepAny.slice?.content?.toString &&
									stepAny.slice.content.toString().includes("entity-reference"))
							) {
								isEntityModification = true;
							}
						});
					}

					// If we detect entity modifications, don't immediately trigger a change
					// HighlightButtons will handle saving with the proper options
					if (isEntityModification || isEntityModificationInProgress) {
						return;
					}

					// For regular content changes, proceed with standard save
					const json = parameter.state.doc.toJSON();
					if (json.content?.length > 0) {
						onChangeJSON?.(json, undefined);
					}
				} catch (error) {
					console.error("Error handling editor change:", error);
					setErrorState("Error updating content. Please try again.");
				}
			},
			[onChange, onChangeJSON, setState, isEntityModificationInProgress]
		);

	return (
		<div className="remirror-theme min-h-[400px] flex flex-col relative">
			{errorState && (
				<div className="bg-red-100 text-red-700 p-2 mb-2 rounded">
					{errorState}
				</div>
			)}

			<Remirror
				manager={manager}
				initialContent={state}
				autoFocus
				onChange={handleChange}
			>
				<div className="h-full min-h-[400px]">
					<div className="w-full h-full">
						<EditorComponent />
					</div>

					{props.renderSidebar && props.showHighlightButtons && (
						<div className="absolute left-full top-0 ml-6 pt-3 min-w-[180px] highlight-buttons-sidebar">
							<HighlightButtons
								onSave={(json, options) => onChangeJSON?.(json, options)}
							/>
						</div>
					)}
				</div>
			</Remirror>
		</div>
	);
});

Editor.displayName = "Editor";

export default Editor;
