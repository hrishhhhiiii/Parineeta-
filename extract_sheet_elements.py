import os
import shutil
from PIL import Image

base_dir = r"c:\Users\hrish\Desktop\logo"
brain_dir = r"C:\Users\hrish\.gemini\antigravity\brain\50747dfb-9620-4e14-800a-ba43140470f1"
sheet_img_name = "brand_identity_sheet_1790335817959.jpg"
sheet_path = os.path.join(brain_dir, sheet_img_name)

# 1. Copy the full presentation sheet to the workspace
dest_sheet = os.path.join(base_dir, "brand_identity_presentation_sheet.jpg")
shutil.copy2(sheet_path, dest_sheet)

# Copy to 02_Horizontal_Wordmark and 03_Submark_and_Monogram as well
os.makedirs(os.path.join(base_dir, "08_Presentation_Sheets"), exist_ok=True)
shutil.copy2(sheet_path, os.path.join(base_dir, "08_Presentation_Sheets", "vector_brand_identity_sheet.jpg"))

# 2. Open image to extract the 3 elements and make transparent versions
im = Image.open(sheet_path).convert("RGBA")
W, H = im.size

# The 3 elements are laid out horizontally:
# Left Monogram: approx x = 0 to 0.32 * W
# Center Lockup: approx x = 0.28 * W to 0.74 * W
# Right App Icon: approx x = 0.72 * W to 1.0 * W

# Function to make white background transparent
def make_white_transparent(image, threshold=240):
    rgba = image.convert("RGBA")
    data = rgba.getdata()
    newData = []
    for item in data:
        # Check if color is close to pure white
        if item[0] >= threshold and item[1] >= threshold and item[2] >= threshold:
            # Fully transparent
            newData.append((255, 255, 255, 0))
        elif item[0] > 215 and item[1] > 215 and item[2] > 215:
            # Soft edge anti-aliasing
            alpha = int(255 - ((min(item[0], item[1], item[2]) - 215) / 25.0 * 255))
            newData.append((item[0], item[1], item[2], max(0, min(255, alpha))))
        else:
            newData.append(item)
    rgba.putdata(newData)
    return rgba

# Crop Left: Monogram
box_left = (int(0.04 * W), int(0.20 * H), int(0.28 * W), int(0.75 * H))
im_left = im.crop(box_left)
bbox_left = im_left.convert("L").point(lambda p: 255 if p < 245 else 0).getbbox()
if bbox_left:
    pad = 20
    im_left = im_left.crop((max(0, bbox_left[0]-pad), max(0, bbox_left[1]-pad), min(im_left.width, bbox_left[2]+pad), min(im_left.height, bbox_left[3]+pad)))
im_left_trans = make_white_transparent(im_left)
im_left_trans.save(os.path.join(base_dir, "03_Submark_and_Monogram", "parineeta_monogram_initial_transparent.png"))

# Crop Center: Horizontal Logo Lockup
box_center = (int(0.28 * W), int(0.30 * H), int(0.74 * W), int(0.75 * H))
im_center = im.crop(box_center)
bbox_center = im_center.convert("L").point(lambda p: 255 if p < 245 else 0).getbbox()
if bbox_center:
    pad = 20
    im_center = im_center.crop((max(0, bbox_center[0]-pad), max(0, bbox_center[1]-pad), min(im_center.width, bbox_center[2]+pad), min(im_center.height, bbox_center[3]+pad)))
im_center_trans = make_white_transparent(im_center)
im_center_trans.save(os.path.join(base_dir, "02_Horizontal_Wordmark", "parineeta_horizontal_lockup_transparent.png"))

# Crop Right: App Icon Hallmark Badge
box_right = (int(0.74 * W), int(0.30 * H), int(0.96 * W), int(0.70 * H))
im_right = im.crop(box_right)
bbox_right = im_right.convert("L").point(lambda p: 255 if p < 245 else 0).getbbox()
if bbox_right:
    pad = 10
    im_right = im_right.crop((max(0, bbox_right[0]-pad), max(0, bbox_right[1]-pad), min(im_right.width, bbox_right[2]+pad), min(im_right.height, bbox_right[3]+pad)))
im_right_trans = make_white_transparent(im_right)
im_right_trans.save(os.path.join(base_dir, "03_Submark_and_Monogram", "parineeta_app_icon_hallmark_badge.png"))

# Also make the entire presentation sheet transparent
sheet_trans = make_white_transparent(im)
sheet_trans.save(os.path.join(base_dir, "08_Presentation_Sheets", "vector_brand_identity_sheet_transparent.png"))

print("Extracted all 3 isolated elements and transparent assets successfully!")
