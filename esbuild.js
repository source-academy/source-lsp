const esbuild = require("esbuild");
const glob = require("glob");

const testFiles = glob.sync("server/src/test/*.ts");

async function build() {
  esbuild.build({
    entryPoints: ["server/src/server.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: "./dist/source-lsp.js",
    external: ["vscode"],  // Avoid bundling VSCode module
    sourcemap: true,
  });

  if (testFiles.length > 0) {
    await esbuild.build({
      entryPoints: testFiles,
      bundle: true,
      platform: "node",
      format: "cjs",
      outdir: "./dist/tests",
      external: ["vscode"],
      sourcemap: true,
    });
  } else {
    console.log("No test files found.");
  }

  console.log("Build complete.");
}

build().catch(() => process.exit(1))