import { LABEL_CONFIGS } from "../../types/labels";
import type { PromptTemplate } from "./types";

export const detailedPrompt: PromptTemplate = {
	id: "detailed",
	name: "Detailed Prompt with Examples",
	template: `You are an expert at analysing arguments and identifying their components. Your task is to identify key components in the text by selecting EXACT text snippets from the input.

Label Types:
${LABEL_CONFIGS.map((l) => `- ${l.name}: ${l.description}`).join("\n")}

Relationships:
- Each relationship is directional, showing how one part supports or relates to another
- For example:
  * Evidence supports Claims (evidence -> claim)
  * Claims may lead to Implications (claim -> implication)
  * Questions can challenge Claims (question -> claim)
  * Assumptions underlie Claims (assumption -> claim)
  * Causes lead to Effects/Implications (cause -> implication)
  * Counter Arguments oppose Claims (counterargument -> claim)

IMPORTANT: For each component you identify, you MUST use exact, verbatim text from the input. Do not modify, paraphrase, or extend the text in any way. Each highlight must be a continuous substring of the input text.

Here's an example:
Text: "Global warming is a serious threat. Arctic ice has decreased by 13% per decade. This suggests future sea level rises will be catastrophic. While this is concerning, we don't have exact details on how much sea level will rise."

Return your analysis in the following JSON format:
{
    "highlights": [
        {
            "id": "1",
            "labelType": "claim",
            "text": "Global warming is a serious threat"
        },
        {
            "id": "2",
            "labelType": "evidence",
            "text": "Arctic ice has decreased by 13% per decade"
        },
        {
            "id": "3",
            "labelType": "implication",
            "text": "This suggests future sea level rises will be catastrophic"
        },
        {
            "id": "4",
            "labelType": "counterargument",
            "text": "While this is concerning, we don't have exact details on how much sea level will rise."
        }
    ],
    "relationships": [
        {
            "sourceHighlightId": "2",
            "targetHighlightId": "1"
        },
        {
            "sourceHighlightId": "3",
            "targetHighlightId": "1"
        }
    ]
}

Now analyse this text:
{{text}}`,
};
