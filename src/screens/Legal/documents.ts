// Legal document content. Privacy + Terms are stable strings baked into the
// bundle. The Impressum requires real contact info (German § 5 TMG), which
// must not be committed — the developer provides it via a local, gitignored
// `contact.local.ts` module.
//
// Behavior:
//   1. On build, `contact.local.ts` may or may not exist.
//   2. At render time, `getLegalDocument("impressum", locale)` reads the
//      locally-overridden contact info (if any) and interpolates it into the
//      Impressum template.
//   3. If `contact.local.ts` is missing OR any {{...}} token survives after
//      interpolation, we return the `UNCONFIGURED_IMPRESSUM` variant
//      explaining the situation instead of rendering placeholders — App
//      Store review would otherwise reject the literal `{{OWNER_NAME}}`.
//
// See README.md → "User-provided values → Impressum" for instructions.

export type DocumentKey = "privacy" | "terms" | "impressum";
export type Locale = "en" | "de";

export type Block =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "p"; text: string };

export type LegalDoc = {
  title: string;
  blocks: Block[];
};

/**
 * Shape the gitignored `contact.local.ts` module is expected to export. Each
 * field MUST be a non-empty, placeholder-free string or the document is
 * treated as unconfigured.
 */
export type ImpressumContact = {
  ownerName: string;
  address: string;
  email: string;
  phone: string;
};

type ContactModule = { default?: ImpressumContact } & Partial<ImpressumContact>;

/**
 * Load the per-developer contact module if present. `require` is wrapped in
 * try/catch so a missing file — the default checkout state — simply yields
 * `null` and the doc renders the "unconfigured" variant. The lazy require is
 * intentional: we cannot hard-import a file that doesn't exist during TS
 * typecheck.
 */
function loadContact(): ImpressumContact | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./contact.local") as ContactModule;
    const candidate: Partial<ImpressumContact> = mod.default ?? mod;
    const { ownerName, address, email, phone } = candidate;
    if (!ownerName || !address || !email || !phone) return null;
    // Final paranoia: if the user copied a template that still has {{...}}
    // tokens in any field we want to fall through to the error variant.
    if (
      hasPlaceholder(ownerName) ||
      hasPlaceholder(address) ||
      hasPlaceholder(email) ||
      hasPlaceholder(phone)
    ) {
      return null;
    }
    return { ownerName, address, email, phone };
  } catch {
    return null;
  }
}

/** True if `s` contains any `{{TOKEN}}` style placeholder. */
function hasPlaceholder(s: string): boolean {
  return /\{\{[^}]+\}\}/.test(s);
}

function interpolate(s: string, contact: ImpressumContact): string {
  return s
    .replace(/\{\{OWNER_NAME\}\}/g, contact.ownerName)
    .replace(/\{\{ADDRESS\}\}/g, contact.address)
    .replace(/\{\{EMAIL\}\}/g, contact.email)
    .replace(/\{\{PHONE\}\}/g, contact.phone);
}

/**
 * Shown in place of the real Impressum when `contact.local.ts` is missing or
 * still has unfilled placeholders. Intentionally clear so a reviewer (and any
 * future dev) knows exactly what to do.
 */
export const UNCONFIGURED_IMPRESSUM: Record<Locale, LegalDoc> = {
  en: {
    title: "Impressum",
    blocks: [
      { type: "h1", text: "Impressum not yet configured" },
      {
        type: "p",
        text: "This build does not include the developer's Impressum contact details yet. The Impressum is required by German law (§ 5 TMG) for apps distributed in the EU.",
      },
      { type: "h2", text: "What to do" },
      {
        type: "p",
        text: "If you're the developer: create src/screens/Legal/contact.local.ts with your ownerName, address, email, and phone number (see README). The file is gitignored so your real address never enters version control.",
      },
      {
        type: "p",
        text: "If you're a user and see this page in a shipped build: please contact the developer — this page should have been filled in before submission.",
      },
    ],
  },
  de: {
    title: "Impressum",
    blocks: [
      { type: "h1", text: "Impressum noch nicht konfiguriert" },
      {
        type: "p",
        text: "Dieser Build enthält noch keine echten Impressum-Kontaktdaten des Entwicklers. Das Impressum ist nach § 5 TMG für in der EU vertriebene Apps vorgeschrieben.",
      },
      { type: "h2", text: "Was zu tun ist" },
      {
        type: "p",
        text: "Als Entwickler: Lege src/screens/Legal/contact.local.ts mit ownerName, address, email und phone an (siehe README). Die Datei ist per .gitignore ausgenommen, deine Kontaktdaten verlassen dein lokales Repo nicht.",
      },
      {
        type: "p",
        text: "Als Nutzer: Bitte wende dich an den Entwickler — diese Seite hätte vor der Einreichung ausgefüllt werden müssen.",
      },
    ],
  },
};

