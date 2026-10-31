// Provisionsliste Mobilfunk & Congstar – Stand 29.10.2026, gültig ab 01.11.2026
// Quelle: provisionsliste.pdf (5 Seiten). eur = Spalte "€ neu" (Punkte neu × 5 €), ap = Spalte "AP neu".
// Beträge in Cent (Ganzzahlen, keine Rundungsfehler).
export const CATEGORIES = {"neu": {"title": "Telekom MoFu Neu", "short": "Neuvertrag", "brand": "telekom"}, "vvlpp": {"title": "Telekom VVL ++", "short": "VVL ++", "brand": "telekom"}, "vvlp": {"title": "Telekom VVL +", "short": "VVL +", "brand": "telekom"}, "ntrl": {"title": "Telekom VVL ntrl", "short": "VVL ntrl", "brand": "telekom"}, "down": {"title": "Telekom VVL down", "short": "VVL down", "brand": "telekom"}, "downp": {"title": "Telekom VVL down+", "short": "VVL down+", "brand": "telekom"}, "cneu": {"title": "congstar Neuvertrag", "short": "congstar Neu", "brand": "congstar"}, "cvvl": {"title": "congstar VVL", "short": "congstar VVL", "brand": "congstar"}, "zuhause": {"title": "congstar Zuhause", "short": "congstar Zuhause", "brand": "congstar"}};
export const TARIFFS = [
  { id: 0, cat: "neu", name: "MagentaMobil XS", eur: 5950, ap: 2000 },
  { id: 1, cat: "neu", name: "MagentaMobil S", eur: 6300, ap: 2000 },
  { id: 2, cat: "neu", name: "MagentaMobil M", eur: 13650, ap: 2000 },
  { id: 3, cat: "neu", name: "MagentaMobil L", eur: 7000, ap: 2000 },
  { id: 4, cat: "neu", name: "MagentaMobil PlusKarte", eur: 2625, ap: 2000 },
  { id: 5, cat: "neu", name: "MagentaMobil PlusKarte +", eur: 1050, ap: 2000 },
  { id: 6, cat: "neu", name: "MagentaMobil PlusKarte Kids & Teens", eur: 350, ap: 2000 },
  { id: 7, cat: "neu", name: "MagentaMobil PlusKarte Data", eur: 1050, ap: 2000 },
  { id: 8, cat: "neu", name: "MagentaMobil S Young", eur: 2800, ap: 2000 },
  { id: 9, cat: "neu", name: "MagentaMobil M Young", eur: 3150, ap: 2000 },
  { id: 10, cat: "neu", name: "MagentaMobil L Young", eur: 3500, ap: 2000 },
  { id: 11, cat: "neu", name: "MagentaMobil Special", eur: 2800, ap: 2000 },
  { id: 12, cat: "neu", name: "MagentaMobil Special S", eur: 1050, ap: 2000 },
  { id: 13, cat: "neu", name: "Magenta Mobil Speedbox M", eur: 1400, ap: 2000 },
  { id: 14, cat: "neu", name: "Magenta Mobil Speedbox L", eur: 1750, ap: 2000 },
  { id: 15, cat: "vvlpp", name: "MagentaMobil XS", eur: 5250, ap: 1000 },
  { id: 16, cat: "vvlpp", name: "MagentaMobil S", eur: 5250, ap: 1000 },
  { id: 17, cat: "vvlpp", name: "MagentaMobil M", eur: 5425, ap: 1000 },
  { id: 18, cat: "vvlpp", name: "MagentaMobil L", eur: 5775, ap: 1000 },
  { id: 19, cat: "vvlpp", name: "MagentaMobil PlusKarte", eur: 5250, ap: 1000 },
  { id: 20, cat: "vvlpp", name: "MagentaMobil PlusKarte +", eur: 5250, ap: 1000 },
  { id: 21, cat: "vvlpp", name: "MagentaMobil PlusKarte Kids & Teens", eur: 5250, ap: 1000 },
  { id: 22, cat: "vvlpp", name: "MagentaMobil PlusKarte Data", eur: 4900, ap: 1000 },
  { id: 23, cat: "vvlpp", name: "MagentaMobil S Young", eur: 5250, ap: 1000 },
  { id: 24, cat: "vvlpp", name: "MagentaMobil M Young", eur: 5425, ap: 1000 },
  { id: 25, cat: "vvlpp", name: "MagentaMobil L Young", eur: 5775, ap: 1000 },
  { id: 26, cat: "vvlpp", name: "MagentaMobil Special", eur: 5425, ap: 1000 },
  { id: 27, cat: "vvlpp", name: "MagentaMobil Special S", eur: 5250, ap: 1000 },
  { id: 28, cat: "vvlpp", name: "Magenta Mobil Speedbox M", eur: 5775, ap: 1000 },
  { id: 29, cat: "vvlpp", name: "Magenta Mobil Speedbox L", eur: 6125, ap: 1000 },
  { id: 30, cat: "vvlp", name: "MagentaMobil XS", eur: 2450, ap: 1000 },
  { id: 31, cat: "vvlp", name: "MagentaMobil S", eur: 2450, ap: 1000 },
  { id: 32, cat: "vvlp", name: "MagentaMobil M", eur: 2625, ap: 1000 },
  { id: 33, cat: "vvlp", name: "MagentaMobil L", eur: 2975, ap: 1000 },
  { id: 34, cat: "vvlp", name: "MagentaMobil PlusKarte", eur: 2450, ap: 1000 },
  { id: 35, cat: "vvlp", name: "MagentaMobil PlusKarte +", eur: 2450, ap: 1000 },
  { id: 36, cat: "vvlp", name: "MagentaMobil PlusKarte Kids & Teens", eur: 2450, ap: 1000 },
  { id: 37, cat: "vvlp", name: "MagentaMobil PlusKarte Data", eur: 2100, ap: 1000 },
  { id: 38, cat: "vvlp", name: "MagentaMobil S Young", eur: 2450, ap: 1000 },
  { id: 39, cat: "vvlp", name: "MagentaMobil M Young", eur: 2625, ap: 1000 },
  { id: 40, cat: "vvlp", name: "MagentaMobil L Young", eur: 2975, ap: 1000 },
  { id: 41, cat: "vvlp", name: "MagentaMobil Special", eur: 2625, ap: 1000 },
  { id: 42, cat: "vvlp", name: "MagentaMobil Special S", eur: 2450, ap: 1000 },
  { id: 43, cat: "vvlp", name: "Magenta Mobil Speedbox M", eur: 2975, ap: 1000 },
  { id: 44, cat: "vvlp", name: "Magenta Mobil Speedbox L", eur: 3325, ap: 1000 },
  { id: 45, cat: "ntrl", name: "MagentaMobil XS", eur: 1050, ap: 0 },
  { id: 46, cat: "ntrl", name: "MagentaMobil S", eur: 1050, ap: 0 },
  { id: 47, cat: "ntrl", name: "MagentaMobil M", eur: 1225, ap: 0 },
  { id: 48, cat: "ntrl", name: "MagentaMobil L", eur: 1575, ap: 0 },
  { id: 49, cat: "ntrl", name: "MagentaMobil PlusKarte", eur: 1050, ap: 0 },
  { id: 50, cat: "ntrl", name: "MagentaMobil PlusKarte +", eur: 1050, ap: 0 },
  { id: 51, cat: "ntrl", name: "MagentaMobil PlusKarte Kids & Teens", eur: 1050, ap: 0 },
  { id: 52, cat: "ntrl", name: "MagentaMobil PlusKarte Data", eur: 700, ap: 0 },
  { id: 53, cat: "ntrl", name: "MagentaMobil S Young", eur: 1050, ap: 0 },
  { id: 54, cat: "ntrl", name: "MagentaMobil M Young", eur: 1225, ap: 0 },
  { id: 55, cat: "ntrl", name: "MagentaMobil L Young", eur: 1575, ap: 0 },
  { id: 56, cat: "ntrl", name: "MagentaMobil Special", eur: 1225, ap: 0 },
  { id: 57, cat: "ntrl", name: "MagentaMobil Special S", eur: 1050, ap: 0 },
  { id: 58, cat: "ntrl", name: "Magenta Mobil Speedbox M", eur: 1575, ap: 0 },
  { id: 59, cat: "ntrl", name: "Magenta Mobil Speedbox L", eur: 1925, ap: 0 },
  { id: 60, cat: "down", name: "MagentaMobil XS", eur: 350, ap: 0 },
  { id: 61, cat: "down", name: "MagentaMobil S", eur: 350, ap: 0 },
  { id: 62, cat: "down", name: "MagentaMobil M", eur: 525, ap: 0 },
  { id: 63, cat: "down", name: "MagentaMobil L", eur: 875, ap: 0 },
  { id: 64, cat: "down", name: "MagentaMobil PlusKarte", eur: 350, ap: 0 },
  { id: 65, cat: "down", name: "MagentaMobil PlusKarte +", eur: 350, ap: 0 },
  { id: 66, cat: "down", name: "MagentaMobil PlusKarte Kids & Teens", eur: 350, ap: 0 },
  { id: 67, cat: "down", name: "MagentaMobil PlusKarte Data", eur: 0, ap: 0 },
  { id: 68, cat: "down", name: "MagentaMobil S Young", eur: 350, ap: 0 },
  { id: 69, cat: "down", name: "MagentaMobil M Young", eur: 525, ap: 0 },
  { id: 70, cat: "down", name: "MagentaMobil L Young", eur: 875, ap: 0 },
  { id: 71, cat: "down", name: "MagentaMobil Special", eur: 525, ap: 0 },
  { id: 72, cat: "down", name: "MagentaMobil Special S", eur: 350, ap: 0 },
  { id: 73, cat: "down", name: "Magenta Mobil Speedbox M", eur: 875, ap: 0 },
  { id: 74, cat: "down", name: "Magenta Mobil Speedbox L", eur: 1225, ap: 0 },
  { id: 75, cat: "downp", name: "MagentaMobil XS", eur: 350, ap: 0 },
  { id: 76, cat: "downp", name: "MagentaMobil S", eur: 350, ap: 0 },
  { id: 77, cat: "downp", name: "MagentaMobil M", eur: 525, ap: 0 },
  { id: 78, cat: "downp", name: "MagentaMobil L", eur: 875, ap: 0 },
  { id: 79, cat: "downp", name: "MagentaMobil PlusKarte", eur: 350, ap: 0 },
  { id: 80, cat: "downp", name: "MagentaMobil PlusKarte +", eur: 350, ap: 0 },
  { id: 81, cat: "downp", name: "MagentaMobil PlusKarte Kids & Teens", eur: 350, ap: 0 },
  { id: 82, cat: "downp", name: "MagentaMobil PlusKarte Data", eur: 0, ap: 0 },
  { id: 83, cat: "downp", name: "MagentaMobil S Young", eur: 350, ap: 0 },
  { id: 84, cat: "downp", name: "MagentaMobil M Young", eur: 525, ap: 0 },
  { id: 85, cat: "downp", name: "MagentaMobil L Young", eur: 875, ap: 0 },
  { id: 86, cat: "downp", name: "MagentaMobil Special", eur: 525, ap: 0 },
  { id: 87, cat: "downp", name: "MagentaMobil Special S", eur: 350, ap: 0 },
  { id: 88, cat: "downp", name: "Magenta Mobil Speedbox M", eur: 875, ap: 0 },
  { id: 89, cat: "downp", name: "Magenta Mobil Speedbox L", eur: 1225, ap: 0 },
  { id: 90, cat: "cneu", name: "congstar Allnet Flat XS mit GB+ 10GB", eur: 2800, ap: 0 },
  { id: 91, cat: "cneu", name: "congstar Allnet Flat S mit GB+ 20GB", eur: 6650, ap: 0 },
  { id: 92, cat: "cneu", name: "congstar Allnet Flat M mit GB+ 35GB", eur: 9100, ap: 0 },
  { id: 93, cat: "cneu", name: "congstar Allnet Flat L mit GB+ 50GB", eur: 11550, ap: 0 },
  { id: 94, cat: "cneu", name: "congstar Homespot S 50GB", eur: 4200, ap: 0 },
  { id: 95, cat: "cneu", name: "congstar Homespot M 150GB", eur: 5600, ap: 0 },
  { id: 96, cat: "cneu", name: "congstar Homespot L 300GB", eur: 7000, ap: 0 },
  { id: 97, cat: "cvvl", name: "congstar Allnet Flat XS mit GB+ 10GB", eur: 1750, ap: 0 },
  { id: 98, cat: "cvvl", name: "congstar Allnet Flat S mit GB+ 20GB", eur: 1750, ap: 0 },
  { id: 99, cat: "cvvl", name: "congstar Allnet Flat M mit GB+ 35GB", eur: 6300, ap: 0 },
  { id: 100, cat: "cvvl", name: "congstar Allnet Flat L mit GB+ 50GB", eur: 7000, ap: 0 },
  { id: 101, cat: "cvvl", name: "congstar Allnet Flat XL mit GB+", eur: 7700, ap: 0 },
  { id: 102, cat: "cvvl", name: "congstar Allnet Flat XXL mit GB+", eur: 4725, ap: 0 },
  { id: 103, cat: "zuhause", name: "congstar Zuhause 250", eur: 5950, ap: 0 },
  { id: 104, cat: "zuhause", name: "congstar Zuhause 175", eur: 5950, ap: 0 },
  { id: 105, cat: "zuhause", name: "congstar Zuhause 100", eur: 4550, ap: 0 },
  { id: 106, cat: "zuhause", name: "congstar Zuhause 50", eur: 4550, ap: 0 },
];

