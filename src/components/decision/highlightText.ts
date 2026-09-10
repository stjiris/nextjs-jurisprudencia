/**
 * Wraps every occurrence of `term` inside `el` in a <mark> element.
 * Only text nodes are touched, so existing markup is preserved.
 */
export function highlightTextInElement(el: HTMLElement, term: string) {
    if (!term || !el) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) nodes.push(node as Text);
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    for (const textNode of nodes) {
        if (textNode.parentElement?.tagName === "MARK") continue;
        const text = textNode.textContent || '';
        if (!regex.test(text)) continue;
        regex.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(text)) !== null) {
            frag.appendChild(document.createTextNode(text.slice(last, m.index)));
            const mark = document.createElement('mark');
            mark.textContent = m[0];
            frag.appendChild(mark);
            last = m.index + m[0].length;
        }
        frag.appendChild(document.createTextNode(text.slice(last)));
        textNode.parentNode?.replaceChild(frag, textNode);
    }
}

/**
 * Turns a raw search query into the plain term to look for:
 * strips surrounding quotes and collapses whitespace.
 */
export function searchQueryToTerm(q: string | null | undefined) {
    if (!q) return "";
    return q.trim().replace(/^["']+|["']+$/g, "").replace(/\s+/g, " ").trim();
}
