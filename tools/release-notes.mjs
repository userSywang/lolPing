import { readFileSync } from 'node:fs';

const tag = process.argv[2] ?? '';
if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error('A stable version tag is required: vX.Y.Z');
const changelog = readFileSync(process.argv.includes('--stdin') ? 0 : new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const lines = changelog.split(/\r?\n/);
const start = lines.findIndex(line => line.startsWith(`## [${tag.slice(1)}]`));
if (start < 0) throw new Error(`Missing CHANGELOG entry for ${tag}`);
let end = start + 1;
while (end < lines.length && !lines[end].startsWith('## ')) end++;
const notes = lines.slice(start + 1, end).join('\n').trim();
if (!notes) throw new Error(`Empty CHANGELOG entry for ${tag}`);
process.stdout.write(notes + '\n');
