export default function NotFound(): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="text-sm text-muted-foreground">The page you requested does not exist.</p>
        <a href="/dashboard" className="mt-2 inline-block text-primary hover:underline">Back to dashboard</a>
      </div>
    </main>
  );
}
