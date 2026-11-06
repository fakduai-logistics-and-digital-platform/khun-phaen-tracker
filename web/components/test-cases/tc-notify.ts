import { toast } from "sonner";

export type NotifyType = "success" | "error" | "info";

export function notify(message: string, type: NotifyType = "success") {
  toast[type](message);
}
