import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const envFile = process.env.ENV_FILE || '.env.local';
const resolvedPath = path.resolve(process.cwd(), envFile);

if (fs.existsSync(resolvedPath)) {
    dotenv.config({ path: resolvedPath });
    console.log(`✅ Loaded env from ${resolvedPath}`);
} else {
    console.warn(`⚠️ ${resolvedPath} not found. Fallback to .env`);
    dotenv.config();
}
