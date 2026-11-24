import { createRoot } from "react-dom/client";
import { AdminShell } from "../../src/components/admin/admin-shell";
import { BookingsWorkspace } from "../../src/components/admin/bookings-workspace";
import { CustomersWorkspace } from "../../src/components/admin/customers-workspace";
import { BookingForm } from "../../src/components/admin/booking-form";
import { ServiceTicketsPage } from "../../src/components/advisor/service-tickets-page";
import { LiveVisitDetail } from "../../src/components/advisor/live-visits";
import { LiveReception } from "../../src/components/advisor/live-reception";
import { VehicleProfile } from "../../src/components/advisor/vehicle-profile";
import {
  MorePage,
  SettingsPage,
} from "../../src/components/admin/secondary-pages";
import { AdvisorNotifications } from "../../src/components/advisor/notifications";
import { AssignmentHistory } from "../../src/components/admin/assignment-history";
import { VisitAssignmentHistory } from "../../src/components/advisor/visit-assignment-history";
import {
  createSeed,
  advisors,
  bookingServices,
} from "../../src/lib/booking/seed";
import { usePathname } from "./advisor-workspace-mocks";

const state = window.advisorQa;
state.data = {
  ...createSeed(),
  advisors,
  services: bookingServices.map((s) => ({
    ...s,
    active: true,
    bookable: true,
  })),
};
state.data.services.push({
  id: "service",
  code: "BD",
  name: "Bảo dưỡng định kỳ và kiểm tra vận hành",
  active: true,
  bookable: true,
  duration: 60,
});
state.data.bookings.forEach((b: any, i: number) => {
  b.code = `LH-16112026-${String(i + 1).padStart(3, "0")}`;
});
state.data.bookings[0].serviceIds = state.data.services
  .slice(0, 5)
  .map((service: any) => service.id);
state.data.customers.forEach((customer: any) => {
  customer.phone = "+84" + customer.phone.slice(1);
});
state.data.vehicles.forEach((vehicle: any) => {
  vehicle.plate = vehicle.plate.replace(/[.-]/g, "");
});
if (state.overviewLists) {
  const booking = state.data.bookings[0];
  state.data.bookings = Array.from({ length: 9 }, (_, index) => ({
    ...booking,
    id: `priority-${index}`,
    code: `DP-PRIORITY-${index}`,
    status: "pending",
    createdAt: `2026-11-${String(index + 1).padStart(2, "0")}T01:00:00Z`,
  })).reverse();
}
state.booking = {
  ...state.data.bookings[1],
  status: "CONFIRMED",
  services: [state.data.services[0]],
  customer: state.data.customers[1],
  vehicle: state.data.vehicles[1],
};
function App() {
  const path = usePathname();
  let content;
  if (path.includes("/lich-hen/tao-moi")) content = <BookingForm />;
  else if (path.includes("/lich-hen"))
    content = <BookingsWorkspace id={path.split("/")[3]} />;
  else if (path.includes("/khach-hang"))
    content = <CustomersWorkspace id={path.split("/")[3]} />;
  else if (path.includes("/phieu-dich-vu/"))
    content = <LiveVisitDetail id="visit" />;
  else if (path.includes("/phieu-dich-vu")) content = <ServiceTicketsPage />;
  else if (path.includes("/tiep-nhan")) content = <LiveReception />;
  else if (path.includes("/tai-khoan")) content = <MorePage />;
  else if (path.includes("/tuy-chon")) content = <SettingsPage />;
  else if (path.includes("/xe")) content = <VehicleProfile id="v1" />;
  else if (path.includes("/thong-bao")) content = <AdvisorNotifications />;
  else if (path.includes("/lich-su"))
    content = (
      <>
        <AssignmentHistory />
        <VisitAssignmentHistory />
      </>
    );
  else content = <BookingsWorkspace overview />;
  return <AdminShell>{content}</AdminShell>;
}
createRoot(document.getElementById("root")!).render(<App />);
