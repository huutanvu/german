export function compileAnnotatedText(seqTokens: any[]) {
  let text = "";
  let currentPos = 0;
  
  const tempTokens = seqTokens.map((st: any, idx: number) => {
    const start = currentPos;
    const end = currentPos + (st.t || "").length;
    text += (st.t || "");
    currentPos = end;
    
    return {
      index: idx,
      text: st.t || "",
      spans: [[start, end]],
      type: st.type || ((st.t || "").trim() ? "word" : "space"),
      lemma: st.lemma,
      sepId: st.sepId
    };
  });
  
  const sepMap = new Map<number, number>();
  tempTokens.forEach((t) => {
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
      lemma: t.lemma
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
