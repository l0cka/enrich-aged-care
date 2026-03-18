import { PinButton } from "@/components/pin-button";
import type { MapSection } from "@/lib/types";

type ResolvedProvision = {
  instrumentSlug: string;
  segmentId: string;
  label: string;
  excerpt: string;
  annotation?: string;
  anchor: string;
};

type MapProvisionListProps = {
  sections: MapSection[];
  resolvedProvisions: Record<string, ResolvedProvision>;
};

export function MapProvisionList({ sections, resolvedProvisions }: MapProvisionListProps) {
  return (
    <div className="map-provisions">
      {sections.map((section) => (
        <section key={section.heading} className="map-provisions__section">
          <h3 className="map-provisions__heading">{section.heading}</h3>
          {section.provisions.length === 0 ? (
            <p className="muted">No provisions added to this section yet.</p>
          ) : (
            <ul className="map-provisions__list">
              {section.provisions.map((provision) => {
                const key = `${provision.instrumentSlug}:${provision.segmentId}`;
                const resolved = resolvedProvisions[key];

                return (
                  <li key={key} className="map-provision">
                    <div className="map-provision__content">
                      <a
                        className="map-provision__label"
                        href={`/${provision.instrumentSlug}#${resolved?.anchor ?? provision.segmentId}`}
                      >
                        {resolved?.label ?? provision.segmentId}
                      </a>
                      {provision.annotation ? (
                        <span className="map-provision__annotation">{provision.annotation}</span>
                      ) : null}
                      {resolved?.excerpt ? (
                        <p className="map-provision__excerpt">{resolved.excerpt}</p>
                      ) : null}
                    </div>
                    <PinButton
                      instrumentSlug={provision.instrumentSlug}
                      segmentId={provision.segmentId}
                      label={resolved?.label ?? provision.segmentId}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