export const LEGAL_DOCS: Record<DocumentKey, Record<Locale, LegalDoc>> = {
  privacy: {
    en: {
      title: "Privacy policy",
      blocks: [
        { type: "h1", text: "Privacy policy" },
        {
          type: "p",
          text: "Time Mapper is designed to keep your data on your device. This page describes exactly what we collect, what we store, and what (if anything) we share.",
        },
        { type: "h2", text: "What we collect" },
        {
          type: "p",
          text: "Location data: when you enable 'Always location' the app uses OS-level geofencing to detect entry and exit of places you've saved. Your coordinates are never transmitted off-device — all tracking happens locally.",
        },
        {
          type: "p",
          text: "Subscriptions: when you purchase Time Mapper Pro, Apple or Google handle the transaction. We receive an anonymous entitlement token via RevenueCat — no personally-identifiable data is shared with us.",
        },
        { type: "h2", text: "What we share" },
        {
          type: "p",
          text: "Nothing, aside from an anonymous RevenueCat user id generated at first install. That id is used only to verify your Pro entitlement across installs and is never linked to your name, email, or device id.",
        },
        { type: "h2", text: "Third-party services" },
        {
          type: "p",
          text: "Address autocomplete is provided by Photon (photon.komoot.io), operated by Komoot GmbH in Potsdam, Germany. When you type an address into Add Place, the partial query is sent to Photon's servers in the EU — your GPS coordinates are NOT included. Photon's data is based on OpenStreetMap.",
        },
        {
          type: "p",
          text: "Map previews: on iOS the preview uses Apple Maps (no data leaves the device beyond the tile request, which Apple handles). On Android the preview uses Google Maps for Android — Google receives tile-render requests but no account or personal data.",
        },
        {
          type: "p",
          text: "Attribution: © OpenStreetMap contributors. Map tiles © Apple or © Google depending on platform.",
        },
        { type: "h2", text: "GDPR rights" },
        {
          type: "p",
          text: "Because we store no identifying data, there is nothing to export or delete on our side. Uninstalling the app removes all local data. If you have questions, contact the developer — see Impressum.",
        },
      ],
    },
    de: {
      title: "Datenschutzerklärung",
      blocks: [
        { type: "h1", text: "Datenschutzerklärung" },
        {
          type: "p",
          text: "Time Mapper ist so konzipiert, dass deine Daten auf deinem Gerät bleiben. Diese Seite erklärt, was wir erfassen, was wir speichern und was (wenn überhaupt) wir weitergeben.",
        },
        { type: "h2", text: "Was wir erfassen" },
        {
          type: "p",
          text: "Standortdaten: Wenn du „Standort immer“ aktivierst, nutzt die App betriebssystemseitige Geofences, um das Betreten und Verlassen deiner Orte zu erkennen. Deine Koordinaten verlassen dein Gerät niemals — das gesamte Tracking findet lokal statt.",
        },
        {
          type: "p",
          text: "Abonnements: Wenn du Time Mapper Pro kaufst, wickeln Apple oder Google den Kauf ab. Wir erhalten über RevenueCat lediglich einen anonymen Berechtigungs-Token — keine personenbezogenen Daten werden an uns übertragen.",
        },
        { type: "h2", text: "Was wir weitergeben" },
        {
          type: "p",
          text: "Nichts, abgesehen von einer anonymen RevenueCat-Nutzer-ID, die beim ersten Start erzeugt wird. Diese ID dient ausschließlich dem Abgleich deiner Pro-Berechtigung über Geräte hinweg und wird nie mit deinem Namen, deiner E-Mail oder einer Geräte-ID verknüpft.",
        },
        { type: "h2", text: "Drittanbieter-Dienste" },
        {
          type: "p",
          text: "Die Adress-Autovervollständigung stellt Photon (photon.komoot.io) bereit, betrieben von der Komoot GmbH in Potsdam. Wenn du in „Ort hinzufügen“ eine Adresse tippst, wird die Teileingabe an Photon-Server in der EU gesendet — deine GPS-Koordinaten werden NICHT mit übertragen. Photons Daten basieren auf OpenStreetMap.",
        },
        {
          type: "p",
          text: "Kartenvorschau: Unter iOS verwendet die Vorschau Apple Maps (der Kachel-Abruf läuft über Apple, verlässt dein Gerät aber nur für diesen Zweck). Unter Android nutzt die Vorschau Google Maps for Android — Google erhält Kachel-Anfragen, aber keine Kontodaten oder personenbezogenen Informationen.",
        },
        {
          type: "p",
          text: "Attribution: © OpenStreetMap-Mitwirkende. Kartenkacheln © Apple oder © Google, je nach Plattform.",
        },
        { type: "h2", text: "DSGVO-Rechte" },
        {
          type: "p",
          text: "Da wir keine identifizierenden Daten speichern, gibt es auf unserer Seite nichts zu exportieren oder zu löschen. Beim Deinstallieren der App werden alle lokalen Daten entfernt. Bei Fragen wende dich an den Entwickler — siehe Impressum.",
        },
      ],
    },
  },
  terms: {
    en: {
      title: "Terms of service",
      blocks: [
        { type: "h1", text: "Terms of service" },
        {
          type: "p",
          text: "By using Time Mapper you agree to these terms. If you don't agree, don't use the app.",
        },
        { type: "h2", text: "License" },
        {
          type: "p",
          text: "We grant you a personal, non-transferable license to use Time Mapper on devices you own. You may not reverse-engineer, resell, or redistribute the app.",
        },
        { type: "h2", text: "Subscriptions" },
        {
          type: "p",
          text: "Time Mapper Pro is billed monthly or yearly via Apple or Google. You can manage or cancel your subscription in your store account at any time.",
        },
        { type: "h2", text: "Warranty" },
        {
          type: "p",
          text: "The app is provided 'as is' without warranty. We aim for high quality but can't guarantee it's free of bugs or that location tracking will work in every environment.",
        },
        { type: "h2", text: "Liability" },
        {
          type: "p",
          text: "To the extent permitted by law, we are not liable for any incidental or consequential damages arising from your use of Time Mapper.",
        },
      ],
    },
    de: {
      title: "Nutzungsbedingungen",
      blocks: [
        { type: "h1", text: "Nutzungsbedingungen" },
        {
          type: "p",
          text: "Mit der Nutzung von Time Mapper erklärst du dich mit diesen Bedingungen einverstanden. Wenn du nicht einverstanden bist, nutze die App nicht.",
        },
        { type: "h2", text: "Lizenz" },
        {
          type: "p",
          text: "Wir gewähren dir eine persönliche, nicht übertragbare Lizenz zur Nutzung von Time Mapper auf deinen Geräten. Du darfst die App nicht zurückentwickeln, weiterverkaufen oder verbreiten.",
        },
        { type: "h2", text: "Abonnements" },
        {
          type: "p",
          text: "Time Mapper Pro wird monatlich oder jährlich über Apple bzw. Google abgerechnet. Du kannst dein Abonnement jederzeit in deinem Store-Konto verwalten oder kündigen.",
        },
        { type: "h2", text: "Gewährleistung" },
        {
          type: "p",
          text: "Die App wird „wie besehen“ ohne Gewährleistung bereitgestellt. Wir streben hohe Qualität an, können jedoch nicht garantieren, dass die App fehlerfrei ist oder Standort-Tracking in jeder Umgebung funktioniert.",
        },
        { type: "h2", text: "Haftung" },
        {
          type: "p",
          text: "Soweit gesetzlich zulässig, haften wir nicht für Folgeschäden, die sich aus der Nutzung von Time Mapper ergeben.",
        },
      ],
    },
  },
  impressum: {
    en: {
      title: "Impressum",
      blocks: [
        { type: "h1", text: "Impressum" },
        {
          type: "p",
          text: "Information according to § 5 TMG (German law — required for apps distributed in the EU):",
        },
        { type: "h2", text: "Owner" },
        { type: "p", text: "{{OWNER_NAME}}" },
        { type: "h2", text: "Address" },
        { type: "p", text: "{{ADDRESS}}" },
        { type: "h2", text: "Contact" },
        { type: "p", text: "Email: {{EMAIL}}" },
        { type: "p", text: "Phone: {{PHONE}}" },
        { type: "h2", text: "Responsible for content" },
        { type: "p", text: "{{OWNER_NAME}}, address as above" },
      ],
    },
    de: {
      title: "Impressum",
      blocks: [
        { type: "h1", text: "Impressum" },
        { type: "p", text: "Angaben gemäß § 5 TMG:" },
        { type: "h2", text: "Inhaber" },
        { type: "p", text: "{{OWNER_NAME}}" },
        { type: "h2", text: "Anschrift" },
        { type: "p", text: "{{ADDRESS}}" },
        { type: "h2", text: "Kontakt" },
        { type: "p", text: "E-Mail: {{EMAIL}}" },
        { type: "p", text: "Telefon: {{PHONE}}" },
        { type: "h2", text: "Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV" },
        { type: "p", text: "{{OWNER_NAME}}, Anschrift wie oben" },
      ],
    },
  },
};

