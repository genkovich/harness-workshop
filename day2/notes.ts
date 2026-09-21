import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
export type Note = { id: string; chatId: string; text: string };
const file = () => process.env.NOTES_FILE || 'notes.json';
export function readNotes(): Note[] {
  return existsSync(file()) ? JSON.parse(readFileSync(file(), 'utf8')) : [];
}
export function writeNotes(notes: Note[]) {
  // Синхронне читання/запис серіалізує операції одного навчального процесу.
  const temp = file() + '.tmp';
  writeFileSync(temp, JSON.stringify(notes, null, 2)); renameSync(temp, file());
}
export function saveNote(chatId: string, text: string) {
  if (!text.trim() || text.length > 2000) throw new Error('Нотатка має містити 1-2000 символів.');
  const note = { id: randomUUID(), chatId, text }; writeNotes([...readNotes(), note]); return note;
}
export function searchNotes(chatId: string, query: string) {
  return readNotes().filter(n => n.chatId === chatId && n.text.toLowerCase().includes(query.toLowerCase()));
}
export function deleteNotes(chatId: string) {
  if (!process.env.OWNER_CHAT_ID || chatId !== process.env.OWNER_CHAT_ID) throw new Error('Видалення дозволене лише власнику.');
  const notes = readNotes(); const keep = notes.filter(n => n.chatId !== chatId);
  writeNotes(keep); return { deleted: notes.length - keep.length };
}
