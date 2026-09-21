import type { ModelMessage, ToolSet } from 'ai';
export type Call = { id: string; name: string; arguments: unknown };
export type Reply = { text: string; calls: Call[]; messages: ModelMessage[] };
export type Event = { event: string; [key: string]: unknown };
export type Log = (event: Event) => void;
export type ModelCall = (messages: ModelMessage[], tools: ToolSet, log: Log, step: number) => Promise<Reply>;
