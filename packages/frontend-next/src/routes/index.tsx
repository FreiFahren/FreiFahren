import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: HomeComponent,
})

function HomeComponent() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-semibold">frontend-next</h1>
      <p className="text-muted-foreground">
        React 19 · Vite · Tailwind · shadcn · TanStack Router & Query
      </p>
      <Button>Get started</Button>
    </main>
  )
}
