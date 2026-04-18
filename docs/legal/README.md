# Legal documents

This directory holds the canonical text of Time Mapper's legal notices:

- `privacy-{en,de}.md` — Privacy policy
- `terms-{en,de}.md` — Terms of service (AGB)
- `impressum-{en,de}.md` — Impressum (German legal requirement)

**The app does not read these files at runtime.** Expo Metro does not
bundle `.md` as a native asset without extra config. Instead, the same
content is mirrored in structured form inside
`src/screens/Legal/documents.ts`, which the `LegalScreen` renders.

Keep both in sync when editing. The markdown files are the
version-controlled "source of truth" that lawyers/editors can read
independently; `documents.ts` is the compiled representation consumed
by React.

## Publishing checklist

Before submitting to the App Store / Play Store:

1. Fill the `{{OWNER_NAME}}`, `{{ADDRESS}}`, `{{EMAIL}}`, `{{PHONE}}`
   placeholders in `impressum-de.md` and `impressum-en.md` with your
   real contact information. The Impressum is a legal requirement in
   Germany and the EU.
2. Update the `_Last updated_` date at the top of each document to
   match the submission date.
3. Review `documents.ts` to ensure the TS version carries the same
   content.
4. Host the privacy policy at a public URL (Apple requires this in
   App Store Connect → App Privacy → Privacy Policy URL). A
   GitHub Pages mirror of `privacy-en.md` works fine.
