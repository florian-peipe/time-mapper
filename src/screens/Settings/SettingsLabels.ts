import { i18n } from "@/lib/i18n";
import type { ThemeOverride } from "@/state/uiStore";
import type { CurrentPlan } from "@/features/billing/usePro";

/**
 * Right-side label for the Restore purchases row. Reflects the in-flight
 * + post-completion state so the user knows their tap was acknowledged.
 */
export function restoreLabel(state: "idle" | "busy" | "done" | "error"): string | undefined {
  if (state === "busy") return i18n.t("settings.subscription.restore.busy");
  if (state === "done") return i18n.t("settings.subscription.restore.done");
  if (state === "error") return i18n.t("settings.subscription.restore.error");
  return undefined;
}

/**
 * Right-side detail string for the active-Pro row in Settings. Shows the
 * plan name and the next renewal / cancellation date.
 */
export function planLabel(
  plan: CurrentPlan | null,
  willRenew: boolean,
  expirationDate: string | null,
): string {
  if (plan == null) return i18n.t("settings.subscription.plan.unknown");
  const planText =
    plan === "monthly"
      ? i18n.t("settings.subscription.plan.monthly")
      : i18n.t("settings.subscription.plan.annual");
  const dateText = expirationDate ? formatShortDate(expirationDate) : "";
  if (!willRenew) {
    return i18n.t("settings.subscription.plan.cancelled", { plan: planText, date: dateText });
  }
  return i18n.t("settings.subscription.plan.renews", { plan: planText, date: dateText });
}

/**
 * Title for the plan-change row (upgrade / downgrade). Returns null when the
 * current plan is unknown so callers can hide the row entirely.
 */
export function changePlanCtaLabel(
  current: CurrentPlan | null,
  savingsPercent: number,
): string | null {
  if (current === "monthly") {
    return savingsPercent > 0
      ? i18n.t("settings.subscription.upgrade.titleWithSavings", { percent: savingsPercent })
      : i18n.t("settings.subscription.upgrade.title");
  }
  if (current === "annual") return i18n.t("settings.subscription.downgrade.title");
  return null;
}

function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Cycle order: System (null) → Light → Dark → System. */
export function nextTheme(current: ThemeOverride): ThemeOverride {
  if (current === null) return "light";
  if (current === "light") return "dark";
  return null;
}

/** Human label for the Theme row's right-side detail string. */
export function themeLabel(current: ThemeOverride): string {
  if (current === null) return i18n.t("settings.appearance.theme.system");
  if (current === "light") return i18n.t("settings.appearance.theme.light");
  return i18n.t("settings.appearance.theme.dark");
}

/**
 * Locale-cycle order: system (null) → English → German → system.
 */
export function nextLocale(current: string | null): string | null {
  if (current === null) return "en";
  if (current === "en") return "de";
  return null;
}

/**
 * Human label for the current language selection. `null` means "follow
 * system locale"; we still surface the active language so the user sees
 * what the app will actually render.
 */
export function languageLabel(override: string | null): string {
  if (override === null) return i18n.t("settings.appearance.language.system");
  if (override.startsWith("de")) return i18n.t("settings.appearance.language.de");
  return i18n.t("settings.appearance.language.en");
}

/**
 * Pick the right i18n key for the Location row detail based on live OS
 * permission state. Keeps the row honest — if the user flipped Always
 * → When in use in iOS Settings, the row immediately reflects that.
 */
export function locationDetailKeyFor(
  status: "granted" | "foreground-only" | "denied" | "undetermined",
): string {
  if (status === "granted") return "settings.tracking.location.detail";
  if (status === "foreground-only") return "settings.tracking.location.detailForeground";
  if (status === "denied") return "settings.tracking.location.detailDenied";
  return "settings.tracking.location.detailUndetermined";
}
