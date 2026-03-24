"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

export default function ApiAccessPage() {
  const t = useTranslations("apiAccess");
  const [form, setForm] = useState({ name: "", email: "", company: "", use_case: "" });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");
    try {
      const resp = await fetch("/api/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(data?.detail || `Request failed (${resp.status})`);
      }
      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <main id="main-content" className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-[var(--color-surface-2)] rounded-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{t("successTitle")}</h1>
          <p className="mt-4 text-[var(--color-text-muted)]">{t("successMessage")}</p>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
      <p className="mt-4 text-sm text-[var(--color-text-muted)]">{t("description")}</p>

      <div className="mt-6 bg-[var(--color-surface-2)] rounded-lg p-6">
        <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3">{t("whatYouGet")}</h2>
        <ul className="text-sm text-[var(--color-text-muted)] space-y-2">
          <li>{t("feature1")}</li>
          <li>{t("feature2")}</li>
          <li>{t("feature3")}</li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-[var(--color-text)]">
            {t("nameLabel")}
          </label>
          <input
            id="name"
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive)]"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text)]">
            {t("emailLabel")}
          </label>
          <input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive)]"
          />
        </div>

        <div>
          <label htmlFor="company" className="block text-sm font-medium text-[var(--color-text)]">
            {t("companyLabel")}
          </label>
          <input
            id="company"
            type="text"
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive)]"
            placeholder={t("companyPlaceholder")}
          />
        </div>

        <div>
          <label htmlFor="use_case" className="block text-sm font-medium text-[var(--color-text)]">
            {t("useCaseLabel")}
          </label>
          <textarea
            id="use_case"
            required
            minLength={10}
            rows={4}
            value={form.use_case}
            onChange={(e) => setForm((f) => ({ ...f, use_case: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive)] resize-y"
            placeholder={t("useCasePlaceholder")}
          />
        </div>

        {status === "error" && errorMsg && (
          <p className="text-sm text-red-500">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full rounded-lg bg-[var(--color-interactive)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {status === "submitting" ? t("submitting") : t("submit")}
        </button>
      </form>
    </main>
  );
}