/**
 * Look up a legal document in the requested locale. For the Impressum we
 * interpolate `contact.local.ts` values into the `{{TOKEN}}` placeholders;
 * if the module is missing or any token survives, we return the
 * "unconfigured" variant instead of rendering literal `{{OWNER_NAME}}` —
 * App Store review would otherwise reject the build.
 */
export function getLegalDocument(key: DocumentKey, locale: Locale): LegalDoc {
  const forKey = LEGAL_DOCS[key];
  const doc = forKey[locale] ?? forKey.en;
  if (key !== "impressum") return doc;

  const contact = loadContact();
  if (!contact) return UNCONFIGURED_IMPRESSUM[locale] ?? UNCONFIGURED_IMPRESSUM.en;

  // Interpolate every block, then guard: if any placeholder survives (e.g.
  // someone added a new `{{TOKEN}}` to the template without updating the
  // contact interface), still render the unconfigured variant.
  const interpolated: LegalDoc = {
    title: doc.title,
    blocks: doc.blocks.map((b) => ({ ...b, text: interpolate(b.text, contact) })),
  };
  const anyPlaceholder = interpolated.blocks.some((b) => hasPlaceholder(b.text));
  if (anyPlaceholder) return UNCONFIGURED_IMPRESSUM[locale] ?? UNCONFIGURED_IMPRESSUM.en;
  return interpolated;
}
