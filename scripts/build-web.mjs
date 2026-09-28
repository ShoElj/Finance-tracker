// Copies the static web app into www/, the folder Capacitor bundles into the Android app.
import { cpSync, mkdirSync, rmSync } from "node:fs";

const files = ["index.html", "styles.css", "app.js", "manifest.json", "service-worker.js", "icons"];

rmSync("www", { recursive: true, force: true });
mkdirSync("www");
for (const file of files) cpSync(file, `www/${file}`, { recursive: true });
console.log("Copied web app to www/");
