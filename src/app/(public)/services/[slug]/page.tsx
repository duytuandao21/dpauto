import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { services } from "@/lib/content";
import { ServiceDetail } from "@/components/pages/service-detail";

export const dynamicParams = false;
export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = services.find((s) => s.slug === slug);
  return { title: service?.title, description: service?.description };
}
export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = services.find((s) => s.slug === slug);
  if (!service) notFound();
  return <ServiceDetail service={service} />;
}
