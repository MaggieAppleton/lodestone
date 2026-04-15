import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { SessionsPage } from "./pages/SessionsPage";
import { DraftPage } from "./pages/DraftPage";
import { SessionProvider, useSession } from "./contexts/SessionContext";
import { EditorProvider } from "./contexts/EditorContext";

/**
 * Parses the :id route param into a positive integer, or NaN if invalid.
 */
function useSessionIdParam(): number {
	const { id } = useParams<{ id: string }>();
	const parsed = id === undefined ? NaN : Number.parseInt(id, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : NaN;
}

function DraftRouteWrapper() {
	const sessionId = useSessionIdParam();
	if (Number.isNaN(sessionId)) return <InvalidSessionId />;
	return (
		<SessionProvider sessionId={sessionId}>
			<DraftPage />
		</SessionProvider>
	);
}

function AnalysisRouteWrapper() {
	const sessionId = useSessionIdParam();
	if (Number.isNaN(sessionId)) return <InvalidSessionId />;
	return (
		<SessionProvider sessionId={sessionId}>
			<AnalysisEditorWrapper />
		</SessionProvider>
	);
}

// Analysis wraps the session's content in an EditorProvider once the
// session has loaded (we need initialContent before mounting Remirror).
function AnalysisEditorWrapper() {
	const { session, isLoading } = useSession();
	if (isLoading) return <LoadingScreen />;
	if (!session) return <SessionNotFound />;
	return (
		<EditorProvider initialContent={session.content}>
			<AnalysisPagePlaceholder />
		</EditorProvider>
	);
}

function AnalysisPagePlaceholder() {
	return (
		<main className="mx-auto max-w-3xl px-6 py-10">
			<p className="text-sm text-neutral-500">
				Analysis page — coming in Phase 4.
			</p>
		</main>
	);
}

function LoadingScreen() {
	return (
		<main className="mx-auto max-w-3xl px-6 py-10">
			<p className="text-sm text-neutral-500">Loading session…</p>
		</main>
	);
}

function SessionNotFound() {
	return (
		<main className="mx-auto max-w-3xl px-6 py-10">
			<h1 className="font-serif text-2xl text-neutral-900">
				Session not found
			</h1>
			<p className="mt-2 text-sm text-neutral-500">
				This session may have been deleted.
			</p>
		</main>
	);
}

function InvalidSessionId() {
	return (
		<main className="mx-auto max-w-3xl px-6 py-10">
			<h1 className="font-serif text-2xl text-neutral-900">
				Invalid session id
			</h1>
		</main>
	);
}

export default function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<SessionsPage />} />
				<Route path="/draft/:id" element={<DraftRouteWrapper />} />
				<Route
					path="/analysis/:id"
					element={<AnalysisRouteWrapper />}
				/>
			</Routes>
		</BrowserRouter>
	);
}
