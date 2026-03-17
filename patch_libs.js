const fs = require('fs');
const path = require('path');

const arcadeLibsDir = path.resolve(__dirname, 'libs');
const commonLibsDir = path.resolve(__dirname, '../pxt-common-packages/libs');

console.log(`Scanning ${arcadeLibsDir}...`);

if (!fs.existsSync(arcadeLibsDir)) {
    console.error('Libs dir not found!');
    process.exit(1);
}

const dirs = fs.readdirSync(arcadeLibsDir);

dirs.forEach(dir => {
    const arcadeJsonPath = path.join(arcadeLibsDir, dir, 'pxt.json');
    if (fs.existsSync(arcadeJsonPath)) {
        try {
            const arcadeContent = JSON.parse(fs.readFileSync(arcadeJsonPath, 'utf8'));

            // Check if it's a stub or has additionalFilePath
            if (arcadeContent.additionalFilePath) {
                console.log(`Processing: ${dir}`);

                // Try to find matching lib in common packages
                // We use the directory name 'dir' to find the source.
                const commonJsonPath = path.join(commonLibsDir, dir, 'pxt.json');

                if (fs.existsSync(commonJsonPath)) {
                    console.log(`  Found source at ${commonJsonPath}`);
                    const commonContent = JSON.parse(fs.readFileSync(commonJsonPath, 'utf8'));

                    // Merge: Use common content but keep the original additionalFilePath
                    const newContent = Object.assign({}, commonContent);
                    newContent.additionalFilePath = arcadeContent.additionalFilePath;
                    // Fix: Add additionalFilePaths array so PXT knows where to look for files
                    newContent.additionalFilePaths = [arcadeContent.additionalFilePath];

                    // COPY FILES to fix "missing file" errors
                    if (newContent.files) {
                        newContent.files.forEach(f => {
                            const srcFile = path.join(path.dirname(commonJsonPath), f);
                            const dstFile = path.join(path.dirname(arcadeJsonPath), f);
                            if (fs.existsSync(srcFile)) {
                                fs.copyFileSync(srcFile, dstFile);
                                console.log(`    Copied ${f}`);
                            } else {
                                console.warn(`    WARN: Source file not found: ${f}`);
                            }
                        });
                    }

                    fs.writeFileSync(arcadeJsonPath, JSON.stringify(newContent, null, 4));
                    console.log(`  Patched ${dir}`);
                } else {
                    console.log(`  WARN: No matching common package found for ${dir}`);
                }
            } else {
                // console.log(`Skipping ${dir} (already valid or not a stub)`);
            }
        } catch (e) {
            console.error(`  Error processing ${dir}:`, e.message);
        }
    }
});

console.log('Done.');
