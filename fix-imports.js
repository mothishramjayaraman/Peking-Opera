import fs from 'fs';
import path from 'path';

function getDepth(filePath) {
  // Count how many directories deep we are from the root
  // root is the current working directory
  const relativePath = path.relative(process.cwd(), filePath);
  // Subtract 1 because the file itself is at the end
  const parts = relativePath.split(path.sep);
  return parts.length - 1;
}

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      const depth = getDepth(fullPath);
      let prefix = '';
      for (let i = 0; i < depth; i++) {
        prefix += '../';
      }
      if (prefix === '') prefix = './';

      // Fix @/server imports
      content = content.replace(/from "@\/server\/(.*?)"/g, `from "${prefix}server/$1"`);
      // Fix @/shared imports
      content = content.replace(/from "@\/shared\/(.*?)"/g, `from "${prefix}shared/$1"`);
      // Fix @shared imports
      content = content.replace(/from "@shared\/(.*?)"/g, `from "${prefix}shared/$1"`);

      fs.writeFileSync(fullPath, content, 'utf-8');
    }
  }
}

// Process these directories
['app', 'components', 'lib', 'hooks'].forEach(dir => {
  const p = path.join(process.cwd(), dir);
  if (fs.existsSync(p)) {
    processDirectory(p);
  }
});
console.log('Fixed imports!');
