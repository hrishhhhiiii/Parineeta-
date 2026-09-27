import os
import shutil
from PIL import Image, ImageOps, ImageFilter, ImageDraw

base_dir = r"c:\Users\hrish\Desktop\logo"
brain_dir = r"C:\Users\hrish\.gemini\antigravity\brain\50747dfb-9620-4e14-800a-ba43140470f1"

# Create directories
folders = [
    "01_Primary_Crest",
    "02_Horizontal_Wordmark",
    "03_Submark_and_Monogram",
    "04_Monochrome_and_Watermarks",
    "05_Brand_Mockups",
    "06_Vector_Source_Files",
    "07_Original_Reference"
]

for f in folders:
    os.makedirs(os.path.join(base_dir, f), exist_ok=True)

# 1. Primary Crest Files
crest_img_path = os.path.join(brain_dir, "bengali_logo_heritage_1790335010258.jpg")
shutil.copy2(crest_img_path, os.path.join(base_dir, "01_Primary_Crest", "parineeta_crest_heritage_crimson.jpg"))
shutil.copy2(os.path.join(brain_dir, "bengali_logo_crest_1790334954101.jpg"), os.path.join(base_dir, "01_Primary_Crest", "parineeta_crest_royal_gold.jpg"))
shutil.copy2(os.path.join(brain_dir, "bengali_logo_modern_1790334984244.jpg"), os.path.join(base_dir, "01_Primary_Crest", "parineeta_crest_lotus_alpana.jpg"))

# 2. Horizontal Wordmark (Letters fused with motifs)
wordmark_src = os.path.join(brain_dir, "parineeta_letter_fusion_1790335194867.jpg")
shutil.copy2(wordmark_src, os.path.join(base_dir, "02_Horizontal_Wordmark", "parineeta_wordmark_fusion.jpg"))

# 3. Brand Mockups
shutil.copy2(os.path.join(brain_dir, "parineeta_invitation_mockup_1790335244624.jpg"), os.path.join(base_dir, "05_Brand_Mockups", "mockup_wedding_invitation_velvet.jpg"))
shutil.copy2(os.path.join(brain_dir, "parineeta_bag_mockup_1790335268242.jpg"), os.path.join(base_dir, "05_Brand_Mockups", "mockup_bridal_boutique_bag.jpg"))

# 4. Original Reference
if os.path.exists(os.path.join(base_dir, "parineeta_original_logo.jpg")):
    shutil.copy2(os.path.join(base_dir, "parineeta_original_logo.jpg"), os.path.join(base_dir, "07_Original_Reference", "original_client_logo.jpg"))

# 5. Master Vector
if os.path.exists(os.path.join(base_dir, "parineeta_vector_logo.svg")):
    shutil.copy2(os.path.join(base_dir, "parineeta_vector_logo.svg"), os.path.join(base_dir, "06_Vector_Source_Files", "parineeta_master_vector.svg"))

print("Base files copied. Now generating transparent, monochrome, and icon assets...")

# Generate Transparent & Watermark Assets using PIL
# Load the wordmark image
im_word = Image.open(wordmark_src).convert("RGBA")
# For wordmark watermark, we extract high luminance (gold text and white shola)
# Background is dark maroon (R: 90-120, G: 5-25, B: 15-35)
r, g, b, a = im_word.split()

# Create a mask where gold/white details are preserved
# Gold has high green and red, white has high all three. Dark velvet has very low green/blue.
# Let's compute brightness and color distance from velvet red
pixels = im_word.load()
width, height = im_word.size

# Transparent Gold Wordmark
im_gold_trans = Image.new("RGBA", (width, height), (0, 0, 0, 0))
pix_gold = im_gold_trans.load()

# White Watermark
im_white_trans = Image.new("RGBA", (width, height), (0, 0, 0, 0))
pix_white = im_white_trans.load()

# Black Watermark
im_black_trans = Image.new("RGBA", (width, height), (0, 0, 0, 0))
pix_black = im_black_trans.load()

for y in range(height):
    for x in range(width):
        pr, pg, pb, pa = pixels[x, y]
        # Velvet red background has high pr, but low pg (< 45) and low pb (< 50)
        # Gold elements have pg > 70 or (pr > 180 and pg > 120)
        # White shola has pr, pg, pb all > 170
        
        # Calculate text/motif intensity
        intensity = max(0, int(pg * 1.5 + pb * 0.8 - pr * 0.4))
        # Refine threshold
        if pg > 60 or (pr > 150 and pg > 50 and pb > 40):
            # Alpha based on brightness of gold/white
            alpha = min(255, int(max(pg, pb) * 1.5))
            if alpha > 30:
                pix_gold[x, y] = (pr, pg, pb, alpha)
                pix_white[x, y] = (255, 255, 255, alpha)
                pix_black[x, y] = (20, 20, 20, alpha)

# Crop the wordmark to bounding box of content
bbox = im_gold_trans.getbbox()
if bbox:
    # Add small padding
    pad = 30
    crop_box = (
        max(0, bbox[0] - pad),
        max(0, bbox[1] - pad),
        min(width, bbox[2] + pad),
        min(height, bbox[3] + pad)
    )
    cropped_gold = im_gold_trans.crop(crop_box)
    cropped_white = im_white_trans.crop(crop_box)
    cropped_black = im_black_trans.crop(crop_box)
else:
    cropped_gold = im_gold_trans
    cropped_white = im_white_trans
    cropped_black = im_black_trans

cropped_gold.save(os.path.join(base_dir, "02_Horizontal_Wordmark", "parineeta_wordmark_transparent.png"))
cropped_white.save(os.path.join(base_dir, "04_Monochrome_and_Watermarks", "parineeta_watermark_white.png"))
cropped_black.save(os.path.join(base_dir, "04_Monochrome_and_Watermarks", "parineeta_watermark_black.png"))
cropped_gold.save(os.path.join(base_dir, "04_Monochrome_and_Watermarks", "parineeta_watermark_gold.png"))

# 4. Submark & Monogram Icons (Square circular crop from primary crest)
im_crest = Image.open(crest_img_path).convert("RGBA")
cw, ch = im_crest.size

# Instagram DP / Avatar (1080x1080)
im_crest.resize((1080, 1080), Image.Resampling.LANCZOS).save(os.path.join(base_dir, "03_Submark_and_Monogram", "parineeta_profile_avatar_1080x1080.png"))

# Circular Submark Badge with transparent border
circle_mask = Image.new("L", (cw, ch), 0)
draw = ImageDraw.Draw(circle_mask)
draw.ellipse((20, 20, cw-20, ch-20), fill=255)

submark = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
submark.paste(im_crest, (0, 0), circle_mask)
submark.resize((800, 800), Image.Resampling.LANCZOS).save(os.path.join(base_dir, "03_Submark_and_Monogram", "parineeta_submark_badge_round.png"))

# Favicon / Web App Icons
submark.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(base_dir, "03_Submark_and_Monogram", "favicon-512x512.png"))
submark.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(base_dir, "03_Submark_and_Monogram", "favicon-192x192.png"))
submark.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(base_dir, "03_Submark_and_Monogram", "favicon-32x32.png"))

print("All package assets generated successfully!")
