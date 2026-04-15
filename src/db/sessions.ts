import type { RemirrorJSON } from "remirror";
import type { XYPosition } from "reactflow";
import { db } from "./index";
import type { Session, Relationship } from "../types";

export async function createSession(title: string): Promise<number> {
	const now = new Date();
	return db.sessions.add({
		title,
		createdAt: now,
		lastModified: now,
		status: "draft",
		content: { type: "doc", content: [{ type: "paragraph" }] },
		relationships: [],
		graphPositions: {},
	});
}

export async function getSession(id: number): Promise<Session | undefined> {
	return db.sessions.get(id);
}

export async function getAllSessions(): Promise<Session[]> {
	return db.sessions.orderBy("lastModified").reverse().toArray();
}

export async function deleteSession(id: number): Promise<void> {
	await db.sessions.delete(id);
	await db.dynamicQuestions.where("sessionId").equals(id).delete();
}

export async function updateSessionTitle(
	id: number,
	title: string,
): Promise<void> {
	await db.sessions.update(id, { title, lastModified: new Date() });
}

export async function saveContent(
	id: number,
	content: RemirrorJSON,
): Promise<void> {
	await db.sessions.update(id, { content, lastModified: new Date() });
}

export async function revertToDraft(id: number): Promise<void> {
	await db.sessions.update(id, {
		status: "draft",
		lastModified: new Date(),
	});
}

export async function saveAnalysis(
	id: number,
	content: RemirrorJSON,
	relationships: Relationship[],
	metadata: { modelName: string; promptId: string },
): Promise<void> {
	await db.sessions.update(id, {
		content,
		relationships,
		status: "analysis",
		analysisMetadata: { ...metadata, analysedAt: new Date() },
		lastModified: new Date(),
	});
}

export async function saveRelationships(
	id: number,
	relationships: Relationship[],
): Promise<void> {
	await db.sessions.update(id, {
		relationships,
		lastModified: new Date(),
	});
}

export async function saveGraphPositions(
	id: number,
	positions: Record<string, XYPosition>,
): Promise<void> {
	await db.sessions.update(id, {
		graphPositions: positions,
		lastModified: new Date(),
	});
}
