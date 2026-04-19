# Datenschutzerklärung

_Letzte Aktualisierung: 17.04.2026_

Time Mapper ist so konzipiert, dass deine Daten auf deinem Gerät
bleiben. Diese Seite erklärt, was wir erfassen, was wir speichern und
was (wenn überhaupt) wir weitergeben.

## Was wir erfassen

**Standortdaten.** Wenn du „Standort immer“ aktivierst, nutzt die App
betriebssystemseitige Geofences, um das Betreten und Verlassen deiner
Orte zu erkennen. Deine Koordinaten verlassen dein Gerät niemals — das
gesamte Tracking findet lokal über iOS Core Location und Android
LocationManager statt.

**Zeiteinträge.** Die Zeitpunkte, an denen du einen Ort betrittst oder
verlässt, werden in einer SQLite-Datenbank innerhalb der App-Sandbox
gespeichert. Beim Deinstallieren der App wird diese Datenbank
vollständig entfernt.

**Abonnement-Berechtigung.** Wenn du Time Mapper Pro kaufst, wickeln
Apple oder Google den Kauf ab. Wir erhalten über RevenueCat lediglich
einen anonymen Berechtigungs-Token — keine personenbezogenen Daten
werden an uns übertragen.

**Absturzberichte (optional).** Hat der Entwickler ein Sentry-Projekt
eingerichtet, werden nicht abgefangene Ausnahmen an Sentry gesendet.
Vor der Übertragung entfernen wir `location`, `latitude` und
`longitude` aus Breadcrumbs und Zusatzfeldern. Es erreichen keine
Standortdaten oder personenbezogenen Daten Sentry.

## Was wir weitergeben

Nichts, abgesehen von einer anonymen RevenueCat-Nutzer-ID, die beim
ersten Start erzeugt wird. Diese ID dient ausschließlich dem Abgleich
deiner Pro-Berechtigung über Installationen desselben App-Store-Kontos.
Wir verknüpfen sie niemals mit deinem Namen, deiner E-Mail oder einer
Geräte-ID.

## Drittanbieter-Dienste

- **Apple App Store / Google Play** — Abrechnung der Abonnements.
  Abgedeckt durch deren jeweilige Datenschutzrichtlinien.
- **RevenueCat** — plattformübergreifender Abgleich der
  Berechtigungen. Siehe
  [revenuecat.com/privacy](https://www.revenuecat.com/privacy).
- **Photon (Komoot GmbH, Potsdam, Deutschland)** —
  Adress-Autovervollständigung beim Hinzufügen von Orten.
  Tippeingaben werden an Photon-Server in der EU gesendet. Deine
  GPS-Koordinaten werden NICHT mit übertragen. Die Datenbasis ist
  OpenStreetMap. Siehe
  [komoot.com/privacy](https://www.komoot.com/privacy).
- **Apple Maps / Google Maps for Android** — Kartenvorschau für den
  gewählten Ort. Unter iOS kommt Apple Maps zum Einsatz (kein Konto,
  keine personenbezogenen Daten); unter Android zeichnet Google Maps
  for Android die Kacheln (kein Konto, keine personenbezogenen Daten,
  nur die Kachelanfrage selbst).
- **Sentry (optional)** — Absturzberichte, falls der Entwickler eine
  DSN konfiguriert hat. Siehe
  [sentry.io/privacy](https://sentry.io/privacy/).

### Attribution

© OpenStreetMap-Mitwirkende. Kartenkacheln © Apple oder © Google,
je nach Plattform.

## DSGVO-Rechte

Da wir keine identifizierenden Daten auf unserer Seite speichern, gibt
es nichts zu exportieren oder zu löschen. Beim Deinstallieren der App
werden alle lokalen Daten von deinem Gerät entfernt.

Bei Fragen wende dich an den Entwickler — siehe Impressum.
