# MAGENTA VICE

Open-World-Parodie im Telekommunikations-Vertrieb – Miami Beach, Neon, Glasfaser. Präsentiert von HEKO Büroservice.
Statische Seite für GitHub Pages (kein Build-Schritt). Three.js 0.169 kommt per jsDelivr (Importmap). Menschen, Sportwagen und Schusswaffen sind freie 3D-Modelle (MIT / CC BY / CC0, siehe CREDITS) unter `assets/models/` (ca. 6,6 MB, Meshopt + WebP komprimiert, Ladebalken). Alles andere – Gebäude, Palmen, Requisiten, Texturen, Musik und Jingles – wird prozedural im Browser erzeugt.

## Spielen
`index.html` über einen Webserver öffnen (z. B. `python3 -m http.server`) oder per GitHub Pages ausliefern. `.nojekyll` liegt bei.

## Steuerung
| Aktion | Desktop | Handy (Querformat empfohlen) |
|---|---|---|
| Laufen / Fahren | WASD / Pfeiltasten | linker Joystick |
| Kamera | Maus (Pointer-Lock) | rechte Bildschirmhälfte wischen |
| Rennen | Shift | Joystick ganz nach außen |
| Schlagen / Schießen | Linksklick / Q | 👊 |
| Zielen | Rechtsklick halten | 🎯 (Auto-Zielerfassung, nächstes Ziel) |
| Waffe wechseln | 1–4 · Mausrad | Waffen-Taste antippen |
| Waffenrad | C halten | Waffen-Taste lange drücken und ziehen |
| Einsteigen / Auto klauen | F | 🚗 |
| Shop ausrauben | E halten | 💰 halten |
| Handbremse | Leertaste | 👊 (im Auto) |
| Hupe | H | 📯 (im Auto) |
| Radio wechseln | R | 📻 |
| Karte | M | Handy → Karte |
| Handy / Pause | Tab · Esc | 📱 |

## Features
- Third-Person-Open-World: Miami Beach mit Strand, Ocean Drive, Art-déco-Hotels mit Neon, Glas-Hochhäusern (HEKO Tower, Telekom Tower), MAGENTA MALL, Causeway-Brücke zur Insel mit dem 150 m hohen Telekom Campus.
- Spieler: Telekom-Mitarbeiter im Magenta-Hemd mit T-Logo (Rocketbox-Modell mit Skelett-Animation).
- Echte animierte Menschen (Laufen, Rennen, Stehen, Tanzen, Sitzen, Liegen, Zielen, Schlagen): Passanten, Touristen in Badekleidung, Nachtschwärmer vor Clubs und Hotels, Polizei, SEK, D2D-ler in Warnweste mit Klemmbrett und „D2D“-Aufdruck. Dichte nach Qualitätsstufe, LOD und Sichtbarkeits-Culling.
- Telekom-Shops überall, dazu Parodie-Konkurrenz: Vodafohn, O₀ Zwei, 1&Eins, Kongstar.
- Plakate für Glasfaser, 5G, MagentaTV, highspeedvorort.de und HEKO Büroservice.
- Verkehr (2–3× dichter, Tag und Nacht, Ampeln mit Haltelinien): Sportwagen-Flotte aus echtem 3D-Modell – Hyper-GT, Hyper mit Heckflügel, Cabrio, Ocean Speedster (Roadster), Kabel Muscle (Hutze), Glasfaser E-Coupé (Unterbodenleuchten) – dazu Telekom-Caddys, Service-Trucks, Tiefbau-Pickups, Konkurrenz-Transporter, Taxis, Polizei, SEK. Fern-LOD (ca. 2,7k statt 25k Dreiecke) für entfernte Autos.
- Waffen: Fäuste + 3 Slots (Schlagstock, Pistole, Uzi, Schrotflinte). Volle Slots → Waffentausch, die gehaltene Waffe fällt zu Boden. Waffenrad mit Zeitlupe, HUD mit 4 Slots und Munition, Auto-Zielerfassung am Handy, Mündungsfeuer, Leuchtspur, Querschläger. Waffen und Munition im AMMU-NETZ (am Ocean Drive) oder als Fundstücke.
- Treffer: Blut (Einstellung „Blut: AN/AUS“, gespeichert), Autos qualmen, brennen und explodieren. Polizei reagiert auf Schüsse, steigt aus und schießt ab 3 Sternen zurück; SEK mit Uzi.
- D2D-ler greifen zufällig in Gruppen von 2–3 an („Ein D2D-ler greift dich an!“), mit deutschen Sprüchen, Abklingzeit und später mit Schlagstöcken oder Pistolen.
- GTA-Mechaniken: jedes Auto klauen (Fahrer fliegt raus), Arcade-Fahrphysik mit Drift/Handbremse, Crashs und Schaden, Fahndungslevel 1–5 mit Polizeiverfolgung, Abhängen, Verhaftung („VERHAFTET“), Gesundheit, Provision als Geld, Lackiererei (250 €) zum Sterne-Löschen.
- Missionen (7): Erste Schicht, Drückerkolonne, Konkurrenz-Check, Heißes Pflaster, Fluchtwagen, Monopol, Glasfaser-König. Konkurrenz-Shops ausrauben, „D2D-ler“ (Haustür-Drücker) umhauen und ihre Verträge abnehmen, Glasfaser-Verträge einsammeln und im Telekom-Shop gegen Provision abgeben (Campus +25 %). Blut abschaltbar.
- Minimap mit Missionsmarkern, große Karte, Handy-Menü (Karte, Aufträge, Radio, Statistik, Einstellungen, Hilfe).
- Autoradio nur im Auto, Sender je nach Autotyp: MAGENTA JAM FM (Hip-Hop/R&B, Standard), Glasfaser Groove (R&B), T-Rock 5G (Rock), Elektro Netz (Electro/Synthwave), Cyber Tarif 2077 (Cyberpunk). Alle Songs werden live im Browser komponiert (WebAudio-Sequencer, eigene Parodie-Künstler und -Titel, keine fremden Aufnahmen), dazu deutsche DJ-Moderationen und Werbe-Jingles per Sprachausgabe. Zu Fuß: Stadtgeräusche, Meer, Vögel bzw. Grillen.
- Tageszeit nach echter Ortszeit (Sonnenstand), physikalischer Himmel (Rayleigh/Mie) für Tag und Dämmerung, Sterne/Mond nachts, Straßenlaternen und Neon immer an, nachts nasse spiegelnde Straßen.
- Spielstand in localStorage, Versionslabel + Cache-Busting (?v=).

