# Timelapse Rec — Photoshop Panel Extension

A timelapse and speedpaint recorder for Adobe Photoshop. It automatically saves frames of your drawing workflow in the background and compiles them into a video (MP4, MKV, MOV, AVI, WebM).

---

## Features

- **Zero-Freeze Capture**: Uses a highly optimized ExtendScript method (`ActionDescriptor`) to save frames without interrupting your drawing process or freezing the Photoshop UI.
- **Smart Recording**: Captures frames *only* when the document history changes (i.e., when you actually draw or make edits). No excessive duplicate frames are created while you are idle.
- **Background Mouse Tracking**: Detects active brush strokes and defers capturing until the stroke is finished to prevent drawing lag or broken lines.
- **Auto-Encoding**: Automatically compiles the captured frames into a high-quality video using FFmpeg as soon as you stop recording.
- **Customizable Settings**: Adjust framing interval, video format, frame hold duration (playback speed), and resolution scale.
- **Multi-Language Support**: Choose between English, Russian, and Chinese languages on the fly without restarting the panel.

---

## Installation

### Automatic (Recommended for Windows)

1. Close Photoshop.
2. Run **`install.bat`** as Administrator.
3. Wait for the script to finish. It will:
   - Enable CEP `PlayerDebugMode` (required for launching unsigned extensions).
   - Download and install FFmpeg automatically.
   - Create a symlink for the extension in the Adobe CEP folder.
4. Open Photoshop → **Window → Extensions → Timelapse Rec**.

### Manual Installation

1. **CEP Debug Mode**: In the Windows Registry, create the following String values depending on your Photoshop version:
   ```text
   HKCU\Software\Adobe\CSXS.9  → PlayerDebugMode = 1
   HKCU\Software\Adobe\CSXS.10 → PlayerDebugMode = 1
   HKCU\Software\Adobe\CSXS.11 → PlayerDebugMode = 1
   ```
2. **FFmpeg**: Download FFmpeg from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) (or any other source) and place `ffmpeg.exe` inside the `TimelapseRec\tools\` folder.
3. **Extension Directory**: Copy the `TimelapseRec` folder to:
   ```text
   %APPDATA%\Adobe\CEP\extensions\
   ```
4. Restart Photoshop → **Window → Extensions → Timelapse Rec**.

---

## Usage

### Getting Started

1. Open a document in Photoshop.
2. In the Timelapse Rec panel, choose a **Save folder** (click "Select / Выбрать").
3. Set the **Interval** between frames (default is 3 seconds).
4. Click **● Record/Запись**.

### During Recording

- The plugin automatically saves a JPEG copy of the canvas every *N* seconds.
- Frames are only saved if you have made changes to the canvas.
- The panel switches to a minimal UI mode showing the recording status and elapsed time.
- **Pause** — Temporarily halts recording.
- **Stop** — Stops recording and automatically encodes the video.

### Settings

| Parameter | Description |
|-----------|-------------|
| **Interval** | Time between frame capture attempts (1–30 sec). |
| **Video Format** | Choose between MP4, MKV, MOV, AVI, or WebM. |
| **Frame Hold** | Duration of each frame in the final video (controls how fast the timelapse plays). |
| **Resolution Scale** | Downscales the captured frames (100% Original, 50%, or 25%) to save disk space and speed up encoding. |
| **Delete Frames** | Automatically deletes the temporary JPEG files after the video is successfully encoded. |

### Output

- JPEG frames are saved in a subfolder named `rec_YYYYMMDD_HHMMSS` within your chosen save directory.
- Once stopped, FFmpeg compiles these frames into a video file directly in the save directory.

---

## Compatibility

- **Photoshop**: CC 2019 and newer (version 20.0+).
- **OS**: Windows 10 / 11.
- **Dependencies**: FFmpeg (downloaded automatically during the automatic installation process).

---

## Troubleshooting

- **Extension doesn't appear in the Window menu**
  → Ensure `install.bat` was run as Administrator to set the registry keys correctly. Restart Photoshop.
- **"FFmpeg not found"**
  → Make sure `ffmpeg.exe` is located in `TimelapseRec\tools\`, or specify its path manually via the plugin settings panel.
- **No frames are being captured**
  → Ensure your document is open and you are actively making changes. The plugin only captures a frame when the document's history state changes.
