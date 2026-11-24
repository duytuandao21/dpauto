import { permanentRedirect } from "next/navigation";

// The service list moved to /dich-vu; keep old links and search results working.
export default function OldServicesPage() {
  permanentRedirect("/dich-vu");
}
