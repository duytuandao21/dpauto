import { homeVi as home } from "@/lib/home-vi";
import { site } from "@/lib/content";
import { Photo } from "@/components/ui/photo";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { HomeAppear, HomeScrollFrame } from "./home-motion";

export { BenefitsSection } from "./benefits-section";

function TrainingPointer() {
  return (
    <svg
      className="training-pointer"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 14c0 4.418-3.582 8-8 8" />
      <path d="M18 11v-1a2 2 0 0 0-4 0" />
      <path d="M14 10V9a2 2 0 0 0-4 0v1" />
      <path d="M10 9.5V4a2 2 0 0 0-4 0v10" />
      <path d="M18 11a2 2 0 0 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}

export function TrainingSection() {
  return (
    <section className="section light training-section" id="training">
      <div className="container">
        <div className="training-intro">
          <h2>Đào tạo nghề chăm sóc xe</h2>
          <div>
            <p>
              <TrainingPointer />
              Học trực tiếp cùng đội ngũ giàu kinh nghiệm về chăm sóc xe và bảo
              vệ sơn tại HyperAuto Care.
            </p>
            <p>
              <TrainingPointer />
              Được hướng dẫn đúng kỹ thuật, sử dụng dụng cụ chuyên nghiệp và
              thực hành theo quy trình thực tế tại xưởng.
            </p>
          </div>
        </div>
        <div className="training-image">
          <HomeScrollFrame
            className="training-photo-motion"
            from={{ y: -40, scale: 1.1 }}
          >
            <Photo
              src="/images/IgURz8uFfe3CNgAaya6hHvyqaA.png"
              alt="Giảng viên hướng dẫn học viên đánh bóng nắp ca-pô"
              unoptimized
              sizes="100vw"
            />
          </HomeScrollFrame>
        </div>
        <div className="training-programs">
          <h3 className="training-subtitle">Bạn nhận được gì sau khóa học?</h3>
          <div className="training-grid">
            {home.training.map((item, i) => (
              <HomeAppear
                key={item.title}
                delay={(i % 3) * 0.2}
                className="training-card"
              >
                <span className="training-check">
                  <Icon name="check" />
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </HomeAppear>
            ))}
            <HomeAppear
              className="training-card training-card--cta"
              delay={0.4}
            >
              <h3>Bắt đầu nghề chăm sóc xe cùng chúng tôi</h3>
              <Button href={site.phoneHref}>Tư vấn khóa học</Button>
            </HomeAppear>
          </div>
        </div>
      </div>
    </section>
  );
}
