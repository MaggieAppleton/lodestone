import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
	Background,
	Controls,
	Handle,
	MiniMap,
	Position,
	applyEdgeChanges,
	applyNodeChanges,
	type Connection,
	type Edge,
	type EdgeChange,
	type Node,
	type NodeChange,
	type NodeProps,
	type XYPosition,
} from "reactflow";
import "reactflow/dist/style.css";
import { useEditorContext } from "../contexts/EditorContext";
import { useSession } from "../contexts/SessionContext";
import { LABEL_CONFIGS } from "../types/labels";
import type { Highlight, Relationship } from "../types";

interface HighlightNodeData {
	highlight: Highlight;
	color: string;
	onEditText: (id: string, newText: string) => void;
	onDelete: (id: string) => void;
}

function HighlightNode({ data }: NodeProps<HighlightNodeData>) {
	const { highlight, color, onEditText, onDelete } = data;
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(highlight.text);

	const commit = () => {
		setIsEditing(false);
		const next = draft.trim();
		if (next && next !== highlight.text) onEditText(highlight.id, next);
		else setDraft(highlight.text);
	};

	return (
		<div
			className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs shadow-sm"
			style={{ borderTopColor: color, borderTopWidth: 4, minWidth: 160, maxWidth: 240 }}
		>
			<Handle type="target" position={Position.Left} />
			<div className="mb-1 flex items-center justify-between gap-2">
				<span
					className="text-[10px] font-medium uppercase tracking-wide"
					style={{ color }}
				>
					{highlight.labelType}
				</span>
				<div className="flex gap-1">
					<button
						type="button"
						onClick={() => {
							setDraft(highlight.text);
							setIsEditing(true);
						}}
						className="text-[10px] text-neutral-500 hover:text-neutral-800"
						aria-label="Edit"
					>
						✎
					</button>
					<button
						type="button"
						onClick={() => onDelete(highlight.id)}
						className="text-[10px] text-neutral-500 hover:text-red-600"
						aria-label="Delete"
					>
						✕
					</button>
				</div>
			</div>
			{isEditing ? (
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
							setIsEditing(false);
							setDraft(highlight.text);
						}
					}}
					className="w-full rounded border border-neutral-200 p-1 text-xs outline-none focus:border-neutral-400"
					rows={3}
				/>
			) : (
				<p className="whitespace-pre-wrap break-words leading-snug text-neutral-800">
					{highlight.text}
				</p>
			)}
			<Handle type="source" position={Position.Right} />
		</div>
	);
}

const nodeTypes = { highlight: HighlightNode };

function buildAutoLayout(
	highlights: Highlight[],
	saved: Record<string, XYPosition>,
): Record<string, XYPosition> {
	// Column-based fallback: group by labelType, one column per label.
	const columns: Record<string, Highlight[]> = {};
	const unseen: Highlight[] = [];
	for (const h of highlights) {
		if (saved[h.id]) continue;
		unseen.push(h);
	}
	for (const h of unseen) {
		(columns[h.labelType] ??= []).push(h);
	}
	const laid: Record<string, XYPosition> = {};
	const labelOrder = LABEL_CONFIGS.map((l) => l.id);
	const orderedLabels = [
		...labelOrder.filter((l) => columns[l]),
		...Object.keys(columns).filter((l) => !labelOrder.includes(l)),
	];
	const colW = 280;
	const rowH = 120;
	orderedLabels.forEach((label, colIdx) => {
		columns[label].forEach((h, rowIdx) => {
			laid[h.id] = { x: colIdx * colW, y: rowIdx * rowH };
		});
	});
	return laid;
}

