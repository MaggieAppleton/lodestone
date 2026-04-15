import type { RemirrorJSON } from "remirror";
import type { XYPosition } from "reactflow";

// Session status is a simple two-state machine: draft → analysis
export type SessionStatus = "draft" | "analysis";

export interface Session {
	id?: number;
	title: string;
	createdAt: Date;
	lastModified: Date;
	status: SessionStatus;
	content: RemirrorJSON; // THE source of truth for text + highlights
	relationships: Relationship[]; // Edges between highlights
	analysisMetadata?: {
		modelName: string;
		promptId: string;
		analysedAt: Date;
	};
	graphPositions: Record<string, XYPosition>; // Node positions for graph view
}

export interface Relationship {
	sourceHighlightId: string;
	targetHighlightId: string;
}

// Derived from document marks — never stored independently
export interface Highlight {
	id: string;
	labelType: string;
	text: string;
	from: number; // ProseMirror position (start)
	to: number; // ProseMirror position (end)
	confidence?: number; // 0-1 classifier confidence score (stored in mark attrs)
}

// Result of the zero-shot classifier for a single highlight
export interface ClassifierResult {
	originalLabel: string; // What the LLM assigned
	validatedLabel: string; // What the classifier thinks it should be
	confidence: number; // 0-1 confidence for the validated label
	scores: Record<string, number>; // Confidence score for every label type
}

export interface DynamicQuestion {
	id?: number;
	sessionId: number;
	question: string;
	generatedAt: Date;
	isDefault: boolean;
}

// Raw output from the LLM (before classifier validation)
export interface LLMAnalysisResult {
	highlights: Array<{
		id: string;
		labelType: string;
		text: string; // Exact substring from source text
	}>;
	relationships: Relationship[];
}

// Final output after classifier validation
export interface ValidatedAnalysisResult {
	highlights: Array<{
		id: string;
		labelType: string; // May differ from LLM's original label
		text: string;
		confidence: number; // Classifier confidence for this label
	}>;
	relationships: Relationship[];
}
