export function FullScreenPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card animate-in fade-in fixed inset-0 z-30 duration-150">
      <div className="mx-auto flex h-full w-full max-w-md flex-col">{children}</div>
    </div>
  );
}
