import { site } from "@/lib/content";
import { Hours } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Reveal } from "@/components/motion/reveal";

export function LocationSection({
  vietnamese = false,
}: {
  vietnamese?: boolean;
}) {
  if (vietnamese) return <HomeLocation />;
  return (
    <section className="section light location-section">
      <div className="container">
        <Reveal>
          <h2>
            {vietnamese ? "Ghé thăm HyperAuto Care" : "Visit HyperAuto Care"}
          </h2>
        </Reveal>
        <div className="location-grid">
          <Reveal className="location-map">
            <iframe
              src={site.mapEmbed}
              title={
                vietnamese
                  ? "Vị trí HyperAuto Care trên Google Maps"
                  : "HyperAuto Care location on Google Maps"
              }
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </Reveal>
          <Reveal className="location-information">
            <div>
              <h3>
                <Icon name="pin" />
                {vietnamese ? "Địa chỉ" : "Address"}
              </h3>
              <p className="location-address">
                <span>{site.address}</span>
                <br />
                <span>
                  {site.city}, {vietnamese ? "Hoa Kỳ" : "United States"}
                </span>
              </p>
              <Button href={site.directions} variant="secondary" arrow>
                {vietnamese ? "Chỉ đường" : "Get Directions"}
              </Button>
            </div>
            <div>
              <h3>
                <Icon name="phone" />
                {vietnamese ? "Điện thoại" : "Phone"}
              </h3>
              <a href={site.phoneHref}>{site.phone}</a>
            </div>
            <div>
              <h3>
                <Icon name="clock" />
                {vietnamese ? "Giờ mở cửa" : "Opening Hours"}
              </h3>
              <Hours vietnamese={vietnamese} />
            </div>
            <div>
              <h3>
                <Icon name="mail" />
                Email
              </h3>
              <a href={`mailto:${site.email}`}>{site.email}</a>
            </div>
            <p className="location-note">
              {vietnamese
                ? "Gara nghỉ vào các ngày lễ lớn. Bạn vui lòng gọi trước để xác nhận giờ mở cửa."
                : "We are closed on major holidays. If you plan to visit during a holiday, please contact us first to confirm our hours."}
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function HomeLocation() {
  return (
    <section className="section light location-section home-location">
      <div className="container location-layout">
        <div className="location-information">
          <h2>Ghé thăm HyperAuto Care</h2>
          <div className="business-grid">
            <div className="business-card business-address">
              <h3>
                <Icon name="pin" />
                Địa chỉ
              </h3>
              <div>
                <p>{site.address}</p>
                <p>{site.city}, Hoa Kỳ</p>
              </div>
              <Button
                href={site.directions}
                variant="light"
                className="directions-button"
              >
                Chỉ đường
              </Button>
            </div>
            <div className="business-card business-phone">
              <h3>
                <Icon name="phone" />
                Điện thoại
              </h3>
              <a href={site.phoneHref}>{site.phone}</a>
            </div>
            <div className="business-card business-hours">
              <h3>
                <Icon name="clock" />
                Giờ mở cửa
              </h3>
              <Hours vietnamese />
            </div>
            <div className="business-card business-email">
              <h3>
                <Icon name="mail" />
                Email
              </h3>
              <a href={`mailto:${site.email}`}>{site.email}</a>
            </div>
          </div>
          <p className="location-note">
            Gara nghỉ vào các ngày lễ lớn. Bạn vui lòng gọi trước để xác nhận
            giờ mở cửa.
          </p>
        </div>
        <div className="location-map">
          <iframe
            src={site.mapEmbed}
            title="Vị trí HyperAuto Care trên Google Maps"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}
