/**
 * Copy custom locale files from /locales to:
 *   - /built/packaged/locales  (packaged build, served via --pkg mode)
 *   - /built/locales           (dev server, served via `pxt serve`)
 *
 * The pxt dev server (non-packaged mode) searches in dirs[] which includes
 * "built/" but NOT "built/packaged/", so we need to copy to both destinations.
 *
 * Usage: node scripts/copyLocales.js
 */
const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "..", "locales");
const destDirs = [
    path.join(__dirname, "..", "built", "packaged", "locales"),
    path.join(__dirname, "..", "built", "locales"),
];

function copyRecursive(src, dest) {
    if (!fs.existsSync(src)) {
        console.log(`[copy-locales] Source directory not found: ${src}`);
        return;
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyRecursive(srcPath, destPath);
        } else {
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(srcPath, destPath);
            console.log(`[copy-locales] Copied ${path.relative(path.join(__dirname, ".."), srcPath)} -> ${path.relative(path.join(__dirname, ".."), destPath)}`);
        }
    }
}

for (const destDir of destDirs) {
    copyRecursive(srcDir, destDir);
}
console.log("[copy-locales] Done.");
