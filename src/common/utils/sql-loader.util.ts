import * as fs from 'fs';
import * as path from 'path';

export function loadSQL(relativePath: string): string {
  const root = process.cwd(); // har doim loyihani ildizidan oladi
  const devPath = path.join(root, 'src', relativePath);
  const prodPath = path.join(root, 'dist', relativePath);
  const fullPath = fs.existsSync(devPath) ? devPath : prodPath;

  if (!fs.existsSync(fullPath)) {
    throw new Error(`❌ SQL file not found: ${fullPath}`);
  }

  return fs.readFileSync(fullPath, 'utf8');
}
