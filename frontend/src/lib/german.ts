const verbRoots: Record<string, string> = {
  // stehen conjugates
  "stehe": "stehen", "stehst": "stehen", "steht": "stehen", "stehen": "stehen", "stand": "stehen", "standst": "stehen", "standen": "stehen", "standet": "stehen", "gestanden": "stehen",
  // tragen conjugates
  "trage": "tragen", "trägst": "tragen", "trägt": "tragen", "tragen": "tragen", "tragt": "tragen", "trug": "tragen", "trugst": "tragen", "trugen": "tragen", "trugt": "tragen", "getragen": "tragen",
  // geben conjugates
  "gebe": "geben", "gibst": "geben", "gibt": "geben", "geben": "geben", "gebt": "geben", "gab": "geben", "gabst": "geben", "gaben": "geben", "gabt": "geben", "gegeben": "geben",
  // nehmen conjugates
  "nehme": "nehmen", "nimmst": "nehmen", "nimmt": "nehmen", "nehmen": "nehmen", "nehmt": "nehmen", "nahm": "nehmen", "nahmst": "nehmen", "nahmen": "nehmen", "nahmt": "nehmen", "genommen": "nehmen",
  // gehen conjugates
  "gehe": "gehen", "gehst": "gehen", "geht": "gehen", "gehen": "gehen", "ging": "gehen", "gingst": "gehen", "gingen": "gehen", "gingt": "gehen", "gegangen": "gehen",
  // sehen conjugates
  "sehe": "sehen", "siehst": "sehen", "sieht": "sehen", "sehen": "sehen", "seht": "sehen", "sah": "sehen", "sahst": "sehen", "sahen": "sehen", "saht": "sehen", "gesehen": "sehen",
  // kommen conjugates
  "komme": "kommen", "kommst": "kommen", "kommt": "kommen", "kommen": "kommen", "kam": "kommen", "kamst": "kommen", "kamen": "kommen", "kamt": "kommen", "gekommen": "kommen",
  // bringen conjugates
  "bringe": "bringen", "bringst": "bringen", "bringt": "bringen", "bringen": "bringen", "brachte": "bringen", "brachtest": "bringen", "brachten": "bringen", "brachtet": "bringen", "gebracht": "bringen",
  // erstellen conjugates
  "erstelle": "erstellen", "erstellst": "erstellen", "erstellt": "erstellen", "erstellen": "erstellen", "erstellte": "erstellen", "erstellten": "erstellen",
  // versammeln conjugates
  "versammle": "versammeln", "versammelst": "versammeln", "versammelt": "versammeln", "versammeln": "versammeln", "versammelte": "versammeln", "versammelten": "versammeln",
  // beeinflussen conjugates
  "beeinflusse": "beeinflussen", "beeinflusst": "beeinflussen", "beeinflussen": "beeinflussen", "beeinflusste": "beeinflussen", "beeinflussten": "beeinflussen",
};

const separablePrefixes = [
  "ab", "an", "auf", "aus", "bei", "ein", "los", "mit", "nach",
  "her", "hin", "vor", "weg", "zu", "zurück", "zusammen"
];

export function findGermanInfinitive(clickedWord: string, sentenceText: string): string {
  // 1. Clean the clicked word
  const cleanWord = clickedWord.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "").toLowerCase();
  if (!cleanWord) return "";

  // 2. Find root verb candidate
  const root = verbRoots[cleanWord];
  if (!root) {
    return cleanWord; // Fallback to plain lowercased word
  }

  // 3. Clean sentence and check for separable prefixes at clause endings
  // Split sentence by commas or end-of-sentence markers to process clauses
  const clauses = sentenceText.split(/[,;.:!?]/);
  
  // Find which clause contains the clicked word
  const containingClause = clauses.find(clause => {
    const words = clause.toLowerCase().split(/\s+/).map(w => w.replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, ""));
    return words.includes(cleanWord);
  }) || sentenceText;

  // Split clause into words and clean them
  const clauseWords = containingClause
    .split(/\s+/)
    .map(w => w.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "").toLowerCase())
    .filter(Boolean);

  // Look at the last few words of the clause for a separable prefix
  // In main clauses, prefix goes to the very end (last or second-to-last word)
  const maxSearchRange = Math.min(3, clauseWords.length);
  for (let i = 1; i <= maxSearchRange; i++) {
    const candidateIdx = clauseWords.length - i;
    if (candidateIdx >= 0) {
      const candidatePrefix = clauseWords[candidateIdx];
      if (separablePrefixes.includes(candidatePrefix) && candidatePrefix !== cleanWord) {
        // Reconstruct the verb (e.g. an + stehen = anstehen)
        return `${candidatePrefix}${root}`;
      }
    }
  }

  return root; // Fallback to direct infinitive root
}