export function ArgumentGraph() {
	const {
		highlights,
		updateHighlightText,
		removeHighlight,
	} = useEditorContext();
	const { session, saveRelationships, saveGraphPositions, saveContent } =
		useSession();
	const { editor } = useEditorContext();

	const relationships = useMemo(
		() => session?.relationships ?? [],
		[session?.relationships],
	);
	const graphPositions = useMemo(
		() => session?.graphPositions ?? {},
		[session?.graphPositions],
	);

	const [labelFilter, setLabelFilter] = useState<Record<string, boolean>>(
		() => Object.fromEntries(LABEL_CONFIGS.map((l) => [l.id, true])),
	);

	const labelColor = useCallback((labelType: string) => {
		return LABEL_CONFIGS.find((l) => l.id === labelType)?.color ?? "#999";
	}, []);

	// Compute initial nodes whenever highlights change; keep ReactFlow's
	// local drag state in between.
	const visibleHighlights = useMemo(
		() => highlights.filter((h) => labelFilter[h.labelType] !== false),
		[highlights, labelFilter],
	);

	const computedPositions = useMemo(() => {
		const autoLaid = buildAutoLayout(visibleHighlights, graphPositions);
		const merged: Record<string, XYPosition> = { ...autoLaid };
		for (const h of visibleHighlights) {
			if (graphPositions[h.id]) merged[h.id] = graphPositions[h.id];
		}
		return merged;
	}, [visibleHighlights, graphPositions]);

	const initialNodes = useMemo<Node<HighlightNodeData>[]>(() => {
		return visibleHighlights.map((h) => ({
			id: h.id,
			type: "highlight",
			position: computedPositions[h.id] ?? { x: 0, y: 0 },
			data: {
				highlight: h,
				color: labelColor(h.labelType),
				onEditText: (id, next) => {
					updateHighlightText(id, next);
					// Persist doc after the mark update.
					void saveContent(editor.getState().doc.toJSON());
				},
				onDelete: (id) => {
					removeHighlight(id);
					// Prune relationships referencing this node.
					const pruned = relationships.filter(
						(r) => r.sourceHighlightId !== id && r.targetHighlightId !== id,
					);
					if (pruned.length !== relationships.length) {
						void saveRelationships(pruned);
					}
					void saveContent(editor.getState().doc.toJSON());
				},
			},
		}));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [visibleHighlights, computedPositions, relationships]);

	const initialEdges = useMemo<Edge[]>(() => {
		const ids = new Set(visibleHighlights.map((h) => h.id));
		return relationships
			.filter(
				(r) => ids.has(r.sourceHighlightId) && ids.has(r.targetHighlightId),
			)
			.map((r) => ({
				id: `${r.sourceHighlightId}->${r.targetHighlightId}`,
				source: r.sourceHighlightId,
				target: r.targetHighlightId,
			}));
	}, [relationships, visibleHighlights]);

	const [nodes, setNodes] = useState<Node<HighlightNodeData>[]>(initialNodes);
	const [edges, setEdges] = useState<Edge[]>(initialEdges);

	// When upstream data changes (highlights added/removed, edges changed by
	// another view), reset local graph state. Drag-only position changes stay
	// local until commit.
	useEffect(() => {
		setNodes(initialNodes);
	}, [initialNodes]);
	useEffect(() => {
		setEdges(initialEdges);
	}, [initialEdges]);

	const onNodesChange = useCallback(
		(changes: NodeChange[]) =>
			setNodes((prev) => applyNodeChanges(changes, prev)),
		[],
	);
	const onEdgesChange = useCallback(
		(changes: EdgeChange[]) => {
			setEdges((prev) => applyEdgeChanges(changes, prev));
			const removedIds = changes
				.filter((c): c is EdgeChange & { type: "remove"; id: string } =>
					c.type === "remove",
				)
				.map((c) => c.id);
			if (removedIds.length === 0) return;
			const next: Relationship[] = relationships.filter((r) => {
				const id = `${r.sourceHighlightId}->${r.targetHighlightId}`;
				return !removedIds.includes(id);
			});
			if (next.length !== relationships.length) {
				void saveRelationships(next);
			}
		},
		[relationships, saveRelationships],
	);

	const onNodeDragStop = useCallback(
		(_: unknown, node: Node) => {
			const next: Record<string, XYPosition> = { ...graphPositions };
			next[node.id] = { x: node.position.x, y: node.position.y };
			void saveGraphPositions(next);
		},
		[graphPositions, saveGraphPositions],
	);

	const onConnect = useCallback(
		(connection: Connection) => {
			if (!connection.source || !connection.target) return;
			if (connection.source === connection.target) return;
			const exists = relationships.some(
				(r) =>
					r.sourceHighlightId === connection.source &&
					r.targetHighlightId === connection.target,
			);
			if (exists) return;
			const next: Relationship[] = [
				...relationships,
				{
					sourceHighlightId: connection.source,
					targetHighlightId: connection.target,
				},
			];
			void saveRelationships(next);
		},
		[relationships, saveRelationships],
	);

	const toggleLabel = (id: string) =>
		setLabelFilter((prev) => ({ ...prev, [id]: !prev[id] }));

	return (
		<div className="flex min-h-[60vh] gap-3">
			<aside className="w-48 shrink-0 rounded-md border border-neutral-200 bg-white p-3">
				<h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
					Filter
				</h3>
				<ul className="flex flex-col gap-1 text-sm">
					{LABEL_CONFIGS.map((label) => (
						<li key={label.id}>
							<label className="flex items-center gap-2 text-neutral-700">
								<input
									type="checkbox"
									checked={labelFilter[label.id] !== false}
									onChange={() => toggleLabel(label.id)}
								/>
								<span
									aria-hidden
									className="inline-block h-2.5 w-2.5 rounded-sm"
									style={{ backgroundColor: label.color }}
								/>
								{label.name}
							</label>
						</li>
					))}
				</ul>
				<p className="mt-4 text-[11px] text-neutral-500">
					Drag nodes to reposition. Drag from a handle to connect two
					highlights.
				</p>
			</aside>
			<div className="flex-1 rounded-md border border-neutral-200 bg-neutral-50">
				<ReactFlow
					nodes={nodes}
					edges={edges}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					onNodeDragStop={onNodeDragStop}
					onConnect={onConnect}
					nodeTypes={nodeTypes}
					fitView
					deleteKeyCode={["Backspace", "Delete"]}
				>
					<Background gap={16} />
					<Controls position="bottom-right" />
					<MiniMap pannable zoomable />
				</ReactFlow>
			</div>
		</div>
	);
}
