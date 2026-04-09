#!/usr/bin/env python3
"""
Create thumbnail grids from PowerPoint presentation slides.

Creates a grid layout of slide thumbnails with configurable columns (max 6).
Each grid contains up to cols×(cols+1) images. For presentations with more
slides, multiple numbered grid files are created automatically.

The program outputs the names of all files created.

Output:
- Single grid: {prefix}.jpg (if slides fit in one grid)
- Multiple grids: {prefix}-1.jpg, {prefix}-2.jpg, etc.

Grid limits by column count:
- 3 cols: max 12 slides per grid (3×4)
- 4 cols: max 20 slides per grid (4×5)
- 5 cols: max 30 slides per grid (5×6) [default]
- 6 cols: max 42 slides per grid (6×7)

Usage:
    python thumbnail.py input.pptx [output_prefix] [--cols N] [--outline-placeholders]

Examples:
    python thumbnail.py presentation.pptx
    # Creates: thumbnails.jpg (using default prefix)
    # Outputs:
    #   Created 1 grid(s):
    #     - thumbnails.jpg

    python thumbnail.py large-deck.pptx grid --cols 4
    # Creates: grid-1.jpg, grid-2.jpg, grid-3.jpg
    # Outputs:
    #   Created 3 grid(s):
    #     - grid-1.jpg
    #     - grid-2.jpg
    #     - grid-3.jpg

"""

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# Constants
THUMBNAIL_WIDTH = 300  # Fixed thumbnail width in pixels
CONVERSION_DPI = 72  # DPI for PDF to image conversion (72 is sufficient for 300px thumbnails)
MAX_COLS = 6  # Maximum number of columns
DEFAULT_COLS = 5  # Default number of columns
JPEG_QUALITY = 95  # JPEG compression quality
# Dedicated LibreOffice profile keeps soffice startup light and avoids
# clobbering the user's personal LibreOffice profile.
LO_USER_PROFILE = "/tmp/lo-pptx-skill-profile"

# Grid layout constants
GRID_PADDING = 20  # Padding between thumbnails
BORDER_WIDTH = 2  # Border width around thumbnails
FONT_SIZE_RATIO = 0.12  # Font size as fraction of thumbnail width
LABEL_PADDING_RATIO = 0.4  # Label padding as fraction of font size


def main():
    parser = argparse.ArgumentParser(
        description="Create thumbnail grids from PowerPoint slides."
    )
    parser.add_argument("input", help="Input PowerPoint file (.pptx)")
    parser.add_argument(
        "output_prefix",
        nargs="?",
        default="thumbnails",
        help="Output prefix for image files (default: thumbnails, will create prefix.jpg or prefix-N.jpg)",
    )
    parser.add_argument(
        "--cols",
        type=int,
        default=DEFAULT_COLS,
        help=f"Number of columns (default: {DEFAULT_COLS}, max: {MAX_COLS})",
    )
    args = parser.parse_args()

    # Validate columns
    cols = min(args.cols, MAX_COLS)
    if args.cols > MAX_COLS:
        print(f"Warning: Columns limited to {MAX_COLS} (requested {args.cols})")

    # Validate input
    input_path = Path(args.input)
    if not input_path.exists() or input_path.suffix.lower() != ".pptx":
        print(f"Error: Invalid PowerPoint file: {args.input}")
        sys.exit(1)

    # Construct output path (always JPG)
    output_path = Path(f"{args.output_prefix}.jpg")

    print(f"Processing: {args.input}")

    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            # Convert slides to images
            slide_images = convert_to_images(input_path, Path(temp_dir), CONVERSION_DPI)
            if not slide_images:
                print("Error: No slides found")
                sys.exit(1)

            print(f"Found {len(slide_images)} slides")

            # Create grids (max cols×(cols+1) images per grid)
            grid_files = create_grids(
                slide_images,
                cols,
                THUMBNAIL_WIDTH,
                output_path,
            )

            # Print saved files
            print(f"Created {len(grid_files)} grid(s):")
            for grid_file in grid_files:
                print(f"  - {grid_file}")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)



