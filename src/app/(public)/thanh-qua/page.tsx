import type { Metadata } from "next";
import { publicFeed, publicMetadata } from "@/lib/public-cms";
import { siteProjects } from "@/lib/site-content";
import { BeforeAfter } from "@/components/media/before-after";
import {
  WorkBanner,
  WorkFinalCTA,
} from "@/components/sections/our-work-motion";

export const generateMetadata = (): Promise<Metadata> =>
  publicMetadata("/our-work", { title: "Thành quả" });
export default async function OurWorkPage() {
  const projects = siteProjects(await publicFeed());
  return (
    <div className="our-work-page">
      <WorkBanner pageKey="our-work" />
      <section className="light projects-section">
        <div className="container work-introduction">
          <h2>Thấy rõ sự khác biệt</h2>
          <p>
            Khám phá những chiếc xe đã được chăm sóc và kéo thanh so sánh để
            thấy rõ kết quả trước và sau khi thực hiện.
          </p>
        </div>
        <div className="container projects-list">
          {projects.map((project) => (
            <article key={project.key} className="project-card">
              <BeforeAfter
                before={project.before}
                after={project.after}
                label={project.title}
                hoverFollow
                className="before-after--project"
              />
              <div className="project-copy">
                <h3>{project.title}</h3>
                <dl>
                  <div>
                    <dt>XE</dt>
                    <dd>{project.vehicle}</dd>
                  </div>
                  <div>
                    <dt>THỜI GIAN</dt>
                    <dd>{project.duration}</dd>
                  </div>
                  <div>
                    <dt>DỊCH VỤ</dt>
                    <dd>{project.services}</dd>
                  </div>
                </dl>
                <p>{project.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <WorkFinalCTA />
    </div>
  );
}
