import fs from 'fs';

function findConflicts(filepath) {
    if (!fs.existsSync(filepath)) return;
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split('\n');
    let inConflict = false;
    let block = [];
    lines.forEach((line, i) => {
        if (line.startsWith('<<<<<<< ')) {
            inConflict = true;
            block = [\`--- Conflict in \${filepath} around line \${i+1} ---\`, line.trim()];
        } else if (inConflict) {
            block.push(line.trim());
            if (line.startsWith('>>>>>>> ')) {
                inConflict = false;
                console.log(block.join('\n') + '\n');
            }
        }
    });
}

findConflicts('c:/WebExcelsDRM/server/services/rbac.service.ts');
findConflicts('c:/WebExcelsDRM/server/utils/role-utils.ts');
