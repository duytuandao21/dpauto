import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SiteEffects } from "@/components/motion/site-effects";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SiteEffects>
      <Header />
      <main id="main-content">{children}</main>
      <Footer />
    </SiteEffects>
  );
}
