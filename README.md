# Cropframe

Cropframe is a lightweight, browser-based tool for applying one consistent pixel-coordinate crop to a set of images and exporting a dataset for analysis.

## Features

- Select or drag in multiple JPG, PNG, or WebP images.
- Preview a reference image and define the crop by dragging or entering pixel coordinates.
- Apply that exact crop rectangle to every selected image; mismatched image dimensions are flagged and cannot be exported.
- Export lossless PNG crops and a CSV manifest in a ZIP archive.
- Process everything locally in the browser. Source files are not uploaded or changed.
- Run offline with no build step, dependencies, account, or server.

## Run locally

Open `index.html` in a recent browser. No installation or server is required.

## Use

1. Select the image files that belong in the same dataset.
2. Drag over the reference image to draw a crop, or enter X, Y, width, and height in source pixels.
3. Export the dataset. The ZIP contains numbered PNGs in `crops/` and a `manifest.csv`.

For meaningful comparisons, use images with identical pixel dimensions and consistent framing. The app checks dimensions before export and uses the same crop coordinates for every image.

## Export details

The CSV records the output filename, source filename, source file's last-modified timestamp, source dimensions, and crop rectangle. A file's last-modified time may differ from its capture time. Exported PNGs are lossless relative to the pixels decoded by the browser, but do not retain source EXIF metadata. Keep original files as your archive.

## Publish with GitHub Pages

This repository includes a GitHub Actions workflow to publish the static app. In the GitHub repository settings, open **Pages** and set the source to **GitHub Actions**. Pushes to the `main` branch will then publish the app. You can also deploy it manually as a static site; there is no build command.

## Project files

- `index.html` — app layout and page metadata
- `styles.css` — responsive styling
- `app.js` — image processing, crop interaction, and ZIP/CSV export
- `.github/workflows/deploy-pages.yml` — GitHub Pages deployment

## License

This project is distributed under the MIT License. See [LICENSE](LICENSE) for details.
