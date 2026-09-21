import { defineSkill } from '@flue/runtime';
import { readFileSync } from 'node:fs';
// defineSkill дозволяє запускати bot.ts через tsx без окремого збирача Markdown.
const text = readFileSync(new URL('./skills/standup/SKILL.md', import.meta.url), 'utf8');
export const standup = defineSkill({ name: 'standup', description: 'Скласти стендап із нотаток: вчора, сьогодні, блокери.',
  instructions: text.replace(/^---[\s\S]*?---\s*/, '') });
