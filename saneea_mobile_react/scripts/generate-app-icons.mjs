import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "..");
const brandDir = path.join(root, "assets", "brand");
const sourceLogo = path.join(repoRoot, "client", "src", "assets", "logo.png");
const mobileLogo = path.join(brandDir, "logo.png");

async function createIcon(output, logoWidth) {
  const logoBuffer = await sharp(sourceLogo)
    .resize({ width: logoWidth, withoutEnlargement: true })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: "#FFFFFF",
    },
  })
    .composite([{ input: logoBuffer, gravity: "center" }])
    .png()
    .toFile(output);
}

await fs.mkdir(brandDir, { recursive: true });
await fs.copyFile(sourceLogo, mobileLogo);

await createIcon(path.join(brandDir, "app_icon.png"), 760);
await createIcon(path.join(brandDir, "app_icon_foreground.png"), 640);
