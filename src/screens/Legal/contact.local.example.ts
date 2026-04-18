// Example contact file for the Impressum. COPY TO `contact.local.ts`
// (gitignored) and fill in your real details before shipping.
//
// The shape is declared in `documents.ts` (ImpressumContact).
// Every field must be a plain string — no `{{...}}` tokens.

import type { ImpressumContact } from "./documents";

const contact: ImpressumContact = {
  ownerName: "Jane Doe",
  address: "Example Street 1, 50667 Köln, Germany",
  email: "jane@example.com",
  phone: "+49 221 1234567",
};

export default contact;
