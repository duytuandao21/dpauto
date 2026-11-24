"use client";
import { site } from "@/lib/content";
import { homeDefaults } from "@/lib/home-defaults";
import { useSection, useSite } from "@/components/site/site-content";

/** Store details: CMS settings once published, otherwise the original sample values. */
function useLocation() {
  const { settings } = useSite();
  const title = useSection("home.location", homeDefaults["home.location"]);
  const loc = settings.custom
    ? {
        address: settings.address,
        city: settings.city || "",
        directions: settings.directions || site.directions,
        mapEmbed: settings.mapEmbed || site.mapEmbed,
        phone: settings.phone,
        phoneHref: settings.phoneHref,
        email: settings.email,
        country: "",
      }
    : { ...site, country: ", Hoa Kỳ" };
  return { loc, section: title };
}
import { Hours } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Reveal } from "@/components/motion/reveal";

export function LocationSection({
  vietnamese = false,
}: {
  vietnamese?: boolean;
}) {
  const { loc, section } = useLocation();
  if (!section) return null;
  if (vietnamese) return <HomeLocation />;
  return (
    <section className="section light location-section">
      <div className="container">
        <Reveal>
          <h2>{section?.title}</h2>
        </Reveal>
        <div className="location-grid">
          <Reveal className="location-map">
            <iframe
              src={loc.mapEmbed}
              title="Vị trí DPAuto trên Google Maps"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </Reveal>
          <Reveal className="location-information">
            <div>
              <h3>
                <Icon name="pin" />
                Địa chỉ
              </h3>
              <p className="location-address">
                <span>{loc.address}</span>
                <br />
                <span>
                  {loc.city}
                  {loc.country}
                </span>
              </p>
              <Button href={loc.directions} variant="secondary" arrow>
                Chỉ đường
              </Button>
            </div>
            <div>
              <h3>
                <Icon name="phone" />
                Điện thoại
              </h3>
              <a href={loc.phoneHref}>{loc.phone}</a>
            </div>
            <div>
              <h3>
                <Icon name="clock" />
                Giờ mở cửa
              </h3>
              <Hours vietnamese />
            </div>
            <div>
              <h3>
                <Icon name="mail" />
                Email
              </h3>
              <a href={`mailto:${loc.email}`}>{loc.email}</a>
            </div>
            <p className="location-note">
              Gara nghỉ vào các ngày lễ lớn. Bạn vui lòng gọi trước để xác nhận
              giờ mở cửa.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function HomeLocation() {
  const { loc, section } = useLocation();
  return (
    <section className="section light location-section home-location">
      <div className="container location-layout">
        <div className="location-information">
          <h2>{section?.title}</h2>
          <div className="business-grid">
            <div className="business-card business-address">
              <h3>
                <Icon name="pin" />
                Địa chỉ
              </h3>
              <div>
                <p>{loc.address}</p>
                <p>
                  {loc.city}
                  {loc.country}
                </p>
              </div>
              <Button
                href={loc.directions}
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
              <a href={loc.phoneHref}>{loc.phone}</a>
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
              <a href={`mailto:${loc.email}`}>{loc.email}</a>
            </div>
          </div>
          <p className="location-note">
            Gara nghỉ vào các ngày lễ lớn. Bạn vui lòng gọi trước để xác nhận
            giờ mở cửa.
          </p>
        </div>
        <div className="location-map">
          <iframe
            src={loc.mapEmbed}
            title="Vị trí DPAuto trên Google Maps"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}
