/* Runs automatically before `npm run build` (npm's prebuild hook).
 *
 * WHY THIS FILE EXISTS
 * Vercel's Linux builder sometimes checks out node_modules/.bin/vite without
 * the executable bit, so the build died there. The fix used to live inline in
 * package.json as:
 *
 *     "build": "chmod +x ./node_modules/.bin/vite 2>/dev/null; vite build"
 *
 * chmod is a Unix command. On Windows npm runs scripts through cmd.exe, which
 * has no chmod and no /dev/null, so `npm run build` failed locally with
 * "The system cannot find the file specified" before vite was ever reached.
 *
 * Doing the same thing in Node works on both: chmodSync is a no-op on Windows
 * and is wrapped anyway, so a failure here can never block a build.
 */
const fs = require("fs");
const path = require("path");

const bin = path.join(__dirname, "node_modules", ".bin", "vite");
try {
  if (fs.existsSync(bin)) {
    fs.chmodSync(bin, 0o755);
    console.log("prebuild: ensured +x on node_modules/.bin/vite");
  } else {
    console.log("prebuild: node_modules/.bin/vite not found, nothing to do");
  }
} catch (err) {
  console.log("prebuild: skipping chmod (" + err.code + ") — harmless on Windows");
}
