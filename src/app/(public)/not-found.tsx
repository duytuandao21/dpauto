import { Photo } from "@/components/ui/photo";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export default function NotFound() {
  return (
    <section className="not-found">
      <Photo
        src="/images/W7P9NeMMaW0raSzYV5sntMR8ZXs.webp"
        alt="Technician polishing a vehicle inside a professional detailing workshop"
        priority
        sizes="100vw"
      />
      <div className="not-found-shade" />
      <div className="container">
        <p className="not-found-address">
          <Icon name="pin" />
          000 Harbor Avenue SW, Seattle, WA 98126
        </p>
        <div className="not-found-number" aria-hidden="true">
          404
        </div>
        <h1>Page Not Found</h1>
        <p>
          The page you’re looking for may have been moved, removed, or is no
          longer available.
        </p>
        <div className="button-row">
          <Button href="/" variant="secondary">
            Back to Home
          </Button>
          <Button href="/services">View Our Services</Button>
        </div>
      </div>
    </section>
  );
}
