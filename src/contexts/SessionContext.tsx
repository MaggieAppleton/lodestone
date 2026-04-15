import {
	createContext,
	useCallback,
	useContext,
	type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { RemirrorJSON } from "remirror";
import type { XYPosition } from "reactflow";
import type { Session, Relationship } from "../types";
import * as sessions from "../db/sessions";

interface SessionContextValue {
	session: Session | undefined;
	isLoading: boolean;
	saveContent: (content: RemirrorJSON) => Promise<void>;
	saveRelationships: (relationships: Relationship[]) => Promise<void>;
	saveGraphPositions: (
		positions: Record<string, XYPosition>,
	) => Promise<void>;
	updateTitle: (title: string) => Promise<void>;
	deleteSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
	sessionId: number;
	children: ReactNode;
}

export function SessionProvider({ sessionId, children }: SessionProviderProps) {
	const session = useLiveQuery(
		() => sessions.getSession(sessionId),
		[sessionId],
	);
	const isLoading = session === undefined;

	const saveContent = useCallback(
		(content: RemirrorJSON) => sessions.saveContent(sessionId, content),
		[sessionId],
	);

	const saveRelationships = useCallback(
		(relationships: Relationship[]) =>
			sessions.saveRelationships(sessionId, relationships),
		[sessionId],
	);

	const saveGraphPositions = useCallback(
		(positions: Record<string, XYPosition>) =>
			sessions.saveGraphPositions(sessionId, positions),
		[sessionId],
	);

	const updateTitle = useCallback(
		(title: string) => sessions.updateSessionTitle(sessionId, title),
		[sessionId],
	);

	const deleteSession = useCallback(
		() => sessions.deleteSession(sessionId),
		[sessionId],
	);

	const value: SessionContextValue = {
		session,
		isLoading,
		saveContent,
		saveRelationships,
		saveGraphPositions,
		updateTitle,
		deleteSession,
	};

	return (
		<SessionContext.Provider value={value}>
			{children}
		</SessionContext.Provider>
	);
}

export function useSession(): SessionContextValue {
	const ctx = useContext(SessionContext);
	if (!ctx) {
		throw new Error("useSession must be used inside <SessionProvider>");
	}
	return ctx;
}
