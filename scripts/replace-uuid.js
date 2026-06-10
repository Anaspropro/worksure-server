const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function (file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, '../src'));

let modifiedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace imports
  // Could be import { randomUUID } from 'node:crypto';
  // or import { randomUUID } from 'crypto';
  // or import { something, randomUUID } from 'crypto';
  // Since it's usually the only import from crypto:
  content = content.replace(/import\s+{\s*randomUUID\s*}\s+from\s+['"](?:node:)?crypto['"];/g, "import { v7 as uuidv7 } from 'uuid';");
  
  // Replace method calls
  content = content.replace(/randomUUID\(\)/g, "uuidv7()");

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    modifiedCount++;
    console.log(`Updated ${file}`);
  }
});

console.log(`Updated ${modifiedCount} files.`);
