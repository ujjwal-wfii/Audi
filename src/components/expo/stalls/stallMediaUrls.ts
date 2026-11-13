// The store and each mounted renderer hold separate references to local URLs.
// Replacing stored media releases ownership without interrupting active readers.
const references = new Map<string, number>();

export function retainMediaUrl(url: string): () => void {
    if (!url.startsWith("blob:")) return () => {};
    references.set(url, (references.get(url) ?? 0) + 1);
    let released = false;
    return () => {
        if (released) return;
        released = true;
        const remaining = (references.get(url) ?? 1) - 1;
        if (remaining > 0) references.set(url, remaining);
        else {
            references.delete(url);
            URL.revokeObjectURL(url);
        }
    };
}
