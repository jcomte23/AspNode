# Vite + Tailwind en ASP.NET Core MVC (.NET 10)

Montaje de un pipeline de front dentro de un proyecto MVC monolítico. Vite
compila el CSS (con Tailwind como plugin) y el JS en un solo paso.

La idea de fondo: `Assets/` es código fuente, `wwwroot/dist/` es artefacto
generado. Lo mismo que tus `.cs` frente a `bin/`. Nunca se edita lo de la
derecha y no va al repo.

---

## Sacar Bootstrap

```bash
rm -rf wwwroot/lib/bootstrap
```

Quitar del `_Layout.cshtml` sus dos etiquetas:

```html
<link rel="stylesheet" href="~/lib/bootstrap/dist/css/bootstrap.min.css" />
<script src="~/lib/bootstrap/dist/js/bootstrap.bundle.min.js"></script>
```

Dejar `jquery` y `jquery-validation*`: la validación de cliente de MVC las
usa y no dependen de Bootstrap.

## Crear el package.json

En la raíz del proyecto web (donde está el `.csproj`):

```bash
npm init -y
```

Agregarle `"type": "module"` al nivel de arriba, hermano de `"name"`.

**Ojo:** que no quede duplicado. Si npm ya puso una `"type": "commonjs"` más
abajo, borrarla. En JSON gana la última, y con `commonjs` el `vite.config.js`
se carga con `require` y revienta con *"tailwindcss is not a function"*.

## Instalar

```bash
npm i -D vite tailwindcss @tailwindcss/vite
```

## Crear la carpeta de fuentes

```bash
mkdir -p Assets/styles
```

`Assets/main.js` — punto de entrada de todo el front:

```js
import "./styles/app.css";
```

`Assets/styles/app.css`:

```css
@import "tailwindcss" source(none);

@source "../../Views";
/* @source "../../Areas";  activar solo si se crea la carpeta */
```

`source(none)` apaga la autodetección de archivos de Tailwind y deja que
valgan solo los `@source` declarados. Sin eso, v4 escanea por su cuenta, se
mete en `bin/` y `obj/`, y aparece un bucle infinito de recompilaciones.

## vite.config.js

En la raíz, al lado del `package.json`:

```js
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/dist/",
  plugins: [tailwindcss()],
  build: {
    outDir: "wwwroot/dist",
    emptyOutDir: false,
    rollupOptions: {
      input: "Assets/main.js",
      output: {
        entryFileNames: "[name].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});
```

- **Nombres fijos, sin hash:** `MapStaticAssets` de .NET ya hace
  fingerprinting. Dejar los dos peleando obliga a leer el `manifest.json`
  desde Razor sin necesidad.
- **`emptyOutDir: false`:** evita que borre la carpeta entera en cada rebuild
  del watch, que deja la página sin estilos por instantes.

## Los scripts

```json
"scripts": {
  "dev": "vite build --watch",
  "build": "vite build"
}
```

`vite build` ya minifica por defecto, no hace falta un script para Release.

## Enlazar en el layout

En el `<head>`:

```html
<link rel="stylesheet" href="~/dist/main.css" />
```

Antes del `</body>`:

```html
<script type="module" src="~/dist/main.js"></script>
```

Sin `asp-append-version`: `MapStaticAssets` ya hace el cache busting, y con
módulos ES el `?v=` provoca que el navegador descargue el archivo dos veces.

El `type="module"` es obligatorio. Vite genera módulos ES, no scripts
clásicos.

## Configurar el .csproj

```xml
<ItemGroup>
  <Content Remove="node_modules/**" />
  <None Remove="node_modules/**" />
  <Watch Remove="Assets/**" />
</ItemGroup>
```

```xml
<Target Name="BuildFrontend" BeforeTargets="BeforeBuild">
  <Exec Command="npm ci" Condition="!Exists('node_modules')" />
  <Exec Command="npm run build" />
</Target>
```

**`BeforeBuild`, nunca `Build`.** Los targets con `BeforeTargets="Build"`
corren después de los `DependsOnTargets` de `Build`, y ahí adentro está
`CoreBuild`, donde el SDK arma el manifiesto de static assets. El CSS
llegaría tarde y el manifiesto quedaría sin él.

El `Content Remove` no es opcional: sin eso el SDK rastrea los miles de
archivos de `node_modules` en cada build y se arrastra.

## .gitignore

```
node_modules/
wwwroot/dist/
```

Todo lo demás sí va versionado: `package.json`, `package-lock.json`,
`vite.config.js` y `Assets/` completa.

El `package-lock.json` va al repo. El `package.json` guarda rangos (`^8.3.0`),
así que dos `npm install` en fechas distintas instalan árboles distintos. El
lock congela las versiones exactas de todo el árbol, incluidas las
transitivas, y `npm ci` lo reconstruye idéntico.

## Limpiar site.css y site.js

```bash
rm wwwroot/css/site.css wwwroot/js/site.js
```

Y quitar sus dos etiquetas del layout. **No borrar** el
`@await RenderSectionAsync("Scripts", required: false)` que suele estar
pegado al `<script>` de `site.js`: esa sección es la que usan las vistas para
inyectar la validación de jQuery.

Lo que traía `site.css` eran parches para clases de Bootstrap que ya no
existen. El truco del footer pegado abajo (`margin-bottom: 60px`) se resuelve
mejor con flexbox: `<body class="flex min-h-screen flex-col">` y
`<main class="flex-1">`.

---

## El día a día

Dos terminales:

```bash
npm run dev
```

```bash
dotnet watch run
```

Para verificar que el fingerprinting está activo, ver el código fuente en el
navegador: el `href` debe salir como `/dist/main.a7f3c9.css`. Si sale tal cual
`/dist/main.css`, falta encadenar `.WithStaticAssets()` a `MapControllerRoute`
en el `Program.cs`.

## Escribir estilos propios

Van en `Assets/styles/app.css`, después del import. Si compiten con
utilidades de Tailwind sobre el mismo elemento, envolverlos:

```css
@layer components {
  .card {
    padding: 2rem;
  }
}
```

Eso los mete en la capa de componentes, que por definición pierde contra las
utilidades, así `p-4` en el HTML siempre gana.

Lo que no se toca con Tailwind (`@font-face`, `@keyframes`, estilos sobre
`body`) se deja suelto.

Los tokens de diseño van en `@theme`:

```css
@theme {
  --color-brand: #1d4ed8;
}
```

Al declarar `--color-brand`, Tailwind genera `bg-brand`, `text-brand`,
`border-brand`, etc.

## Agregar paquetes de npm

```bash
npm i alpinejs
```

Y se importa en `Assets/main.js`. Vite lo empaqueta junto con todo lo demás,
sin tocar configuración. Para TypeScript: renombrar a `main.ts` y ajustar el
`input` del `vite.config.js`.

