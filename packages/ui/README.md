# @freifahren/ui

FreiFahren's design system, shared by the app and the report dashboard.

- `@freifahren/ui/styles.css`: Tailwind, the IBM Plex Sans font, the theme tokens and the base layer. An app's stylesheet imports it first and adds its own rules after it. It also points Tailwind at this package's components, which Tailwind wouldn't scan otherwise.
- `@freifahren/ui/<name>`: the generic shadcn primitives, such as `@freifahren/ui/button`. Components that depend on one app's code stay in that app.
- `@freifahren/ui/cn`: the class-name helper.

## Adding a primitive

Run the shadcn CLI here, not in an app: `bunx shadcn add <name>` writes the component to `src/components/`. Current shadcn components import `cn` from the `cn` npm package and add it as a dependency; change that import to `@freifahren/ui/cn` and drop the dependency, so every primitive uses the same helper.

Inside this package, components import each other and `cn` by the package's own name, as the apps do: bundlers resolve that through the package's `exports`, and the shadcn CLI and tsc through `tsconfig.json`'s `paths`.
