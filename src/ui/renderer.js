/**
 * Marola - Sunset & Sea Music Player
 * Controlador de Interface, Renderização Dinâmica e Integração IPC
 */

(() => {
  // Helpers DOM e utilitários
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

  /* ---------- Presets Convencionais de Acústica do Equalizador ---------- */
  const FREQ_LABELS = ['40', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
  const FREQS_HZ = [40, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const EQ_PRESETS = {
    'Plano':            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'Graves Fortes':    [8, 7, 5, 3, 1, 0, 0, 0, 0, 0],
    'Eletrônica / Pop': [6, 5, 2, -1, -2, -1, 2, 4, 6, 7],
    'Rock':             [4, 3, 4, 3, -1, 1, 3, 5, 4, 3],
    'Acústico / Voz':   [-3, -2, 0, 2, 4, 5, 4, 2, 1, 0]
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
    currentNav: 'tracks', // tracks | albums | artists | playlists
    themeMode: 'dark', // dark | light | system
    accentMode: 'dynamic', // dynamic or hex
    crossfadeSeconds: 3,
    volumeNormalization: false,
    eq: {
      enabled: true,
      preset: 'Plano',
      bands: FREQ_LABELS.map((freq, i) => ({ freq, gain: EQ_PRESETS['Plano'][i] }))
    }
  };

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
    scheduleAnimationWake();
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

    if (S.accentMode === 'dynamic') {
      r.setProperty('--accent', rgb(currentColors.accent));
      r.setProperty('--accent-rgb', css(currentColors.accent));
      r.setProperty('--accent-hover', rgb(currentColors.accent));
      r.setProperty('--ink', rgb(currentColors.ink));
    }
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

  /* ---------- Alternância de Capa do Sol (Disco de Vinil) ---------- */
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

  /* ---------- Canvas de Progresso / Seekbar Sem Cortes Geométricos ---------- */
  function renderWaveformProgress(ctx, progressRatio, isPlaying) {
    if (!ctx || !seekW || !seekH) return;
    ctx.clearRect(0, 0, seekW, seekH);

    const mid = seekH / 2;
    // Margem segura de 7px para raio do cursor circular de 7px
    const x = clamp(progressRatio * (seekW - 14) + 7, 7, seekW - 7);
    const calm = seaAnim.calm;
    const energy = reduceMotion ? 0 : seaAnim.energy;

    // Linha tracejada pontilhada restante
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([0.1, 7]);
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.beginPath();
    ctx.moveTo(Math.max(x, 7), mid);
    ctx.lineTo(seekW - 7, mid);
    ctx.stroke();
    ctx.setLineDash([]);

    // Onda senoidal de progresso concluído
    if (x > 7) {
      ctx.strokeStyle = rgb(currentColors.accent);
      ctx.lineWidth = 3;
      ctx.beginPath();
      const A = (1.2 + 2.4 * calm) * (1 + energy * 0.5);
      const wl = 26;
      const ph = reduceMotion ? 0 : (performance.now() / 1000) * (1.2 + 3 * calm) * 2;
      for (let xx = 7; xx <= x; xx += 2) {
        const env = Math.min(1, (x - xx) / 20, (xx - 7) / 10 + 0.35);
        const y = mid + A * env * Math.sin((xx / wl) * 6.2832 - ph);
        xx === 7 ? ctx.moveTo(xx, y) : ctx.lineTo(xx, y);
      }
      ctx.stroke();
    }

    // Cursor circular com anel
    ctx.beginPath();
    ctx.arc(x, mid, 7, 0, 6.2832);
    ctx.fillStyle = rgb(currentColors.accent);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(7,17,27,0.92)';
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

  function applyEqualizerBand(bandIndex, gainDb) {
    handleEqualizerChange(bandIndex, gainDb);
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

  function selectEqualizerPreset(presetName) {
    const presetGains = EQ_PRESETS[presetName];
    if (!presetGains) return;
    S.eq.preset = presetName;
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
      selectEqualizerPreset(b.dataset.p);
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
      $('#empty-welcome').style.display = S.tracks.length === 0 ? 'grid' : 'none';
      return;
    }

    $('#empty-welcome').style.display = 'none';
    $('#ttl').textContent = trackData.title || 'Faixa Desconhecida';
    $('#by').textContent = trackData.artist || 'Artista Desconhecido';
    $('#alb').textContent = (trackData.album || 'Álbum Desconhecido') + (trackData.year ? `, ${trackData.year}` : '');

    const ext = (trackData.filePath || '').split('.').pop().toUpperCase();
    $('#fmt').textContent = ext || 'ÁUDIO';

    S.dur = trackData.duration || 0;
    $('#tdur').textContent = fmt(S.dur);
    $('#seek')?.setAttribute('aria-valuemax', S.dur);

    const palette = trackData.paletteConfig || hashPalette((trackData.artist || '') + (trackData.album || '') + (trackData.title || ''));
    applyThemePalette(palette);
    updateDiscCover(trackData, false);

    S.playing = playbackState ? playbackState.isPlaying : S.playing;
    updatePlayControls();
    renderAllLists();
    scheduleAnimationWake();
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

  /* ---------- Renderização de Álbuns, Artistas e Playlists ---------- */
  function renderAlbumsGrid() {
    const grid = $('#albums-grid');
    const countEl = $('#albums-count');
    if (!grid) return;

    // Agrupar por álbum
    const albumsMap = new Map();
    S.tracks.forEach((tr, idx) => {
      const albName = tr.album || 'Álbum Desconhecido';
      if (!albumsMap.has(albName)) {
        albumsMap.set(albName, {
          title: albName,
          artist: tr.artist || 'Artista Desconhecido',
          year: tr.year || '',
          coverDataUrl: tr.coverDataUrl,
          paletteConfig: tr.paletteConfig,
          trackIndices: []
        });
      }
      albumsMap.get(albName).trackIndices.push(idx);
    });

    const albums = Array.from(albumsMap.values());
    if (countEl) countEl.textContent = `${albums.length} ${albums.length === 1 ? 'álbum' : 'álbuns'}`;

    if (albums.length === 0) {
      grid.innerHTML = `<div class="empty"><b>Nenhum álbum encontrado</b>Importe músicas pela Vitrola.</div>`;
      return;
    }

    grid.innerHTML = albums.map((alb) => `
      <div class="album-card" data-album="${esc(alb.title)}">
        <div class="album-cover-wrap" style="background:${coverBg(alb)}"></div>
        <div class="album-card-title" title="${esc(alb.title)}">${esc(alb.title)}</div>
        <div class="album-card-artist" title="${esc(alb.artist)}">${esc(alb.artist)}${alb.year ? `, ${alb.year}` : ''}</div>
        <div class="album-card-count">${alb.trackIndices.length} ${alb.trackIndices.length === 1 ? 'música' : 'músicas'}</div>
      </div>
    `).join('');

    grid.querySelectorAll('.album-card').forEach((card) => {
      card.addEventListener('click', () => {
        const albName = card.dataset.album;
        const albData = albumsMap.get(albName);
        if (albData && albData.trackIndices.length > 0) {
          playTrackByIndex(albData.trackIndices[0]);
          S.queue = albData.trackIndices.slice(1);
          renderQueueList();
          showToast(`Tocando álbum: ${albName}`);
        }
      });
    });
  }

  function renderArtistsList() {
    const listEl = $('#artists-list');
    const countEl = $('#artists-count');
    if (!listEl) return;

    const artistsMap = new Map();
    S.tracks.forEach((tr, idx) => {
      const artName = tr.artist || 'Artista Desconhecido';
      if (!artistsMap.has(artName)) {
        artistsMap.set(artName, { name: artName, trackIndices: [] });
      }
      artistsMap.get(artName).trackIndices.push(idx);
    });

    const artists = Array.from(artistsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    if (countEl) countEl.textContent = `${artists.length} ${artists.length === 1 ? 'artista' : 'artistas'}`;

    if (artists.length === 0) {
      listEl.innerHTML = `<li class="empty"><b>Nenhum artista encontrado</b>Importe músicas pela Vitrola.</li>`;
      return;
    }

    listEl.innerHTML = artists.map((art) => `
      <li class="artist-row" data-artist="${esc(art.name)}">
        <div class="artist-info">
          <div class="artist-avatar">${ic('user')}</div>
          <div>
            <div class="artist-name">${esc(art.name)}</div>
            <div class="artist-tracks-count">${art.trackIndices.length} ${art.trackIndices.length === 1 ? 'faixa' : 'faixas'}</div>
          </div>
        </div>
        <button class="round" style="width:28px;height:28px" title="Tocar artista">${ic('play', 'f')}</button>
      </li>
    `).join('');

    listEl.querySelectorAll('.artist-row').forEach((row) => {
      row.addEventListener('click', () => {
        const artName = row.dataset.artist;
        const artData = artistsMap.get(artName);
        if (artData && artData.trackIndices.length > 0) {
          playTrackByIndex(artData.trackIndices[0]);
          S.queue = artData.trackIndices.slice(1);
          renderQueueList();
          showToast(`Tocando artista: ${artName}`);
        }
      });
    });
  }

  async function renderPlaylistsList() {
    const listEl = $('#playlists-list');
    if (!listEl) return;

    let playlists = [];
    try {
      if (window.api?.getPlaylists) {
        playlists = await window.api.getPlaylists('created');
      }
    } catch (e) {
      console.warn('[Marola] Erro ao carregar playlists:', e);
    }

    if (!Array.isArray(playlists) || playlists.length === 0) {
      listEl.innerHTML = `<li class="empty"><b>Nenhuma playlist criada</b>Clique em "+ Nova Playlist" acima.</li>`;
      return;
    }

    listEl.innerHTML = playlists.map((pl) => `
      <li class="playlist-row" data-id="${pl.id}">
        <div class="playlist-info">
          <div class="playlist-icon-wrap">${ic('list')}</div>
          <div>
            <div class="playlist-name">${esc(pl.name)}</div>
            <div class="playlist-tracks-count">${pl.trackIds ? pl.trackIds.length : 0} músicas</div>
          </div>
        </div>
        <button class="round" style="width:28px;height:28px" title="Tocar playlist">${ic('play', 'f')}</button>
      </li>
    `).join('');

    listEl.querySelectorAll('.playlist-row').forEach((row) => {
      row.addEventListener('click', async () => {
        const plId = row.dataset.id;
        const pl = playlists.find((p) => p.id === plId);
        if (pl && pl.trackIds?.length > 0) {
          const matchedIndices = pl.trackIds
            .map((tid) => S.tracks.findIndex((t) => t.filePath === tid || t.id === tid))
            .filter((idx) => idx !== -1);
          if (matchedIndices.length > 0) {
            playTrackByIndex(matchedIndices[0]);
            S.queue = matchedIndices.slice(1);
            renderQueueList();
            showToast(`Tocando playlist: ${pl.name}`);
          }
        }
      });
    });
  }

  function renderAllLists() {
    renderChips();
    renderLibraryList();
    renderQueueList();
    if (S.currentNav === 'albums') renderAlbumsGrid();
    if (S.currentNav === 'artists') renderArtistsList();
    if (S.currentNav === 'playlists') renderPlaylistsList();
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
      scheduleAnimationWake();
    }
  }

  async function togglePlayback() {
    if (S.tracks.length === 0) {
      showToast('Adicione uma pasta de músicas na Vitrola para começar!');
      return false;
    }
    if (S.i === -1) {
      await playTrackByIndex(0);
      return true;
    }
    if (window.audioEngine) {
      window.audioEngine.togglePlayPause();
      S.playing = window.audioEngine.isPlaying;
      updatePlayControls();
      scheduleAnimationWake();
      return S.playing;
    }
    return false;
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
      if (window.audioEngine) {
        await window.audioEngine.playTrack(track);
        scheduleAnimationWake();
      }
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
    if (window.audioEngine) {
      await window.audioEngine.playTrack(track);
      scheduleAnimationWake();
    }
    renderQueueList();
  }

  function stepTrack(dir) {
    if (dir === 'next') nextTrack();
    else if (dir === 'prev') prevTrack();
  }

  function seekPosition(seconds) {
    S.pos = clamp(seconds, 0, S.dur || 0);
    if (window.audioEngine) {
      window.audioEngine.seek(S.pos);
      scheduleAnimationWake();
    }
  }

  function setPlaybackVolume(level, isMuted) {
    S.vol = clamp(level, 0, 100);
    S.muted = Boolean(isMuted);
    const volInput = $('#vol');
    if (volInput) {
      const effectiveVol = S.muted ? 0 : S.vol;
      volInput.value = effectiveVol;
      volInput.style.setProperty('--v', effectiveVol + '%');
      $('#volUse')?.setAttribute('href', S.muted || S.vol === 0 ? '#i-mute' : '#i-vol');
      $('#bMute')?.setAttribute('aria-label', S.muted ? 'Reativar som' : 'Silenciar');
    }
    if (window.audioEngine) {
      window.audioEngine.setVolume((S.muted ? 0 : S.vol) / 100);
    }
  }

  /* ---------- Troca de Abas do Painel Direito ---------- */
  function showPanelTab(tabName) {
    [['lib', 'pane-lib'], ['q', 'pane-q'], ['eq', 'pane-eq']].forEach(([k, id]) => {
      const isSelected = k === tabName;
      $(`#tab-${k}`)?.setAttribute('aria-selected', String(isSelected));
      const pane = $(`#${id}`);
      if (pane) pane.hidden = !isSelected;
    });
    // Ocultar painéis secundários de álbuns/artistas/playlists se voltar para lib
    if (tabName === 'lib') {
      $('#pane-albums').hidden = true;
      $('#pane-artists').hidden = true;
      $('#pane-playlists').hidden = true;
      $('#pane-lib').hidden = false;
    }
  }

  /* ---------- Roteamento das Seções do Rail Lateral ---------- */
  function switchNavSection(section) {
    S.currentNav = section;
    $$('.rail .rb').forEach((b) => b.removeAttribute('aria-current'));

    const tabLib = $('#tab-lib');
    const tabQ = $('#tab-q');
    const tabEq = $('#tab-eq');

    $('#pane-lib').hidden = true;
    $('#pane-albums').hidden = true;
    $('#pane-artists').hidden = true;
    $('#pane-playlists').hidden = true;
    $('#pane-q').hidden = true;
    $('#pane-eq').hidden = true;

    tabLib?.setAttribute('aria-selected', 'false');
    tabQ?.setAttribute('aria-selected', 'false');
    tabEq?.setAttribute('aria-selected', 'false');

    if (section === 'tracks') {
      $('#rail-tracks')?.setAttribute('aria-current', 'page');
      tabLib?.setAttribute('aria-selected', 'true');
      tabLib.textContent = 'Músicas';
      $('#pane-lib').hidden = false;
      renderLibraryList();
    } else if (section === 'albums') {
      $('#rail-albums')?.setAttribute('aria-current', 'page');
      tabLib?.setAttribute('aria-selected', 'true');
      tabLib.textContent = 'Álbuns';
      $('#pane-albums').hidden = false;
      renderAlbumsGrid();
    } else if (section === 'artists') {
      $('#rail-artists')?.setAttribute('aria-current', 'page');
      tabLib?.setAttribute('aria-selected', 'true');
      tabLib.textContent = 'Artistas';
      $('#pane-artists').hidden = false;
      renderArtistsList();
    } else if (section === 'playlists') {
      $('#rail-playlists')?.setAttribute('aria-current', 'page');
      tabLib?.setAttribute('aria-selected', 'true');
      tabLib.textContent = 'Playlists';
      $('#pane-playlists').hidden = false;
      renderPlaylistsList();
    }
  }

  /* ---------- Gerenciador de Pastas Locais (Ajustes e Vitrola) ---------- */
  async function getMonitoredFolders() {
    try {
      if (window.api?.getMusicFolders) {
        return (await window.api.getMusicFolders()) || [];
      }
    } catch (e) {
      console.warn('[Marola] Erro ao buscar pastas:', e);
    }
    return [];
  }

  async function renderFoldersUI() {
    const folders = await getMonitoredFolders();
    const settingsList = $('#music-folders-list');
    const vitrolaList = $('#vitrola-folders-list');

    const html = folders.length > 0
      ? folders.map((f) => `
        <li class="folder-item" data-id="${f.id}" data-path="${esc(f.path)}">
          <div class="folder-item-info">
            <svg class="i"><use href="#i-folder"/></svg>
            <span class="folder-item-path" title="${esc(f.path)}">${esc(f.path)}</span>
          </div>
          <div class="folder-item-actions">
            <span class="folder-count-badge">${f.trackCount || 0} faixas</span>
            <button class="switch" role="switch" aria-checked="${f.enabled !== false}" title="Ocultar/Exibir faixas"></button>
            <button class="btn-remove-folder" title="Remover pasta do Marola">${ic('trash')}</button>
          </div>
        </li>
      `).join('')
      : `<li class="empty" style="padding:14px 8px;font-size:12px">Nenhuma pasta monitorada no momento.</li>`;

    if (settingsList) settingsList.innerHTML = html;
    if (vitrolaList) vitrolaList.innerHTML = html;

    const bindFolderEvents = (container) => {
      if (!container) return;
      container.querySelectorAll('.folder-item').forEach((item) => {
        const folderId = item.dataset.id;
        const folderPath = item.dataset.path;

        // Toggle visibilidade
        item.querySelector('.switch')?.addEventListener('click', async (e) => {
          const currentChecked = e.currentTarget.getAttribute('aria-checked') === 'true';
          const nextState = !currentChecked;
          e.currentTarget.setAttribute('aria-checked', String(nextState));
          if (window.api?.toggleMusicFolder) {
            await window.api.toggleMusicFolder(folderId, nextState);
            await reloadLibrary();
            showToast(nextState ? 'Pasta ativada na biblioteca' : 'Pasta ocultada da biblioteca');
          }
        });

        // Remover pasta
        item.querySelector('.btn-remove-folder')?.addEventListener('click', async () => {
          await removeMonitoredFolder(folderId || folderPath);
        });
      });
    };

    bindFolderEvents(settingsList);
    bindFolderEvents(vitrolaList);
  }

  async function addMonitoredFolder() {
    if (!window.api?.openFolderDialog || !window.api?.scanFolder || !window.api?.parseMetadataBatch) {
      showToast('API de diálogo de pastas não disponível');
      return { success: false, tracksImported: 0 };
    }

    const folderRes = await window.api.openFolderDialog();
    if (!folderRes || folderRes.canceled || !folderRes.filePaths?.length) {
      return { success: false, tracksImported: 0 };
    }

    const folderPath = folderRes.filePaths[0];
    showProgressUI(true, 'Escaneando pasta selecionada...', 20);

    try {
      const audioFiles = await window.api.scanFolder(folderPath);
      showProgressUI(true, `Indexando ${audioFiles.length} arquivos encontrados...`, 50);

      let importedCount = 0;
      if (audioFiles.length > 0) {
        const metaList = await window.api.parseMetadataBatch(audioFiles);
        if (window.api.upsertTracksBatch) {
          await window.api.upsertTracksBatch(metaList);
        }
        importedCount = metaList.length;
      }

      if (window.api.addMusicFolder) {
        await window.api.addMusicFolder(folderPath);
      }

      showProgressUI(true, 'Concluído!', 100);
      setTimeout(() => showProgressUI(false), 800);

      await reloadLibrary();
      await renderFoldersUI();
      showToast(`Sucesso: ${importedCount} faixas importadas!`);
      return { success: true, addedPath: folderPath, tracksImported: importedCount };
    } catch (err) {
      console.error('[Marola] Erro ao adicionar pasta:', err);
      showProgressUI(false);
      showToast('Erro ao importar pasta de músicas.');
      return { success: false, tracksImported: 0 };
    }
  }

  async function removeMonitoredFolder(folderIdOrPath) {
    if (!window.api?.removeMusicFolder) return { success: false, removedTracks: 0 };
    try {
      showToast('Removendo pasta e atualizando catálogo...');
      await window.api.removeMusicFolder(folderIdOrPath);
      await reloadLibrary();
      await renderFoldersUI();
      showToast('Pasta removida do catálogo com sucesso!');
      return { success: true, removedTracks: 1 };
    } catch (err) {
      console.error('[Marola] Erro ao remover pasta:', err);
      showToast('Erro ao desvincular pasta.');
      return { success: false, removedTracks: 0 };
    }
  }

  async function toggleFolderVisibility(folderId, enabled) {
    if (window.api?.toggleMusicFolder) {
      await window.api.toggleMusicFolder(folderId, enabled);
      await reloadLibrary();
      await renderFoldersUI();
    }
  }

  async function reloadLibrary() {
    if (window.api?.getTracks) {
      const reloaded = await window.api.getTracks();
      if (Array.isArray(reloaded)) {
        S.tracks = reloaded;
        if (S.i >= S.tracks.length) S.i = S.tracks.length - 1;
        renderAllLists();
        syncPlayerStateToUI(currentTrack(), { isPlaying: window.audioEngine?.isPlaying || false });
      }
    }
  }

  function showProgressUI(visible, text = '', percent = 0) {
    const box = $('#vitrola-progress-box');
    const fill = $('#vitrola-progress-fill');
    const txt = $('#vitrola-progress-text');
    if (!box) return;
    box.style.display = visible ? 'block' : 'none';
    if (fill) fill.style.width = percent + '%';
    if (txt) txt.textContent = text;
  }

  /* ---------- Temas e Cores de Acento ---------- */
  function setThemeMode(mode) {
    S.themeMode = mode;
    if (mode === 'light') {
      root.setAttribute('data-theme', 'light');
    } else if (mode === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else if (mode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
    $$('.theme-mode-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
  }

  function setAccentColor(colorHex) {
    S.accentMode = colorHex;
    $$('.accent-dot').forEach((d) => {
      d.classList.toggle('active', d.dataset.accent === colorHex);
    });

    if (colorHex === 'dynamic') {
      flushColorsToCss();
    } else {
      const rgbArr = hex(colorHex);
      root.style.setProperty('--accent', colorHex);
      root.style.setProperty('--accent-rgb', css(rgbArr));
      root.style.setProperty('--accent-hover', colorHex);
    }
  }

  function setCrossfadeDuration(seconds) {
    S.crossfadeSeconds = clamp(seconds, 0, 12);
    const slider = $('#crossfade-slider');
    const valEl = $('#crossfade-val');
    if (slider) slider.value = S.crossfadeSeconds;
    if (valEl) valEl.textContent = S.crossfadeSeconds.toFixed(1) + 's';
    if (window.audioEngine) {
      window.audioEngine.setCrossfade(S.crossfadeSeconds);
    }
  }

  /* ---------- Toasts ---------- */
  let toastTimer = null;
  function showToast(msg) {
    const toast = $('#toast-notification');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  /* ---------- Loop de Animação com Suspensão em Ocioso ---------- */
  let rafId = null;
  let isRafRunning = false;
  let lastTime = performance.now();
  let startTime = lastTime;
  let pausedTimeStart = 0;

  function scheduleAnimationWake() {
    pausedTimeStart = 0;
    if (!isRafRunning) {
      isRafRunning = true;
      lastTime = performance.now();
      rafId = requestAnimationFrame(animationLoop);
    }
  }

  function animationLoop(now) {
    // Suspensão em ocioso: pausado > 5s ou janela minimizada/oculta
    if (!S.playing && document.hidden) {
      isRafRunning = false;
      return;
    }
    if (!S.playing) {
      if (!pausedTimeStart) pausedTimeStart = now;
      if (now - pausedTimeStart > 5000) {
        isRafRunning = false;
        return;
      }
    } else {
      pausedTimeStart = 0;
    }

    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    const t = reduceMotion ? 0 : (now - startTime) / 1000;

    // Sincronização estrita de tempo com o motor nativo de áudio (elimina avanço fantasma)
    if (window.audioEngine && window.audioEngine.isPlaying && !isDraggingSeek) {
      const curDeck = window.audioEngine.getActiveDeck();
      if (curDeck?.audio && !isNaN(curDeck.audio.currentTime)) {
        S.pos = curDeck.audio.currentTime;
        if (curDeck.audio.duration && !isNaN(curDeck.audio.duration) && curDeck.audio.duration > 0) {
          S.dur = curDeck.audio.duration;
        }
      }
    }

    // Dinâmica de amortecimento das ondas do mar
    seaAnim.calm += ((S.playing ? 1 : 0) - seaAnim.calm) * Math.min(1, dt * 3);
    const bpm = currentTrack()?.bpm || 110;
    const beatPhase = (S.pos * (bpm / 60)) % 1;
    seaAnim.energy += (Math.exp(-beatPhase * 4.5) * seaAnim.calm - seaAnim.energy) * Math.min(1, dt * 14);

    // Interpolação suave de paleta
    if (tweenPalette(reduceMotion ? 1 : 1 - Math.exp(-dt * 4.5))) {
      flushColorsToCss();
    }

    // Pulso luminoso do sol
    const sunEl = $('#sun');
    if (!reduceMotion && sunEl) {
      sunEl.style.setProperty('--pulse', (1 + seaAnim.energy * 0.028).toFixed(4));
      sunEl.style.setProperty('--halo', (0.62 + seaAnim.energy * 0.38).toFixed(3));
    }

    // Renderizar Canvas do Mar e Seekbar
    renderSeaAtmosphere(seaCtx, t, bpm, S.playing);
    const ratio = S.dur > 0 ? S.pos / S.dur : 0;
    renderWaveformProgress(seekCtx, ratio, S.playing);

    // Atualizar labels de minutagem
    $('#tcur').textContent = fmt(S.pos);
    $('#tdur').textContent = fmt(S.dur);

    rafId = requestAnimationFrame(animationLoop);
  }

  let isDraggingSeek = false;

  /* ---------- Inicialização Principal do App ---------- */
  async function initApp() {
    // 1. Inicializar AudioEngine e QueueManager
    const queueManager = new QueueManager();
    const storageProxy = {
      getSettings: () => ({ crossfadeSeconds: S.crossfadeSeconds, volume: S.vol / 100 }),
      updateSettings: (s) => window.api?.updateSettings?.(s),
      incrementPlayCount: (fp) => window.api?.incrementPlayCount?.(fp)
    };
    const audioEngine = new AudioEngine(queueManager, storageProxy);
    window.audioEngine = audioEngine;
    window.queueManager = queueManager;

    // Listeners do AudioEngine
    audioEngine.on('timeupdate', (data) => {
      if (!isDraggingSeek) {
        S.pos = data.currentTime || 0;
        S.dur = data.duration || S.dur;
        $('#tcur').textContent = fmt(S.pos);
        $('#tdur').textContent = fmt(S.dur);
        $('#seek')?.setAttribute('aria-valuenow', Math.floor(S.pos));
        $('#seek')?.setAttribute('aria-valuetext', `${fmt(S.pos)} de ${fmt(S.dur)}`);
      }
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
      scheduleAnimationWake();
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

    // 3. Inicializar Equalizador com presets padrão
    initEQDOM();

    // 4. Carregar estado inicial
    if (S.tracks.length > 0) {
      S.i = 0;
      buildQueueFromCurrent();
      syncPlayerStateToUI(S.tracks[0], { isPlaying: false });
    } else {
      syncPlayerStateToUI(null, { isPlaying: false });
    }
    renderAllLists();
    renderFoldersUI();

    // 5. Volume e Mudo
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

    // 6. Seekbar com Cálculo de Margem Segura e Arraste Contínuo
    const seekEl = $('#seek');
    const tipEl = $('#tip');

    function seekAtEvent(e, commit = false) {
      const r = seekEl.getBoundingClientRect();
      const ratio = clamp((e.clientX - r.left - 7) / (r.width - 14), 0, 1);
      const targetTime = ratio * (S.dur || 0);
      S.pos = targetTime;
      if (tipEl) {
        tipEl.style.left = clamp(ratio * (r.width - 14) + 7, 7, r.width - 7) + 'px';
        tipEl.textContent = fmt(targetTime);
      }
      if (commit && window.audioEngine) {
        window.audioEngine.seek(targetTime);
        scheduleAnimationWake();
      }
    }

    seekEl?.addEventListener('pointerdown', (e) => {
      seekEl.setPointerCapture(e.pointerId);
      isDraggingSeek = true;
      seekEl.classList.add('drag');
      seekAtEvent(e, false);
      scheduleAnimationWake();
    });

    seekEl?.addEventListener('pointermove', (e) => {
      if (isDraggingSeek) {
        seekAtEvent(e, false);
      } else {
        const r = seekEl.getBoundingClientRect();
        const ratio = clamp((e.clientX - r.left - 7) / (r.width - 14), 0, 1);
        if (tipEl) {
          tipEl.style.left = clamp(ratio * (r.width - 14) + 7, 7, r.width - 7) + 'px';
          tipEl.textContent = fmt(ratio * (S.dur || 0));
        }
      }
    });

    seekEl?.addEventListener('pointerup', (e) => {
      if (isDraggingSeek) {
        seekAtEvent(e, true);
        isDraggingSeek = false;
        seekEl.classList.remove('drag');
        try { seekEl.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    });

    seekEl?.addEventListener('pointercancel', (e) => {
      isDraggingSeek = false;
      seekEl.classList.remove('drag');
      try { seekEl.releasePointerCapture(e.pointerId); } catch (_) {}
    });

    seekEl?.addEventListener('keydown', (e) => {
      const delta = { ArrowRight: 5, ArrowLeft: -5, PageUp: 15, PageDown: -15 }[e.key];
      if (delta) {
        e.preventDefault();
        seekPosition(S.pos + delta);
      }
      if (e.key === 'Home') seekPosition(0);
      if (e.key === 'End') seekPosition(S.dur - 0.5);
    });

    // 7. Botões da Doca
    $('#bPlay')?.addEventListener('click', togglePlayback);
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

    // 8. Eventos da Lista Principal e Chips
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
        togglePlayback();
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
      switchNavSection('tracks');
      renderLibraryList();
    });

    // 9. Abas do Painel Direito
    $('.tabs')?.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (tab) showPanelTab(tab.id.slice(4));
    });

    $('#eqpill')?.addEventListener('click', () => showPanelTab('eq'));

    // 10. Navegação do Rail Lateral
    $('#rail-tracks')?.addEventListener('click', () => switchNavSection('tracks'));
    $('#rail-albums')?.addEventListener('click', () => switchNavSection('albums'));
    $('#rail-artists')?.addEventListener('click', () => switchNavSection('artists'));
    $('#rail-playlists')?.addEventListener('click', () => switchNavSection('playlists'));

    // Botão de boas-vindas quando biblioteca vazia
    $('#btn-welcome-add')?.addEventListener('click', () => {
      addMonitoredFolder();
    });

    // Vitrola (Modal de Scanner e Importação)
    $('#rail-import')?.addEventListener('click', () => {
      const modal = $('#vitrola-modal');
      if (modal) {
        modal.style.display = 'grid';
        renderFoldersUI();
      }
    });

    $('#btn-close-vitrola')?.addEventListener('click', () => {
      const modal = $('#vitrola-modal');
      if (modal) modal.style.display = 'none';
    });

    $('#btn-vitrola-add-folder')?.addEventListener('click', () => addMonitoredFolder());

    $('#btn-vitrola-rescan')?.addEventListener('click', async () => {
      if (window.api?.scanAllFolders) {
        showProgressUI(true, 'Reescaneando biblioteca completa...', 40);
        await window.api.scanAllFolders();
        showProgressUI(true, 'Concluído!', 100);
        setTimeout(() => showProgressUI(false), 600);
        await reloadLibrary();
        await renderFoldersUI();
        showToast('Biblioteca completa reindexada!');
      }
    });

    // Ajustes (Modal Expandido)
    $('#rail-settings')?.addEventListener('click', () => {
      const modal = $('#settings-modal');
      if (modal) {
        modal.style.display = 'grid';
        renderFoldersUI();
      }
    });

    $('#btn-close-settings')?.addEventListener('click', () => {
      const modal = $('#settings-modal');
      if (modal) modal.style.display = 'none';
    });

    $('#btn-add-music-folder')?.addEventListener('click', () => addMonitoredFolder());

    $('#btn-rescan-folders')?.addEventListener('click', async () => {
      if (window.api?.scanAllFolders) {
        showToast('Reescaneando pastas...');
        await window.api.scanAllFolders();
        await reloadLibrary();
        await renderFoldersUI();
        showToast('Pastas reescaneadas!');
      }
    });

    // Ajustes: Modos de Tema
    $$('.theme-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setThemeMode(btn.dataset.mode);
      });
    });

    // Ajustes: Seletor de Cores de Acento
    $$('.accent-dot').forEach((dot) => {
      dot.addEventListener('click', () => {
        setAccentColor(dot.dataset.accent);
      });
    });

    // Ajustes: Crossfade Slider
    $('#crossfade-slider')?.addEventListener('input', (e) => {
      setCrossfadeDuration(+e.target.value);
    });

    // Ajustes: Normalização de Volume
    $('#normalization-switch')?.addEventListener('click', (e) => {
      S.volumeNormalization = !S.volumeNormalization;
      e.currentTarget.setAttribute('aria-checked', String(S.volumeNormalization));
      showToast(S.volumeNormalization ? 'Normalização de volume ativada' : 'Normalização de volume desativada');
    });

    // 11. Seletor de Saída de Áudio (#out-sink)
    $('#out-sink')?.addEventListener('click', async () => {
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');
          if (audioOutputs.length > 0) {
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
      if (tag === 'INPUT' && e.key === 'Escape') {
        e.target.value = '';
        S.q = '';
        renderLibraryList();
        e.target.blur();
        return;
      }
      if (e.key === 'Escape') {
        $('#settings-modal').style.display = 'none';
        $('#vitrola-modal').style.display = 'none';
        $('#playlist-picker-modal').style.display = 'none';
        return;
      }
      if (tag === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Space' && tag !== 'BUTTON') {
        e.preventDefault();
        togglePlayback();
      } else if (e.key === 'n' || e.key === 'N') {
        nextTrack();
      } else if (e.key === 'p' || e.key === 'P') {
        prevTrack();
      }
    });

    // 14. Redimensionamento e Inicialização de Canvases
    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        scheduleAnimationWake();
      }
    });

    scheduleAnimationWake();
  }

  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  // Exportar contratos globais para interoperabilidade, comandos e testes
  window.applyThemePalette = applyThemePalette;
  window.renderWaveformProgress = renderWaveformProgress;
  window.renderSeaAtmosphere = renderSeaAtmosphere;
  window.handleEqualizerChange = handleEqualizerChange;
  window.applyEqualizerBand = applyEqualizerBand;
  window.selectEqualizerPreset = selectEqualizerPreset;
  window.syncPlayerStateToUI = syncPlayerStateToUI;
  window.togglePlayback = togglePlayback;
  window.seekPosition = seekPosition;
  window.stepTrack = stepTrack;
  window.setPlaybackVolume = setPlaybackVolume;
  window.getMonitoredFolders = getMonitoredFolders;
  window.addMonitoredFolder = addMonitoredFolder;
  window.removeMonitoredFolder = removeMonitoredFolder;
  window.toggleFolderVisibility = toggleFolderVisibility;
  window.setThemeMode = setThemeMode;
  window.setAccentColor = setAccentColor;
  window.setCrossfadeDuration = setCrossfadeDuration;
})();
