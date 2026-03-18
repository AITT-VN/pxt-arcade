/**
 * Copy custom locale files from /locales to /built/packaged/locales
 * This ensures Vietnamese (and any future) translations persist across builds.
 * 
 * Usage: node scripts/copyLocales.js
 */
const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "..", "locales");
const destDir = path.join(__dirname, "..", "built", "packaged", "locales");

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

copyRecursive(srcDir, destDir);
console.log("[copy-locales] Done.");
