#!/usr/bin/env bash
# Image generation script for Nội Thất AVH project.
# Runs each generation sequentially with a 10s sleep between, retries once on 429.

set -u

PRODUCT_DIR="/home/z/my-project/public/products"
BANNER_DIR="/home/z/my-project/public/banners"
CAT_DIR="/home/z/my-project/public/categories"
BLOG_DIR="/home/z/my-project/public/blog"

mkdir -p "$PRODUCT_DIR" "$BANNER_DIR" "$CAT_DIR" "$BLOG_DIR"

# Each entry: "output_path|size|prompt"
JOBS=(
  "$PRODUCT_DIR/bed-beige.png|1024x1024|Modern king size bed with upholstered beige fabric headboard, neatly made with crisp white linens and pillows, minimalist bedroom furniture, professional product photography, bright soft light, white background, high quality, detailed"
  "$PRODUCT_DIR/armchair-yellow.png|1024x1024|Designer accent armchair with mustard yellow velvet upholstery and tapered wooden legs, mid-century modern style, studio product photo on pure white background, high quality, detailed"
  "$PRODUCT_DIR/wardrobe-white.png|1024x1024|Tall modern 3-door wardrobe in matte white finish with brass handles, minimalist bedroom storage furniture, full product shot on white background, bright studio light, high quality"
  "$PRODUCT_DIR/coffee-table.png|1024x1024|Round marble-top coffee table with black metal base, modern living room furniture, studio product photography on white background, high quality, detailed"
  "$PRODUCT_DIR/tv-stand.png|1024x1024|Low modern TV console media stand in walnut wood with black metal legs, minimalist living room furniture, product photo on white background, high quality"
  "$PRODUCT_DIR/floor-lamp.png|1024x1024|Arc floor lamp with marble base and matte black arc, modern decorative lighting, studio product photo on white background, high quality, detailed"
  "$PRODUCT_DIR/rug-pattern.png|1024x1024|Folded rolled rectangular area rug with geometric boho pattern in beige and terracotta tones, home decor product photo on white background, high quality"
  "$PRODUCT_DIR/nightstand.png|1024x1024|Small modern nightstand bedside table in light oak wood with single drawer, minimalist bedroom furniture, product photo on white background, high quality"
  "$PRODUCT_DIR/dining-chair.png|1024x1024|Set of two modern dining chairs with bentwood oak frame and grey fabric seat, Scandinavian design, product photo on white background, high quality"
  "$PRODUCT_DIR/office-desk.png|1024x1024|Modern minimalist writing desk in white oak with black metal legs, home office furniture, product photo on pure white background, high quality, detailed"
  "$BANNER_DIR/hero-1.png|1440x720|Wide banner of a bright modern minimalist living room with beige sofa, wooden coffee table, plants and large windows, lifestyle interior design photography, warm natural light, high quality"
  "$BANNER_DIR/hero-2.png|1440x720|Wide banner of an elegant modern bedroom with upholstered bed, wooden nightstands, soft bedding and warm lamp light at dusk, lifestyle interior photography, high quality"
  "$BANNER_DIR/hero-3.png|1440x720|Wide banner of a stylish Scandinavian dining room with light oak dining set, pendant lamp and plants, lifestyle interior photography, bright airy, high quality"
  "$CAT_DIR/cat-living.png|1024x1024|Cozy modern living room category icon image, sofa and coffee table, soft beige tones, top-down flat lay style, minimal, high quality"
  "$CAT_DIR/cat-bedroom.png|1024x1024|Serene modern bedroom category icon image, bed and nightstand, soft neutral tones, minimal, high quality"
  "$CAT_DIR/cat-dining.png|1024x1024|Modern dining room category icon image, table and chairs, light wood, minimal, high quality"
  "$CAT_DIR/cat-lighting.png|1024x1024|Decorative lighting category icon image, pendant and floor lamps, warm glow, minimal, high quality"
  "$BLOG_DIR/blog-1.png|1344x768|Interior design blog cover, arranging furniture in small living room, warm tones, lifestyle photography, high quality"
  "$BLOG_DIR/blog-2.png|1344x768|Interior design blog cover, choosing sofa fabric and color, swatches and sofa, lifestyle photography, high quality"
  "$BLOG_DIR/blog-3.png|1344x768|Interior design blog cover, lighting tips for cozy bedroom, warm lamp light, lifestyle photography, high quality"
)

RESULTS_FILE="/home/z/my-project/image-gen-results.txt"
: > "$RESULTS_FILE"

for entry in "${JOBS[@]}"; do
  IFS='|' read -r out_path size prompt <<< "$entry"
  fname="$(basename "$out_path")"
  echo "=== Generating $fname ($size) ==="
  if z-ai image -p "$prompt" -o "$out_path" -s "$size" > /tmp/zai-out.txt 2>&1; then
    if [[ -f "$out_path" ]]; then
      sz=$(stat -c%s "$out_path" 2>/dev/null || echo 0)
      echo "OK $fname $sz bytes" | tee -a "$RESULTS_FILE"
    else
      echo "FAIL $fname (no file produced) - see /tmp/zai-out.txt" | tee -a "$RESULTS_FILE"
    fi
  else
    # Check if 429
    if grep -q "429\|rate" /tmp/zai-out.txt; then
      echo "429 hit on $fname, sleeping 30s and retrying once..." | tee -a "$RESULTS_FILE"
      sleep 30
      if z-ai image -p "$prompt" -o "$out_path" -s "$size" > /tmp/zai-out2.txt 2>&1; then
        if [[ -f "$out_path" ]]; then
          sz=$(stat -c%s "$out_path" 2>/dev/null || echo 0)
          echo "OK-RETRY $fname $sz bytes" | tee -a "$RESULTS_FILE"
        else
          echo "FAIL $fname (retry produced no file)" | tee -a "$RESULTS_FILE"
        fi
      else
        echo "FAIL $fname (retry failed)" | tee -a "$RESULTS_FILE"
      fi
    else
      echo "FAIL $fname (non-429 error)" | tee -a "$RESULTS_FILE"
      tail -5 /tmp/zai-out.txt | tee -a "$RESULTS_FILE"
    fi
  fi
  sleep 10
done

echo "=== DONE ==="
cat "$RESULTS_FILE"
