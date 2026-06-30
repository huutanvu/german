export function compileAnnotatedText(seqTokens: any[]) {
  let text = "";
  let currentPos = 0;
  
  let isBold = false;
  let isItalic = false;
  
  const tempTokens: any[] = [];
  
  for (let i = 0; i < seqTokens.length; i++) {
    const st = seqTokens[i];
    const t = st.t || "";
    
    // Check if this is a bold toggle (double asterisks/underscores)
    if (t === "**" || t === "__") {
      isBold = !isBold;
      continue;
    }
    
    // Check if it is two adjacent single asterisks/underscores representing bold
    if ((t === "*" && i + 1 < seqTokens.length && seqTokens[i + 1].t === "*") ||
        (t === "_" && i + 1 < seqTokens.length && seqTokens[i + 1].t === "_")) {
      isBold = !isBold;
      i++; // skip next asterisk
      continue;
    }
    
    // Check if this is an italic toggle (single asterisk/underscore)
    if (t === "*" || t === "_") {
      isItalic = !isItalic;
      continue;
    }
    
    // Check if the token text itself is wrapped in bold/italic (e.g. "**Quellcode**")
    let cleanText = t;
    let tokenBold = isBold;
    let tokenItalic = isItalic;
    
    if ((cleanText.startsWith("**") && cleanText.endsWith("**")) || (cleanText.startsWith("__") && cleanText.endsWith("__"))) {
      tokenBold = true;
      cleanText = cleanText.slice(2, -2);
    } else if ((cleanText.startsWith("*") && cleanText.endsWith("*")) || (cleanText.startsWith("_") && cleanText.endsWith("_"))) {
      tokenItalic = true;
      cleanText = cleanText.slice(1, -1);
    }
    
    const start = currentPos;
    const end = currentPos + cleanText.length;
    text += cleanText;
    currentPos = end;
    
    tempTokens.push({
      index: tempTokens.length, // temporary index
      text: cleanText,
      spans: [[start, end]],
      type: st.type || (cleanText.trim() ? "word" : "space"),
      lemma: st.lemma,
      sepId: st.sepId,
      bold: tokenBold,
      italic: tokenItalic
    });
  }
  
  // Second pass: group separable verbs
  const sepMap = new Map<number, number>();
  tempTokens.forEach((t, idx) => {
    t.index = idx;
    if (t.sepId !== undefined) {
      if (t.type === "separable" || t.type === "verb" || (t.lemma && !t.type?.includes("prefix"))) {
        sepMap.set(t.sepId, t.index);
      }
    }
  });
  
  const finalTokens: any[] = [];
  tempTokens.forEach((t) => {
    if (t.sepId !== undefined) {
      const primaryIdx = sepMap.get(t.sepId);
      if (primaryIdx !== undefined && primaryIdx !== t.index) {
        const primaryToken = tempTokens[primaryIdx];
        if (primaryToken) {
          primaryToken.spans.push(t.spans[0]);
          primaryToken.type = "separable";
        }
        return;
      }
    }
    finalTokens.push({
      index: finalTokens.length,
      spans: t.spans,
      type: t.type,
      lemma: t.lemma,
      bold: t.bold || undefined,
      italic: t.italic || undefined
    });
  });
  
  finalTokens.forEach((t, idx) => {
    t.index = idx;
  });
  
  return {
    text,
    tokens: finalTokens
  };
}

export function compileTokenInput(input: any): any {
  if (!input) return input;
  let parsed = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      return input;
    }
  }
  
  if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.tokens) && parsed.tokens.length > 0 && parsed.tokens[0].t !== undefined) {
      return compileAnnotatedText(parsed.tokens);
    } else if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].t !== undefined) {
      return compileAnnotatedText(parsed);
    }
  }
  
  return input;
}