// ---------------------------------------------------------------------------
// Schwierigkeit: kontinuierlich aus dem Gesamtwert (Euro-Wert + AP).
// 0 = billig (groß, langsam, ruhig, häufig) … 1 = Top-Vertrag (klein/weit,
// schnell, hektisch, kurz sichtbar, selten).
export const MAX_VALUE = Math.max(...TARIFFS.map(t => t.eur + t.ap));
export function valueOf(t) { return t.eur + t.ap; }
export function difficulty(t) {
  return Math.pow(valueOf(t) / MAX_VALUE, 0.85);
}
// Spawn-Chance: hängt NUR am Wert und fällt stetig – je wertvoller, desto seltener.
// Tarife mit identischem Gesamtwert teilen sich die Chance ihrer Wertstufe (sonst würden
// z. B. die 14 gleichen 3,50-€-Zeilen den Himmel füllen).
const VALUE_GROUP = {};
for (const t of TARIFFS) VALUE_GROUP[valueOf(t)] = (VALUE_GROUP[valueOf(t)] || 0) + 1;
export function valueChance(t) { // relatives Gewicht der Wertstufe
  const d = difficulty(t);
  return 0.1 + Math.pow(1 - d, 2);
}
export function spawnWeight(t) {
  return valueChance(t) / VALUE_GROUP[valueOf(t)];
}
