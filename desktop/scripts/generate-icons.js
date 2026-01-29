#!/usr/bin/env node
/**
 * Generate placeholder icons for AlloLib Studio
 *
 * This script creates simple placeholder icons for all platforms.
 * For production, replace these with proper designed icons.
 *
 * Usage: node generate-icons.js
 *
 * Requirements: npm install sharp png-to-ico
 */

const fs = require('fs');
const path = require('path');

// Try to use sharp for image generation, fall back to creating empty files
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
    console.log('Using sharp for icon generation');
  } catch (e) {
    console.log('sharp not available, creating placeholder files');
    console.log('For proper icons, run: npm install sharp');

    // Create placeholder files
    const placeholderPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    // Create minimal placeholder files
    fs.writeFileSync(path.join(resourcesDir, 'icon.png'), placeholderPng);
    fs.writeFileSync(path.join(resourcesDir, 'tray-icon.png'), placeholderPng);

    // Create Linux icon sizes
    const sizes = [16, 32, 48, 64, 128, 256, 512];
    for (const size of sizes) {
      fs.writeFileSync(path.join(iconsDir, `${size}x${size}.png`), placeholderPng);
    }

    console.log('Placeholder icons created. Replace with proper icons before release.');
    return;
  }

  // Generate icons with sharp
  const sizes = [16, 32, 48, 64, 128, 256, 512];

  // Create a simple gradient icon
  async function createIcon(size) {
    // Create a simple blue gradient square with "A" letter
    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#58a6ff;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1f6feb;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#grad)"/>
        <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="${size * 0.6}"
              font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">A</text>
      </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  console.log('Generating icons...');

  // Generate PNG icons for each size
  for (const size of sizes) {
    const buffer = await createIcon(size);
    const filename = path.join(iconsDir, `${size}x${size}.png`);
    fs.writeFileSync(filename, buffer);
    console.log(`  Created: ${size}x${size}.png`);
  }

  // Copy 256x256 as main icon
  const mainIcon = await createIcon(256);
  fs.writeFileSync(path.join(resourcesDir, 'icon.png'), mainIcon);
  console.log('  Created: icon.png');

  // Create tray icon (16x16)
  const trayIcon = await createIcon(16);
  fs.writeFileSync(path.join(resourcesDir, 'tray-icon.png'), trayIcon);
  console.log('  Created: tray-icon.png');

  // Try to create ICO for Windows
  try {
    const pngToIco = require('png-to-ico');
    const pngFiles = [16, 32, 48, 64, 128, 256].map(size =>
      path.join(iconsDir, `${size}x${size}.png`)
    );
    const ico = await pngToIco(pngFiles);
    fs.writeFileSync(path.join(resourcesDir, 'icon.ico'), ico);
    console.log('  Created: icon.ico');
  } catch (e) {
    console.log('  Skipping ICO (install png-to-ico for Windows icon)');
  }

  console.log('');
  console.log('Icon generation complete!');
  console.log('Note: For macOS .icns, use iconutil on macOS or an online converter.');
}

generateIcons().catch(console.error);
