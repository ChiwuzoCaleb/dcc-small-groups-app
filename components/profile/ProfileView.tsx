"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, Card, PageHeader, TextInput } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HierarchyList, type Hierarchy } from "@/components/profile/HierarchyList";
import { useAuth } from "@/hooks/useAuth";
import { useChangePassword } from "@/hooks/api/auth";
import { useMyReportsPage } from "@/hooks/api/reports";
import { CAPABILITIES, isRoleName } from "@/lib/auth/roles";
import type { ReportCell, ReportOrgUnit, ReportUser, SundayReport } from "@/lib/api/types";
import { ApiError } from "@/lib/api/errors";
import { notify } from "@/lib/toast";
import { colors } from "@/lib/tokens";

const LEVELS = ["section", "area", "zone", "district", "region"] as const;

function asUnit(value: unknown): ReportOrgUnit | null {
  return value && typeof value === "object" && "id" in value ? (value as ReportOrgUnit) : null;
}

const text = (v: unknown) => (typeof v === "string" && v ? v : null);

function humanize(value?: string | null): string | null {
  if (!value) return null;
  const s = value.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The signed-in user's own record inside a `reports/mine/` row: the cell leader, or a matching hierarchy leader. */
function findSelf(report: SundayReport | undefined, userId: string | null): ReportUser | null {
  if (!report) return null;
  const cell = typeof report.cell === "object" ? report.cell : null;
  const candidates = [cell?.leader, ...LEVELS.map((l) => asUnit(report[l])?.leader)].filter(Boolean) as ReportUser[];
  if (userId) return candidates.find((u) => u.id === userId) ?? null;
  return cell?.leader ?? null;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{value || "—"}</dd>
    </div>
  );
}

/** Account details and hierarchy, populated from the latest `reports/mine/` row. */
export function ProfileView({ eyebrow }: { eyebrow: string }) {
  const router = useRouter();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const changePassword = useChangePassword();
  const { user, logout } = useAuth();
  const record = user as Record<string, unknown> | null;
  const userId = text(record?.id);
  const query = useMyReportsPage(1);
  const latest = query.data?.results?.[0];

  const self = findSelf(latest, userId);
  const cell: ReportCell | null = latest && typeof latest.cell === "object" ? latest.cell : null;

  const hierarchy: Hierarchy = {};
  for (const level of LEVELS) hierarchy[level] = asUnit(latest?.[level]) ?? asUnit(record?.[level]);

  const pick = (key: keyof ReportUser) => text(self?.[key]) ?? text(record?.[key]);
  const name =
    [self?.first_name, self?.last_name].filter(Boolean).join(" ") ||
    [record?.first_name, record?.last_name].filter((v) => typeof v === "string" && v).join(" ");
  const role = pick("role");
  const isCellLeader = role === "CELL_LEADER";

  async function submitPasswordChange() {
    setPasswordError(null);
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError("Complete all password fields.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    try {
      await changePassword.mutateAsync({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? (err.fieldError("old_password") ??
            err.fieldError("new_password") ??
            err.fieldError("confirm_password") ??
            err.message)
          : "Could not change your password. Please try again.";
      setPasswordError(message);
      notify.error(message);
      return;
    }

    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordDialogOpen(false);
    notify.success("Password changed. Sign in again with your new password.");
    try {
      await logout();
    } catch (err) {
      notify.error(err, "Your password changed, but sign-out could not be completed cleanly.");
    } finally {
      router.replace("/sign-in");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title="Profile"
        sub="Your account and where you sit in the hierarchy"
        right={
          <Button
            variant="primary"
            padding="10px 14px"
            fontSize={13}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              minHeight: 44,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
            onClick={() => {
              setPasswordError(null);
              setPasswordDialogOpen(true);
            }}
          >
            <KeyRound size={16} aria-hidden="true" />
            Change password
          </Button>
        }
      />
      <div className="dcc-page" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18, maxWidth: 800 }}>
        {query.isError && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            Could not load your details: {query.error.message}
          </p>
        )}
        <Card style={{ padding: 20 }}>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <Field label="Name" value={name} />
            <Field label="Role" value={isRoleName(role) ? CAPABILITIES[role].label : humanize(role)} />
            <Field label="Email" value={pick("email")} />
            <Field label="Phone" value={pick("phone_number")} />
            <Field label="Code" value={pick("code")} />
            <Field label="Status" value={humanize(pick("status"))} />
          </dl>
        </Card>
        {isCellLeader && cell && (
          <Card style={{ padding: 20 }}>
            <h3 className="mb-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Cell</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Field label="Name" value={cell.name} />
              <Field label="Code" value={cell.code} />
              <Field label="Type" value={humanize(cell.cell_type)} />
              <div className="col-span-2 min-w-0 sm:col-span-3">
                <Field label="Address" value={cell.address} />
              </div>
            </dl>
          </Card>
        )}
        <Card style={{ padding: 20 }}>
          <h3 className="mb-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Hierarchy</h3>
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <HierarchyList hierarchy={hierarchy} />
          )}
        </Card>
      </div>
      <Dialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          if (changePassword.isPending) return;
          setPasswordDialogOpen(open);
          if (!open) {
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setPasswordError(null);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl p-5 sm:max-w-md sm:p-6">
          <DialogHeader className="pr-8">
            <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-red-50 text-red-700">
              <KeyRound size={20} aria-hidden="true" />
            </div>
            <DialogTitle className="text-xl tracking-tight">Change password</DialogTitle>
            <DialogDescription className="leading-relaxed">
              Verify your current password, then choose a new one for your account.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!changePassword.isPending) void submitPasswordChange();
            }}
            className="flex flex-col gap-4"
          >
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Current password</span>
              <TextInput
                value={oldPassword}
                onChange={(value) => {
                  setOldPassword(value);
                  setPasswordError(null);
                }}
                type="password"
                autoComplete="current-password"
                fontSize={16}
                placeholder="Enter current password"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">New password</span>
              <TextInput
                value={newPassword}
                onChange={(value) => {
                  setNewPassword(value);
                  setPasswordError(null);
                }}
                type="password"
                autoComplete="new-password"
                fontSize={16}
                placeholder="At least 8 characters"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Confirm new password</span>
              <TextInput
                value={confirmPassword}
                onChange={(value) => {
                  setConfirmPassword(value);
                  setPasswordError(null);
                }}
                type="password"
                autoComplete="new-password"
                fontSize={16}
                placeholder="Re-enter new password"
              />
            </label>
            {passwordError && (
              <p role="alert" className="text-sm" style={{ color: colors.red }}>
                {passwordError}
              </p>
            )}
            <div className="grid grid-cols-1 pt-1 sm:flex sm:justify-end">
              <Button
                variant="primary"
                fullWidth
                padding="13px 20px"
                style={{ minHeight: 48 }}
                disabled={changePassword.isPending}
              >
                {changePassword.isPending ? "Updating…" : "Update password"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
