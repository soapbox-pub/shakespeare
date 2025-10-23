#!/bin/bash

# Script to generate Electron icons from the Shakespeare logo
# Requires ImageMagick to be installed: brew install imagemagick (macOS) or apt-get install imagemagick (Linux)

set -e

echo "🎭 Generating Electron icons for Shakespeare..."

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick is not installed."
    echo ""
    echo "Please install ImageMagick:"
    echo "  macOS:   brew install imagemagick"
    echo "  Ubuntu:  sudo apt-get install imagemagick"
    echo "  Windows: Download from https://imagemagick.org/script/download.php"
    echo ""
    echo "Alternatively, use an online tool or electron-icon-builder:"
    echo "  npm install -g electron-icon-builder"
    echo "  electron-icon-builder --input=public/shakespeare-512x512.png --output=electron/resources"
    exit 1
fi

# Source image
SOURCE="public/shakespeare-512x512.png"

if [ ! -f "$SOURCE" ]; then
    echo "❌ Source image not found: $SOURCE"
    exit 1
fi

# Create resources directory if it doesn't exist
mkdir -p electron/resources/icons

echo "📦 Generating macOS icon (icon.icns)..."
# Create iconset directory
mkdir -p electron/resources/icon.iconset

# Generate different sizes for macOS
convert "$SOURCE" -resize 16x16 electron/resources/icon.iconset/icon_16x16.png
convert "$SOURCE" -resize 32x32 electron/resources/icon.iconset/icon_16x16@2x.png
convert "$SOURCE" -resize 32x32 electron/resources/icon.iconset/icon_32x32.png
convert "$SOURCE" -resize 64x64 electron/resources/icon.iconset/icon_32x32@2x.png
convert "$SOURCE" -resize 128x128 electron/resources/icon.iconset/icon_128x128.png
convert "$SOURCE" -resize 256x256 electron/resources/icon.iconset/icon_128x128@2x.png
convert "$SOURCE" -resize 256x256 electron/resources/icon.iconset/icon_256x256.png
convert "$SOURCE" -resize 512x512 electron/resources/icon.iconset/icon_256x256@2x.png
convert "$SOURCE" -resize 512x512 electron/resources/icon.iconset/icon_512x512.png
convert "$SOURCE" -resize 1024x1024 electron/resources/icon.iconset/icon_512x512@2x.png

# Convert to icns (macOS only)
if command -v iconutil &> /dev/null; then
    iconutil -c icns electron/resources/icon.iconset -o electron/resources/icon.icns
    echo "✅ Created icon.icns"
else
    echo "⚠️  iconutil not found (macOS only). Skipping .icns generation."
    echo "   You can use an online converter or run this on macOS."
fi

# Clean up iconset
rm -rf electron/resources/icon.iconset

echo "📦 Generating Windows icon (icon.ico)..."
# Generate ico file with multiple sizes
convert "$SOURCE" -resize 256x256 \
    \( -clone 0 -resize 16x16 \) \
    \( -clone 0 -resize 32x32 \) \
    \( -clone 0 -resize 48x48 \) \
    \( -clone 0 -resize 64x64 \) \
    \( -clone 0 -resize 128x128 \) \
    \( -clone 0 -resize 256x256 \) \
    -delete 0 electron/resources/icon.ico
echo "✅ Created icon.ico"

echo "📦 Generating Linux icons (PNG)..."
# Generate PNG icons for Linux
for size in 16 32 48 64 128 256 512 1024; do
    convert "$SOURCE" -resize ${size}x${size} electron/resources/icons/${size}x${size}.png
done
echo "✅ Created Linux PNG icons"

echo ""
echo "✨ Icon generation complete!"
echo ""
echo "Generated files:"
echo "  - electron/resources/icon.icns (macOS)"
echo "  - electron/resources/icon.ico (Windows)"
echo "  - electron/resources/icons/*.png (Linux)"
echo ""
echo "You can now build Electron apps with:"
echo "  npm run electron:build"
