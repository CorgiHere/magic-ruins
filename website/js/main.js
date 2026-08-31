const PAGES = ["home", "howto", "rules", "notes", "items", "draw", "victory", "start"];

const PRIZES = [
  {
    id: "finale",
    name: "華麗謝幕",
    desc: "受狙擊槍瞄準，現在不可以動 15 秒",
    art: "assets/items/art-finale.png",
    full: "assets/items/item-finale.png",
  },
  {
    id: "palm",
    name: "黃金神掌",
    desc: "守門員獲得超大手套，持續 1 MIN",
    art: "assets/items/art-palm.png",
    full: "assets/items/item-palm.png",
  },
  {
    id: "headband",
    name: "四萬年前的髮箍",
    desc: "服裝加 0 分，恭喜你變得更好看了",
    art: "assets/items/art-headband.png",
    full: "assets/items/item-headband.png",
  },
];

const pageEls = PAGES.map((id) => document.getElementById(`page-${id}`));
const dockBtns = [...document.querySelectorAll(".dock button")];
const pageIndexEl = document.getElementById("page-index");
const pageTotalEl = document.getElementById("page-total");
const pageNameEl = document.getElementById("page-name");
const prevBtn = document.getElementById("btn-prev");
const nextBtn = document.getElementById("btn-next");
const drawBtn = document.getElementById("btn-draw");
const prizeCards = [...document.querySelectorAll(".carousel-card")];
const carouselStage = document.getElementById("carousel-stage");
const modal = document.getElementById("result-modal");
const resultTitle = document.getElementById("result-title");
const resultArt = document.getElementById("result-art");
const resultDesc = document.getElementById("result-desc");
const historyEl = document.getElementById("draw-history");

let current = -1;
let drawing = false;
let frontIndex = 0;
let autoTimer = null;
const history = [];
const TOTAL = PRIZES.length;

function slotOffset(i, front) {
  let offset = (i - front) % TOTAL;
  if (offset > TOTAL / 2) offset -= TOTAL;
  if (offset < -TOTAL / 2) offset += TOTAL;
  return offset;
}

function setCarousel(index) {
  frontIndex = ((index % TOTAL) + TOTAL) % TOTAL;
  prizeCards.forEach((card, i) => {
    const offset = slotOffset(i, frontIndex);
    card.dataset.pos = String(offset);
    card.classList.toggle("lit", offset === 0);
  });
}

function rotateCarousel(dir) {
  if (drawing) return;
  setCarousel(frontIndex + dir);
}

function startAutoplay() {
  stopAutoplay();
  autoTimer = setInterval(() => {
    if (drawing || !modal.hidden) return;
    rotateCarousel(1);
  }, 2600);
}

function stopAutoplay() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
}

