import { chatbotsTest } from "./chatbots";
import { alienAiTest } from "./alien-ai";
import { voiceTest } from "./voice";
import type { TestCase } from "./types";

export const TEST_CASES: TestCase[] = [chatbotsTest, alienAiTest, voiceTest];

export type { TestCase };
