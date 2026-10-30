// Wrangler bundles .sql imports as text by default; esbuild needs loader: { '.sql': 'text' }.
declare module '*.sql' {
  const sql: string;
  export default sql;
}
