export default function LockdownPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface)]">
      <div className="mx-auto max-w-md px-6 text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/10 ring-1 ring-danger/20">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-danger"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        </div>

        <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
          App Locked Down
        </h1>

        <p className="text-sm text-text-secondary mb-6">
          This application is temporarily locked. Access has been restricted by
          the administrator. The lockdown will expire automatically.
        </p>

        <a
          href="/login"
          className="inline-flex items-center gap-2 rounded-xl bg-accent/10 px-5 py-2.5 text-sm font-semibold text-accent ring-1 ring-accent/20 transition-all hover:bg-accent/20"
        >
          Admin Login
        </a>
      </div>
    </div>
  );
}
