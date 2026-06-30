#!/usr/bin/env python3
"""
Process client-provided Corsair Tactical Solutions photos.
Resize, crop, optimize, and save with descriptive filenames.
"""
import os
from PIL import Image

INPUT_DIR = '/workspace'
OUTPUT_DIR = '/workspace/corsair-website/public/images/corsair-real'

# Mapping from original filenames to new descriptive names + processing params
PHOTO_MAP = {
    # Range shooters / group training
    '20241116_115621.jpg': {
        'output': 'group-range-training-01.jpg',
        'crop': None,  # Full image, indoor range with multiple shooters
        'max_size': 1200,
    },
    '20241207_122420.jpg': {
        'output': 'range-lineup-01.jpg',
        'crop': None,  # Indoor range with shooters at stalls
        'max_size': 1200,
    },
    '20240706_114009.jpg': {
        'output': 'range-lineup-02.jpg',
        'crop': None,  # Range lineup, multiple shooters
        'max_size': 1200,
    },
    '20240706_113947.jpg': {
        'output': 'group-range-safety-briefing-01.jpg',
        'crop': None,  # Group at range, people standing
        'max_size': 1200,
    },
    
    # Student target success / beginner training
    '20250830_165945.jpg': {
        'output': 'student-target-success-01.jpg',
        'crop': None,  # Person with target, successful training
        'max_size': 1200,
    },
    '20251101_150513.jpg': {
        'output': 'student-target-success-02.jpg',
        'crop': None,  # Person holding target with hits
        'max_size': 1200,
    },
    
    # Individual shooter / handgun training
    '20260425_161711.jpg': {
        'output': 'range-shooter-lane-01.jpg',
        'crop': None,  # Individual shooter in lane from overhead
        'max_size': 1200,
    },
    '20251104_185714.jpg': {
        'output': 'handgun-training-student-01.jpg',
        'crop': None,  # Person at range with target, handgun training
        'max_size': 1200,
    },
    
    # Steve Hopwood photos
    '20251025_093457.jpg': {
        'output': 'steve-outdoor-range-01.jpg',
        'crop': None,  # Steve at outdoor range in tactical gear
        'max_size': 1200,
    },
    '20260104_113919.jpg': {
        'output': 'steve-security-uniform-01.jpg',
        'crop': None,  # Steve in Corsair security uniform with badge
        'max_size': 1200,
    },
    '20260426_112211.jpg': {
        'output': 'steve-security-closeup-01.jpg',
        'crop': None,  # Steve in security vehicle with Corsair patch
        'max_size': 1200,
    },
    'Screenshot_20240406_170433_Gallery.jpg': {
        'output': 'steve-classroom-instructor-01.jpg',
        'crop': None,  # Steve in classroom/office setting
        'max_size': 1200,
    },
    
    # Security team / church
    '20260328_191835.jpg': {
        'output': 'security-team-church-01.jpg',
        'crop': None,  # Steve with uniformed security team
        'max_size': 1200,
    },
    
    # Church / classroom training
    'IMG_20250322_215757.jpg': {
        'output': 'classroom-training-group-01.jpg',
        'crop': None,  # Church/community training session
        'max_size': 1200,
    },
    
    # Handgun closeup
    '20251111_175106.jpg': {
        'output': 'handgun-closeup-01.jpg',
        'crop': None,  # Close-up of handgun with optic
        'max_size': 1200,
    },
    
    # Hands-on defense training
    'IMG_20250225_205140.jpg': {
        'output': 'hands-on-defense-training-01.jpg',
        'crop': None,  # Steve demonstrating self-defense technique
        'max_size': 1200,
    },
    
    # Rifle range
    '20221111_180644.jpg': {
        'output': 'rifle-range-01.jpg',
        'crop': None,  # AR-15 rifle on mat with brass casings
        'max_size': 1200,
    },
    
    # Spent round closeup (use sparingly)
    '20250118_104015.jpg': {
        'output': 'spent-round-closeup-01.jpg',
        'crop': None,  # Close-up of spent cartridge
        'max_size': 800,
    },
    
    # Woman range training - we don't have a specific woman-only photo,
    # but 20251104_185714.jpg has a woman at the range
    # Already mapped above as handgun-training-student-01
    # We'll also save it as woman-range-training-01 since it shows a woman training
}


def process_photo(input_path, output_path, max_size=1200, crop=None):
    """Process a single photo: open, optionally crop, resize, and save optimized."""
    try:
        img = Image.open(input_path)
        
        # Auto-rotate based on EXIF
        from PIL import ImageOps
        img = ImageOps.exif_transpose(img)
        
        # Convert to RGB if necessary (for PNG with transparency)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # Apply crop if specified
        if crop:
            img = img.crop(crop)
        
        # Resize maintaining aspect ratio
        if max(img.size) > max_size:
            img.thumbnail((max_size, max_size), Image.LANCZOS)
        
        # Save optimized JPEG
        img.save(output_path, 'JPEG', quality=85, optimize=True)
        
        # Get file size
        size_kb = os.path.getsize(output_path) / 1024
        print(f"  ✓ {os.path.basename(output_path)}: {img.size[0]}x{img.size[1]} ({size_kb:.0f}KB)")
        
    except Exception as e:
        print(f"  ✗ Error processing {input_path}: {e}")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("Processing Corsair Tactical Solutions real photos...")
    print("=" * 60)
    
    processed = 0
    for input_name, config in PHOTO_MAP.items():
        input_path = os.path.join(INPUT_DIR, input_name)
        output_path = os.path.join(OUTPUT_DIR, config['output'])
        
        if not os.path.exists(input_path):
            print(f"  ✗ Missing: {input_name}")
            continue
        
        print(f"\nProcessing: {input_name} → {config['output']}")
        process_photo(input_path, output_path, config['max_size'], config.get('crop'))
        processed += 1
    
    # Special case: create woman-range-training-01 from the same source
    # (20251104_185714.jpg shows a woman at the range)
    src = os.path.join(INPUT_DIR, '20251104_185714.jpg')
    dst = os.path.join(OUTPUT_DIR, 'woman-range-training-01.jpg')
    if os.path.exists(src):
        print(f"\nProcessing: 20251104_185714.jpg → woman-range-training-01.jpg")
        process_photo(src, dst, max_size=1200)
        processed += 1
    
    print(f"\n{'=' * 60}")
    print(f"Total processed: {processed} photos")
    print(f"Output directory: {OUTPUT_DIR}")
    
    # List all output files
    print(f"\nFiles in output directory:")
    for f in sorted(os.listdir(OUTPUT_DIR)):
        size_kb = os.path.getsize(os.path.join(OUTPUT_DIR, f)) / 1024
        print(f"  {f}: {size_kb:.0f}KB")


if __name__ == '__main__':
    main()
