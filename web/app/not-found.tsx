import Link from "next/link";

export default function RootNotFound() {
  return (
    <>
      <style>{`body{margin:0;background:#0a0a0a}`}</style>
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 1rem",
          textAlign: "center",
          backgroundColor: "#0a0a0a",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <svg viewBox="0 0 32 32" width="40" height="40" fill="none" style={{ marginBottom: 24 }}>
          <path d="M9 27V11L15 4" stroke="#22c55e" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" />
          <path d="M19 27V11L25 4" stroke="#22c55e" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" />
          <line x1="4" y1="15" x2="26" y2="15" stroke="#22c55e" strokeWidth="2.8" strokeLinecap="square" />
        </svg>
        <h1 style={{ fontSize: "3rem", fontWeight: 700, color: "#fff", margin: "0 0 0.75rem" }}>404</h1>
        <p style={{ fontSize: "1.125rem", color: "#9ca3af", margin: "0 0 2rem" }}>Page not found</p>
        <Link
          href="/"
          style={{
            backgroundColor: "#22c55e",
            color: "#fff",
            fontWeight: 500,
            padding: "0.625rem 1.25rem",
            borderRadius: "0.5rem",
            textDecoration: "none",
          }}
        >
          Search Flights
        </Link>
      </main>
    </>
  );
}
