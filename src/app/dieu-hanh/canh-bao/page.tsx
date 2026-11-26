import { redirect } from "next/navigation";

// Alerts moved onto the overview page (GĐ3); keep old links working.
export default function AlertsPage() {
  redirect("/dieu-hanh#canh-bao");
}
