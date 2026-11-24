import { Photo } from "@/components/ui/photo";
import { Icon } from "@/components/ui/icon";
import type { SiteImage } from "@/lib/content";
import {
  AboutGalleryImage,
  AboutReveal,
  AboutVideo,
} from "./about-motion";

type Item = { title: string; text: string };
type Block = {
  subtitle?: string;
  title?: string;
  description?: string;
  note?: string;
  image?: SiteImage;
  images: (SiteImage | undefined)[];
  video?: string;
  items: Item[];
};
/** Each block is null when hidden in the admin. */
export type AboutBlocks = {
  story: Block | null;
  approach: Block | null;
  workshop: Block | null;
  team: Block | null;
};

export function AboutContent({ story, approach, workshop, team }: AboutBlocks) {
  // The lead's first sentence is set apart, as in the original layout.
  const lead = story?.description?.match(/^(.+?[.!?])\s+([\s\S]*)$/);
  // The approach heading breaks after its first comma.
  const comma = approach?.title?.indexOf(",") ?? -1;
  return (
    <>
      {story && (
        <section className="light about-story">
          <div className="container">
            <div className="story-heading">
              {story.images[0] && (
                <Photo
                  {...story.images[0]}
                  className="story-floating-image story-floating-image--one"
                />
              )}
              {story.images[1] && (
                <Photo
                  {...story.images[1]}
                  className="story-floating-image story-floating-image--two"
                />
              )}
              {story.subtitle && <p className="story-label">{story.subtitle}</p>}
              <div className="story-title">
                <h2>{story.title}</h2>
              </div>
            </div>
            <div className="story-support">
              {story.video && <AboutVideo src={story.video} />}
              <div className="story-copy">
                {story.description && (
                  <p className="story-lead">
                    {lead ? (
                      <>
                        <span>{lead[1]} </span>
                        {lead[2]}
                      </>
                    ) : (
                      story.description
                    )}
                  </p>
                )}
                {story.images[2] && (
                  <Photo {...story.images[2]} className="story-center-image" />
                )}
                {story.note && (
                  <p className="story-description">{story.note}</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
      {approach && (
        <section className="about-approach">
          <div className="container">
            <h2>
              {comma > 0 ? (
                <>
                  {approach.title!.slice(0, comma + 1)}
                  <br />
                  {approach.title!.slice(comma + 1).trim()}
                </>
              ) : (
                approach.title
              )}
            </h2>
            <div className="approach-grid">
              {approach.items.map((item, i) => (
                <AboutReveal key={i} className="approach-card">
                  <span className="approach-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="approach-copy">
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                </AboutReveal>
              ))}
            </div>
          </div>
        </section>
      )}
      {workshop && (
        <section className="light about-workshop">
          <div className="container">
            <div className="about-workshop-heading">
              <h2>{workshop.title}</h2>
              {workshop.description && <p>{workshop.description}</p>}
            </div>
            <div className="workshop-panel">
              {workshop.image && <Photo {...workshop.image} sizes="100vw" />}
              <div className="workshop-grid">
                {workshop.items.map((item, i) => (
                  <AboutReveal
                    key={i}
                    className="workshop-card"
                    delay={i * 0.2}
                  >
                    <span className="workshop-check">
                      <Icon name="check" />
                    </span>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </div>
                  </AboutReveal>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
      {team && (
        <>
          <section className="about-team">
            <div className="container team-layout">
              <div className="about-team-copy">
                <h2>{team.title}</h2>
                {team.description && (
                  <p className="about-team-lead">{team.description}</p>
                )}
                {team.note && <p>{team.note}</p>}
              </div>
              {team.image && <AboutGalleryImage image={team.image} />}
            </div>
          </section>
          {team.images[0] && (
            // Whole team photo at its own proportions, never cropped.
            <div
              className="about-team-photo"
              style={{
                aspectRatio:
                  team.images[0].media?.width && team.images[0].media?.height
                    ? `${team.images[0].media.width} / ${team.images[0].media.height}`
                    : "16 / 9",
              }}
            >
              <Photo {...team.images[0]} sizes="100vw" />
            </div>
          )}
        </>
      )}
    </>
  );
}
