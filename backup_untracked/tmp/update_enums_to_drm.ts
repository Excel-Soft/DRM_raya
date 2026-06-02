import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, '../shared/schema.ts');
let content = fs.readFileSync(schemaPath, 'utf8');

// Replace pgEnum with drmSchema.enum
content = content.replace(/pgEnum\(/g, 'drmSchema.enum(');

fs.writeFileSync(schemaPath, content);
console.log('Successfully updated shared/schema.ts to use drmSchema.enum');
