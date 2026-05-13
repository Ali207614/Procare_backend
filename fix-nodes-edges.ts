import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/history/history.service.ts', 'utf-8');

// I will do this manually with git merge diff instead to be safe.