## Grafik
- Volle Geräteauflösung (Handy bis 2×, Desktop bis 2,5×), MSAA-Rendertarget (4×), ACES-Tonemapping, sRGB-Ausgabe, Bloom, Farbkorrektur.
- PBR: Klarlack-Autolack (MeshPhysical, Clearcoat), spiegelndes Glas, Fassaden mit Rauheits-/Metall- und Normal-Maps, Wasser mit zwei gegenläufigen Normal-Maps und Klarlack-Glanz, Umgebungs-Reflexionen aus dem Himmel (PMREM).
- Hochauflösende prozedurale Texturen (1024 px, anisotrope Filterung, Mipmaps): Asphalt mit Splitt, Rissen, Flicken und Spurrillen, Gehwegplatten mit Fugen, Sand mit Rippeln, Palmenrinde, Art-déco-Fassaden.
- Geometrie: abgerundete Karosserien, Reifen mit Flanke und Speichenfelgen, glatte Figuren, Palmen mit gebogenem Stamm und gefiederten Wedeln.
- Weiche Schatten (4096 px auf HOCH, 2048 px auf MITTEL), GTAO-Umgebungsverdeckung auf HOCH (Desktop), Nebel.
- Qualitätsmenü im Handy: AUTO (Standard: Desktop = HOCH, Handy = MITTEL), HOCH, MITTEL, NIEDRIG. Dynamische Auflösung hält die Bildrate (Schritte von 0,25× zwischen Minimum und Maximum der Stufe).

## Debug
`?hour=22` erzwingt eine Uhrzeit, `?pr=1.5` eine feste Auflösung, `?q=niedrig` eine Qualitätsstufe, `?ao=0` schaltet AO ab.

## CREDITS
Alle Fremd-Assets stehen unter weitergabefähigen Lizenzen (MIT, CC BY, CC0). Musik, Jingles, Gebäude, Palmen, Requisiten und Texturen sind eigene prozedurale Erzeugnisse.

- **Menschen und Animationen** (`assets/models/people`, `assets/models/anim`): [Microsoft Rocketbox Avatar Library](https://github.com/microsoft/Microsoft-Rocketbox), MIT-Lizenz, Copyright (c) 2020 Microsoft. Bezogen als glTF über models.codelove.in. Geändert: Texturen umgefärbt (Magenta-Hemd mit T-Logo, Neon-Warnwesten), „Footsteps“-Hilfsknoten aus den Animationen entfernt, Meshopt/WebP-komprimiert.
- **Sportwagen** (`assets/models/cars`): „Car Concept“ aus den [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept), © 2024 Darmstadt Graphics Group GmbH, Modell und Texturen von Eric Chadwick, nach einem Entwurf von Unity Fan (CC0), Lizenz [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Geändert: vereinfacht (Fern-LOD zusätzlich stark reduziert), Innenraum/Logos entfernt, Cabrio-Variante ohne Dach, Varianten mit anderen Proportionen, Lackierungen, Felgen und Anbauteilen (Heckflügel, Hutze, Unterbodenleuchten).
- **Pistole**: „Pistol“ von [Quaternius](https://poly.pizza/m/52kQzphmeF), CC0 (Public Domain).
- **Uzi**: „Uzi“ von [AdamKokrito](https://poly.pizza/m/968b3pYNyQ), Lizenz [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Geändert: skaliert, ausgerichtet, komprimiert.
- **Schrotflinte**: „Shotgun“ von [CreativeTrio](https://poly.pizza/m/CkSFaW2d7m), CC0 (Public Domain).
- **Three.js** 0.169 (MIT, © 2010–2024 three.js authors) mit GLTFLoader, MeshoptDecoder (MIT, © 2016–2024 Arseny Kapoulkine) und Postprocessing.

### MIT-Lizenz (Microsoft Rocketbox)
```
MIT License

Copyright (c) 2020 Microsoft

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## English summary
Magenta Vice is a German-language GTA-style parody set in a neon Miami Beach. You play a Telekom employee who steals cars, robs competitor phone shops, knocks out door-to-door "D2D-ler" salesmen and collects fibre contracts for commission while evading the police. It has animated Rocketbox people, a sports-car fleet based on the Khronos Car Concept model, a 3-slot weapon system with weapon wheel and the AMMU-NETZ shop, and a procedurally composed car radio. It runs on desktop and on phones, with touch controls and landscape layout first. The game is a static Three.js site. Third-party models are MIT, CC BY or CC0 licensed (see CREDITS); everything else, including all music, is generated procedurally.
