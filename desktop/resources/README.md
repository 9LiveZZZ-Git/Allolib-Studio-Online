# Desktop App Resources

This directory contains resources for the desktop application.

## Required Icons

Before building, you need to create the following icon files:

### Windows
- `icon.ico` - 256x256 multi-resolution icon (16, 32, 48, 64, 128, 256)

### macOS
- `icon.icns` - Multi-resolution icon set for macOS

### Linux
- `icons/` directory with:
  - `16x16.png`
  - `32x32.png`
  - `48x48.png`
  - `64x64.png`
  - `128x128.png`
  - `256x256.png`
  - `512x512.png`

### Tray Icon
- `tray-icon.png` - 16x16 or 22x22 PNG for system tray

## Generating Icons

You can use online tools or command-line tools to generate icons:

### Using ImageMagick (Linux/macOS)
```bash
# From a source PNG (512x512 or larger)
convert icon-source.png -resize 256x256 icon.png

# For ICO (Windows)
convert icon-source.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# For ICNS (macOS) - requires iconutil on macOS
mkdir icon.iconset
for size in 16 32 64 128 256 512; do
  convert icon-source.png -resize ${size}x${size} icon.iconset/icon_${size}x${size}.png
  convert icon-source.png -resize $((size*2))x$((size*2)) icon.iconset/icon_${size}x${size}@2x.png
done
iconutil -c icns icon.iconset -o icon.icns
```

### Online Tools
- https://icoconvert.com/ - Convert PNG to ICO
- https://cloudconvert.com/png-to-icns - Convert PNG to ICNS
- https://realfavicongenerator.net/ - Generate all icon formats

## Placeholder Icons

If icons are missing, the build will use Electron's default icon.
