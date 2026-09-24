/** Lowercase ASCII slug ("Kramer Bouwservice B.V." → "kramer-bouwservice-b-v"), or `fallback`
 * when nothing usable remains. Used for download filenames and question ids. */
export function slugify(text: string, fallback = ""): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || fallback
  );
}
