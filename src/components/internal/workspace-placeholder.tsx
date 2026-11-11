import Link from "next/link";
import { AdminIcon, type AdminIconName } from "@/components/admin/admin-icon";
import { PageHeading } from "@/components/admin/primitives";

export function WorkspacePlaceholder({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: AdminIconName;
}) {
  return (
    <>
      <PageHeading
        eyebrow="DPAUTO / KHÔNG GIAN NỘI BỘ"
        title={title}
        description={description}
      />
      <section className="adm-panel adm-website-intro">
        <span className="adm-feature-icon">
          <AdminIcon name={icon} />
        </span>
        <div>
          <h2>Đang chuẩn bị</h2>
          <p>Khu vực này sẽ được phát triển trong giai đoạn tiếp theo.</p>
        </div>
        <Link href="/" className="adm-btn">
          Xem website
          <AdminIcon name="arrow" />
        </Link>
      </section>
    </>
  );
}
