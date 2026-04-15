import { useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { addQuestions } from "../db/dynamicQuestions";
import {
	DEFAULT_CONFIG,
	DEFAULT_QUESTIONS,
	generateQuestions,
} from "../services/dynamicQuestions";
import { getApiKey } from "../services/llm";

interface DynamicQuestionsPanelProps {
	sessionId: number;
	editorText: string;
	topic: string;
	maxVisible?: number;
}

export function DynamicQuestionsPanel({
	sessionId,
	editorText,
	topic,
	maxVisible = 6,
}: DynamicQuestionsPanelProps) {
	const questions = useLiveQuery(
		() =>
			db.dynamicQuestions
				.where("sessionId")
				.equals(sessionId)
				.sortBy("generatedAt"),
		[sessionId],
	);

	// All rate-limiting/debounce state lives in component refs — never in
	// module-level globals. See phase spec §3.3.
	const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastCallAt = useRef<number>(0);
	const inFlight = useRef<boolean>(false);
	// Mirror the latest questions into a ref so the debounced callback can
	// read them without adding `questions` to the effect's deps (which would
	// re-arm the timer every time we write our own results back to Dexie).
	const previousQuestionsRef = useRef<string[]>([]);
	previousQuestionsRef.current = (questions ?? []).map((q) => q.question);

	useEffect(() => {
		if (editorText.length < DEFAULT_CONFIG.minCharsBeforeGeneration) return;

		const apiKey = getApiKey("gpt-4o-mini");
		if (!apiKey) return;

		if (debounceTimer.current) clearTimeout(debounceTimer.current);
		debounceTimer.current = setTimeout(() => {
			const now = Date.now();
			if (inFlight.current) return;
			if (now - lastCallAt.current < DEFAULT_CONFIG.minTimeBetweenCalls) {
				return;
			}
			lastCallAt.current = now;
			inFlight.current = true;

			generateQuestions({
				text: editorText,
				topic,
				previousQuestions: previousQuestionsRef.current,
				apiKey,
			})
				.then((fresh) => addQuestions(sessionId, fresh))
				.catch((error) => {
					console.error("Dynamic question generation failed:", error);
				})
				.finally(() => {
					inFlight.current = false;
				});
		}, DEFAULT_CONFIG.debounceMs);

		return () => {
			if (debounceTimer.current) clearTimeout(debounceTimer.current);
		};
	}, [editorText, topic, sessionId]);

	const hasGenerated = (questions?.length ?? 0) > 0;
	const visible = hasGenerated
		? (questions ?? []).slice(-maxVisible).reverse()
		: DEFAULT_QUESTIONS.map((question, i) => ({
				id: `default-${i}`,
				question,
				isDefault: true,
			}));

	return (
		<aside className="flex h-full flex-col gap-3 border-l border-neutral-200 bg-neutral-50 px-5 py-6">
			<header className="flex items-baseline justify-between">
				<h2 className="font-serif text-sm uppercase tracking-wide text-neutral-600">
					Questions
				</h2>
				<span className="text-[10px] uppercase tracking-wider text-neutral-400">
					{hasGenerated ? "AI-generated" : "Starters"}
				</span>
			</header>
			<ul className="flex flex-col gap-3 overflow-y-auto pr-1">
				{visible.map((q) => (
					<li
						key={q.id}
						className="text-sm leading-snug text-neutral-700"
					>
						{q.question}
					</li>
				))}
			</ul>
		</aside>
	);
}
