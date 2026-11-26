// Worker thread for playground builds (see app/services/Playground.ts).
// Builds run here so a slow or pathological input can't stall the docs
// server's event loop; the host terminates this worker if one takes too
// long. TypeScript stays warm between builds, which keeps them ~150 ms.

import fs from "node:fs";
import crypto from "node:crypto";
import { parentPort } from "node:worker_threads";
import { compileProject, ProjectError } from "./compileProject.mjs";

const bridgeSource = fs.readFileSync(new URL("./previewBridge.js", import.meta.url), "utf8");

parentPort.on("message", async ({ id, files }) => {
    const build = crypto.randomBytes(8).toString("hex");
    try {
        const result = await compileProject(files, { bridge: bridgeSource.replace("__BUILD__", build) });
        parentPort.postMessage({ id, result: { ...result, build } });
    } catch (err) {
        const invalid = err instanceof ProjectError;
        parentPort.postMessage({
            id,
            error: invalid ? err.message : `The compiler stopped unexpectedly: ${err?.message ?? err}`,
            invalid,
        });
    }
});
