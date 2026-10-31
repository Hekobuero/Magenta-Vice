# MAGENTA VICE

Open-World-Parodie im Telekommunikations-Vertrieb – Miami Beach, Neon, Glasfaser. Präsentiert von HEKO Büroservice.
Statische Seite für GitHub Pages (kein Build-Schritt). Three.js 0.169 kommt per jsDelivr (Importmap), sonst keine externen Assets: alle Texturen, Modelle, Musik und Jingles werden prozedural im Browser erzeugt.

## Spielen
`index.html` über einen Webserver öffnen (z. B. `python3 -m http.server`) oder per GitHub Pages ausliefern. `.nojekyll` liegt bei.

## Steuerung
| Aktion | Desktop | Handy (Querformat empfohlen) |
|---|---|---|
| Laufen / Fahren | WASD / Pfeiltasten | linker Joystick |
| Kamera | Maus (Pointer-Lock) | rechte Bildschirmhälfte wischen |
| Rennen | Shift | 🏃 bzw. Joystick ganz raus |
| Schlagen | Klick / Q | 👊 |
| Einsteigen / Auto klauen | F | 🚗 |
| Shop ausrauben | E halten | 💰 halten |
| Handbremse | Leertaste | ⛔ |
| Hupe | H | 📯 |
| Radio wechseln | R | 📻 |
| Karte | M | Handy → Karte |
| Handy / Pause | Tab · Esc | 📱 |

## Features
- Third-Person-Open-World: Miami Beach mit Strand, Ocean Drive, Art-déco-Hotels mit Neon, Glas-Hochhäusern (HEKO Tower, Telekom Tower), MAGENTA MALL, Causeway-Brücke zur Insel mit dem 150 m hohen Telekom Campus.
- Spieler: Telekom-Mitarbeiter im Magenta-Polo mit T-Logo.
- Telekom-Shops überall, dazu Parodie-Konkurrenz: Vodafohn, O₀ Zwei, 1&Eins, Kongstar.
- Plakate für Glasfaser, 5G, MagentaTV, highspeedvorort.de und HEKO Büroservice.
- Verkehr: Telekom-Caddys und Service-Trucks, Glasfaser-Tiefbau-Pickups, Konkurrenz-Transporter, Sportwagen, Taxis, Polizei mit Sirene, SEK – plus Fußgänger und Touristen.
- GTA-Mechaniken: jedes Auto klauen (Fahrer fliegt raus), Arcade-Fahrphysik mit Drift/Handbremse, Crashs und Schaden, Fahndungslevel 1–5 mit Polizeiverfolgung, Abhängen, Verhaftung („VERHAFTET“), Gesundheit, Provision als Geld, Lackiererei (250 €) zum Sterne-Löschen.
- Missionen (7): Erste Schicht, Drückerkolonne, Konkurrenz-Check, Heißes Pflaster, Fluchtwagen, Monopol, Glasfaser-König. Konkurrenz-Shops ausrauben, „Rangerz“-Drücker umhauen und ihre Verträge abnehmen, Glasfaser-Verträge einsammeln und im Telekom-Shop gegen Provision abgeben (Campus +25 %). Comic-Stil, kein Blut.
- Minimap mit Missionsmarkern, große Karte, Handy-Menü (Karte, Aufträge, Radio, Statistik, Einstellungen, Hilfe).
- Autoradio mit 4 prozeduralen Sendern (MAGENTA FM, GLASFASER BEATS, RADIO FUNKLOCH, VERTRIEB TALK) und deutschen Parodie-Jingles per Sprachausgabe.
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

## English summary
Magenta Vice is a German-language GTA-style parody set in a neon Miami Beach. You play a Telekom employee who steals cars, robs competitor phone shops, knocks out door-to-door "Rangerz" salesmen and collects fibre contracts for commission while evading the police. It runs on desktop and on phones, with touch controls and landscape layout first. The game is a static Three.js site, and every texture, model and sound is generated procedurally.
