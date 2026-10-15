/**
 * Marola - Sunset & Sea Music Player
 * Controlador de Interface, Renderização Dinâmica e Integração IPC
 */

(() => {
  // Helpers DOM e utilitários matemáticos
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
  const css = (a) => a.map(Math.round).join(',');
  const rgb = (a) => `rgb(${css(a)})`;
  const rgba = (a, o) => `rgba(${css(a)},${o})`;
  const fmt = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ic = (id, cls = '') => `<svg class="i ${cls}"><use href="#i-${id}"/></svg>`;

  /* ---------- Matrizes de Paletas Sunset & Sea ---------- */
  const PALETTES = {
    asfalto: { sky: ['#0A0612', '#2A0F3D', '#8A1F4E'], sun: '#FF7A59', sea: ['#2A0F36', '#07040E'], accent: '#FF5C7A', ink: '#2B0612', text: '#F7EDF2' },
    gelo:    { sky: ['#070A1E', '#16206B', '#4A39A6'], sun: '#BFEFFF', sea: ['#1A1F5A', '#05071A'], accent: '#67E3FF', ink: '#03212B', text: '#EEF3FF' },
    verao:   { sky: ['#1B1464', '#B1307A', '#FF8F55'], sun: '#FFE48A', sea: ['#3A1A7A', '#120A3A'], accent: '#FF79B0', ink: '#2E0A1E', text: '#FFF2EA' },
    neon:    { sky: ['#120640', '#5B1A9A', '#FF4E9B'], sun: '#FFF0A8', sea: ['#3A1580', '#0E0630'], accent: '#4BE8D6', ink: '#03282A', text: '#FFF1F8' },
    sessao:  { sky: ['#240C2E', '#8C2C4B', '#FF9A3C'], sun: '#FFD27A', sea: ['#4A1738', '#190812'], accent: '#FFB84D', ink: '#2B1500', text: '#FFF4E8' },
    planeta: { sky: ['#02070D', '#073045', '#12717A'], sun: '#FFE9A8', sea: ['#06404A', '#020B10'], accent: '#F5CA5E', ink: '#2A1D00', text: '#F0F8F6' },
    vazio:   { sky: ['#010409', '#0B1D3A', '#2C5388'], sun: '#E8F2FF', sea: ['#12315E', '#030A18'], accent: '#9CC7FF', ink: '#06182E', text: '#F1F6FF' },
    domingo: { sky: ['#4FB0EE', '#86D3F3', '#E6F7F5'], sun: '#FFFFFF', sea: ['#19C2BF', '#0A6A8C'], accent: '#14D1C2', ink: '#032B2A', text: '#05314A' },
    areia:   { sky: ['#5BB4E6', '#F2C48C', '#FFE8C6'], sun: '#FFF2C4', sea: ['#18AAA4', '#0B5E72'], accent: '#FF8C42', ink: '#2B1200', text: '#0B2F45' }
  };
  const PAL_KEYS = Object.keys(PALETTES);

  function hashPalette(str) {
    let hash = 0;
    for (let i = 0; i < (str || '').length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % PAL_KEYS.length;
    return PALETTES[PAL_KEYS[idx]];
  }

  /* ---------- Presets e Frequências do Equalizador ---------- */
  const FREQ_LABELS = ['40', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
  const FREQS_HZ = [40, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const EQ_PRESETS = {
    'V13 Cinema/Phonk': [7, 6, 0, 2, 1, 2, 4, 5, 4, 7],
    'Plano':            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'Graves fortes':    [8, 7, 4, 1, 0, 0, 0, 1, 2, 3],
    'Voz clara':        [-3, -2, 0, 1, 3, 4, 4, 2, 1, 0],
    'Sunset & Sea':     [5, 4, 2, 0, -1, 1, 3, 4, 5, 6]
  };

  /* ---------- Estado Centralizado da Interface ---------- */
  const S = {
    tracks: [],
    i: -1,
    pos: 0,
    dur: 0,
    playing: false,
    vol: 70,
    muted: false,
    shuffle: false,
    repeat: 'off', // off | all | one
    filter: 'tudo',
    q: '',
    queue: [],
    hist: [],
    eq: {
      enabled: true,
      preset: 'V13 Cinema/Phonk',
      bands: FREQ_LABELS.map((freq, i) => ({ freq, gain: EQ_PRESETS['V13 Cinema/Phonk'][i] }))
    }
  };

  // Referência do track atual
  const currentTrack = () => (S.i >= 0 && S.i < S.tracks.length ? S.tracks[S.i] : null);

  /* ---------- Gerador de Capas Abstratas Procedurais ---------- */
  function coverBg(tr) {
    if (!tr) return 'linear-gradient(135deg, #14293B, #07111A)';
    if (tr.coverDataUrl) {
      return `url("${tr.coverDataUrl}") center / cover no-repeat`;
    }
    const pal = tr.paletteConfig || hashPalette((tr.artist || '') + (tr.album || '') + (tr.title || ''));
    const [s0, s1, s2] = pal.sky;
    const sun = pal.sun;
    const ac = pal.accent;
    const [sea0, sea1] = pal.sea;

    const patterns = ['rings', 'dots', 'diag', 'stripes', 'conic'];
    const patIdx = Math.abs(((tr.title || '').length + (tr.artist || '').length) % patterns.length);
    const pat = patterns[patIdx];

    switch (pat) {
      case 'rings':
        return `repeating-radial-gradient(circle at 32% 36%, ${sun} 0 4%, ${ac} 4% 9%, ${sea0} 9% 14%, ${sea1} 14% 19%)`;
      case 'dots':
        return `radial-gradient(circle, ${sun} 0 26%, transparent 28%) 0 0/15% 15%, linear-gradient(155deg, ${sea0}, ${sea1})`;
      case 'diag':
        return `radial-gradient(circle at 70% 30%, ${sun} 0 17%, transparent 18%), linear-gradient(135deg, ${s2} 0 50%, ${s0} 50%)`;
      case 'stripes':
        return `repeating-linear-gradient(180deg, transparent 0 8%, ${s0} 8% 11%), radial-gradient(circle at 50% 54%, ${sun} 0 30%, ${ac} 31% 38%, transparent 39%), linear-gradient(180deg, ${s0}, ${s1} 60%, ${s2})`;
      default:
        return `conic-gradient(from 210deg at 50% 112%, ${sun}, ${ac}, ${sea0}, ${s1}, ${sun})`;
    }
  }

  /* ---------- Motor de Cores e Interpolação Harmônica ---------- */
  const COLOR_KEYS = ['sky0', 'sky1', 'sky2', 'sun', 'sea0', 'sea1', 'accent', 'ink', 'text'];
  function parsePaletteConfig(p) {
    return {
      sky0: hex(p.sky[0]), sky1: hex(p.sky[1]), sky2: hex(p.sky[2]),
      sun: hex(p.sun),
      sea0: hex(p.sea[0]), sea1: hex(p.sea[1]),
      accent: hex(p.accent),
      ink: hex(p.ink),
      text: hex(p.text)
    };
  }

  let targetPalette = parsePaletteConfig(PALETTES.verao);
  const currentColors = {};
  COLOR_KEYS.forEach((k) => { currentColors[k] = targetPalette[k].slice(); });

  function applyThemePalette(paletteConfig) {
    if (!paletteConfig) return;
    targetPalette = parsePaletteConfig(paletteConfig);
    if (reduceMotion) {
      COLOR_KEYS.forEach((k) => { currentColors[k] = targetPalette[k].slice(); });
      flushColorsToCss();
    }
  }

  function flushColorsToCss() {
    const s = $('#scene')?.style;
    const r = root.style;
    if (!s) return;
    s.setProperty('--sky0', rgb(currentColors.sky0));
    s.setProperty('--sky1', rgb(currentColors.sky1));
    s.setProperty('--sky2', rgb(currentColors.sky2));
    s.setProperty('--sea0', rgb(currentColors.sea0));
    s.setProperty('--sea1', rgb(currentColors.sea1));
    s.setProperty('--sun-rgb', css(currentColors.sun));
    s.setProperty('--stext', rgb(currentColors.text));
    r.setProperty('--accent', rgb(currentColors.accent));
    r.setProperty('--accent-rgb', css(currentColors.accent));
    r.setProperty('--accent-hover', rgb(currentColors.accent));
    r.setProperty('--ink', rgb(currentColors.ink));
  }

  function tweenPalette(factor) {
    let diff = 0;
    for (const key of COLOR_KEYS) {
      for (let c = 0; c < 3; c++) {
        const delta = targetPalette[key][c] - currentColors[key][c];
        currentColors[key][c] += delta * factor;
        diff = Math.max(diff, Math.abs(delta));
      }
    }
    return diff > 0.4;
  }

  /* ---------- Alternância de Capa do Sol (Disco Giratório) ---------- */
  let activeArtSide = false;
  function updateDiscCover(tr, instant = false) {
    const onEl = activeArtSide ? $('#artB') : $('#artA');
    const offEl = activeArtSide ? $('#artA') : $('#artB');
    if (!onEl || !offEl) return;

    offEl.style.background = coverBg(tr);
    if (instant || reduceMotion) {
      offEl.style.transition = 'none';
    }
    offEl.classList.add('on');
    onEl.classList.remove('on');
    if (instant || reduceMotion) {
      offEl.offsetWidth; // flush layout
      offEl.style.transition = '';
    }
    activeArtSide = !activeArtSide;
  }

  /* ---------- Canvas do Mar e Reflexo do Sol (#sea) ---------- */
  const seaCanvas = $('#sea');
  const seaCtx = seaCanvas ? seaCanvas.getContext('2d') : null;
  const seekCanvas = $('#seekc');
  const seekCtx = seekCanvas ? seekCanvas.getContext('2d') : null;

  let seaW = 0, seaH = 0, seekW = 0, seekH = 0;
  let sunDiscRadius = 150;

  function resizeCanvases() {
    if (seaCanvas && seaCtx) {
      const r = seaCanvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      seaCanvas.width = Math.round(r.width * dpr);
      seaCanvas.height = Math.round(r.height * dpr);
      seaCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seaW = r.width;
      seaH = r.height;
    }
    if (seekCanvas && seekCtx) {
      const r = seekCanvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      seekCanvas.width = Math.round(r.width * dpr);
      seekCanvas.height = Math.round(r.height * dpr);
      seekCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seekW = r.width;
      seekH = r.height;
    }
    const sunEl = $('#sun');
    if (sunEl) {
      sunDiscRadius = sunEl.offsetWidth / 2;
    }
  }

  const seaAnim = { calm: 0, energy: 0 };

  function renderSeaAtmosphere(ctx, timestamp, bpm, isPlaying) {
    if (!ctx || !seaW || !seaH) return;
    ctx.clearRect(0, 0, seaW, seaH);

    const calm = seaAnim.calm;
    const energy = reduceMotion ? 0 : seaAnim.energy;
    const amp = (0.4 + 0.6 * calm) * (1 + energy * 0.9);
    const spd = 0.25 + 0.75 * calm;

    const layers = [
      { y: 0.05, a: 3, l: 90, s: 0.9, o: 0 },
      { y: 0.22, a: 5, l: 130, s: -0.7, o: 1.3 },
      { y: 0.47, a: 8, l: 180, s: 0.55, o: 2.1 },
      { y: 0.76, a: 12, l: 260, s: -0.42, o: 3.4 }
    ];

    const calcWave = (l, x) =>
      seaH * l.y +
      l.a * amp * Math.sin((x / l.l) * 6.2832 + timestamp * l.s * spd * 2 + l.o) +
      l.a * 0.45 * amp * Math.sin((x / (l.l * 0.43)) * 6.2832 - timestamp * l.s * spd * 1.3 + l.o * 2);

    const drawLayer = (l, k) => {
      const pts = [];
      ctx.beginPath();
      ctx.moveTo(0, seaH);
      for (let x = 0; x <= seaW + 6; x += 6) {
        const y = calcWave(l, x);
        pts.push(x, y);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(seaW + 6, seaH);
      ctx.closePath();
      ctx.fillStyle = rgba(mix(currentColors.sea0, currentColors.sea1, (k + 0.5) / layers.length), 0.5 + 0.14 * k);
      ctx.fill();

      ctx.beginPath();
      for (let j = 0; j < pts.length; j += 2) {
        j ? ctx.lineTo(pts[j], pts[j + 1]) : ctx.moveTo(pts[j], pts[j + 1]);
      }
      ctx.strokeStyle = rgba(currentColors.sun, 0.12 + 0.05 * k);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    };

    drawLayer(layers[0], 0);
    drawLayer(layers[1], 1);

    // Reflexo do sol pontilhado na água
    const cx = seaW / 2;
    ctx.fillStyle = rgb(currentColors.sun);
    ctx.globalCompositeOperation = 'lighter';
    for (let y = seaH * 0.02; y < seaH * 0.72; y += 5) {
      const d = y / seaH;
      const bw = sunDiscRadius * (0.35 + 1.1 * d);
      const n = 0.5 + 0.5 * Math.sin(y * 0.37 + timestamp * 1.9 * spd + Math.sin(y * 0.11) * 2);
      const n2 = Math.sin(y * 0.21 - timestamp * 1.3 * spd);
      const len = bw * (0.12 + 0.88 * n) * (0.8 + 0.5 * energy);
      ctx.globalAlpha = Math.max(0, 0.64 - 0.8 * d) * (0.6 + 0.7 * energy) * (0.5 + 0.5 * calm);
      ctx.fillRect(cx + n2 * bw * 0.35 - len / 2, y, len, 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    drawLayer(layers[2], 2);
    drawLayer(layers[3], 3);
  }

  /* ---------- Canvas de Progresso / Onda Seekbar (#seekc) ---------- */
  function renderWaveformProgress(ctx, progressRatio, isPlaying) {
    if (!ctx || !seekW || !seekH) return;
    ctx.clearRect(0, 0, seekW, seekH);

    const mid = seekH / 2;
    const x = clamp(progressRatio, 0, 1) * seekW;
    const calm = seaAnim.calm;
    const energy = reduceMotion ? 0 : seaAnim.energy;

    // Linha tracejada pontilhada restante
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([0.1, 7]);
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.beginPath();
    ctx.moveTo(Math.max(x, 8), mid);
    ctx.lineTo(seekW - 3, mid);
    ctx.stroke();
    ctx.setLineDash([]);

    // Onda senoidal de progresso
    if (x > 4) {
      ctx.strokeStyle = rgb(currentColors.accent);
      ctx.lineWidth = 3;
      ctx.beginPath();
      const A = (1.2 + 2.6 * calm) * (1 + energy * 0.5);
      const wl = 26;
      const ph = reduceMotion ? 0 : (performance.now() / 1000) * (1.2 + 3 * calm) * 2;
      for (let xx = 3; xx <= x; xx += 2) {
        const env = Math.min(1, (x - xx) / 22, (xx - 3) / 10 + 0.35);
        const y = mid + A * env * Math.sin((xx / wl) * 6.2832 - ph);
        xx === 3 ? ctx.moveTo(xx, y) : ctx.lineTo(xx, y);
      }
      ctx.stroke();
    }

    // Cursor circular com anel
    ctx.beginPath();
    ctx.arc(Math.max(x, 4), mid, 7, 0, 6.2832);
    ctx.fillStyle = rgb(currentColors.accent);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(7,17,27,0.9)';
    ctx.stroke();
  }

  /* ---------- Equalizador Gráfico (Curva Bézier e Biquad) ---------- */
  let eqFilters = [];
  function setupAudioEqualizer(audioCtx, masterGain) {
    if (!audioCtx || !masterGain || eqFilters.length > 0) return;
    eqFilters = FREQS_HZ.map((f, i) => {
      const filter = audioCtx.createBiquadFilter();
      if (i === 0) {
        filter.type = 'lowshelf';
      } else if (i === FREQS_HZ.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
        filter.Q.value = 1.4;
      }
      filter.frequency.value = f;
      filter.gain.value = S.eq.bands[i]?.gain || 0;
      return filter;
    });

    try {
      masterGain.disconnect();
    } catch (e) {}

    if (S.eq.enabled) {
      masterGain.connect(eqFilters[0]);
      for (let i = 0; i < eqFilters.length - 1; i++) {
        eqFilters[i].connect(eqFilters[i + 1]);
      }
      eqFilters[eqFilters.length - 1].connect(audioCtx.destination);
    } else {
      masterGain.connect(audioCtx.destination);
    }
  }

  function handleEqualizerChange(bandIndex, gainDb) {
    if (bandIndex < 0 || bandIndex >= S.eq.bands.length) return;
    S.eq.bands[bandIndex].gain = clamp(gainDb, -12, 12);
    S.eq.preset = null;

    if (eqFilters[bandIndex] && window.audioEngine?.audioCtx) {
      eqFilters[bandIndex].gain.setTargetAtTime(
        S.eq.enabled ? S.eq.bands[bandIndex].gain : 0,
        window.audioEngine.audioCtx.currentTime,
        0.02
      );
    }
    renderEQ();
  }

  function toggleEqualizer(enabled) {
    S.eq.enabled = enabled;
    const ae = window.audioEngine;
    if (ae?.audioCtx && ae?.masterGain && eqFilters.length === 10) {
      try {
        ae.masterGain.disconnect();
      } catch (e) {}
      if (S.eq.enabled) {
        ae.masterGain.connect(eqFilters[0]);
        for (let i = 0; i < eqFilters.length - 1; i++) {
          eqFilters[i].connect(eqFilters[i + 1]);
        }
        eqFilters[eqFilters.length - 1].connect(ae.audioCtx.destination);
        eqFilters.forEach((f, idx) => {
          f.gain.setTargetAtTime(S.eq.bands[idx].gain, ae.audioCtx.currentTime, 0.02);
        });
      } else {
        ae.masterGain.connect(ae.audioCtx.destination);
      }
    }
    renderEQ();
  }

  function curvePoints(pts) {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
    }
    return d;
  }

  function renderEQ() {
    const rails = $('#rails');
    const vals = $('#vals');
    if (!rails || !vals) return;

    const spans = vals.children;
    const rs = rails.children;
    const gains = S.eq.bands.map((b) => b.gain);
    const pts = gains.map((g, i) => [(i + 0.5) * 10, ((12 - g) / 24) * 100]);

    gains.forEach((g, i) => {
      if (spans[i]) spans[i].textContent = g > 0 ? '+' + g : String(g);
      const pos = (12 - g) / 24;
      if (rs[i]) {
        const k = rs[i].querySelector('.knob');
        const f = rs[i].querySelector('.fill');
        if (k) k.style.top = pos * 100 + '%';
        if (f) {
          f.style.top = Math.min(pos, 0.5) * 100 + '%';
          f.style.height = Math.abs(pos - 0.5) * 100 + '%';
        }
        rs[i].setAttribute('aria-valuenow', g);
      }
    });

    const linePath = curvePoints(pts);
    const eqLine = $('#eqLine');
    const eqArea = $('#eqArea');
    if (eqLine) eqLine.setAttribute('d', linePath);
    if (eqArea) eqArea.setAttribute('d', `${linePath} L${pts[9][0]},50 L${pts[0][0]},50 Z`);

    const label = S.eq.preset || 'Ajuste manual';
    const eqsub = $('#eqsub');
    const eqpilltx = $('#eqpilltx');
    if (eqsub) eqsub.textContent = S.eq.enabled ? label : 'Desligado';
    if (eqpilltx) eqpilltx.textContent = S.eq.enabled ? 'Som: ' + label : 'Som: desligado';

    $$('#presets .chip').forEach((c) => {
      c.setAttribute('aria-pressed', String(c.dataset.p === S.eq.preset));
    });
    $('#eqbox')?.classList.toggle('off', !S.eq.enabled);
  }

  function initEQDOM() {
    const vals = $('#vals');
    const fqs = $('#fqs');
    const rails = $('#rails');
    const presets = $('#presets');
    if (!vals || !fqs || !rails || !presets) return;

    vals.innerHTML = FREQ_LABELS.map(() => '<span></span>').join('');
    fqs.innerHTML = FREQ_LABELS.map((f) => `<span>${f}</span>`).join('');
    rails.innerHTML = FREQ_LABELS.map(
      (f, i) => `<div class="bd" role="slider" tabindex="0" aria-orientation="vertical" aria-label="${f} Hz" aria-valuemin="-12" aria-valuemax="12" data-b="${i}"><i class="fill"></i><i class="knob"></i></div>`
    ).join('');
    presets.innerHTML = Object.keys(EQ_PRESETS).map(
      (n) => `<button class="chip" data-p="${n}" aria-pressed="${S.eq.preset === n}">${n}</button>`
    ).join('');

    const plot = $('#plot');
    let dragBand = null;

    const setGainFromY = (bandIndex, clientY) => {
      const r = plot.getBoundingClientRect();
      const gain = clamp(Math.round(12 - ((clientY - r.top) / r.height) * 24), -12, 12);
      handleEqualizerChange(bandIndex, gain);
    };

    plot.addEventListener('pointerdown', (e) => {
      const r = plot.getBoundingClientRect();
      dragBand = clamp(Math.floor(((e.clientX - r.left) / r.width) * 10), 0, 9);
      plot.setPointerCapture(e.pointerId);
      plot.classList.add('drag');
      setGainFromY(dragBand, e.clientY);
      rails.children[dragBand]?.focus({ preventScroll: true });
    });

    plot.addEventListener('pointermove', (e) => {
      if (dragBand !== null) setGainFromY(dragBand, e.clientY);
    });

    const endDrag = () => {
      dragBand = null;
      plot.classList.remove('drag');
    };
    plot.addEventListener('pointerup', endDrag);
    plot.addEventListener('pointercancel', endDrag);

    rails.addEventListener('keydown', (e) => {
      const i = +e.target.dataset.b;
      if (isNaN(i)) return;
      const delta = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
      if (!delta) return;
      e.preventDefault();
      handleEqualizerChange(i, S.eq.bands[i].gain + delta);
    });

    presets.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      S.eq.preset = b.dataset.p;
      const presetGains = EQ_PRESETS[S.eq.preset];
      if (presetGains) {
        S.eq.bands.forEach((band, idx) => {
          band.gain = presetGains[idx];
          if (eqFilters[idx] && window.audioEngine?.audioCtx) {
            eqFilters[idx].gain.setTargetAtTime(
              S.eq.enabled ? band.gain : 0,
              window.audioEngine.audioCtx.currentTime,
              0.02
            );
          }
        });
        renderEQ();
      }
    });

    $('#eqsw')?.addEventListener('click', (e) => {
      const newState = !S.eq.enabled;
      e.currentTarget.setAttribute('aria-checked', String(newState));
      toggleEqualizer(newState);
    });

    renderEQ();
  }

  /* ---------- Sincronização do Player para a UI ---------- */
  function syncPlayerStateToUI(trackData, playbackState) {
    if (!trackData) {
      $('#ttl').textContent = 'Marola';
      $('#by').textContent = 'Selecione uma faixa para ouvir';
      $('#alb').textContent = 'Sunset & Sea Player';
      $('#fmt').textContent = 'Áudio Local';
      $('#tdur').textContent = '0:00';
      $('#tcur').textContent = '0:00';
      return;
    }

    $('#ttl').textContent = trackData.title || 'Faixa Desconhecida';
    $('#by').textContent = trackData.artist || 'Artista Desconhecido';
    $('#alb').textContent = (trackData.album || 'Álbum Desconhecido') + (trackData.year ? `, ${trackData.year}` : '');

    // Formato de áudio
    const ext = (trackData.filePath || '').split('.').pop().toUpperCase();
    $('#fmt').textContent = ext || 'ÁUDIO';

    S.dur = trackData.duration || 0;
    $('#tdur').textContent = fmt(S.dur);
    $('#seek')?.setAttribute('aria-valuemax', S.dur);

    // Paleta harmônica
    const palette = trackData.paletteConfig || hashPalette((trackData.artist || '') + (trackData.album || '') + (trackData.title || ''));
    applyThemePalette(palette);
    updateDiscCover(trackData, false);

    // Estado de reprodução
    S.playing = playbackState ? playbackState.isPlaying : S.playing;
    updatePlayControls();
    renderAllLists();
  }

  function updatePlayControls() {
    $('#playUse')?.setAttribute('href', S.playing ? '#i-pause' : '#i-play');
    $('#bPlay')?.setAttribute('aria-label', S.playing ? 'Pausar' : 'Tocar');
    $('#win')?.classList.toggle('paused', !S.playing);
  }

  /* ---------- Renderização da Coleção e Fila ---------- */
  const CHIPS_DATA = [
    { k: 'tudo', n: 'Tudo' },
    { k: 'novas', n: 'Recentes', hint: 'Tocadas recentemente' },
    { k: 'top', n: 'Mais Tocadas', hint: 'Ranking por execuções' }
  ];

  function renderChips() {
    const chipsEl = $('#chips');
    if (!chipsEl) return;
    chipsEl.innerHTML = CHIPS_DATA.map((c) => {
      let count = S.tracks.length;
      if (c.k === 'novas') count = S.tracks.filter((t) => t.last_played_at).length;
      if (c.k === 'top') count = S.tracks.filter((t) => (t.play_count || 0) > 0).length;
      return `<button class="chip" data-k="${c.k}" aria-pressed="${S.filter === c.k}" ${c.hint ? `title="${c.hint}"` : ''}>${c.n}<small>${count}</small></button>`;
    }).join('');
  }

  function trackRowHTML(idx, extra = '') {
    const tr = S.tracks[idx];
    if (!tr) return '';
    const now = idx === S.i;
    return `
      <button class="row" data-i="${idx}" ${now ? 'aria-current="true"' : ''}>
        <span class="cv" style="background:${coverBg(tr)}">
          <span class="ov pl">${ic(S.playing && now ? 'pause' : 'play', 'f')}</span>
          <span class="ov eqb"><i></i><i></i><i></i></span>
        </span>
        <span class="tx">
          <b>${esc(tr.title || 'Sem título')}</b>
          <small>${esc(tr.artist || 'Artista desconhecido')}, ${esc(tr.album || 'Álbum desconhecido')}</small>
        </span>
        ${extra || `<span class="du">${fmt(tr.duration)}</span>`}
      </button>
    `;
  }

  function renderLibraryList() {
    const listEl = $('#list');
    if (!listEl) return;
    const query = S.q.trim().toLowerCase();

    let filteredIndices = S.tracks.map((_, idx) => idx);

    if (S.filter === 'novas') {
      filteredIndices = filteredIndices
        .filter((idx) => S.tracks[idx].last_played_at)
        .sort((a, b) => new Date(S.tracks[b].last_played_at) - new Date(S.tracks[a].last_played_at));
    } else if (S.filter === 'top') {
      filteredIndices = filteredIndices
        .filter((idx) => (S.tracks[idx].play_count || 0) > 0)
        .sort((a, b) => (S.tracks[b].play_count || 0) - (S.tracks[a].play_count || 0));
    }

    if (query) {
      filteredIndices = filteredIndices.filter((idx) => {
        const tr = S.tracks[idx];
        const searchCorpus = `${tr.title || ''} ${tr.artist || ''} ${tr.album || ''}`.toLowerCase();
        return searchCorpus.includes(query);
      });
    }

    if (filteredIndices.length === 0) {
      if (S.tracks.length === 0) {
        listEl.innerHTML = `
          <li class="empty">
            <b>Sua biblioteca está vazia</b>
            Adicione uma pasta de músicas clicando em "Vitrola" na barra lateral.
          </li>
        `;
      } else {
        listEl.innerHTML = `
          <li class="empty">
            <b>Nada encontrado${query ? ` para "${esc(S.q.trim())}"` : ''}</b>
            Tente outro termo de pesquisa ou limpe o filtro.
          </li>
        `;
      }
      return;
    }

    listEl.innerHTML = filteredIndices.map((idx) => `<li>${trackRowHTML(idx)}</li>`).join('');
  }

  function renderQueueList() {
    const qnow = $('#qnow');
    const qlist = $('#qlist');
    const qcnt = $('#qcnt');
    const qclear = $('#qclear');

    if (qnow) {
      qnow.innerHTML = S.i >= 0 ? `<li>${trackRowHTML(S.i)}</li>` : '';
    }

    if (qlist) {
      if (S.queue.length === 0) {
        qlist.innerHTML = `
          <li class="empty">
            <b>A fila está vazia</b>
            Escolha uma música na coleção para começar uma nova reprodução.
          </li>
        `;
      } else {
        qlist.innerHTML = S.queue.map(
          (idx, n) => `
            <li class="qrow">
              ${trackRowHTML(idx)}
              <button class="rm" data-rm="${n}" aria-label="Remover da fila">${ic('x')}</button>
            </li>
          `
        ).join('');
      }
    }

    if (qcnt) qcnt.textContent = S.queue.length;
    if (qclear) qclear.hidden = S.queue.length === 0;

    const qSecTitle = $('#pane-q .sec:last-of-type h3');
    if (qSecTitle) {
      const totalSecs = S.queue.reduce((acc, idx) => acc + (S.tracks[idx]?.duration || 0), 0);
      const mins = Math.round(totalSecs / 60);
      qSecTitle.textContent = S.queue.length
        ? `A seguir, ${S.queue.length} ${S.queue.length === 1 ? 'faixa' : 'faixas'} (${mins} min)`
        : 'A seguir';
    }
  }

  function renderAllLists() {
    renderChips();
    renderLibraryList();
    renderQueueList();
  }

  /* ---------- Navegação e Fila ---------- */
  function buildQueueFromCurrent() {
    if (S.tracks.length === 0) {
      S.queue = [];
      return;
    }
    const pool = S.tracks.map((_, idx) => idx);
    const at = pool.indexOf(S.i);
    let rest = pool.slice(at + 1).concat(pool.slice(0, Math.max(0, at)));

    if (S.shuffle) {
      for (let k = rest.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [rest[k], rest[j]] = [rest[j], rest[k]];
      }
    }
    S.queue = rest;
  }

  async function playTrackByIndex(idx) {
    if (idx < 0 || idx >= S.tracks.length) return;
    S.i = idx;
    S.pos = 0;
    S.playing = true;
    S.hist = [];
    buildQueueFromCurrent();

    const track = S.tracks[idx];
    syncPlayerStateToUI(track, { isPlaying: true });

    if (window.audioEngine) {
      await window.audioEngine.playTrack(track);
    }
  }

  async function nextTrack() {
    if (S.queue.length === 0 && S.repeat === 'all') {
      buildQueueFromCurrent();
    }
    if (S.queue.length > 0) {
      if (S.i >= 0) S.hist.push(S.i);
      const nextIdx = S.queue.shift();
      S.i = nextIdx;
      S.pos = 0;
      S.playing = true;
      const track = S.tracks[nextIdx];
      syncPlayerStateToUI(track, { isPlaying: true });
      if (window.audioEngine) await window.audioEngine.playTrack(track);
    } else {
      S.pos = 0;
      S.playing = false;
      updatePlayControls();
      if (window.audioEngine) window.audioEngine.pause();
    }
    renderQueueList();
  }

  async function prevTrack() {
    if (S.pos > 3 || S.hist.length === 0) {
      S.pos = 0;
      if (window.audioEngine) window.audioEngine.seek(0);
      return;
    }
    const backIdx = S.hist.pop();
    if (S.i >= 0) S.queue.unshift(S.i);
    S.i = backIdx;
    S.pos = 0;
    S.playing = true;
    const track = S.tracks[backIdx];
    syncPlayerStateToUI(track, { isPlaying: true });
    if (window.audioEngine) await window.audioEngine.playTrack(track);
    renderQueueList();
  }

  /* ---------- Troca de Abas do Painel Direito ---------- */
  function showPanelTab(tabName) {
    [['lib', 'pane-lib'], ['q', 'pane-q'], ['eq', 'pane-eq']].forEach(([k, id]) => {
      const isSelected = k === tabName;
      $(`#tab-${k}`)?.setAttribute('aria-selected', String(isSelected));
      const pane = $(`#${id}`);
      if (pane) pane.hidden = !isSelected;
    });
  }

  /* ---------- Exibição de Toasts ---------- */
  let toastTimer = null;
  function showToast(msg) {
    const toast = $('#toast-notification');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  /* ---------- Inicialização Principal do App ---------- */
  async function initApp() {
    // 1. Inicializar AudioEngine e QueueManager
    const queueManager = new QueueManager();
    const storageProxy = {
      getSettings: () => ({ crossfadeSeconds: 3, volume: S.vol / 100 }),
      updateSettings: (s) => window.api?.updateSettings(s),
      incrementPlayCount: (fp) => window.api?.incrementPlayCount(fp)
    };
    const audioEngine = new AudioEngine(queueManager, storageProxy);
    window.audioEngine = audioEngine;
    window.queueManager = queueManager;

    // Listeners do AudioEngine
    audioEngine.on('timeupdate', (data) => {
      S.pos = data.currentTime || 0;
      S.dur = data.duration || S.dur;
      $('#tcur').textContent = fmt(S.pos);
      $('#tdur').textContent = fmt(S.dur);
      $('#seek')?.setAttribute('aria-valuenow', Math.floor(S.pos));
      $('#seek')?.setAttribute('aria-valuetext', `${fmt(S.pos)} de ${fmt(S.dur)}`);
    });

    audioEngine.on('trackChange', (data) => {
      if (data.track) {
        const foundIdx = S.tracks.findIndex((t) => t.filePath === data.track.filePath);
        if (foundIdx !== -1) S.i = foundIdx;
        syncPlayerStateToUI(data.track, { isPlaying: audioEngine.isPlaying });
      }
    });

    audioEngine.on('stateChange', (data) => {
      S.playing = data.isPlaying;
      updatePlayControls();
      if (audioEngine.audioCtx && eqFilters.length === 0) {
        setupAudioEqualizer(audioEngine.audioCtx, audioEngine.masterGain);
      }
    });

    // 2. Carregar biblioteca local do usuário
    try {
      if (window.api?.getTracks) {
        const localTracks = await window.api.getTracks();
        if (Array.isArray(localTracks)) {
          S.tracks = localTracks;
        }
      }
    } catch (err) {
      console.warn('[Marola] Erro ao carregar trilhas da biblioteca:', err);
    }

    // 3. Inicializar Equalizador gráfico
    initEQDOM();

    // 4. Se houver músicas, carregar a primeira em espera
    if (S.tracks.length > 0) {
      S.i = 0;
      buildQueueFromCurrent();
      syncPlayerStateToUI(S.tracks[0], { isPlaying: false });
    } else {
      syncPlayerStateToUI(null, { isPlaying: false });
    }
    renderAllLists();

    // 5. Configurar controles de volume
    const volInput = $('#vol');
    const syncVolumeUI = () => {
      const effectiveVol = S.muted ? 0 : S.vol;
      if (volInput) {
        volInput.value = effectiveVol;
        volInput.style.setProperty('--v', effectiveVol + '%');
      }
      $('#volUse')?.setAttribute('href', S.muted || S.vol === 0 ? '#i-mute' : '#i-vol');
      $('#bMute')?.setAttribute('aria-label', S.muted ? 'Reativar som' : 'Silenciar');
      audioEngine.setVolume(effectiveVol / 100);
    };

    volInput?.addEventListener('input', () => {
      S.vol = +volInput.value;
      S.muted = false;
      syncVolumeUI();
    });

    $('#bMute')?.addEventListener('click', () => {
      S.muted = !S.muted;
      syncVolumeUI();
    });
    syncVolumeUI();

    // 6. Configurar Seekbar
    const seekEl = $('#seek');
    const tipEl = $('#tip');

    const getSeekRatio = (e) => {
      const r = seekEl.getBoundingClientRect();
      return clamp((e.clientX - r.left) / r.width, 0, 1);
    };

    const updateSeekTip = (e) => {
      const ratio = getSeekRatio(e);
      if (tipEl) {
        tipEl.style.left = ratio * seekEl.clientWidth + 'px';
        tipEl.textContent = fmt(ratio * S.dur);
      }
    };

    seekEl?.addEventListener('pointerdown', (e) => {
      seekEl.setPointerCapture(e.pointerId);
      seekEl.classList.add('drag');
      const ratio = getSeekRatio(e);
      S.pos = ratio * S.dur;
      audioEngine.seek(S.pos);
      updateSeekTip(e);
    });

    seekEl?.addEventListener('pointermove', (e) => {
      updateSeekTip(e);
      if (seekEl.classList.contains('drag')) {
        const ratio = getSeekRatio(e);
        S.pos = ratio * S.dur;
        audioEngine.seek(S.pos);
      }
    });

    seekEl?.addEventListener('pointerup', () => seekEl.classList.remove('drag'));

    seekEl?.addEventListener('keydown', (e) => {
      const delta = { ArrowRight: 5, ArrowLeft: -5, PageUp: 15, PageDown: -15 }[e.key];
      if (delta) {
        e.preventDefault();
        S.pos = clamp(S.pos + delta, 0, S.dur - 0.5);
        audioEngine.seek(S.pos);
      }
      if (e.key === 'Home') audioEngine.seek(0);
      if (e.key === 'End') audioEngine.seek(S.dur - 0.5);
    });

    // 7. Controles de Reprodução da Doca
    $('#bPlay')?.addEventListener('click', () => {
      if (S.i === -1 && S.tracks.length > 0) {
        playTrackByIndex(0);
      } else {
        audioEngine.togglePlayPause();
      }
    });

    $('#bNext')?.addEventListener('click', nextTrack);
    $('#bPrev')?.addEventListener('click', prevTrack);

    $('#bShuf')?.addEventListener('click', (e) => {
      S.shuffle = !S.shuffle;
      e.currentTarget.setAttribute('aria-pressed', String(S.shuffle));
      buildQueueFromCurrent();
      renderQueueList();
    });

    $('#bRep')?.addEventListener('click', (e) => {
      const nextModes = { off: 'all', all: 'one', one: 'off' };
      S.repeat = nextModes[S.repeat] || 'off';
      e.currentTarget.setAttribute('aria-pressed', String(S.repeat !== 'off'));
      e.currentTarget.setAttribute('aria-label', `Repetir: ${{ off: 'desligado', all: 'tudo', one: 'esta faixa' }[S.repeat]}`);
      $('#repUse')?.setAttribute('href', S.repeat === 'one' ? '#i-repeat1' : '#i-repeat');
    });

    // 8. Eventos da Lista e Fila
    $('#chips')?.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      S.filter = b.dataset.k;
      renderChips();
      renderLibraryList();
    });

    $('.panel')?.addEventListener('click', (e) => {
      const rmBtn = e.target.closest('.rm');
      if (rmBtn) {
        const rmIdx = +rmBtn.dataset.rm;
        S.queue.splice(rmIdx, 1);
        renderQueueList();
        return;
      }
      const row = e.target.closest('.row');
      if (!row) return;
      const idx = +row.dataset.i;
      if (idx === S.i) {
        audioEngine.togglePlayPause();
      } else {
        playTrackByIndex(idx);
      }
    });

    $('#qclear')?.addEventListener('click', () => {
      S.queue = [];
      renderQueueList();
    });

    $('#q')?.addEventListener('input', (e) => {
      S.q = e.target.value;
      showPanelTab('lib');
      renderLibraryList();
    });

    // 9. Abas do Painel Direito
    $('.tabs')?.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (tab) showPanelTab(tab.id.slice(4));
    });

    $('#eqpill')?.addEventListener('click', () => showPanelTab('eq'));

    // 10. Botões do Rail Lateral
    $('#rail-tracks')?.addEventListener('click', () => {
      S.filter = 'tudo';
      showPanelTab('lib');
      renderAllLists();
      $$('.rail .rb').forEach((b) => b.removeAttribute('aria-current'));
      $('#rail-tracks')?.setAttribute('aria-current', 'page');
    });

    $('#rail-albums')?.addEventListener('click', () => {
      showPanelTab('lib');
      showToast('Visualização por Álbuns agrupada');
    });

    $('#rail-artists')?.addEventListener('click', () => {
      showPanelTab('lib');
      showToast('Visualização por Artistas agrupada');
    });

    $('#rail-playlists')?.addEventListener('click', () => {
      showPanelTab('lib');
      showToast('Visualização de Playlists aberta');
    });

    // Vitrola (Importar Músicas)
    $('#rail-import')?.addEventListener('click', async () => {
      if (window.api?.openFolderDialog && window.api?.scanFolder && window.api?.parseMetadataBatch) {
        try {
          const folderRes = await window.api.openFolderDialog();
          if (folderRes && !folderRes.canceled && folderRes.filePaths?.length > 0) {
            const folderPath = folderRes.filePaths[0];
            showToast('Escaneando pasta selecionada...');
            const audioFiles = await window.api.scanFolder(folderPath);
            if (audioFiles && audioFiles.length > 0) {
              const metaList = await window.api.parseMetadataBatch(audioFiles);
              if (window.api.upsertTracksBatch) {
                await window.api.upsertTracksBatch(metaList);
              }
              const reloaded = await window.api.getTracks();
              if (Array.isArray(reloaded)) {
                S.tracks = reloaded;
                renderAllLists();
                showToast(`${metaList.length} faixas importadas com sucesso!`);
              }
            } else {
              showToast('Nenhum arquivo de áudio encontrado nesta pasta.');
            }
          }
        } catch (err) {
          console.error('[Marola] Erro ao importar pasta:', err);
          showToast('Erro ao importar pasta de músicas.');
        }
      } else {
        showToast('Seletor de pastas pronto.');
      }
    });

    // Ajustes
    $('#rail-settings')?.addEventListener('click', () => {
      const modal = $('#settings-modal');
      if (modal) modal.style.display = 'grid';
    });

    $('#btn-close-settings')?.addEventListener('click', () => {
      const modal = $('#settings-modal');
      if (modal) modal.style.display = 'none';
    });

    const crossfadeSlider = $('#crossfade-slider');
    const crossfadeVal = $('#crossfade-val');
    crossfadeSlider?.addEventListener('input', (e) => {
      const val = +e.target.value;
      if (crossfadeVal) crossfadeVal.textContent = val + 's';
      audioEngine.setCrossfade(val);
    });

    $('#btn-add-music-folder')?.addEventListener('click', async () => {
      if (window.api?.openFolderDialog) {
        const res = await window.api.openFolderDialog();
        if (res && !res.canceled && res.filePaths?.length > 0) {
          if (window.api.addMusicFolder) {
            await window.api.addMusicFolder(res.filePaths[0]);
            showToast('Pasta adicionada ao monitoramento!');
          }
        }
      }
    });

    $('#btn-rescan-folders')?.addEventListener('click', async () => {
      if (window.api?.scanAllFolders) {
        showToast('Reescaneando todas as pastas...');
        await window.api.scanAllFolders();
        const reloaded = await window.api.getTracks();
        if (Array.isArray(reloaded)) {
          S.tracks = reloaded;
          renderAllLists();
          showToast('Biblioteca atualizada!');
        }
      }
    });

    // 11. Seletor de Saída de Áudio (#out-sink)
    $('#out-sink')?.addEventListener('click', async () => {
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');
          if (audioOutputs.length > 0) {
            // Ciclar para o próximo dispositivo disponível
            const currentSink = audioEngine.sinkId;
            const curIdx = audioOutputs.findIndex((d) => d.deviceId === currentSink);
            const nextIdx = (curIdx + 1) % audioOutputs.length;
            const nextDev = audioOutputs[nextIdx];
            await audioEngine.setSinkId(nextDev.deviceId);
            const label = nextDev.label || 'Dispositivo de Áudio';
            $('#current-sink-label').textContent = label;
            showToast(`Saída de áudio: ${label}`);
          } else {
            showToast('Saída padrão do sistema em uso.');
          }
        }
      } catch (err) {
        console.warn('[Marola] Erro ao alternar saída de áudio:', err);
      }
    });

    // 12. Controles de Janela da Titlebar
    $('#btn-minimize')?.addEventListener('click', () => window.api?.minimizeWindow?.());
    $('#btn-maximize')?.addEventListener('click', () => window.api?.maximizeWindow?.());
    $('#btn-close')?.addEventListener('click', () => window.api?.closeWindow?.());

    // 13. Atalhos Globais de Teclado
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        $('#q')?.focus();
        return;
      }
      const tag = e.target.tagName;
      if (tag === 'INPUT' && e.target.id === 'q' && e.key === 'Escape') {
        e.target.value = '';
        S.q = '';
        renderLibraryList();
        e.target.blur();
        return;
      }
      if (tag === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Space' && tag !== 'BUTTON') {
        e.preventDefault();
        audioEngine.togglePlayPause();
      } else if (e.key === 'n' || e.key === 'N') {
        nextTrack();
      } else if (e.key === 'p' || e.key === 'P') {
        prevTrack();
      }
    });

    // 14. Redimensionamento e Loop de Animação do Canvas
    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);

    let lastTime = performance.now();
    let startTime = lastTime;
    const sunEl = $('#sun');

    function animationLoop(now) {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      const t = reduceMotion ? 0 : (now - startTime) / 1000;

      // Dinâmica de amortecimento e energia
      seaAnim.calm += ((S.playing ? 1 : 0) - seaAnim.calm) * Math.min(1, dt * 3);
      const bpm = currentTrack()?.bpm || 110;
      const beatPhase = (S.pos * (bpm / 60)) % 1;
      seaAnim.energy += (Math.exp(-beatPhase * 4.5) * seaAnim.calm - seaAnim.energy) * Math.min(1, dt * 14);

      // Interpolação de cores
      if (tweenPalette(reduceMotion ? 1 : 1 - Math.exp(-dt * 4.5))) {
        flushColorsToCss();
      }

      // Efeito de pulso no sol
      if (!reduceMotion && sunEl) {
        sunEl.style.setProperty('--pulse', (1 + seaAnim.energy * 0.028).toFixed(4));
        sunEl.style.setProperty('--halo', (0.62 + seaAnim.energy * 0.38).toFixed(3));
      }

      // Renderizar Canvas do Mar e da Seekbar
      renderSeaAtmosphere(seaCtx, t, bpm, S.playing);
      const ratio = S.dur > 0 ? S.pos / S.dur : 0;
      renderWaveformProgress(seekCtx, ratio, S.playing);

      requestAnimationFrame(animationLoop);
    }

    requestAnimationFrame(animationLoop);
  }

  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  // Exportar contratos globais para interoperabilidade e testes
  window.applyThemePalette = applyThemePalette;
  window.renderWaveformProgress = renderWaveformProgress;
  window.renderSeaAtmosphere = renderSeaAtmosphere;
  window.handleEqualizerChange = handleEqualizerChange;
  window.syncPlayerStateToUI = syncPlayerStateToUI;
})();
