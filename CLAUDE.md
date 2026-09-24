# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single ASP.NET Core MVC app (.NET 10, `src/AspNode.Web`) with a Vite + Tailwind CSS v4 front-end pipeline replacing the template's Bootstrap/site.css/site.js. The repo doubles as a tutorial: `README.md` (Spanish) documents every setup step and the reasoning behind each config choice. Keep it in sync when changing the pipeline. Commit messages and docs are in Spanish.

## Commands

Run from `src/AspNode.Web` (where the `.csproj` and `package.json` live):

```bash
npm run dev          # vite build --watch → wwwroot/dist/
dotnet watch run     # in a second terminal
```

```bash
dotnet build                         # also runs npm ci (if no node_modules) + vite build
dotnet build -p:SkipFrontend=true    # manual escape hatch only; not for CI
npm run build                        # front end only
```

There are no tests and no linter configured.

## Architecture

- **`Assets/` is source, `wwwroot/dist/` is generated** (gitignored, like `bin/`). Never edit files in `dist/`. `Assets/main.js` is the single Vite entry and imports `styles/app.css`. Add npm packages by importing them there.
- **Tailwind scanning is explicit.** `app.css` uses `@import "tailwindcss" source(none)` plus `@source "../../Views"`. Don't remove `source(none)`: auto-detection scans `bin/`/`obj/` and causes an infinite rebuild loop. If you add `Areas/` or other Razor locations, add a matching `@source` line and add them to `FrontendInput` in the csproj. Custom CSS goes after the import, in `@layer components` if it competes with utilities; design tokens go in `@theme`.
- **No hashes from Vite.** `vite.config.js` emits fixed names (`main.js`, `main.css`) because `MapStaticAssets` handles fingerprinting on publish. `emptyOutDir: false` avoids a flash of unstyled page during watch rebuilds. The layout references `~/dist/main.css` and `~/dist/main.js` without `asp-append-version`.
- **MSBuild integration** (`AspNode.Web.csproj`): the `BuildFrontend` target runs `BeforeTargets="BeforeBuild"`. It must not be `Build`, because the static-assets manifest is built in `CoreBuild` and would miss the CSS. It is incremental via `Inputs="@(FrontendInput)"` (Assets, Views `*.cshtml`, npm/vite config) and `Outputs="wwwroot/dist/main.css"`. `node_modules` is removed from `Content`/`None` for build speed, and `Assets/**` is excluded from `dotnet watch`.
- **Dev caching workaround** (`Program.cs`): in Development, `/dist` is served by `UseStaticFiles` with a `PhysicalFileProvider`, because `MapStaticAssets` uses a build-time ETag and returns stale 304s after Vite rewrites files. This middleware **must be registered before `UseRouting()`**. After routing picks the manifest endpoint, `StaticFileMiddleware` skips the request. In production, `MapStaticAssets` serves fingerprinted, immutable URLs.
- jQuery + jquery-validation(-unobtrusive) in `wwwroot/lib` are kept for MVC client validation. Keep `RenderSectionAsync("Scripts", ...)` in `_Layout.cshtml`.
- `package-lock.json` is committed. `package.json` must keep `"type": "module"` and must not also contain `"type": "commonjs"`, or loading `vite.config.js` fails with "tailwindcss is not a function".
