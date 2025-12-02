const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL_WORKER + "/api/tools";

export async function getAllTools(user_id: string) {
  const res = await fetch(`${BASE_URL}?user_id=${user_id}`);
  if (!res.ok) throw new Error("Failed to fetch tools");
  return res.json();
}

export async function getTool(toolId: string, user_id: string) {
  const res = await fetch(`${BASE_URL}/${toolId}?user_id=${user_id}`);
  if (!res.ok) throw new Error("Failed to fetch tool");
  return res.json();
}

export async function createTool(user_id: string, bot_id: string, tool: any) {
  const res = await fetch(`${BASE_URL}?user_id=${user_id}&bot_id=${bot_id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tool),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to create tool");
  return res.json();
}

export async function updateTool(toolId: string, user_id: string, tool: any) {
  const res = await fetch(`${BASE_URL}/${toolId}?user_id=${user_id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tool),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to update tool");
  return res.json();
}

export async function deleteTool(toolId: string, user_id: string) {
  const res = await fetch(`${BASE_URL}/${toolId}?user_id=${user_id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id }),
  });
  if (!res.ok) throw new Error("Failed to delete tool");
  return res.json();
} 