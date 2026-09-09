const fs = require('fs');
const path = require('path');

const scriptsDir = path.join(__dirname);
const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(scriptsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Replace "./db" with "../db"
  if (content.includes('from "./db"')) {
    content = content.replace(/from "\.\/db"/g, 'from "../db"');
    changed = true;
  }
  if (content.includes('from "./db.js"')) {
    content = content.replace(/from "\.\/db\.js"/g, 'from "../db"');
    changed = true;
  }

  // Replace "../shared/schema" with "../../shared/schema"
  if (content.includes('from "../shared/schema"')) {
    content = content.replace(/from "\.\.\/shared\/schema"/g, 'from "../../shared/schema"');
    changed = true;
  }

  // Replace "./services/..." with "../services/..."
  if (content.includes('from "./services/')) {
    content = content.replace(/from "\.\/services\//g, 'from "../services/');
    changed = true;
  }

  // Replace "./repositories/..." with "../repositories/..."
  if (content.includes('from "./repositories/')) {
    content = content.replace(/from "\.\/repositories\//g, 'from "../repositories/');
    changed = true;
  }

  // Replace "./utils/..." with "../utils/..."
  if (content.includes('from "./utils/')) {
    content = content.replace(/from "\.\/utils\//g, 'from "../utils/');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log('Fixed', file);
  }
});
