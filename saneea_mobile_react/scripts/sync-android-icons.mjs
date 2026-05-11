import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resDir = path.join(root, "android", "app", "src", "main", "res");
const appIcon = path.join(root, "assets", "brand", "app_icon.png");
const foregroundIcon = path.join(root, "assets", "brand", "app_icon_foreground.png");

try {
  await fs.access(resDir);
} catch {
  console.log("No native Android project found; Expo will use app.json icon assets.");
  process.exit(0);
}

const densities = [
  ["mipmap-mdpi", 48],
  ["mipmap-hdpi", 72],
  ["mipmap-xhdpi", 96],
  ["mipmap-xxhdpi", 144],
  ["mipmap-xxxhdpi", 192],
];

for (const [dir, size] of densities) {
  const targetDir = path.join(resDir, dir);
  await sharp(appIcon)
    .resize(size, size)
    .webp({ quality: 100 })
    .toFile(path.join(targetDir, "ic_launcher.webp"));

  await sharp(appIcon)
    .resize(size, size)
    .webp({ quality: 100 })
    .toFile(path.join(targetDir, "ic_launcher_round.webp"));

  await sharp(foregroundIcon)
    .resize(size, size)
    .webp({ quality: 100 })
    .toFile(path.join(targetDir, "ic_launcher_foreground.webp"));
}
