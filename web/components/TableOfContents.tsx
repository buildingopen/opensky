"use client";

import { useState, useEffect } from "react";

interface TocItem {
  id: string;
  label: string;
}

export function TableOfContents({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id || "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );

    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className="hidden lg:block">
      <div className="sticky top-8">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
          On this page
        </p>
        <ul className="space-y-1 border-s border-[var(--color-border)]">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`block text-xs ps-3 py-1 -ms-px border-s-2 transition-colors ${
                  activeId === item.id
                    ? "border-[var(--color-interactive)] text-[var(--color-text)]"
                    : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border)]"
                }`}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
