import { db } from "./index";
import type { DynamicQuestion } from "../types";

export async function addQuestions(
	sessionId: number,
	questions: string[],
): Promise<void> {
	if (questions.length === 0) return;
	const now = new Date();
	const rows: DynamicQuestion[] = questions.map((question) => ({
		sessionId,
		question,
		generatedAt: now,
		isDefault: false,
	}));
	await db.dynamicQuestions.bulkAdd(rows);
}

export async function getQuestionsForSession(
	sessionId: number,
): Promise<DynamicQuestion[]> {
	return db.dynamicQuestions
		.where("sessionId")
		.equals(sessionId)
		.sortBy("generatedAt");
}