function go(idOrIndex) {
  const index = typeof idOrIndex === "number" ? idOrIndex : PAGES.indexOf(idOrIndex);
  if (index < 0 || index === current) return;
  if (current >= 0) {
    pageEls[current].classList.remove("active");
    pageEls[current].hidden = true;
  }
  current = index;
  pageEls[current].hidden = false;
  pageEls[current].classList.add("active");
  pageIndexEl.textContent = String(current + 1).padStart(2, "0");
  if (pageTotalEl) pageTotalEl.textContent = String(PAGES.length).padStart(2, "0");
  pageNameEl.textContent = pageEls[current].dataset.name;
  prevBtn.disabled = current === 0;
  nextBtn.disabled = current === PAGES.length - 1;
  dockBtns.forEach((btn, i) => btn.classList.toggle("active", i === current));
  location.hash = PAGES[current];
  if (PAGES[current] === "draw") startAutoplay();
  else stopAutoplay();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openResult(prize) {
  resultTitle.textContent = prize.name;
  resultDesc.textContent = prize.desc;
  resultArt.src = prize.art;
  resultArt.alt = prize.name;
  modal.hidden = false;
  stopAutoplay();
}

const SlotSfx = {
  ctx: null,
  whir: null,
  master: null,

  ensure() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!this.ctx) this.ctx = new AC();
    if (this.ctx.state === "suspended") this.ctx.resume();
    if (!this.master) {
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 10;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.14;
      const makeup = this.ctx.createGain();
      makeup.gain.value = 1.45;
      comp.connect(makeup).connect(this.ctx.destination);
      this.master = makeup;
      this.comp = comp;
    }
    return this.ctx;
  },

  out() {
    this.ensure();
    return this.comp;
  },

  tone({ freq, endFreq, duration, type = "sine", volume = 0.2, when = 0, pan = 0, attack = 0.008 }) {
    const ctx = this.ensure();
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 20), t + duration);
    panner.pan.setValueAtTime(pan, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(panner).connect(this.out());
    osc.start(t);
    osc.stop(t + duration + 0.03);
  },

  noise({ duration = 0.05, volume = 0.2, when = 0, freq = 1600, q = 4, pan = 0 }) {
    const ctx = this.ensure();
    const t = ctx.currentTime + when;
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    n.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    n.connect(filter).connect(gain).connect(panner).connect(this.out());
    n.start(t);
  },

  lever() {
    this.noise({ duration: 0.16, volume: 0.35, freq: 420, q: 1.4 });
    this.tone({ freq: 90, endFreq: 48, duration: 0.28, type: "sawtooth", volume: 0.34 });
    this.tone({ freq: 180, endFreq: 70, duration: 0.18, type: "square", volume: 0.16, when: 0.04 });
    this.tone({ freq: 720, endFreq: 240, duration: 0.12, type: "triangle", volume: 0.14, when: 0.08 });
  },

  tick(progress) {
    const pan = (Math.random() * 1.4 - 0.7);
    const pitch = 1680 - progress * 920;
    this.tone({
      freq: pitch + Math.random() * 90,
      endFreq: pitch * 0.45,
      duration: 0.07,
      type: "square",
      volume: 0.2,
      pan,
    });
    this.tone({
      freq: pitch * 1.5,
      endFreq: pitch * 0.8,
      duration: 0.05,
      type: "triangle",
      volume: 0.12,
      pan: pan * -0.6,
    });
    this.noise({ duration: 0.045, volume: 0.32, freq: 1900 - progress * 600, q: 5, pan });
    if (progress < 0.55) {
      this.tone({ freq: 2400 + Math.random() * 400, duration: 0.03, type: "sine", volume: 0.08, pan: -pan, when: 0.012 });
    }
  },

  startWhir() {
    const ctx = this.ensure();
    this.stopWhir();
    const makeNoise = (freq, q, vol, rate) => {
      const n = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      n.buffer = buf;
      n.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = freq;
      filter.Q.value = q;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = rate;
      lfoGain.gain.value = freq * 0.22;
      lfo.connect(lfoGain).connect(filter.frequency);
      const gain = ctx.createGain();
      gain.gain.value = vol;
      n.connect(filter).connect(gain).connect(this.out());
      n.start();
      lfo.start();
      return { n, lfo, gain };
    };
    const motor = ctx.createOscillator();
    const motorGain = ctx.createGain();
    motor.type = "sawtooth";
    motor.frequency.value = 62;
    motorGain.gain.value = 0.08;
    motor.connect(motorGain).connect(this.out());
    motor.start();
    this.whir = [
      makeNoise(620, 3.2, 0.12, 11),
      makeNoise(1250, 6, 0.09, 17),
      { n: motor, lfo: motor, gain: motorGain },
    ];
  },

  stopWhir() {
    if (!this.whir || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.whir.forEach((node) => {
      node.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      try { node.n.stop(t + 0.2); } catch (err) { /* already stopped */ }
      try { node.lfo.stop(t + 0.2); } catch (err) { /* already stopped */ }
    });
    this.whir = null;
  },

  jackpot() {
    this.tone({ freq: 140, endFreq: 420, duration: 0.35, type: "sawtooth", volume: 0.18 });
    this.noise({ duration: 0.28, volume: 0.22, freq: 900, q: 1.2 });

    const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093];
    fanfare.forEach((freq, i) => {
      const when = 0.08 + i * 0.07;
      this.tone({ freq, duration: 0.55, type: "square", volume: 0.16, when, pan: -0.15 });
      this.tone({ freq: freq * 1.002, duration: 0.55, type: "triangle", volume: 0.14, when, pan: 0.18 });
      this.tone({ freq: freq * 2, duration: 0.32, type: "sine", volume: 0.08, when });
    });

    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      this.tone({ freq, duration: 0.9, type: "triangle", volume: 0.12, when: 0.55 + i * 0.05, pan: i % 2 ? 0.25 : -0.25 });
    });

    for (let i = 0; i < 18; i += 1) {
      const pan = (i % 2 === 0 ? -1 : 1) * (0.25 + Math.random() * 0.7);
      this.tone({
        freq: 1600 + Math.random() * 1800,
        endFreq: 900 + Math.random() * 500,
        duration: 0.16,
        type: "sine",
        volume: 0.14,
        when: 0.35 + i * 0.055,
        pan,
      });
      this.noise({ duration: 0.04, volume: 0.12, freq: 3200, q: 8, when: 0.36 + i * 0.055, pan });
    }

    this.tone({ freq: 1046.5, duration: 1.1, type: "triangle", volume: 0.16, when: 0.95 });
    this.tone({ freq: 1318.51, duration: 1.1, type: "sine", volume: 0.12, when: 0.98, pan: 0.3 });
    this.tone({ freq: 1567.98, duration: 1.2, type: "triangle", volume: 0.1, when: 1.02, pan: -0.3 });
  },
};

