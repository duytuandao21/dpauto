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
            <p className="story-label">CÂU CHUYỆN</p>
            <div className="story-title">
              <h2>{b[1].text}</h2>
            </div>
          </div>
          <div className="story-support">
            <AboutVideo src={about.video[0].src} />
            <div className="story-copy">
              <p className="story-lead">
                <span>
                  Mỗi chiếc xe đến với chúng tôi trong một tình trạng khác
                  nhau.{" "}
                </span>
                {b[2].text.slice(
                  "Mỗi chiếc xe đến với chúng tôi trong một tình trạng khác nhau. "
                    .length,
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
            Cách chúng tôi làm việc,
            <br />
            Tận tâm từng bước
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
            <h2>Xưởng chăm sóc xe chuyên nghiệp</h2>
            <p>
              {b.find((e) => e.text.startsWith("Xưởng của chúng tôi"))?.text}
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
            <h2>Những con người tận tâm với công việc</h2>
            <p className="about-team-lead">
              {
                b.find((e) => e.text.startsWith("Chăm sóc xe tốt phụ thuộc"))
                  ?.text
              }
            </p>
            <p>{b.find((e) => e.text.startsWith("Mọi công đoạn"))?.text}</p>
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
              Đào tạo chăm sóc xe chuyên nghiệp, dựa trên kinh nghiệm thực tế
              tại xưởng
            </h2>
            <p>{b.find((e) => e.text.startsWith("Kỹ thuật, dụng cụ"))?.text}</p>
            <p>{b.find((e) => e.text.startsWith("Từ chuẩn bị"))?.text}</p>
            <Button href={site.phoneHref}>Tìm hiểu khóa đào tạo</Button>
          </div>
        </div>
      </section>
    </>
  );
}
