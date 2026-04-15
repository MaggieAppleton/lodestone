import { formatDistanceToNow } from "date-fns";
import type { Session } from "../types";
import { extractText } from "../utils/text";

interface SessionCardProps {
	session: Session;
	onOpen: (session: Session) => void;
	onDelete: (session: Session) => void;
}

function snippet(session: Session): string {
	const text = extractText(session.content).trim();
	if (text.length === 0) return "Empty session";
	return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

function statusLabel(status: Session["status"]): string {
	return status === "analysis" ? "Analysis" : "Draft";
}

function statusClasses(status: Session["status"]): string {
	return status === "analysis"
		? "bg-primary/10 text-primary"
		: "bg-neutral-200 text-neutral-700";
}

export function SessionCard({ session, onOpen, onDelete }: SessionCardProps) {
	const handleCardClick = () => onOpen(session);
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onOpen(session);
		}
	};
	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation();
		onDelete(session);
	};

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={handleCardClick}
			onKeyDown={handleKeyDown}
			className="group relative flex cursor-pointer flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 text-left shadow-sm transition hover:border-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40"
		>
			<div className="flex items-start justify-between gap-3">
				<h3 className="font-serif text-lg font-medium leading-snug text-neutral-900">
					{session.title || "Untitled session"}
				</h3>
				<span
					className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(
						session.status,
					)}`}
				>
					{statusLabel(session.status)}
				</span>
			</div>

			<p className="text-sm leading-relaxed text-neutral-600 line-clamp-3">
				{snippet(session)}
			</p>

			<div className="mt-auto flex items-center justify-between pt-2 text-xs text-neutral-500">
				<span>
					{formatDistanceToNow(session.lastModified, {
						addSuffix: true,
					})}
				</span>
				<button
					type="button"
					onClick={handleDelete}
					className="rounded px-2 py-1 text-neutral-500 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-300 group-hover:opacity-100"
					aria-label={`Delete session "${session.title || "Untitled"}"`}
				>
					Delete
				</button>
			</div>
		</div>
	);
}
