import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, '../shared/schema.ts');
let content = fs.readFileSync(schemaPath, 'utf8');

// Add pgSchema import
if (!content.includes('pgSchema')) {
    content = content.replace(/import \{ pgTable/, 'import { pgTable, pgSchema');
}

// Add schema declaration
if (!content.includes('export const drmSchema = pgSchema("drm");')) {
    // Insert after Enums
    content = content.replace(/\/\/ Enums/, 'export const drmSchema = pgSchema("drm");\n\n// Enums');
}

// Replace pgTable with drmSchema.table
content = content.replace(/pgTable\(/g, 'drmSchema.table(');

fs.writeFileSync(schemaPath, content);
console.log('Successfully updated shared/schema.ts to use drmSchema');
