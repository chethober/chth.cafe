// The Worker bundles .sql files as text (see the rules in wrangler.jsonc).
declare module '*.sql' {
  const sql: string;
  export default sql;
}
