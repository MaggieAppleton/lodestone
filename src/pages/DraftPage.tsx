import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { RemirrorJSON } from "remirror";
import { useSession } from "../contexts/SessionContext";
import { Editor } from "../components/Editor";
import { DynamicQuestionsPanel } from "../components/DynamicQuestionsPanel";
import { extractText } from "../utils/text";
import { runAnalysis } from "../services/analysis";
import { getAvailableModels, type ModelId } from "../services/llm";
import { detailedPrompt } from "../evals/prompts";

export function DraftPage() {
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
				<p className="mt-2 text-sm text-neutral-500">
					This session may have been deleted.
				</p>
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
		<DraftPageInner
			sessionId={session.id}
			initialTitle={session.title}
			initialContent={session.content}
			saveContent={saveContent}
			updateTitle={updateTitle}
		/>
	);
}

// Split so the editor is mounted only once the session has loaded — Remirror
// consumes `initialContent` at mount time only, so remounting on every save
// would clobber the user's in-flight edits.
interface DraftPageInnerProps {
	sessionId: number;
	initialTitle: string;
	initialContent: RemirrorJSON;
	saveContent: (content: RemirrorJSON) => Promise<void>;
	updateTitle: (title: string) => Promise<void>;
}

function DraftPageInner({
	sessionId,
	initialTitle,
	initialContent,
	saveContent,
	updateTitle,
}: DraftPageInnerProps) {
	const navigate = useNavigate();
	const [title, setTitle] = useState(initialTitle);
	const [editorText, setEditorText] = useState(() =>
		extractText(initialContent),
	);

	// Latest doc from the editor, captured on blur — avoids stale state for Analyse.
	const latestContentRef = useRef<RemirrorJSON>(initialContent);

	// Memoise the initial JSON so the editor mounts once per session.
	const mountContent = useMemo(() => initialContent, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

	const availableModels = getAvailableModels();
	const [selectedModel, setSelectedModel] = useState<ModelId | undefined>(
		availableModels[0],
	);
	const [analysing, setAnalysing] = useState(false);
	const [analyseError, setAnalyseError] = useState<string | null>(null);

	const handleTitleBlur = async () => {
		const next = title.trim() || "Untitled session";
		if (next !== initialTitle) {
			await updateTitle(next);
		}
		if (next !== title) setTitle(next);
	};

	const handleEditorBlur = async (content: RemirrorJSON) => {
		setEditorText(extractText(content));
		latestContentRef.current = content;
		await saveContent(content);
	};

	const handleAnalyse = async () => {
		if (!selectedModel) return;
		const content = latestContentRef.current;
		if (extractText(content).trim().length === 0) {
			setAnalyseError("Add some text before analysing.");
			return;
		}
		setAnalysing(true);
		setAnalyseError(null);
		try {
			await runAnalysis({
				sessionId,
				content,
				model: selectedModel,
				promptTemplate: detailedPrompt,
			});
			navigate(`/analysis/${sessionId}`);
		} catch (err) {
			setAnalyseError(err instanceof Error ? err.message : String(err));
		} finally {
			setAnalysing(false);
		}
	};

	return (
		<main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
			<header className="mb-6 flex items-start justify-between gap-4">
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
						placeholder="Untitled session"
						className="mt-2 w-full border-none bg-transparent font-serif text-3xl font-semibold text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-0"
					/>
				</div>
			</header>

			<div className="grid flex-1 grid-cols-[1fr_280px] gap-6">
				<section className="min-h-[60vh] rounded-md border border-neutral-200 bg-white p-6">
					<Editor
						initialContent={mountContent}
						placeholder="Start writing…"
						onBlur={handleEditorBlur}
					/>
				</section>
				<DynamicQuestionsPanel
					sessionId={sessionId}
					editorText={editorText}
					topic={title || "Untitled session"}
				/>
			</div>

			<footer className="mt-6 flex flex-col items-end gap-2">
				{analyseError && (
					<p className="text-sm text-red-600">{analyseError}</p>
				)}
				<div className="flex items-center gap-2">
					{availableModels.length > 1 && (
						<select
							value={selectedModel}
							onChange={(e) =>
								setSelectedModel(e.target.value as ModelId)
							}
							className="rounded border border-neutral-200 bg-white px-2 py-2 text-sm"
							disabled={analysing}
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
						onClick={handleAnalyse}
						disabled={analysing || !selectedModel}
						className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
					>
						{analysing ? "Analysing…" : "Analyse"}
					</button>
				</div>
			</footer>
		</main>
	);
}
