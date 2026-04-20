# hono-history-api-fallback

[Hono](https://hono.dev/) middleware modeled after [connect-history-api-fallback](https://github.com/bripkens/connect-history-api-fallback): serve your SPA shell (`index.html`) for navigation requests so client-side routers work with HTML5 History API.

## Requirements

- Node.js with `fs` / `path` (typical Node or compatible runtimes)
- `hono` **^4** (peer dependency)

## Install

```sh
npm install hono-history-api-fallback hono
```

```sh
pnpm add hono-history-api-fallback hono
```

## Usage

Place the middleware **after** APIs and static asset routes so JSON and real files are not rewritten to HTML.

```ts
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { historyApiFallback } from "hono-history-api-fallback";

const app = new Hono();

app.get("/api/health", (c) => c.json({ ok: true }));

app.use(
  "/*",
  serveStatic({
    root: "./public",
  }),
);

app.use(
  "/*",
  historyApiFallback({
    root: "./public",
    index: "/index.html",
  }),
);
```

## Options

| Option | Type | Description |
|--------|------|-------------|
| `root` | `string` | **Required.** Directory containing static files (used to read `index` and rewrite targets). |
| `index` | `string` | Default `/index.html`. Path (under `root`) to serve for eligible requests. |
| `rewrites` | `array` | Extra `{ from: RegExp, to: string \| function }` rules merged with built-ins (includes GitLab-style `/-/` paths). |
| `htmlAcceptHeaders` | `string[]` | Substrings matched against `Accept`; defaults allow `text/html` and `*/*`. |
| `disableDotRule` | `boolean` | When `false` (default), paths whose last segment contains `.` are not rewritten (treated as file-like). |
| `verbose` | `boolean` | Log rewrite decisions via `console.log`. |
| `logger` | `function` | Custom logger; overrides `verbose` logging when set. |

Only `GET` and `HEAD` with an HTML-capable `Accept` (and not preferring JSON) are rewritten. Behavior follows the same intent as `connect-history-api-fallback`.

## Scripts

| Script | Command |
|--------|---------|
| `build` | `tsdown` — emit `dist/` |
| `dev` | `tsdown --watch` |
| `typecheck` | `tsc --noEmit` |

## License

MIT
