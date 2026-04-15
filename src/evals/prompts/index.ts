export { detailedPrompt } from "./detailed";
export { basicPrompt } from "./basic";
export type { PromptTemplate } from "./types";

import { detailedPrompt } from "./detailed";
import { basicPrompt } from "./basic";

export const PROMPT_TEMPLATES = [detailedPrompt, basicPrompt] as const;
