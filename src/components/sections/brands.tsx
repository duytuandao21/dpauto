import Image from "next/image";
import { HomeAppear } from "./home-motion";

const brands = [
  { name: "70mai", file: "70mai", width: 447, height: 447 },
  { name: "HELIOZ", file: "helioz", width: 565, height: 353 },
  { name: "ICAR", file: "icar", width: 1094, height: 658 },
  { name: "VINCAR", file: "vincar", width: 225, height: 225 },
  { name: "WOLVER", file: "wolver", width: 1181, height: 295 },
  { name: "YueMi", file: "yuemi", width: 800, height: 200 },
  { name: "Zestech", file: "zestech", width: 800, height: 228 },
];

export function BrandsSection() {
  return (
    <section
      className="section brands-section"
      id="brands"
      aria-labelledby="brands-heading"
    >
      <div className="container">
        <div className="section-heading">
          <h2 id="brands-heading">Thương hiệu được lựa chọn</h2>
          <p>
            Những thương hiệu được DPAuto lựa chọn cho các hạng mục chăm sóc và
            nâng cấp xe.
          </p>
        </div>
        <ul className="brands-grid" aria-label="Các thương hiệu được lựa chọn">
          {brands.map((brand, index) => (
            <li key={brand.file}>
              <HomeAppear className="brand-card" delay={(index % 4) * 0.08}>
                <div className={`brand-logo brand-logo--${brand.file}`}>
                  <Image
                    src={`/images/brands/${brand.file}.png`}
                    alt={brand.name}
                    width={brand.width}
                    height={brand.height}
                    unoptimized={brand.file !== "wolver"}
                    sizes="(max-width: 809px) 160px, 240px"
                  />
                </div>
              </HomeAppear>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
