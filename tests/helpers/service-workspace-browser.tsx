import { createRoot } from "react-dom/client";
import { LiveVisitDetail } from "../../src/components/advisor/live-visits";

createRoot(document.getElementById("root")!).render(
  <LiveVisitDetail id="visit" />,
);
