export interface LabelConfig {
	id: string;
	name: string;
	color: string;
	description: string;
}

export const LABEL_CONFIGS: LabelConfig[] = [
	{
		id: "claim",
		name: "Claim",
		color: "#FADF18",
		description:
			"A statement or proposition that the author presents as true or worthy of consideration",
	},
	{
		id: "evidence",
		name: "Evidence",
		color: "#1BE2C9",
		description: "Facts, data, or examples used to support a claim",
	},
	{
		id: "assumption",
		name: "Assumption",
		color: "#7E4CE9",
		description:
			"An underlying belief or premise that the argument takes for granted",
	},
	{
		id: "implication",
		name: "Implication",
		color: "#83E927",
		description:
			"A logical consequence or conclusion that follows from other statements",
	},
	{
		id: "question",
		name: "Question",
		color: "#27B9E9",
		description: "An inquiry or point of uncertainty raised in the text",
	},
	{
		id: "counterargument",
		name: "Counter Argument",
		color: "#E92727",
		description:
			"A point that challenges or opposes another claim or argument",
	},
	{
		id: "cause",
		name: "Cause",
		color: "#FF8B38",
		description:
			"A factor or event that leads to or explains another outcome",
	},
];
