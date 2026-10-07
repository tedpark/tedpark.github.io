export const original: string;
export function protect(text: string): { masked: string; blocks: string[] };
export function review(source: string, candidate: string): { accepted: boolean; checks: { name: string; passed: boolean }[]; output: string };
export const scenarios: { id: string; label: string; expected: boolean; candidate: string; lesson: string }[];