const SpinSfx = {
  id: "Xa2tDZxnm6w",
  player: null,
  ready: false,
  loading: false,
  looping: false,
  pending: false,

  init() {
    window.__onYtReady = () => this.create();
    if (window.YT && window.YT.Player) {
      this.create();
      return;
    }
    if (this.loading) return;
    this.loading = true;
    if (document.querySelector('script[src*="iframe_api"]')) return;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => {
      this.loading = false;
    };
    document.head.appendChild(tag);
  },

  create() {
    if (this.player) return;
    const mount = document.getElementById("yt-spin");
    if (!mount || !window.YT || !window.YT.Player) return;
    this.player = new window.YT.Player(mount, {
      videoId: this.id,
      width: 200,
      height: 200,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        origin: location.origin,
      },
      events: {
        onReady: () => {
          this.ready = true;
          this.player.setVolume(100);
          if (this.pending || this.looping) this.play();
          else this.warm();
        },
        onStateChange: (event) => {
          const state = event.data;
          if (state === window.YT.PlayerState.PLAYING && !this.looping) {
            this.player.pauseVideo();
            this.player.seekTo(0, true);
            this.player.unMute();
            return;
          }
          if (this.looping && state === window.YT.PlayerState.ENDED) {
            this.player.seekTo(0, true);
            this.player.playVideo();
          }
        },
        onError: () => {
          this.ready = false;
        },
      },
    });
  },

  warm() {
    if (!this.ready || this.looping) return;
    try {
      this.player.mute();
      this.player.playVideo();
    } catch (err) {
      /* ignore */
    }
  },

  play() {
    this.pending = true;
    this.looping = true;
    this.init();
    if (!this.ready || !this.player || typeof this.player.playVideo !== "function") return false;
    try {
      this.player.unMute();
      this.player.setVolume(100);
      this.player.playVideo();
      this.pending = false;
      SlotSfx.stopWhir();
      return true;
    } catch (err) {
      return false;
    }
  },

  stop() {
    this.looping = false;
    this.pending = false;
    if (this.player && typeof this.player.pauseVideo === "function") {
      try {
        this.player.pauseVideo();
        this.player.seekTo(0, true);
      } catch (err) {
        /* player not ready */
      }
    }
  },
};

let duckedBgm = null;

function duckBgm() {
  if (duckedBgm == null) duckedBgm = bgm.volume;
  if (!bgm.paused) bgm.volume = Math.min(duckedBgm, 0.22);
}

function unduckBgm() {
  if (duckedBgm == null) return;
  if (!bgm.paused) bgm.volume = duckedBgm;
  duckedBgm = null;
}

async function drawPrize() {
  if (drawing) return;
  drawing = true;
  drawBtn.disabled = true;
  duckBgm();
  SlotSfx.ensure();
  const spinning = SpinSfx.play();
  if (!spinning) {
    SlotSfx.lever();
    SlotSfx.startWhir();
  }
  modal.hidden = true;
  stopAutoplay();
  carouselStage.classList.add("spinning");

  const winner = Math.floor(Math.random() * TOTAL);
  const extra = (winner - frontIndex + TOTAL) % TOTAL;
  const steps = 12 + extra;
  let delay = 90;

  for (let n = 0; n < steps; n += 1) {
    if (!spinning && !SpinSfx.looping) SlotSfx.tick(n / Math.max(steps - 1, 1));
    setCarousel(frontIndex + 1);
    await sleep(delay);
    delay *= 1.12;
  }

  SpinSfx.stop();
  SlotSfx.stopWhir();
  carouselStage.classList.remove("spinning");
  setCarousel(winner);
  SlotSfx.jackpot();
  const prize = PRIZES[winner];
  history.push(prize.name);
  historyEl.textContent = `本場已抽出：${history.join("、")}`;
  await sleep(1400);
  unduckBgm();
  openResult(prize);
  drawing = false;
  drawBtn.disabled = false;
}