def convert_to_images(pptx_path, temp_dir, dpi):
    """Convert PowerPoint to images via LibreOffice (PDF) + pdftoppm."""
    pdf_path = temp_dir / f"{pptx_path.stem}.pdf"

    # Convert to PDF via LibreOffice.
    # Flags minimise cold-start cost:
    #   -env:UserInstallation  — dedicated profile (no first-run wizard / lock churn)
    #   --norestore            — skip crash recovery scan
    #   --nolockcheck          — skip global lock file check
    #   --nologo --nodefault   — skip splash / default-document load
    #   --nofirststartwizard   — skip first-start wizard
    print("Converting to PDF via LibreOffice...")
    result = subprocess.run(
        [
            "soffice",
            f"-env:UserInstallation=file://{LO_USER_PROFILE}",
            "--headless",
            "--norestore",
            "--nolockcheck",
            "--nologo",
            "--nodefault",
            "--nofirststartwizard",
            "--convert-to",
            "pdf",
            "--outdir",
            str(temp_dir),
            str(pptx_path),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0 or not pdf_path.exists():
        raise RuntimeError("PDF conversion failed")

    # Convert PDF to images via pdftoppm
    print(f"Converting to images at {dpi} DPI...")
    result = subprocess.run(
        ["pdftoppm", "-jpeg", "-r", str(dpi), str(pdf_path), str(temp_dir / "slide")],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError("Image conversion failed")

    return sorted(temp_dir.glob("slide-*.jpg"))


def create_grids(
    image_paths,
    cols,
    width,
    output_path,
):
    """Create multiple thumbnail grids from slide images, max cols×(cols+1) images per grid."""
    # Maximum images per grid is cols × (cols + 1) for better proportions
    max_images_per_grid = cols * (cols + 1)
    grid_files = []

    print(
        f"Creating grids with {cols} columns (max {max_images_per_grid} images per grid)"
    )

    # Split images into chunks
    for chunk_idx, start_idx in enumerate(
        range(0, len(image_paths), max_images_per_grid)
    ):
        end_idx = min(start_idx + max_images_per_grid, len(image_paths))
        chunk_images = image_paths[start_idx:end_idx]

        # Create grid for this chunk
        grid = create_grid(
            chunk_images, cols, width, start_idx,
        )

        # Generate output filename
        if len(image_paths) <= max_images_per_grid:
            # Single grid - use base filename without suffix
            grid_filename = output_path
        else:
            # Multiple grids - insert index before extension with dash
            stem = output_path.stem
            suffix = output_path.suffix
            grid_filename = output_path.parent / f"{stem}-{chunk_idx + 1}{suffix}"

        # Save grid
        grid_filename.parent.mkdir(parents=True, exist_ok=True)
        grid.save(str(grid_filename), quality=JPEG_QUALITY)
        grid_files.append(str(grid_filename))

    return grid_files


def create_grid(
    image_paths,
    cols,
    width,
    start_slide_num=0,
):
    """Create thumbnail grid from slide images."""
    font_size = int(width * FONT_SIZE_RATIO)
    label_padding = int(font_size * LABEL_PADDING_RATIO)

    # Get dimensions
    with Image.open(image_paths[0]) as img:
        aspect = img.height / img.width
    height = int(width * aspect)

    # Calculate grid size
    rows = (len(image_paths) + cols - 1) // cols
    grid_w = cols * width + (cols + 1) * GRID_PADDING
    grid_h = rows * (height + font_size + label_padding * 2) + (rows + 1) * GRID_PADDING

    # Create grid
    grid = Image.new("RGB", (grid_w, grid_h), "white")
    draw = ImageDraw.Draw(grid)

    # Load font with size based on thumbnail width
    try:
        # Use Pillow's default font with size
        font = ImageFont.load_default(size=font_size)
    except Exception:
        # Fall back to basic default font if size parameter not supported
        font = ImageFont.load_default()

    # Place thumbnails
    for i, img_path in enumerate(image_paths):
        row, col = i // cols, i % cols
        x = col * width + (col + 1) * GRID_PADDING
        y_base = (
            row * (height + font_size + label_padding * 2) + (row + 1) * GRID_PADDING
        )

        # Add label with actual slide number
        label = f"{start_slide_num + i}"
        bbox = draw.textbbox((0, 0), label, font=font)
        text_w = bbox[2] - bbox[0]
        draw.text(
            (x + (width - text_w) // 2, y_base + label_padding),
            label,
            fill="black",
            font=font,
        )

        # Add thumbnail below label with proportional spacing
        y_thumbnail = y_base + label_padding + font_size + label_padding

        with Image.open(img_path) as img:
            img.thumbnail((width, height), Image.Resampling.LANCZOS)
            w, h = img.size
            tx = x + (width - w) // 2
            ty = y_thumbnail + (height - h) // 2
            grid.paste(img, (tx, ty))

            # Add border
            if BORDER_WIDTH > 0:
                draw.rectangle(
                    [
                        (tx - BORDER_WIDTH, ty - BORDER_WIDTH),
                        (tx + w + BORDER_WIDTH - 1, ty + h + BORDER_WIDTH - 1),
                    ],
                    outline="gray",
                    width=BORDER_WIDTH,
                )

    return grid


if __name__ == "__main__":
    main()
