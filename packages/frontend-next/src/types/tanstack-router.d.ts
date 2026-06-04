import '@tanstack/react-router';

declare module '@tanstack/react-router' {
  // Adding a *required* key here flips TanStack's `staticData` from optional to
  // mandatory on every route (see `UpdatableStaticRouteOption` in router-core:
  // `{} extends StaticDataRouteOption ? optional : required`). That means every
  // route — including the root and pathless layout routes — must explicitly
  // declare whether the legal disclaimer applies, or `tsc -b` fails. Forgetting
  // a route is a compile error, not a silent omission.
  interface StaticDataRouteOption {
    /**
     * Whether the legal disclaimer must be shown when this route is the active
     * leaf. The disclaimer reads the deepest matched route's value, so layout
     * and root routes (never a leaf themselves) can safely be `false`.
     */
    legalDisclaimer: boolean;
  }
}
