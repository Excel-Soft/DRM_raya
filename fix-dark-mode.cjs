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

  // We want to replace ANY 'bg-white' without a dark mode equivalent to 'bg-white dark:bg-zinc-900'
  content = content.replace(/className=(['"])(.*?)\1/g, (match, quote, className) => {
    let classes = className.split(' ').filter(c => c !== '');
    
    const lightBg = classes.find(c => ['bg-white', 'bg-[#f8fafc]', 'bg-[#f8f9fa]', 'bg-slate-50', 'bg-gray-50', 'bg-[#f4f7f6]', 'bg-[#f1f5f9]', 'bg-[#f2f2f2]', 'bg-[#e4fcde]', 'bg-[#f1f3f5]'].includes(c));
    
    // Remove existing dark:bg-* to override them with zinc
    classes = classes.filter(c => !c.startsWith('dark:bg-'));
    
    if (lightBg) {
      if (classes.includes('min-h-screen') || classes.includes('min-h-[calc(100vh-60px)]')) {
        classes.push('dark:bg-zinc-950');
      } else {
        if (['bg-[#f1f5f9]', 'bg-[#f2f2f2]', 'bg-[#e4fcde]', 'bg-[#f1f3f5]'].includes(lightBg)) {
            classes.push('dark:bg-zinc-800'); // slightly lighter for headers
        } else {
            classes.push('dark:bg-zinc-900');
        }
      }
    }

    // Fix hovers
    const lightHover = classes.find(c => ['hover:bg-slate-50', 'hover:bg-gray-50', 'hover:bg-[#f1f5f9]'].includes(c));
    classes = classes.filter(c => !c.startsWith('dark:hover:bg-'));
    if (lightHover) {
       classes.push('dark:hover:bg-zinc-800');
    }

    // Fix text colors from slate to zinc or pure white/gray
    classes = classes.filter(c => !c.startsWith('dark:text-'));
    
    if (classes.includes('text-slate-800') || classes.includes('text-gray-800') || classes.includes('text-[#1e3a5f]') || classes.includes('text-[#555]')) {
        classes.push('dark:text-zinc-100');
    } else if (classes.includes('text-slate-600') || classes.includes('text-gray-600')) {
        classes.push('dark:text-zinc-300');
    } else if (classes.includes('text-slate-500') || classes.includes('text-gray-500') || classes.includes('text-[#495057]') || classes.includes('text-[#475569]')) {
        classes.push('dark:text-zinc-400');
    }

    // Fix borders
    classes = classes.filter(c => !c.startsWith('dark:border-'));
    if (classes.some(c => c.startsWith('border-slate-') || c.startsWith('border-gray-') || c.startsWith('border-[#'))) {
        classes.push('dark:border-zinc-800');
    }

    return 'className=' + quote + classes.join(' ') + quote;
  });

  if (original !== content) {
    fs.writeFileSync(file, content, 'utf8');
    processed++;
  }
}
console.log('Fixed classes in ' + processed + ' files using Zinc palette.');
