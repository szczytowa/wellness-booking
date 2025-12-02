#!/bin/bash

# PWA Icon Generator
# Requires ImageMagick: brew install imagemagick (Mac) or apt install imagemagick (Linux)

# Source SVG
SOURCE="public/icons/icon.svg"

# Output directory
OUTPUT="public/icons"

# Sizes to generate
SIZES=(72 96 128 144 152 192 384 512)

echo "Generating PWA icons..."

for size in "${SIZES[@]}"; do
    echo "Creating ${size}x${size}..."
    convert -background none -resize ${size}x${size} "$SOURCE" "${OUTPUT}/icon-${size}x${size}.png"
done

echo "Done! Icons generated in ${OUTPUT}/"

# If you don't have ImageMagick, you can use online tools:
# - https://realfavicongenerator.net/
# - https://www.pwabuilder.com/imageGenerator
# 
# Or generate manually using:
# - Figma
# - Canva
# - Adobe Express
