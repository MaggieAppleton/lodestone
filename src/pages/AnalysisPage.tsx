import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { RemirrorJSON } from "remirror";
import { EditorComponent } from "@remirror/react";
import { useSession } from "../contexts/SessionContext";
import { useEditorContext } from "../contexts/EditorContext";
import { HighlightToolbar } from "../components/HighlightToolbar";
import { runAnalysis } from "../services/analysis";
import { getAvailableModels, type ModelId } from "../services/llm";
import { detailedPrompt } from "../evals/prompts";
import * as sessions from "../db/sessions";

type Tab = "text" | "graph" | "claims";

export function AnalysisPage() {
	const { session, isLoading, saveContent, updateTitle } = useSession();

	if (isLoading) {
		return (
			<main className="mx-auto max-w-3xl px-6 py-10">
				<p className="text-sm text-neutral-500">Loading session…</p>
			</main>
		);
	}
	if (!session || session.id === undefined) {
		return (
			<main className="mx-auto max-w-3xl px-6 py-10">
				<h1 className="font-serif text-2xl text-neutral-900">
					Session not found
				</h1>
				<Link
					to="/"
					className="mt-4 inline-block text-sm text-primary hover:underline"
				>
					← Back to sessions
				</Link>
			</main>
		);
	}

	return (
		<AnalysisPageInner
			sessionId={session.id}
			initialTitle={session.title}
			modelName={session.analysisMetadata?.modelName}
			saveContent={saveContent}
			updateTitle={updateTitle}
		/>
	);
}

interface InnerProps {
	sessionId: number;
	initialTitle: string;
	modelName: string | undefined;
	saveContent: (content: RemirrorJSON) => Promise<void>;
	updateTitle: (title: string) => Promise<void>;
}

function AnalysisPageInner({
	sessionId,
	initialTitle,
	modelName,
	saveContent,
	updateTitle,
}: InnerProps) {
	const navigate = useNavigate();
	const { editor } = useEditorContext();
	const [tab, setTab] = useState<Tab>("text");
	const [title, setTitle] = useState(initialTitle);
	const [reanalysing, setReanalysing] = useState(false);
	const [reanalyseError, setReanalyseError] = useState<string | null>(null);

	const availableModels = getAvailableModels();
	const defaultModel: ModelId | undefined =
		(modelName as ModelId | undefined) ?? availableModels[0];
	const [selectedModel, setSelectedModel] = useState<ModelId | undefined>(
		defaultModel,
	);

	// Read current doc from the Remirror state exposed via EditorContext.
	const readDoc = useCallback((): RemirrorJSON => {
		return editor.getState().doc.toJSON() as RemirrorJSON;
	}, [editor]);

	// Persist on blur (captured on the editor wrapper) and on beforeunload.
	const saveContentRef = useRef(saveContent);
	saveContentRef.current = saveContent;

	useEffect(() => {
		const handler = () => {
			// Fire-and-forget; the browser may still be tearing down.
			void saveContentRef.current(readDoc());
		};
		window.addEventListener("beforeunload", handler);
		return () => window.removeEventListener("beforeunload", handler);
	}, [readDoc]);

	const handleEditorBlur = () => {
		void saveContent(readDoc());
	};

	const handleTitleBlur = async () => {
		const next = title.trim() || "Untitled session";
		if (next !== initialTitle) await updateTitle(next);
		if (next !== title) setTitle(next);
	};

	const handleBackToEditing = async () => {
		// Save any pending edits first, then flip status.
		await saveContent(readDoc());
		await sessions.revertToDraft(sessionId);
		navigate(`/draft/${sessionId}`);
	};

	const handleReanalyse = async () => {
		if (!selectedModel) return;
		setReanalysing(true);
		setReanalyseError(null);
		try {
			await runAnalysis({
				sessionId,
				content: readDoc(),
				model: selectedModel,
				promptTemplate: detailedPrompt,
			});
		} catch (err) {
			setReanalyseError(err instanceof Error ? err.message : String(err));
		} finally {
			setReanalysing(false);
		}
	};

	return (
		<main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
			<header className="mb-4 flex items-start justify-between gap-4">
				<div className="flex-1">
					<Link
						to="/"
						className="text-xs text-neutral-500 hover:text-neutral-700"
					>
						← All sessions
					</Link>
					<input
						type="text"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						onBlur={handleTitleBlur}
						className="mt-2 w-full border-none bg-transparent font-serif text-3xl font-semibold text-neutral-900 outline-none focus:ring-0"
					/>
				</div>
				<div className="flex items-center gap-2">
					{availableModels.length > 1 && (
						<select
							value={selectedModel}
							onChange={(e) =>
								setSelectedModel(e.target.value as ModelId)
							}
							className="rounded border border-neutral-200 bg-white px-2 py-1 text-sm"
						>
							{availableModels.map((m) => (
								<option key={m} value={m}>
									{m}
								</option>
							))}
						</select>
					)}
					<button
						type="button"
						onClick={handleBackToEditing}
						className="rounded border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
					>
						Back to editing
					</button>
					<button
						type="button"
						disabled={reanalysing || !selectedModel}
						onClick={handleReanalyse}
						className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
					>
						{reanalysing ? "Analysing…" : "Re-analyse"}
					</button>
				</div>
			</header>

			{reanalyseError && (
				<div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
					{reanalyseError}
				</div>
			)}

			<nav className="mb-4 flex gap-1 border-b border-neutral-200">
				{(["text", "graph", "claims"] as const).map((t) => (
					<button
						key={t}
						type="button"
						onClick={() => setTab(t)}
						className={`-mb-px border-b-2 px-4 py-2 text-sm capitalize ${
							tab === t
								? "border-primary text-neutral-900"
								: "border-transparent text-neutral-500 hover:text-neutral-700"
						}`}
					>
						{t}
					</button>
				))}
			</nav>

			{tab === "text" && (
				<div className="grid flex-1 grid-cols-[1fr_280px] gap-6">
					<section
						className="min-h-[60vh] rounded-md border border-neutral-200 bg-white p-6"
						onBlur={handleEditorBlur}
					>
						<EditorComponent />
					</section>
					<HighlightToolbar />
				</div>
			)}

			{tab === "graph" && (
				<section className="min-h-[60vh] rounded-md border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
					Graph view — coming in Phase 5.
				</section>
			)}

			{tab === "claims" && (
				<section className="min-h-[60vh] rounded-md border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
					Claims view — coming in Phase 5.
				</section>
			)}
		</main>
	);
}
