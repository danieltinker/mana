// The bundles' esbuild options, shared by tools/build.mjs and the tests that bundle the entry (test/v2/entry.test.ts).
export const JS = {
  bundle: true, format: 'esm', target: ['es2020'], minify: true, legalComments: 'none',
  jsx: 'automatic', jsxImportSource: 'preact',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
};
