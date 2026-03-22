(function () {
  'use strict';

  const DEFAULT_DELAY = 2;
  const DEFAULT_DURATION = 120;
  const DEFAULT_TRANSPOSE = 0;

  const FALLBACK_TEXT = 'delay="2";\nduration="90";\ntranspose="0";\n> <C> <Am> <F> <G>\nFirst line of lyrics with chords\n';

  const CHORD_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const CHORD_ROOTS_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  const MIN_FONT_SIZE = 0.75;
  const MAX_FONT_SIZE = 4;
  const DEFAULT_FONT_SIZE = 1.25;

  const CHORD_TOKEN = /^[A-G][#b]?[a-zA-Z0-9/]*$/;

  const elements = {
    fileInput: document.getElementById('fileInput'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    stopBtn: document.getElementById('stopBtn'),
    editBtn: document.getElementById('editBtn'),
    doneBtn: document.getElementById('doneBtn'),
    detectChordsBtn: document.getElementById('detectChordsBtn'),
    saveBtn: document.getElementById('saveBtn'),
    displayArea: document.getElementById('displayArea'),
    editArea: document.getElementById('editArea'),
    lyricsDisplay: document.getElementById('lyricsDisplay'),
    lyricsEditor: document.getElementById('lyricsEditor')
  };

  let rawContent = '';
  let scrollRafId = null;
  let scrollPositionAccum = 0;
  let countdownInterval = null;
  let durationInterval = null;
  let elapsedSeconds = 0;
  let isPlaying = false;
  let isEditMode = false;
  let fontSize = DEFAULT_FONT_SIZE;
  let lastPinchDistance = 0;
  let scrollSpeedPxPerSec = 0;
  let currentDelay = DEFAULT_DELAY;
  let currentDuration = DEFAULT_DURATION;
  let currentTranspose = DEFAULT_TRANSPOSE;
  let remainingCountdown = null;
  let wasScrolling = false;

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
        container.appendChild(document.createElement('br'));
        continue;
      }

      if (line.startsWith('>')) {
        const chordLine = document.createElement('div');
        chordLine.className = 'chord-line';
        const chordContent = line.slice(1);
        chordLine.appendChild(renderLineWithChords(chordContent, transposeAmount, true));
        container.appendChild(chordLine);
      } else if (/^\s*delay\s*=\s*["']\d/i.test(line.trim()) || /^\s*duration\s*=\s*["']\d/i.test(line.trim()) || /^\s*transpose\s*=\s*["']-?\d/i.test(line.trim())) {
        const metaLine = document.createElement('div');
        metaLine.className = 'meta-line';
        metaLine.textContent = line;
        container.appendChild(metaLine);
      } else {
        const lyricLine = document.createElement('div');
        lyricLine.className = 'lyric-line';
        lyricLine.appendChild(renderLineWithChords(line, transposeAmount, false));
        container.appendChild(lyricLine);
      }
    }

    return container;
  }

  function renderLineWithChords(line, transposeAmount, isChordLine) {
    const fragment = document.createDocumentFragment();
    const angleRegex = /<([^>]+)>/g;
    const plainChordRegex = /\b([A-G][#b]?[a-zA-Z0-9/]*)\b/g;
    let lastIndex = 0;
    let match;
    const replacers = [];

    if (isChordLine) {
      while ((match = plainChordRegex.exec(line)) !== null) {
        if (CHORD_TOKEN.test(match[1]) && match[1].length <= 8) {
          replacers.push({ index: match.index, end: match.index + match[0].length, chord: match[1] });
        }
      }
    }
    plainChordRegex.lastIndex = 0;
    while ((match = angleRegex.exec(line)) !== null) {
      replacers.push({ index: match.index, end: match.index + match[0].length, chord: match[1] });
    }
    replacers.sort(function (a, b) { return a.index - b.index; });
    for (let i = 0; i < replacers.length; i++) {
      const r = replacers[i];
      if (i > 0 && r.index < replacers[i - 1].end) continue;
      fragment.appendChild(document.createTextNode(line.slice(lastIndex, r.index)));
      const span = document.createElement('span');
      span.className = 'chord';
      span.textContent = transposeChord(r.chord, transposeAmount);
      fragment.appendChild(span);
      lastIndex = r.end;
    }
    fragment.appendChild(document.createTextNode(line.slice(lastIndex)));

    return fragment;
  }

  function updateDisplay() {
    elements.lyricsDisplay.innerHTML = '';
    const rendered = parseAndRender(rawContent, currentTranspose);
    elements.lyricsDisplay.appendChild(rendered);
  }

  function setFontSize(size) {
    fontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
    elements.lyricsDisplay.style.setProperty('--lyrics-font-size', fontSize + 'rem');
  }

  function setupPinchZoom() {
    elements.displayArea.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setFontSize(fontSize + delta);
      }
    }, { passive: false });

    elements.displayArea.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        lastPinchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    elements.displayArea.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = (dist - lastPinchDistance) * 0.01;
        lastPinchDistance = dist;
        setFontSize(fontSize + delta);
      }
    }, { passive: false });

    elements.displayArea.addEventListener('touchend', function (e) {
      if (e.touches.length < 2) lastPinchDistance = 0;
    }, { passive: true });
  }

  function scrollFrame(lastTime) {
    return function frame(now) {
      const deltaSec = (now - lastTime) / 1000;
      const display = elements.displayArea;
      const maxScroll = display.scrollHeight - display.clientHeight;
      scrollPositionAccum += scrollSpeedPxPerSec * deltaSec;
      display.scrollTop = Math.min(scrollPositionAccum, maxScroll);
      if (isPlaying) {
        scrollRafId = requestAnimationFrame(scrollFrame(now));
      }
    };
  }

  function parseMetadata(text) {
    const result = { delay: null, duration: null, transpose: null };
    const delayMatch = text.match(/\bdelay\s*=\s*["'](-?\d+(?:\.\d+)?)["']\s*;?/i);
    const durationMatch = text.match(/\bduration\s*=\s*["'](\d+(?:\.\d+)?)["']\s*;?/i);
    const transposeMatch = text.match(/\btranspose\s*=\s*["'](-?\d+)["']\s*;?/i);
    if (delayMatch) result.delay = parseFloat(delayMatch[1]);
    if (durationMatch) result.duration = parseFloat(durationMatch[1]);
    if (transposeMatch) result.transpose = parseInt(transposeMatch[1], 10);
    return result;
  }

  function ensureMetadataInContent(text) {
    let content = text;
    const lines = [];
    if (!/\bdelay\s*=\s*["']-?\d/i.test(content)) {
      lines.push('delay="' + DEFAULT_DELAY + '";');
    }
    if (!/\bduration\s*=\s*["']\d/i.test(content)) {
      lines.push('duration="' + DEFAULT_DURATION + '";');
    }
    if (!/\btranspose\s*=\s*["']-?\d/i.test(content)) {
      lines.push('transpose="' + DEFAULT_TRANSPOSE + '";');
    }
    if (lines.length > 0) {
      content = lines.join('\n') + '\n' + content;
    }
    return content;
  }

  function applyMetadata(text) {
    const content = ensureMetadataInContent(text);
    if (content !== text) rawContent = content;
    const meta = parseMetadata(content);
    currentDelay = meta.delay != null ? meta.delay : DEFAULT_DELAY;
    currentDuration = meta.duration != null ? meta.duration : DEFAULT_DURATION;
    currentTranspose = meta.transpose != null ? Math.max(-11, Math.min(11, meta.transpose)) : DEFAULT_TRANSPOSE;
  }

  function startScrolling() {
    scrollPositionAccum = elements.displayArea.scrollTop;
    const startTime = performance.now();
    scrollRafId = requestAnimationFrame(scrollFrame(startTime));
    isPlaying = true;
    wasScrolling = true;
    elapsedSeconds = 0;
    elements.playPauseBtn.textContent = '0';
    elements.playPauseBtn.title = 'Pause';
    durationInterval = setInterval(function () {
      elapsedSeconds++;
      elements.playPauseBtn.textContent = String(elapsedSeconds);
    }, 1000);
  }

  function startPlayback() {
    if (isPlaying) return;
    applyMetadata(rawContent);
    const duration = currentDuration;
    const display = elements.displayArea;
    const scrollHeight = display.scrollHeight;
    const clientHeight = display.clientHeight;
    const scrollDistance = scrollHeight - clientHeight;
    scrollSpeedPxPerSec = scrollDistance > 0 ? scrollDistance / duration : 30;

    if (wasScrolling) {
      startScrolling();
      return;
    }

    const delay = remainingCountdown != null ? remainingCountdown : currentDelay;
    remainingCountdown = Math.max(0, Math.ceil(delay));
    isPlaying = true;

    function tick() {
      if (remainingCountdown <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        remainingCountdown = null;
        startScrolling();
        return;
      }
      elements.playPauseBtn.textContent = String(remainingCountdown);
      elements.playPauseBtn.title = 'Pause';
      remainingCountdown--;
    }

    tick();
    if (remainingCountdown !== null && remainingCountdown >= 0 && countdownInterval === null) {
      countdownInterval = setInterval(tick, 1000);
    }
  }

  function pausePlayback() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      wasScrolling = false;
    }
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }
    if (scrollRafId !== null) {
      cancelAnimationFrame(scrollRafId);
      scrollRafId = null;
    }
    isPlaying = false;
    elements.playPauseBtn.textContent = '\u25B6';
    elements.playPauseBtn.title = 'Play';
  }

  function stopPlayback() {
    pausePlayback();
    scrollPositionAccum = 0;
    remainingCountdown = null;
    wasScrolling = false;
    elements.displayArea.scrollTop = 0;
  }

  function togglePlayPause() {
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
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
    elements.playPauseBtn.disabled = true;
    setControlsHeight();
    document.addEventListener('keydown', handleEditKeydown);
  }

  function handleEditKeydown(e) {
    if (e.key === 'Escape') exitEditMode();
  }

  function exitEditMode() {
    if (!isEditMode) return;
    document.removeEventListener('keydown', handleEditKeydown);
    rawContent = elements.lyricsEditor.value;
    applyMetadata(rawContent);
    updateDisplay();
    elements.editArea.classList.add('hidden');
    elements.displayArea.classList.remove('hidden');
    elements.editBtn.classList.remove('hidden');
    elements.doneBtn.classList.add('hidden');
    elements.doneBtn.disabled = true;
    elements.fileInput.disabled = false;
    elements.playPauseBtn.disabled = false;
    elements.stopBtn.disabled = false;
    setControlsHeight();
    isEditMode = false;
  }

  function isChordRow(line) {
    if (line.startsWith('>')) return false;
    const t = line.trim();
    if (!t) return false;
    if (/^\s*(delay|duration|transpose)\s*=\s*["']/i.test(t)) return false;
    const tokens = t.split(/\s+/).filter(function (s) { return s.length > 0; });
    if (tokens.length === 1) {
      return tokens[0].length <= 8 && CHORD_TOKEN.test(tokens[0]);
    }
    if (!/\s{2,}/.test(line)) return false;
    const chordCount = tokens.filter(function (tok) {
      return tok.length <= 8 && CHORD_TOKEN.test(tok);
    }).length;
    return chordCount >= tokens.length * 0.8;
  }

  function detectChords() {
    const content = isEditMode ? elements.lyricsEditor.value : rawContent;
    const lines = content.split('\n');
    const out = lines.map(function (line) {
      return isChordRow(line) ? '>' + line : line;
    });
    const result = out.join('\n');
    rawContent = result;
    if (isEditMode) elements.lyricsEditor.value = result;
    else updateDisplay();
  }

  function saveToFile() {
    if (!rawContent) return;
    const blob = new Blob([rawContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lyrics-chords-' + new Date().toISOString().slice(0, 19).replace(/[:-]/g, '') + '.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  function setControlsHeight() {
    const controls = document.getElementById('controls');
    if (controls) {
      document.documentElement.style.setProperty('--controls-height', controls.offsetHeight + 'px');
    }
  }

  function init() {
    setFontSize(DEFAULT_FONT_SIZE);
    setupPinchZoom();
    setControlsHeight();
    window.addEventListener('resize', setControlsHeight);
    elements.playPauseBtn.textContent = '\u25B6';
    elements.playPauseBtn.title = 'Play';

    fetch('sample.txt')
      .then(function (r) { return r.ok ? r.text() : Promise.reject(); })
      .then(function (text) {
        rawContent = text;
        stopPlayback();
        applyMetadata(rawContent);
        updateDisplay();
        elements.displayArea.scrollTop = 0;
      })
      .catch(function () {
        rawContent = FALLBACK_TEXT;
        applyMetadata(rawContent);
        updateDisplay();
      });
  }

  elements.fileInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (ev) {
      rawContent = ev.target.result;
      stopPlayback();
      applyMetadata(rawContent);
      updateDisplay();
      elements.displayArea.scrollTop = 0;
    };
    reader.readAsText(file);
  });

  elements.playPauseBtn.addEventListener('click', togglePlayPause);
  elements.stopBtn.addEventListener('click', stopPlayback);
  elements.editBtn.addEventListener('click', enterEditMode);
  elements.doneBtn.addEventListener('click', exitEditMode);
  elements.detectChordsBtn.addEventListener('click', detectChords);
  elements.saveBtn.addEventListener('click', saveToFile);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
