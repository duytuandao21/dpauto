import { AdvisorNotifications } from "@/components/advisor/notifications";
import { apiEnabled } from "@/lib/api/client";
import { EmptyState, PageHeading } from "@/components/admin/primitives";
export default function NotificationsPage() {
  return apiEnabled ? (
    <AdvisorNotifications />
  ) : (
    <div className="adv-stack">
      <PageHeading
        title="Thông báo"
        description="Cập nhật lịch hẹn và công việc cần xử lý."
      />
      <section className="adm-panel">
        <EmptyState
          title="Bạn chưa có thông báo"
          description="Thông báo mới sẽ xuất hiện tại đây."
          create={false}
        />
      </section>
    </div>
  );
}
