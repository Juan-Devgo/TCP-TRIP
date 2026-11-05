import tailwind from "bun-plugin-tailwind";

/**
 * Ahead-of-time build of the whole server: `src/index.ts` plus the SPA it
 * imports through `src/index.html`. The output is self-contained — `bun
 * index.js` from inside `dist/` needs no `node_modules`, no Tailwind plugin and
 * no bundling at runtime.
 *
 * Without this step Bun bundles the SPA lazily on the first request to an HTML
 * route, which on a 512 MB container is a ~500 MB memory spike *after* the
 * health check has already passed.
 *
 * Two quirks of Bun 1.3's full-stack manifest shape the options:
 *   - `publicPath: "/"` makes the HTML reference `/chunk-*.js`. Left relative
 *     (`./chunk-*.js`) a nested SPA path such as `/tools/ipv4` would ask for
 *     `/tools/chunk-*.js` and get the HTML fallback back.
 *   - No `splitting`: with `publicPath` the server's own chunks are imported
 *     from `/chunk-*.js` (the filesystem root) and the process fails to start.
 *     The runtime bundler did not split either, so the client is unchanged.
 * The manifest also resolves assets against the working directory, so the
 * server must be started from inside `dist/` (the Dockerfile copies it to the
 * image's WORKDIR).
 */

// PUBLIC_* values are inlined into the client now, not at runtime. A bundle
// without the Clerk key is a blank page in production, so refuse to make one.
if (!process.env.PUBLIC_CLERK_PUBLISHABLE_KEY) {
  console.error(
    "[build] PUBLIC_CLERK_PUBLISHABLE_KEY is not set — it is inlined into the client bundle at build time",
  );
  process.exit(1);
}

const result = await Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: "dist",
  target: "bun",
  env: "PUBLIC_*",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  minify: true,
  publicPath: "/",
  sourcemap: "linked",
  plugins: [tailwind],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

for (const output of result.outputs) {
  if (output.kind === "sourcemap") continue;
  const kb = (output.size / 1024).toFixed(0).padStart(6);
  console.log(`[build] ${kb} KB  ${output.kind.padEnd(11)} ${output.path.slice(output.path.lastIndexOf("/") + 1)}`);
}
console.log(`[build] ${result.outputs.length} files written to dist/ — run with: cd dist && bun index.js`);
