const fs = require('fs');

function findFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const stat = fs.statSync(dir + '/' + file);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(dir + '/' + file));
    } else if (file.endsWith('.tsx')) {
      results.push(dir + '/' + file);
    }
  }
  return results;
}

const allTsx = findFiles('client/src');
let processed = 0;

for (const file of allTsx) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  content = content.replace(/className=(['"])(.*?)\1/g, (match, quote, className) => {
    let classes = className.split(' ').filter(c => c !== '');
    
    // Pattern for light backgrounds: bg-white, bg-*-50, bg-*-100, or bg-[#e*], bg-[#f*], bg-[#d*]
    const lightBgRegex = /^(bg-white|bg-(slate|gray|zinc|neutral|stone)-(50|100)|bg-\[#[efdEFD][a-fA-F0-9]{5}\])$/;
    const lightBg = classes.find(c => lightBgRegex.test(c));
    
    if (lightBg && !classes.some(c => c.startsWith('dark:bg-'))) {
      if (classes.includes('min-h-screen') || classes.includes('min-h-[calc(100vh-60px)]') || classes.includes('min-h-[100vh]')) {
        classes.push('dark:bg-zinc-950');
      } else {
        classes.push('dark:bg-zinc-900');
      }
    }

    // Pattern for light hovers
    const lightHoverRegex = /^hover:(bg-white|bg-(slate|gray|zinc)-(50|100)|bg-\[#[efdEFD][a-fA-F0-9]{5}\])$/;
    const lightHover = classes.find(c => lightHoverRegex.test(c));
    if (lightHover && !classes.some(c => c.startsWith('dark:hover:bg-'))) {
       classes.push('dark:hover:bg-zinc-800');
    }

    // Pattern for dark text (slate-600+, gray-600+, #333, #444, #555, etc)
    const darkTextRegex = /^(text-(slate|gray|zinc)-(500|600|700|800|900)|text-\[#[0-5][a-fA-F0-9]{5}\])$/;
    const darkText = classes.find(c => darkTextRegex.test(c));
    if (darkText && !classes.some(c => c.startsWith('dark:text-'))) {
       if (darkText.includes('800') || darkText.includes('900') || darkText.includes('text-[#1') || darkText.includes('text-[#2') || darkText.includes('text-[#3')) {
           classes.push('dark:text-zinc-100');
       } else {
           classes.push('dark:text-zinc-400');
       }
    }

    // Pattern for light borders
    const lightBorderRegex = /^(border-(slate|gray|zinc)-(100|200|300)|border-\[#[defDEF][a-fA-F0-9]{5}\])$/;
    const lightBorder = classes.find(c => lightBorderRegex.test(c));
    if (lightBorder && !classes.some(c => c.startsWith('dark:border-'))) {
        classes.push('dark:border-zinc-800');
    }

    return 'className=' + quote + classes.join(' ') + quote;
  });

  if (original !== content) {
    fs.writeFileSync(file, content, 'utf8');
    processed++;
  }
}
console.log('Fixed classes in ' + processed + ' files using comprehensive Regex.');
