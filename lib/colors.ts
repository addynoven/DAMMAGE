export function labelColor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("pothole")) return "#f59e0b";
  if (l.includes("crack")) return "#3CFFD0";
  if (l.includes("wear") || l.includes("surface")) return "#a855f7";
  return "#ef4444";
}

const WASTE_COLORS: Record<string, string> = {
  garbage: "#FF0000",
  pile: "#FF0000",
  cardboard: "#FF8C00",
  bottle: "#FF8C00",
  plastic: "#FF8C00",
  metal: "#22c55e",
  organic: "#84cc16",
};

export function wasteColor(label: string): string {
  const l = label.toLowerCase();
  for (const [key, color] of Object.entries(WASTE_COLORS)) {
    if (l.includes(key)) return color;
  }
  return "#f59e0b";
}
