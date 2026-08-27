import tailwind from "bun-plugin-tailwind";

const result = await Bun.build({
  entrypoints: ["src/index.html"],
  outdir: "dist",
  target: "browser",
  env: "PUBLIC_*",
  minify: true,
  // PDFKit is imported on demand and weighs ~2.4 MB: without splitting it would
  // be inlined into the main bundle and downloaded by every visitor.
  splitting: true,
  sourcemap: "linked",
  plugins: [tailwind],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

console.log(`Built ${result.outputs.length} files to dist/`);
