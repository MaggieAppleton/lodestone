import Dexie, { type Table } from "dexie";
import type { Session, DynamicQuestion } from "../types";

export class LodestoneDB extends Dexie {
	sessions!: Table<Session>;
	dynamicQuestions!: Table<DynamicQuestion>;

	constructor() {
		super("lodestone-v2");
		this.version(1).stores({
			sessions: "++id, createdAt, status, lastModified",
			dynamicQuestions: "++id, sessionId, generatedAt",
		});
	}
}

export const db = new LodestoneDB();
