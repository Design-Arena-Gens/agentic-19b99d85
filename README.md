# Animation to Video Converter

Browser-based transcoder that turns animated GIF, WebP, APNG, or short video clips into broadcast-friendly MP4 files using `ffmpeg.wasm`. All processing happens locally in the browser, so media never leaves the device.

## Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build
```

## Features

- Drag-and-drop upload for common animated formats
- In-browser FFmpeg pipeline with progress feedback
- H.264 MP4 output optimized for universal playback
- Download link plus inline preview of the converted video
- Dark, responsive UI suitable for desktop and mobile
