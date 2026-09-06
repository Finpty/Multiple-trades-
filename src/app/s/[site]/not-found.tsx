export default function SiteNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Page not found</h1>
      <p className="mt-3 opacity-70">The page you are looking for does not exist or is not published.</p>
    </div>
  );
}
