export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-border border-t-accent" />
        <p className="text-sm text-text-secondary">Loading scanner...</p>
      </div>
    </div>
  );
}