function closeModal() {
  modal.hidden = true;
  SpinSfx.stop();
  unduckBgm();
  if (PAGES[current] === "draw" && !drawing) startAutoplay();
}

document.querySelectorAll("[data-go]").forEach((el) => {
  el.addEventListener("click", () => go(el.dataset.go));
});

prevBtn.addEventListener("click", () => go(current - 1));
nextBtn.addEventListener("click", () => go(current + 1));

document.getElementById("carousel").addEventListener("mouseenter", stopAutoplay);
document.getElementById("carousel").addEventListener("mouseleave", () => {
  if (PAGES[current] === "draw" && !drawing && modal.hidden) startAutoplay();
});
document.getElementById("carousel-prev").addEventListener("click", () => rotateCarousel(-1));
document.getElementById("carousel-next").addEventListener("click", () => rotateCarousel(1));

prizeCards.forEach((card, i) => {
  card.addEventListener("click", () => {
    if (drawing) return;
    if (slotOffset(i, frontIndex) === 0) openResult(PRIZES[i]);
    else setCarousel(i);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
  if (PAGES[current] === "draw" && modal.hidden && !drawing) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      rotateCarousel(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      rotateCarousel(1);
      return;
    }
  }
  if (event.key === "ArrowLeft") go(current - 1);
  if (event.key === "ArrowRight") go(current + 1);
});

function startDraw(event) {
  if (event && event.button && event.button !== 0) return;
  drawPrize();
}

drawBtn.addEventListener("pointerdown", startDraw);
drawBtn.addEventListener("click", startDraw);
document.getElementById("btn-redraw").addEventListener("pointerdown", startDraw);
document.getElementById("btn-redraw").addEventListener("click", startDraw);

document.querySelectorAll("[data-close-modal]").forEach((el) => {
  el.addEventListener("click", closeModal);
});

document.querySelectorAll("[data-preview]").forEach((card) => {
  card.addEventListener("click", () => {
    const prize = PRIZES.find((item) => item.id === card.dataset.preview);
    if (prize) openResult(prize);
  });
});

window.addEventListener("hashchange", () => {
  const id = location.hash.replace("#", "");
  const index = PAGES.indexOf(id);
  if (index >= 0) go(index);
});

const startHash = location.hash.replace("#", "");
const startIndex = PAGES.indexOf(startHash);
setCarousel(0);
go(startIndex >= 0 ? startIndex : 0);

const bgm = document.getElementById("bgm");
const musicBtn = document.getElementById("btn-music");
const iconOn = document.getElementById("icon-music-on");
const iconOff = document.getElementById("icon-music-off");
bgm.volume = 0.9;
let musicOn = localStorage.getItem("music") !== "off";

function renderMusic() {
  musicBtn.classList.toggle("off", !musicOn);
  musicBtn.setAttribute("aria-pressed", String(musicOn));
  iconOn.hidden = !musicOn;
  iconOff.hidden = musicOn;
}

function tryPlay() {
  if (!musicOn) return;
  const play = bgm.play();
  if (play && typeof play.then === "function") {
    play.then(() => musicBtn.classList.remove("waiting")).catch(() => {
      musicBtn.classList.add("waiting");
    });
  }
}

function setMusic(on) {
  musicOn = on;
  localStorage.setItem("music", on ? "on" : "off");
  renderMusic();
  if (on) tryPlay();
  else {
    bgm.pause();
    musicBtn.classList.remove("waiting");
  }
}

musicBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  setMusic(!musicOn);
});

["pointerdown", "keydown", "touchstart"].forEach((name) => {
  window.addEventListener(name, () => {
    tryPlay();
    SpinSfx.init();
    SpinSfx.warm();
  }, { passive: true });
});

renderMusic();
tryPlay();
SpinSfx.init();
