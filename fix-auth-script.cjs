const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(dirPath);
  });
}

const getDepth = (filePath) => {
  const rel = path.relative(path.join(__dirname, 'app'), filePath);
  const parts = rel.split(path.sep);
  return parts.length;
}

const getImportPath = (filePath) => {
  const depth = getDepth(filePath);
  // app/page.js depth is 1. Should be './server/session.js' actually it is '../server/session.js' relative to app/page.js
  // Let's use absolute path logic:
  // From app/page.js to server/session.js -> ../server/session.js
  let prefix = '';
  for(let i=0; i<depth; i++) prefix += '../';
  return prefix + 'server/session.js';
}

walk(path.join(__dirname, 'app'), (filePath) => {
  if (!filePath.endsWith('.js') && !filePath.endsWith('.jsx')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // 1. Fixing writing cookies
  if (content.includes('cookieStore.set("userId", user.id')) {
    content = content.replace(
      'cookieStore.set("userId", user.id,',
      'cookieStore.set("userId", signSession(user.id),'
    );
    // Add import
    const importPath = getImportPath(filePath);
    content = `import { signSession } from "${importPath}";\n` + content;
    changed = true;
  }

  // 2. Fixing reading cookies
  if (content.includes('cookieStore.get("userId")?.value')) {
    content = content.replace(
      /const userId = cookieStore\.get\("userId"\)\?\.value;/g,
      'const userId = verifySession(cookieStore.get("userId")?.value);'
    );
    // Add import
    const importPath = getImportPath(filePath);
    if (!content.includes('verifySession')) {
      // it was replaced but we need to ensure import exists
      content = `import { verifySession } from "${importPath}";\n` + content;
    } else if (!content.includes('import { verifySession')) {
      content = `import { verifySession } from "${importPath}";\n` + content;
    }
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
});
