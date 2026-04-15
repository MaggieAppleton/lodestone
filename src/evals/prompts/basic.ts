import { LABEL_CONFIGS } from "../../types/labels";
import type { PromptTemplate } from "./types";

export const basicPrompt: PromptTemplate = {
	id: "basic",
	name: "Basic Prompt",
	template: `Analyse the following text and identify its key components. For each component, assign one of these label types:

${LABEL_CONFIGS.map((l) => `- ${l.name}: ${l.description}`).join("\n")}

Also identify any relationships between the components (e.g., how evidence supports claims, or how claims lead to implications).

Return your analysis in this JSON format:
{
    "highlights": [
        {
            "id": "1",
            "labelType": "claim",
            "text": "exact text from the passage"
        }
    ],
    "relationships": [
        {
            "sourceHighlightId": "1",
            "targetHighlightId": "2"
        }
    ]
}

Text to analyse:
{{text}}`,
};
