"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleReset() {
    if (!confirm("Reset both counters to 0? This can't be undone.")) return;
    setPending(true);
    try {
      await fetch("/api/admin/stats/reset", { method: "POST" });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" onClick={handleReset} disabled={pending}>
      {pending ? "Resetting…" : "Reset counters"}
    </button>
  );
}
