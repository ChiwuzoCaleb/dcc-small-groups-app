import { PageHeader, Card } from "@/components/ui";
import { colors } from "@/lib/tokens";

/**
 * Placeholder for screens whose data the DCC API does not expose yet
 * (follow-up assignments, cell members / attendance, resources). Replace with
 * a real screen once the corresponding endpoints ship.
 */
export function NotYetAvailable({
  title,
  blurb,
  eyebrow = "My cell",
}: {
  title: string;
  blurb: string;
  eyebrow?: string;
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} sub="Not available yet" />
      <div className="dcc-page" style={{ padding: 28, maxWidth: 640 }}>
        <Card style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Coming with a later API release</div>
          <div style={{ fontSize: 13.5, color: colors.muted, lineHeight: 1.6 }}>{blurb}</div>
        </Card>
      </div>
    </>
  );
}
