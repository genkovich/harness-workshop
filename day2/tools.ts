import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { saveNote, searchNotes, deleteNotes } from './notes.ts';
export function toolsForChat(chatId: string) {
  // chatId походить від Telegram/Flue, модель не може передати його аргументом.
  const tools = [
    defineTool({ name: 'saveNote', description: 'Збережи нотатку цього користувача.', input: v.object({ text: v.pipe(v.string(), v.minLength(1), v.maxLength(2000)) }),
      run: ({ data }) => ({ output: saveNote(chatId, data.text) }) }),
    defineTool({ name: 'searchNotes', description: 'Знайди власні нотатки за текстом.', input: v.object({ query: v.string() }),
      run: ({ data }) => ({ output: searchNotes(chatId, data.query) }) }),
  ];
  return tools;
}
