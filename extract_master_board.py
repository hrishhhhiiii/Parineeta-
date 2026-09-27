import os
import shutil
from PIL import Image

base_dir = r"c:\Users\hrish\Desktop\logo"
brain_dir = r"C:\Users\hrish\.gemini\antigravity\brain\50747dfb-9620-4e14-800a-ba43140470f1"
board_img_name = "final_master_brand_board_1790336006940.jpg"
board_path = os.path.join(brain_dir, board_img_name)

# 1. Copy the full master board to root and 08_Presentation_Sheets
shutil.copy2(board_path, os.path.join(base_dir, "final_master_brand_board.jpg"))
shutil.copy2(board_path, os.path.join(base_dir, "08_Presentation_Sheets", "final_master_brand_board.jpg"))

# 2. Open image to extract the Big Primary Logo and make transparent versions
im = Image.open(board_path).convert("RGBA")
W, H = im.size

def make_white_transparent(image, threshold=242):
    rgba = image.convert("RGBA")
    data = list(rgba.getdata())
    newData = []
    for item in data:
        # Check if color is close to pure white
        if item[0] >= threshold and item[1] >= threshold and item[2] >= threshold:
            newData.append((255, 255, 255, 0))
        elif item[0] > 220 and item[1] > 220 and item[2] > 220:
            # Soft anti-aliasing
            alpha = int(255 - ((min(item[0], item[1], item[2]) - 220) / 22.0 * 255))
            newData.append((item[0], item[1], item[2], max(0, min(255, alpha))))
        else:
            newData.append(item)
    rgba.putdata(newData)
    return rgba

# Crop the Big Primary Logo (Left side)
# Bounding box roughly: x from 0.03 to 0.52 * W, y from 0.08 to 0.95 * H
box_primary = (int(0.04 * W), int(0.08 * H), int(0.53 * W), int(0.95 * H))
im_primary = im.crop(box_primary)
bbox_p = im_primary.convert("L").point(lambda p: 255 if p < 240 else 0).getbbox()
if bbox_p:
    pad = 25
    im_primary = im_primary.crop((max(0, bbox_p[0]-pad), max(0, bbox_p[1]-pad), min(im_primary.width, bbox_p[2]+pad), min(im_primary.height, bbox_p[3]+pad)))

im_primary_trans = make_white_transparent(im_primary)
im_primary_trans.save(os.path.join(base_dir, "01_Primary_Crest", "parineeta_big_primary_crest_isolated.png"))

# Also save high-res JPG of the isolated big crest
im_primary.convert("RGB").save(os.path.join(base_dir, "01_Primary_Crest", "parineeta_big_primary_crest_isolated.jpg"), quality=95)

# Save transparent cutout of the entire master brand board
board_trans = make_white_transparent(im)
board_trans.save(os.path.join(base_dir, "08_Presentation_Sheets", "final_master_brand_board_transparent.png"))

print("Extracted Big Primary Logo and master board cutouts successfully!")
