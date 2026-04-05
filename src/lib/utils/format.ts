import type { Match } from "@/types/database";

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function getCourtLabel(match: Match): string {
  if (match.court_name) return match.court_name;
  if (match.court_number > 0 && match.court_number <= 7) return `Court ${match.court_number}`;
  if (match.court_number === 8) return "Centre Court";
  return "";
}

export function getStatusLabel(status: string): string {
  if (status === "pending") return "Ready";
  if (status === "in_progress") return "In Progress";
  return "Completed";
}

export function getStatusColor(status: string): string {
  if (status === "pending") return "text-blue-500";
  if (status === "in_progress") return "text-orange-500";
  return "text-green-500";
}
