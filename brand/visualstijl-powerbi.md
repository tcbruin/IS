# Visualstijl Power BI

Vast te leggen in een JSON-thema, één keer voor alle rapporten.

## Dataseries (in deze volgorde)

1. `#264549`
2. `#FF5713`
3. `#6B9EA3`
4. `#FF9E00`
5. `#97C1C4`
6. `#FF4258`
7. `#143034`
8. `#FFC999`

## Regels

| Element | Regel |
|---|---|
| Visualtitel | Epilogue SemiBold 26px · #264549 · links |
| Subtitel / eenheid | Manrope Medium 17px · #264549 50% |
| Aslabels | Manrope SemiBold 15–17px · #264549 60% |
| Aslijn | 1px · #264549 25% · alleen X-as |
| Gridlijnen | 1px · #264549 10% · horizontaal, max 4 |
| KPI-waarde | Epilogue SemiBold 44–46px · #264549 |
| Positief / negatief | #264549 / #FF4258 — nooit rood-groen |
| Nadruk / focus | #FF5713, maximaal één per visual |
| Tabel | kop 2px #264549 · zebra #FFFAF4 · totaal 2px boven |
| Verloop | #FF4258 → #FF9E00, alleen decoratief |
| Canvas / kaart | #FFFAF4 achtergrond · #FFFFFF kaart · rand #264549 10% |

## Canvas (verplicht, exacte pixels)

Elke dashboardpagina — live app-pagina, printweergave/PDF én de losse "Interactieve HTML"-export
— is een vast canvas van **1280×720px** (de standaard Power BI 16:9-paginamaat), nooit een
schaalbare/responsive pagina. Dit is de letterlijke, pixel-exacte specificatie:

| Element | Positie | Grootte | Kleur |
|---|---|---|---|
| Header (petrol) | 0, 0 | 1280 × 60 | `#264549` |
| Filterbalk (wit) | 0, 60 | 1280 × 60 | `#FFFFFF` |
| Canvas-achtergrond | 0, 120 – 1280, 712 | 1280 × 592 | `#FFFAF4` |
| Footerbalk | 0, 712 | 1280 × 8 | `#FF5D00` |
| Logo ("D") | 25, 10 | 40 × 40 | — |
| Paginatitel | direct rechts van het logo | — | wit op petrol, verticaal gecentreerd in de headerbalk |

**Harde regels, altijd:**

- **Alles moet in het canvas passen — nooit scrollen.** Visuals, filters en tabellen worden
  zo groot/compact gemaakt dat ze binnen de 592px canvas-achtergrond passen. Geen enkele
  pagina scrollt, precies zoals een echte, statische Power BI-pagina nooit scrollt.
- **Geen overbodige tekst.** Geen subtitel, geen verhalend paragraaf, geen los statusblokje.
  Elke pixel is een visual, een filter of een cijfer — nooit proza. (Zie `dashboardContentSchema`
  in `lib/validation.ts`: de AI genereert bewust geen `subtitle`/`narrative`/`statusHighlight`
  meer — dat veld bestaat niet, juist om te voorkomen dat er weer losse tekst bijkomt.)
- **De witte balk (60–120px) IS de filterbalk** — geen aparte witte kaart eronder. Reset-icoon,
  dropdowns/periode-velden en de decoratieve filter/…-iconen staan direct in die ene witte
  strook, net als in de screenshots hieronder.

## Referentiepagina's (screenshots van een echt Datavance Power BI-rapport)

Vier screenshots van een bestaand Exact Globe-rapport (opgeslagen in deze map, `brand/referentie-*.png`)
zijn de directe, pixel-voor-pixel referentie voor hoe een dashboardpagina eruit moet zien. Ze
laten zien dat de content **per pagina verschilt**, terwijl de canvas-chrome
(header/filterbalk/footer hierboven) altijd hetzelfde blijft:

1. **`referentie-overzicht.png`** — KPI-rij (elk met een `Begroting: X (Δ%)`-regel) · een
   gecombineerde staaf+lijngrafiek met 4 series (realisatie, begroting, cumulatief realisatie,
   cumulatief begroting) · een "Doelstellingen"-tabel met kolommen R / B / %B / Resultaat (groen
   vinkje / rood kruisje). Dit is het patroon dat dit project momenteel bouwt (KPI-rij + grafiek
   + tabel).
2. **`referentie-winst-verlies.png`** — geen KPI's, geen grafiek: één grote, uitklapbare
   P&L-tabel (CategorieNaam/SubcategorieNaam, kolommen Huidig Jaar/Vorig Jaar/Δ/Begroting/Δ
   Begroting), met donkere totaalregels per categorie.
3. **`referentie-balans.png`** — nog eenvoudiger: alleen een tabel (Activa/Passiva per jaar),
   amper filters.
4. **`referentie-openstaande-posten.png`** — 2 KPI's + 3 tabellen tegelijk (betalingstermijnen,
   ouderdomsanalyse per bucket, factuurgeschiedenis), met een simpele toggle
   (Crediteur/Debiteur) in de filterbalk.

**Consequentie voor toekomstig werk:** dit bevestigt dat de layout per pagina moet kunnen
wisselen (soms 1 tabel, soms KPI+grafiek, soms KPI+meerdere tabellen) — precies wat al eerder
is afgesproken, maar hier nu met concrete voorbeelden. Een generiek "layout-per-pagina"-systeem
is nog niet gebouwd; dit project bouwt vooralsnog alleen patroon 1.

**Nog open — begroting/budget ontbreekt.** Alle vier de referentiepagina's leunen zwaar op een
vergelijking met **Begroting** (budget/target-cijfers). Dit project heeft daarvoor geen bron:
`lib/sampleData` bevat geen budget, en het is een expliciete projectregel om nooit cijfers te
verzinnen. Zolang er geen echte budgetbron is, blijft de KPI-vergelijking "vs. vorige periode"
(zie `computeMetricComparison` in `lib/sampleData/index.ts`) de vervanging — dit is een bewust
verschil met de referentiescreenshots, geen fout.
