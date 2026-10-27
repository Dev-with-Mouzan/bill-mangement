export type ViewName = "overview" | "single" | "batch" | "manual" | "records" | "settings";
export type Filters = { search?: string; from?: string; to?: string };
export type NoticeType = "success" | "error" | "info";
export type ConfirmOptions = { title: string; description: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void | Promise<void> };
export type SaveResult = {
  saved: Array<{ clientId: string; reference: string; id: string; alreadySaved?: boolean }>;
  failed: Array<{ clientId: string; reference: string; error: string }>;
};
export type SavePayments = (records: Array<Record<string, unknown>>) => Promise<SaveResult>;
