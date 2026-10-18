/**
 * Node-side ONNX downloader for Maia3 variants.
 *
 * Resolution order in ensureModelNode():
 *   1. If the variant is bundled and `<packageDir>/models/<file>` exists, use it.
 *   2. If `<modelDir>/<file>` exists, use it.
 *   3. Otherwise download from VARIANTS[variant].url to `<modelDir>/<file>`.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as https from "node:https";
import { fileURLToPath } from "node:url";
import { getVariant, VARIANTS } from "./variants.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Bundled models live in `<package>/models`. The compiled JS sits in `<package>/dist`. */
export const PACKAGE_MODELS_DIR = path.resolve(__dirname, "..", "models");
export const DEFAULT_MODEL_DIR = PACKAGE_MODELS_DIR;
function downloadFile(url, destPath, label) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        let cleaned = false;
        const cleanup = (err) => {
            if (cleaned)
                return;
            cleaned = true;
            file.close();
            try {
                fs.unlinkSync(destPath);
            }
            catch {
                /* ignore */
            }
            reject(err);
        };
        const request = (u) => {
            https
                .get(u, (response) => {
                if (response.statusCode &&
                    response.statusCode >= 300 &&
                    response.statusCode < 400 &&
                    response.headers.location) {
                    request(response.headers.location);
                    return;
                }
                if (response.statusCode !== 200) {
                    cleanup(new Error(`Download failed (${label}): HTTP ${response.statusCode}`));
                    return;
                }
                const total = parseInt(response.headers["content-length"] || "0", 10);
                let received = 0;
                response.on("data", (chunk) => {
                    received += chunk.length;
                    if (total > 0 && process.stdout.isTTY) {
                        const pct = ((received / total) * 100).toFixed(1);
                        process.stdout.write(`\r[maia3-js] downloading ${label}: ${pct}%`);
                    }
                });
                response.pipe(file);
                file.on("finish", () => {
                    file.close();
                    if (process.stdout.isTTY)
                        process.stdout.write("\n");
                    resolve();
                });
                file.on("error", cleanup);
            })
                .on("error", cleanup);
        };
        request(url);
    });
}
/**
 * Resolve the local path to the ONNX file for a variant, downloading it if
 * necessary. Returns the absolute file path on disk.
 */
export async function ensureModelNode(opts) {
    const info = getVariant(opts.variant);
    // 1. Check bundled location first.
    const bundledPath = path.join(PACKAGE_MODELS_DIR, info.onnxFile);
    if (fs.existsSync(bundledPath))
        return bundledPath;
    // 2. Check the cache dir.
    const cacheDir = opts.modelDir ?? DEFAULT_MODEL_DIR;
    const cachedPath = path.join(cacheDir, info.onnxFile);
    if (fs.existsSync(cachedPath))
        return cachedPath;
    // 3. Download.
    if (!fs.existsSync(cacheDir))
        fs.mkdirSync(cacheDir, { recursive: true });
    console.log(`[maia3-js] ${info.name} not cached; downloading from ${info.url}`);
    await downloadFile(info.url, cachedPath, info.name);
    return cachedPath;
}
export { VARIANTS };
//# sourceMappingURL=download.node.js.map