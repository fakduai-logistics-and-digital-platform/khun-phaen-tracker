// The backend returns untyped JSON; keep Response.json() as `any` (as in the SvelteKit app)
// instead of `unknown` so call sites do not need a cast at every boundary read.
interface Response {
  json(): Promise<any>;
}
