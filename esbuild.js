const esbuild = require("esbuild");

esbuild.build({
  entryPoints: ["server/src/server.ts"],  // Adjust if your main entry file is different
  bundle: true,
  platform: "node",
  format: "cjs",  // Ensure CommonJS format
  outfile: "./dist/source-lsp.js",
  external: ["vscode"],  // Avoid bundling VSCode module
  sourcemap: true,  // Optional: Generates a source map for debugging
}).catch(() => process.exit(1));

console.log("Built successfully")
