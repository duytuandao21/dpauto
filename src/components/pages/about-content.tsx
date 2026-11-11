import { about, site } from "@/lib/content";
import { Photo } from "@/components/ui/photo";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  AboutGalleryImage,
  AboutReveal,
  AboutTeamImage,
  AboutVideo,
} from "./about-motion";

export function AboutContent() {
  const b = about.blocks;
  return (
    <>
      <section className="light about-story">
        <div className="container">
          <div className="story-heading">
            <Photo
              {...about.images[2]}
              unoptimized
              className="story-floating-image story-floating-image--one"
            />
            <Photo
              {...about.images[3]}
              unoptimized
              className="story-floating-image story-floating-image--two"
            />
            <p className="story-label">OUR STORY</p>
            <div className="story-title">
              <h2>{b[1].text}</h2>
            </div>
          </div>
          <div className="story-support">
            <AboutVideo src={about.video[0].src} />
            <div className="story-copy">
              <p className="story-lead">
                <span>
                  Every vehicle comes to us in a different condition.{" "}
                </span>
                {b[2].text.slice(
                  "Every vehicle comes to us in a different condition. ".length,
                )}
              </p>
              <Photo
                {...about.images[4]}
                unoptimized
                className="story-center-image"
              />
              <p className="story-description">{b[3].text}</p>
            </div>
          </div>
        </div>
      </section>
      <section className="about-approach">
        <div className="container">
          <h2>
            Our Approach,
            <br />
            Care in Every Step
          </h2>
          <div className="approach-grid">
            {about.approach.map((item, i) => (
              <AboutReveal key={item.title} className="approach-card">
                <span className="approach-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="approach-copy">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </AboutReveal>
            ))}
          </div>
        </div>
      </section>
      <section className="light about-workshop">
        <div className="container">
          <div className="about-workshop-heading">
            <h2>Built for Professional Car Care</h2>
            <p>
              {b.find((e) => e.text.startsWith("Our workshop is set up"))?.text}
            </p>
          </div>
          <div className="workshop-panel">
            <Photo {...about.images[5]} unoptimized sizes="100vw" />
            <div className="workshop-grid">
              {about.workshop.map((item, i) => (
                <AboutReveal
                  key={item.title}
                  className="workshop-card"
                  delay={i * 0.2}
                >
                  <span className="workshop-check">
                    <Icon name="check" />
                  </span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                </AboutReveal>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="about-team">
        <div className="container team-layout">
          <div className="about-team-copy">
            <h2>People Who Care About the Work</h2>
            <p className="about-team-lead">
              {b.find((e) => e.text.startsWith("Good detailing depends"))?.text}
            </p>
            <p>{b.find((e) => e.text.startsWith("The work stays"))?.text}</p>
          </div>
          <AboutGalleryImage image={about.images[6]} />
        </div>
      </section>
      <AboutTeamImage image={about.images[7]} />
      <section className="light about-training">
        <div className="container">
          <AboutGalleryImage image={about.images[8]} />
          <div className="about-training-copy">
            <h2>
              Professional Detailing Training, Built on Real Workshop Experience
            </h2>
            <p>
              {b.find((e) => e.text.startsWith("Detailing techniques"))?.text}
            </p>
            <p>{b.find((e) => e.text.startsWith("From preparation"))?.text}</p>
            <Button href={site.phoneHref}>Ask About Training</Button>
          </div>
        </div>
      </section>
    </>
  );
}
