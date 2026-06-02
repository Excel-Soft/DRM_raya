const fs = require('fs');

function check() {
  const content = fs.readFileSync('shared/schema.ts', 'utf8');
  const index = content.indexOf('export const targetSystemUserTargets');
  if (index !== -1) {
    const end = content.indexOf(';', index);
    console.log(content.substring(index, end + 1));
  } else {
    console.log("Not found.");
  }
}
check();
