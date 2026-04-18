// Legal document content — stub for Plan 5 Commit 3. Real content lands in
// Commit 7 (docs/legal/*-de.md + -en.md). This module simply serves a
// structured block list keyed by document + locale so the `LegalScreen`
// generic renderer doesn't need to know about markdown parsing.

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
        {
          type: "p",
          text: "Before publishing: replace the {{placeholders}} in docs/legal/impressum-en.md and docs/legal/impressum-de.md with your real contact information.",
        },
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
        {
          type: "p",
          text: "Vor der Veröffentlichung: Ersetze die {{Platzhalter}} in docs/legal/impressum-de.md und docs/legal/impressum-en.md durch deine echten Kontaktdaten.",
        },
      ],
    },
  },
};

export function getLegalDocument(key: DocumentKey, locale: Locale): LegalDoc {
  const forKey = LEGAL_DOCS[key];
  return forKey[locale] ?? forKey.en;
}
