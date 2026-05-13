export async function updatePostAdminNotesApi(params: {
  id: string;
  notes: string;
  kind: "post" | "exchange";
}): Promise<void> {
  const res = await fetch("/api/admin/post-notes", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "Failed to save admin notes"
    );
  }
}
