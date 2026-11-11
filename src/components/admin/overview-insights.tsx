"use client";

import { bookingTime, formatDate } from "@/lib/booking/logic";
import { bookingServices } from "@/lib/booking/seed";
import { useBookings } from "./booking-provider";

export function OverviewInsights({ date }: { date: string }) {
  const { data } = useBookings();
  const dayBookings = data.bookings.filter(
    (b) => bookingTime(b).slice(0, 10) === date,
  );
  const services = bookingServices
    .map((service) => ({
      ...service,
      count: dayBookings.filter((b) => b.serviceIds.includes(service.id))
        .length,
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
  const serviceTotal = services.reduce((sum, s) => sum + s.count, 0);
  return (
    <div className="adm-overview-insights">
      <section
        className="adm-panel adm-service-insight"
        aria-label="Dịch vụ trong ngày"
      >
        <div className="adm-section-line">
          <h2>Dịch vụ trong ngày</h2>
          <span className="adm-muted">{formatDate(date)}</span>
        </div>
        <div className="adm-service-breakdown">
          {services.length ? (
            services.slice(0, 4).map((service) => (
              <div key={service.id}>
                <span>{service.name}</span>
                <div>
                  <i
                    style={{
                      width: `${(service.count / Math.max(1, serviceTotal)) * 100}%`,
                    }}
                  />
                </div>
                <strong>{service.count}</strong>
              </div>
            ))
          ) : (
            <p className="adm-muted">Chưa có dịch vụ cho ngày này.</p>
          )}
        </div>
      </section>
    </div>
  );
}
