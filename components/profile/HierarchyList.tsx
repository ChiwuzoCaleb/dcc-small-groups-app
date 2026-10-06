import { CAPABILITIES, isRoleName } from "@/lib/auth/roles";
import type { ReportOrgUnit, ReportUser } from "@/lib/api/types";

function humanize(value?: string | null): string {
  if (!value) return "—";
  const s = value.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Person({ user }: { user?: ReportUser | null }) {
  if (!user) return <span className="text-muted-foreground">—</span>;
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "—";
  const role = isRoleName(user.role) ? CAPABILITIES[user.role].label : humanize(user.role);
  return (
    <div className="min-w-0 text-sm">
      <div className="font-medium">
        {name} <span className="font-normal text-muted-foreground">· {role}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        {user.email && (
          <a href={`mailto:${user.email}`} className="hover:underline">
            {user.email}
          </a>
        )}
        {user.phone_number && (
          <a href={`tel:${user.phone_number}`} className="hover:underline">
            {user.phone_number}
          </a>
        )}
      </div>
    </div>
  );
}

function OrgRow({ level, unit }: { level: string; unit?: ReportOrgUnit | null }) {
  if (!unit) return null;
  return (
    <div className="grid gap-1 rounded-lg border p-3 sm:grid-cols-[110px_1fr] sm:gap-3">
      <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{level}</div>
      <div className="min-w-0 space-y-1.5">
        <div className="text-sm font-medium">
          {unit.name ?? "—"}
          {unit.code && <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{unit.code}</span>}
        </div>
        <Person user={unit.leader} />
      </div>
    </div>
  );
}

export type Hierarchy = {
  section?: ReportOrgUnit | null;
  area?: ReportOrgUnit | null;
  zone?: ReportOrgUnit | null;
  district?: ReportOrgUnit | null;
  region?: ReportOrgUnit | null;
};

/** The Section ? Region chain with each unit's leader. */
export function HierarchyList({ hierarchy }: { hierarchy: Hierarchy }) {
  const { section, area, zone, district, region } = hierarchy;
  if (!(section || area || zone || district || region)) {
    return <p className="text-sm text-muted-foreground">Hierarchy details are not available yet.</p>;
  }
  return (
    <div className="space-y-2">
      <OrgRow level="Section" unit={section} />
      <OrgRow level="Area" unit={area} />
      <OrgRow level="Zone" unit={zone} />
      <OrgRow level="District" unit={district} />
      <OrgRow level="Region" unit={region} />
    </div>
  );
}
