#!/bin/bash

mkdir -p build

inkscape src/renderer/icon.svg --export-type=png --export-filename=build/icon.png --export-width=512 --export-height=512

mkdir -p build/icon.iconset

inkscape src/renderer/icon.svg --export-type=png --export-filename=build/icon.iconset/icon_16x16.png --export-width=16 --export-height=16
inkscape src/renderer/icon.svg --export-type=png --export-filename=build/icon.iconset/icon_16x16@2x.png --export-width=32 --export-height=32
inkscape src/renderer/icon.svg --export-type=png --export-filename=build/icon.iconset/icon_32x32.png --export-width=32 --export-height=32
inkscape src/renderer/icon.svg --export-type=png --export-filename=build/icon.iconset/icon_32x32@2x.png --export-width=64 --export-height=64
inkscape src/renderer/icon.svg --export-type=png --export-filename=build/icon.iconset/icon_128x128.png --export-width=128 --export-height=128
inkscape src/renderer/icon.svg --export-type=png --export-filename=build/icon.iconset/icon_128x128@2x.png --export-width=256 --export-height=256
inkscape src/renderer/icon.svg --export-type=png --export-filename=build/icon.iconset/icon_256x256.png --export-width=256 --export-height=256
inkscape src/renderer/icon.svg --export-type=png --export-filename=build/icon.iconset/icon_256x256@2x.png --export-width=512 --export-height=512
inkscape src/renderer/icon.svg --export-type=png --export-filename=build/icon.iconset/icon_512x512.png --export-width=512 --export-height=512
inkscape src/renderer/icon.svg --export-type=png --export-filename=build/icon.iconset/icon_512x512@2x.png --export-width=1024 --export-height=1024

magick build/icon.png \
  \( -clone 0 -resize 16x16 \) \
  \( -clone 0 -resize 32x32 \) \
  \( -clone 0 -resize 48x48 \) \
  \( -clone 0 -resize 64x64 \) \
  \( -clone 0 -resize 128x128 \) \
  \( -clone 0 -resize 256x256 \) \
  \( -clone 0 -resize 512x512 \) \
  -delete 0 build/icon.ico


magick build/icon.iconset/icon_*.png build/icon.icns

rm -rf build/icon.iconset

ls -la build/icon.*

cp build/icon.ico src/renderer/icon.ico