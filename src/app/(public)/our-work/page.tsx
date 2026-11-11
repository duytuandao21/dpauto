import type { Metadata } from "next";
import { projects } from "@/lib/content";
import { BeforeAfter } from "@/components/media/before-after";
import {
  WorkBanner,
  WorkFinalCTA,
} from "@/components/sections/our-work-motion";

export const metadata: Metadata = { title: "Our Work" };
export default function OurWorkPage() {
  return (
    <div className="our-work-page">
      <WorkBanner />
      <section className="light projects-section">
        <div className="container work-introduction">
          <h2>See the Difference</h2>
          <p>
            Explore a selection of vehicle transformations and drag each
            comparison to see the results before and after the work.
          </p>
        </div>
        <div className="container projects-list">
          {projects.map((project) => (
            <article key={project.title} className="project-card">
              <BeforeAfter
                before={project.before}
                after={project.after}
                label={project.title}
                hoverFollow
                originalImages
                className="before-after--project"
              />
              <div className="project-copy">
                <h3>{project.title}</h3>
                <dl>
                  <div>
                    <dt>VEHICLE</dt>
                    <dd>{project.vehicle}</dd>
                  </div>
                  <div>
                    <dt>DURATION</dt>
                    <dd>{project.duration}</dd>
                  </div>
                  <div>
                    <dt>SERVICES</dt>
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
