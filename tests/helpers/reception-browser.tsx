import { createRoot } from "react-dom/client";
import { LiveReception } from "../../src/components/advisor/live-reception";

createRoot(document.getElementById("root")!).render(
  <LiveReception
    id={
      new URLSearchParams(location.search).get("mode") === "walk-in"
        ? undefined
        : "booking"
    }
  />,
);
