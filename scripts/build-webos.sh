#!/bin/bash
# Build script for LG webOS TV package
# This creates an IPK file ready to install on LG Smart TVs

set -e

echo "🔧 Building web app..."
npm run build

echo "📦 Preparing webOS package..."
WEBOS_DIR="dist-webos"
rm -rf "$WEBOS_DIR"
mkdir -p "$WEBOS_DIR"

# Copy built files
cp -r dist/* "$WEBOS_DIR/"

# Copy webOS config
cp public/tv/webos/appinfo.json "$WEBOS_DIR/"

# Copy icons if they exist, otherwise create placeholders
if [ -f public/tv/webos/icon.png ]; then
  cp public/tv/webos/icon.png "$WEBOS_DIR/"
else
  echo "⚠️  No icon.png found - you'll need to add an 80x80 icon"
fi

if [ -f public/tv/webos/largeIcon.png ]; then
  cp public/tv/webos/largeIcon.png "$WEBOS_DIR/"
else
  echo "⚠️  No largeIcon.png found - you'll need to add a 130x130 icon"
fi

# Force TV mode by injecting ?tv=1 redirect
# This ensures the TV layout activates automatically
cat > "$WEBOS_DIR/webos-init.js" << 'EOF'
// Auto-detect webOS and set TV mode
if (!window.location.search.includes('tv=1') && !window.location.search.includes('mode=tv')) {
  var sep = window.location.search ? '&' : '?';
  window.location.replace(window.location.pathname + window.location.search + sep + 'tv=1' + window.location.hash);
}
EOF

# Inject webos-init.js into index.html before main script
sed -i 's|<script type="module"|<script src="webos-init.js"></script>\n    <script type="module"|' "$WEBOS_DIR/index.html"

echo ""
echo "✅ webOS package ready in: $WEBOS_DIR/"
echo ""
echo "📋 Next steps:"
echo "   1. Install webOS CLI: npm install -g @anthropic/webos-cli"
echo "   2. Package: ares-package $WEBOS_DIR"
echo "   3. Install on TV: ares-install com.iptv.player_1.0.0_all.ipk"
echo ""
echo "   OR use USB method - see README-WEBOS.md"
