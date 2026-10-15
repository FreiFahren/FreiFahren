// Bundled as text by the Text rule in wrangler.jsonc.
declare module '*.md' {
    const content: string
    export default content
}
