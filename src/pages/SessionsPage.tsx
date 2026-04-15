import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import type { Session } from "../types";
import * as sessions from "../db/sessions";
import { SessionCard } from "../components/SessionCard";

function pathForSession(session: Session): string {
	return session.status === "analysis"
		? `/analysis/${session.id}`
		: `/draft/${session.id}`;
}

export function SessionsPage() {
	const navigate = useNavigate();
	const allSessions = useLiveQuery(() => sessions.getAllSessions(), []);

	const handleCreate = async () => {
		const id = await sessions.createSession("Untitled session");
		navigate(`/draft/${id}`);
	};

	const handleOpen = (session: Session) => {
		if (session.id === undefined) return;
		navigate(pathForSession(session));
	};

	const handleDelete = async (session: Session) => {
		if (session.id === undefined) return;
		const confirmed = window.confirm(
			`Delete "${session.title || "Untitled session"}"? This cannot be undone.`,
		);
		if (!confirmed) return;
		await sessions.deleteSession(session.id);
	};

	const isLoading = allSessions === undefined;
	const isEmpty = !isLoading && allSessions.length === 0;

	return (
		<main className="mx-auto max-w-6xl px-6 py-10">
			<header className="mb-8 flex items-center justify-between">
				<div>
					<h1 className="font-serif text-3xl font-semibold text-neutral-900">
						Lodestone
					</h1>
					<p className="mt-1 text-sm text-neutral-600">
						Your writing and thinking sessions.
					</p>
				</div>
				<button
					type="button"
					onClick={handleCreate}
					className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primaryDark focus:outline-none focus:ring-2 focus:ring-primary/40"
				>
					New session
				</button>
			</header>

			{isLoading && (
				<p className="text-sm text-neutral-500">Loading…</p>
			)}

			{isEmpty && (
				<div className="rounded-lg border border-dashed border-neutral-300 bg-white/60 p-10 text-center">
					<p className="font-serif text-lg text-neutral-700">
						No sessions yet.
					</p>
					<p className="mt-1 text-sm text-neutral-500">
						Create your first session to start writing.
					</p>
				</div>
			)}

			{!isLoading && !isEmpty && (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{allSessions!.map((session) => (
						<SessionCard
							key={session.id}
							session={session}
							onOpen={handleOpen}
							onDelete={handleDelete}
						/>
					))}
				</div>
			)}
		</main>
	);
}
