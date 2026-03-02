import { format, formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

export function formatDate(date: string | Date): string {
  return format(new Date(date), "dd MMM yyyy, HH:mm", { locale: id });
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: id });
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + "..." : str;
}

export const testTypeLabels: Record<string, string> = {
  iq: "Uji IQ",
  concentration: "Uji Konsentrasi",
  mixed: "Tes Campuran",
};

export const difficultyLabels: Record<string, string> = {
  easy: "Mudah",
  medium: "Sedang",
  hard: "Sulit",
};

export const questionTypeLabels: Record<string, string> = {
  multiple_choice: "Pilihan Ganda",
  sequence: "Deret",
  pattern: "Pola",
  logic: "Logika",
  attention: "Perhatian",
};
