import * as fs from 'fs';
import * as path from 'path';


export function loadSQL(relativePath: string): string {
    const fullPath = path.resolve(__dirname, '../../', relativePath);
    return fs.readFileSync(fullPath, 'utf8');
}
