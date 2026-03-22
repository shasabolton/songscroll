(function () {
  'use strict';

  const CHORD_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const CHORD_ROOTS_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  const elements = {
    fileInput: document.getElementById('fileInput'),
    initialDelay: document.getElementById('initialDelay'),
    scrollSpeed: document.getElementById('scrollSpeed'),
    transpose: document.getElementById('transpose'),
    playBtn: document.getElementById('playBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    restartBtn: document.getElementById('restartBtn'),
    editBtn: document.getElementById('editBtn'),
    doneBtn: document.getElementById('doneBtn'),
    saveBtn: document.getElementById('saveBtn'),
    displayArea: document.getElementById('displayArea'),
    editArea: document.getElementById('editArea'),
    lyricsDisplay: document.getElementById('lyricsDisplay'),
    lyricsEditor: document.getElementById('lyricsEditor')
  };

  let rawContent = '';
  let scrollInterval = null;
  let initialDelayTimeout = null;
  let isPlaying = false;
  let isEditMode = false;

  function transposeChord(chordStr, semitones) {
    if (!chordStr || semitones === 0) return chordStr;

    const match = chordStr.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return chordStr;

    const root = match[1];
    const suffix = match[2] || '';
    const roots = root.includes('b') ? CHORD_ROOTS_FLAT : CHORD_ROOTS;
    let idx = roots.indexOf(root);
    if (idx === -1) return chordStr;

    idx = (idx + semitones + 12) % 12;
    return roots[idx] + suffix;
  }

  function parseAndRender(text, transposeAmount = 0) {
    const lines = text.split('\n');
    const container = document.createElement('div');
    container.className = 'lyrics-content';

    for (const line of lines) {
      if (line.trim() === '') {
        container.appendChild(document.createTextNode('\n'));
        continue;
      }

      if (line.startsWith('>')) {
        const chordLine = document.createElement('div');
        chordLine.className = 'chord-line';
        const chordContent = line.slice(1);
        chordLine.appendChild(renderLineWithChords(chordContent, transposeAmount));
        container.appendChild(chordLine);
        container.appendChild(document.createTextNode('\n'));
      } else {
        const lyricLine = document.createElement('div');
        lyricLine.appendChild(renderLineWithChords(line, transposeAmount));
        container.appendChild(lyricLine);
        container.appendChild(document.createTextNode('\n'));
      }
    }

    return container;
  }

  function renderLineWithChords(line, transposeAmount) {
    const fragment = document.createDocumentFragment();
    const regex = /<([^>]+)>/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
      fragment.appendChild(document.createTextNode(line.slice(lastIndex, match.index)));
      const span = document.createElement('span');
      span.className = 'chord';
      span.textContent = transposeChord(match[1], transposeAmount);
      fragment.appendChild(span);
      lastIndex = match.index + match[0].length;
    }
    fragment.appendChild(document.createTextNode(line.slice(lastIndex)));

    return fragment;
  }

  function updateDisplay() {
    const transposeVal = parseInt(elements.transpose.value, 10) || 0;
    elements.lyricsDisplay.innerHTML = '';
    const rendered = parseAndRender(rawContent, transposeVal);
    elements.lyricsDisplay.appendChild(rendered);
  }

  function scrollContent() {
    const display = elements.displayArea;
    const speed = parseFloat(elements.scrollSpeed.value) || 30;
    display.scrollTop += speed / 60;
  }

  function startPlayback() {
    if (isPlaying) return;
    const delay = parseFloat(elements.initialDelay.value) || 0;
    const delayMs = delay * 1000;

    initialDelayTimeout = setTimeout(() => {
      initialDelayTimeout = null;
      scrollInterval = setInterval(scrollContent, 1000 / 60);
      isPlaying = true;
      elements.playBtn.disabled = true;
      elements.pauseBtn.disabled = false;
    }, delayMs);

    elements.playBtn.disabled = true;
    elements.pauseBtn.disabled = true;
  }

  function pausePlayback() {
    if (initialDelayTimeout) {
      clearTimeout(initialDelayTimeout);
      initialDelayTimeout = null;
    }
    if (scrollInterval) {
      clearInterval(scrollInterval);
      scrollInterval = null;
    }
    isPlaying = false;
    elements.playBtn.disabled = false;
    elements.pauseBtn.disabled = true;
  }

  function restartPlayback() {
    pausePlayback();
    elements.displayArea.scrollTop = 0;
    startPlayback();
  }

  function enterEditMode() {
    if (isEditMode) return;
    pausePlayback();
    isEditMode = true;
    elements.lyricsEditor.value = rawContent;
    elements.displayArea.classList.add('hidden');
    elements.editArea.classList.remove('hidden');
    elements.editBtn.classList.add('hidden');
    elements.doneBtn.classList.remove('hidden');
    elements.doneBtn.disabled = false;
    elements.fileInput.disabled = true;
    elements.playBtn.disabled = true;
    elements.pauseBtn.disabled = true;
    elements.restartBtn.disabled = true;
  }

  function exitEditMode() {
    if (!isEditMode) return;
    rawContent = elements.lyricsEditor.value;
    updateDisplay();
    elements.editArea.classList.add('hidden');
    elements.displayArea.classList.remove('hidden');
    elements.editBtn.classList.remove('hidden');
    elements.doneBtn.classList.add('hidden');
    elements.doneBtn.disabled = true;
    elements.fileInput.disabled = false;
    elements.playBtn.disabled = false;
    elements.pauseBtn.disabled = true;
    elements.restartBtn.disabled = false;
    isEditMode = false;
  }

  function saveToFile() {
    if (!rawContent) return;
    const blob = new Blob([rawContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lyrics-chords.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  elements.fileInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (ev) {
      rawContent = ev.target.result;
      updateDisplay();
      elements.playBtn.disabled = false;
      elements.restartBtn.disabled = false;
      elements.editBtn.disabled = false;
      elements.saveBtn.disabled = false;
      elements.displayArea.scrollTop = 0;
    };
    reader.readAsText(file);
  });

  elements.transpose.addEventListener('change', updateDisplay);
  elements.transpose.addEventListener('input', updateDisplay);

  elements.playBtn.addEventListener('click', startPlayback);
  elements.pauseBtn.addEventListener('click', pausePlayback);
  elements.restartBtn.addEventListener('click', restartPlayback);
  elements.editBtn.addEventListener('click', enterEditMode);
  elements.doneBtn.addEventListener('click', exitEditMode);
  elements.saveBtn.addEventListener('click', saveToFile);
})();
