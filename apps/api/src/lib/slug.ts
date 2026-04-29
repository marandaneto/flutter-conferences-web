export function makeSlug(name: string, dateStart: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const month = new Date(dateStart)
    .toLocaleString("en-US", { month: "long" })
    .toLowerCase();
  const year = dateStart.slice(0, 4);
  return `${base}-${month}-${year}`.replace(/-+/g, "-");
}
