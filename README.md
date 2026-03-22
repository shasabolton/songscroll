# Songscroll

A vanilla JavaScript client-side app for scrolling through lyrics and chords.

## Features

- **Load** lyrics/chords from a text file
- **Scroll** vertically through content (configurable speed and initial delay)
- **Transpose** chords (-11 to +11 semitones)
- **Play**, **Pause**, **Restart** controls
- **Edit mode** – click Edit to modify lyrics and chords in a text area; click Done to exit
- **Save** – download the current content as a text file

## Format

- **Chord rows** start with `>`
- **Inline chords** use angle brackets: `<C>`, `<Am>`, `<F#m>`, etc.
- Chords display in blue; lyrics in black

## Usage

1. Open `index.html` in a browser (or serve via a local web server)
2. Load a text file via the file input
3. Set initial delay (seconds before scrolling), scroll speed (px/s), and transpose
4. Click Play to scroll, Pause to stop, Restart to start over
5. Use Edit to modify, Done to apply changes, Save to download

## Sample

See `sample.txt` for an example file format.
