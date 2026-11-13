import { LiveNotifications } from "@/components/manager/live-operations";
import { apiEnabled } from "@/lib/api/client";
export default function NotificationsPage() {
  return apiEnabled ? (
    <LiveNotifications advisor />
  ) : (
    <p>Không có thông báo.</p>
  );
}
