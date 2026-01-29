#!/usr/bin/env node
/**
 * Generate placeholder icons for AlloLib Studio
 *
 * This script creates simple placeholder icons for all platforms.
 * For production, replace these with proper designed icons.
 *
 * Usage: node generate-icons.js
 *
 * Requirements: npm install sharp
 */

const fs = require('fs');
const path = require('path');

async function generateIcons() {
  const resourcesDir = path.join(__dirname, '..', 'resources');
  const iconsDir = path.join(resourcesDir, 'icons');

  // Ensure directories exist
  if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir, { recursive: true });
  }
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('Error: sharp is required for icon generation');
    console.error('Run: npm install sharp');
    process.exit(1);
  }

  console.log('Generating icons with sharp...');

  // SVG template for the icon - blue gradient with "A" letter
  function createSvg(size) {
    return Buffer.from(`
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#58a6ff;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1f6feb;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#grad)"/>
        <text x="50%" y="58%" font-family="Arial, Helvetica, sans-serif" font-size="${size * 0.55}"
              font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">A</text>
      </svg>
    `);
  }

  // Generate icons at various sizes
  const sizes = [16, 32, 48, 64, 128, 256, 512];

  for (const size of sizes) {
    const svg = createSvg(size);
    const png = await sharp(svg).png().toBuffer();

    // Write to icons folder
    fs.writeFileSync(path.join(iconsDir, `${size}x${size}.png`), png);
    console.log(`Created: resources/icons/${size}x${size}.png`);
  }

  // Copy 256x256 as main icon
  const mainIcon = await sharp(createSvg(256)).png().toBuffer();
  fs.writeFileSync(path.join(resourcesDir, 'icon.png'), mainIcon);
  console.log('Created: resources/icon.png');

  // Create tray icon (16x16)
  const trayIcon = await sharp(createSvg(16)).png().toBuffer();
  fs.writeFileSync(path.join(resourcesDir, 'tray-icon.png'), trayIcon);
  console.log('Created: resources/tray-icon.png');

  console.log('');
  console.log('Icon generation complete!');
  console.log('Note: These are placeholder icons. Replace with proper designed icons before production release.');
}

generateIcons().catch(err => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
