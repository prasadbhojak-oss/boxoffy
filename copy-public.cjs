const fs = require('fs');
const path = require('path');

const publicDir = 'public';
const distDir = 'dist';

fs.readdirSync(publicDir).forEach(f => {
  const src = path.join(publicDir, f);
  const dest = path.join(distDir, f);
  if (fs.statSync(src).isFile()) {
    fs.copyFileSync(src, dest);
    console.log('Copied:', f);
  }
});