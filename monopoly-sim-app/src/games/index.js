// Registry of available game JSON files.
// Vite supports dynamic directory imports via import.meta.glob.
// This will automatically load any `*.json` in this folder.

const modules = import.meta.glob("./*.json", { eager: true });

// Convert { "./game.json": {...}, ... } -> { "game": {...}, ... }
export const games = Object.fromEntries(
  Object.entries(modules).map(([path, mod]) => {
    const key = path.replace(/^\.\//, "").replace(/\.json$/i, "");
    // JSON imports are exposed as { default: <json> }
    return [key, mod?.default ?? mod];
  })
);

export const gameOptions = Object.keys(games)
  .sort((a, b) => a.localeCompare(b))
  .map(key => ({
    key,
    label: key
  }));
