const PAGES = ["home", "howto", "rules", "items", "draw", "victory", "start"];

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

function closeModal() {
  modal.hidden = true;
  if (PAGES[current] === "draw" && !drawing) startAutoplay();
}

async function drawPrize() {
  if (drawing) return;
  drawing = true;
  drawBtn.disabled = true;
  closeModal();
  stopAutoplay();
  carouselStage.classList.add("spinning");

  const winner = Math.floor(Math.random() * TOTAL);
  const extra = (winner - frontIndex + TOTAL) % TOTAL;
  const steps = 12 + extra;
  let delay = 90;

  for (let n = 0; n < steps; n += 1) {
    setCarousel(frontIndex + 1);
    await sleep(delay);
    delay *= 1.12;
  }

  carouselStage.classList.remove("spinning");
  setCarousel(winner);
  const prize = PRIZES[winner];
  history.push(prize.name);
  historyEl.textContent = `本場已抽出：${history.join("、")}`;
  await sleep(420);
  openResult(prize);
  drawing = false;
  drawBtn.disabled = false;
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

drawBtn.addEventListener("click", drawPrize);
document.getElementById("btn-redraw").addEventListener("click", () => {
  closeModal();
  drawPrize();
});

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
bgm.volume = 0.32;
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
  window.addEventListener(name, tryPlay, { passive: true });
});

renderMusic();
tryPlay();
