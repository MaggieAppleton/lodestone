import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../contexts/SessionContext";
import { Editor } from "../components/Editor";
import { DynamicQuestionsPanel } from "../components/DynamicQuestionsPanel";
import { extractText } from "../utils/text";

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
	initialContent: import("remirror").RemirrorJSON;
	saveContent: (content: import("remirror").RemirrorJSON) => Promise<void>;
	updateTitle: (title: string) => Promise<void>;
}

function DraftPageInner({
	sessionId,
	initialTitle,
	initialContent,
	saveContent,
	updateTitle,
}: DraftPageInnerProps) {
	const [title, setTitle] = useState(initialTitle);
	const [editorText, setEditorText] = useState(() =>
		extractText(initialContent),
	);

	// Memoise the initial JSON so the editor mounts once per session.
	const mountContent = useMemo(() => initialContent, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleTitleBlur = async () => {
		const next = title.trim() || "Untitled session";
		if (next !== initialTitle) {
			await updateTitle(next);
		}
		if (next !== title) setTitle(next);
	};

	const handleEditorBlur = async (content: import("remirror").RemirrorJSON) => {
		setEditorText(extractText(content));
		await saveContent(content);
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

			<footer className="mt-6 flex justify-end">
				<button
					type="button"
					disabled
					title="Analyse — wired up in Phase 4"
					className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-white opacity-50"
				>
					Analyse
				</button>
			</footer>
		</main>
	);
}
