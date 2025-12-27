import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function serveStatic(app: Express) {
  // In production, the bundled server runs from dist/index.cjs
  // so __dirname is dist/, and public files are in dist/public/
  // We try multiple resolution strategies for robustness
  const possiblePaths = [
    path.resolve(__dirname, "public"),                    // Relative to bundled location (dist/)
    path.resolve(process.cwd(), "dist", "public"),        // Relative to cwd
    path.resolve(process.cwd(), "public"),                // Direct public folder
  ];

  let distPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, "index.html"))) {
      distPath = p;
      console.log(`[static] Serving files from: ${p}`);
      break;
    }
  }

  if (!distPath) {
    console.error(`[static] Could not find build directory. Tried: ${possiblePaths.join(", ")}`);
    console.error(`[static] Current working directory: ${process.cwd()}`);
    console.error(`[static] __dirname: ${__dirname}`);
    throw new Error(
      `Could not find the build directory, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
