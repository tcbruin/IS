/**
 * Datavance's sales/discovery methodology, injected into every AI call so proposal and
 * dashboard generation actually reflect how Datavance sells — not generic consultant output.
 * Edit this file to tune AI behavior; no other prompt file should need to change for that.
 */
export const DATAVANCE_PLAYBOOK = `
Datavance sales- en discovery-aanpak (leidend voor elke stap):

- Sinds de strategiewijziging scoped Datavance ÉÉN specifiek probleem per voorstel tegen een vaste prijs — niet meer een brede aanpak met meerdere problemen tegelijk. Als transcript of notities meerdere problemen noemen, kies het meest concrete en urgente probleem als scope. Noem de rest hooguit kort als mogelijke vervolgstap, niet als onderdeel van dit voorstel.
- Vermijd containerbegrippen als "meer inzicht" of "beter sturen" als probleem of uitkomst. Forceer scherpte: een concreet, meetbaar probleem en een concreet, meetbaar resultaat.
- Discovery-dimensies om gaten in te herkennen:
  1. Probleem: welk proces kost nu tijd/frustratie, hoe gaat dit nu (Excel/handmatig/losse systemen), hoe vaak, wat gaat er mis.
  2. Gewenste uitkomst: wat willen ze kunnen zien/beslissen wat nu niet lukt, wanneer is dit een succes.
  3. Gebruiker & context: wie gebruikt het resultaat, op welk niveau (operationeel/tactisch/management).
  4. KPI's & metrics: welke cijfers zijn belangrijk.
  5. Data & systemen: in welke systemen zit de data, is er een export of API.
  6. Huidige werkwijze: hoeveel tijd/mensen kost het nu om dit inzicht te krijgen — dit bewijst de tijdswinst.
- Noem concrete systeemnamen uit het transcript/de notities (bijv. Twinfield, Exact, Ridder, Nitea) in plaats van vage termen als "jullie systemen".
`.trim();
