const SUITS = ["C", "H", "S", "D"];
const SUIT_SYMBOL = {
  C: "♣",
  H: "♥",
  S: "♠",
  D: "♦",
};
const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
const COLOR_BY_SUIT = {
  C: "black",
  H: "red",
  S: "black",
  D: "red",
};

class FreecellState {
  constructor() {
    this.cascades = Array.from({ length: 8 }, () => []);
    this.freecells = Array.from({ length: 4 }, () => null);
    this.foundations = { S: [], H: [], D: [], C: [] };
    this.moves = [];
  }

  buildDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank += 1) {
        deck.push({
          id: `${suit}${rank}`,
          suit,
          rank,
          rankLabel: RANKS[rank - 1],
          color: COLOR_BY_SUIT[suit],
        });
      }
    }
    return deck;
  }

  shuffle(cards) {
    for (let i = cards.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  resetBoard() {
    this.cascades = Array.from({ length: 8 }, () => []);
    this.freecells = Array.from({ length: 4 }, () => null);
    this.foundations = { S: [], H: [], D: [], C: [] };
    this.moves = [];

    const deck = this.shuffle(this.buildDeck());
    deck.forEach((card, index) => {
      this.cascades[index % 8].push(card);
    });
  }

  undo() {
    if (this.moves.length === 0) {
      return null;
    }
    let move = this.moves.pop();
    this.performMove(move.to, move.from);
    return move;
  }

  canUndo() {
    return this.moves.length > 0;
  }

  isValidDescendingRun(cards) {
    for (let i = 0; i < cards.length - 1; i += 1) {
      const current = cards[i];
      const next = cards[i + 1];
      if (current.color === next.color || current.rank !== next.rank + 1) {
        return false;
      }
    }
    return true;
  }

  movable(from) {
    if (from.type === "cascade") {
      const cascade = this.cascades[from.key];
      const run = cascade.slice(from.depth);
      if (!this.isValidDescendingRun(run)) {
        return false;
      }
    }
    return true;
  }

  cardsFrom(from) {
    if (from.type === "freecell") {
      const card = this.freecells[from.key];
      if (!card) {
        return [];
      }
      return [card];
    }

    if (from.type === "foundation") {
      const stack = this.foundations[from.key];
      if (stack.length === 0 || from.depth !== stack.length - 1) {
        return [];
      }
      return [stack[stack.length - 1]];
    }

    if (from.type === "cascade") {
      const cascade = this.cascades[from.key];
      if (!cascade.length || from.depth >= cascade.length) {
        return [];
      }
      const run = cascade.slice(from.depth);
      if (!this.isValidDescendingRun(run)) {
        return [];
      }
      return run;
    }

    return null;
  }

  tryMove(from, to) {
    if (!this.canMove(from, to)) {
      return null;
    }

    if (to.type === "freecell") to.depth = 0;
    else if (to.type === "foundation")
      to.depth = this.foundations[to.key].length;
    else if (to.type === "cascade") to.depth = this.cascades[to.key].length;
    this.performMove(from, to);

    let move = { from: from, to: to };
    this.moves.push(move);

    return move;
  }

  canMove(from, to) {
    if (from.type === to.type && from.key === to.key) {
      return false;
    }

    const movingCards = this.cardsFrom(from);
    if (movingCards.length === 0) return false;
    const head = movingCards[0];

    if (to.type === "freecell") {
      return movingCards.length === 1 && this.freecells[to.key] === null;
    }

    if (to.type === "foundation") {
      if (movingCards.length !== 1 || head.suit !== to.key) {
        return false;
      }
      const stack = this.foundations[to.key];
      if (!stack.length) {
        return head.rank === 1;
      }
      const top = stack[stack.length - 1];
      return head.rank === top.rank + 1;
    }

    if (to.type === "cascade") {
      const cascade = this.cascades[to.key];
      if (cascade.length === 0) {
        return movingCards.length <= this.maxMovableCards(from.key, to.key);
      }
      const top = cascade[cascade.length - 1];
      const fits = top.color !== head.color && top.rank === head.rank + 1;
      if (!fits) {
        return false;
      }
      return movingCards.length <= this.maxMovableCards(from.key, to.key);
    }

    return false;
  }

  maxMovableCards(fromCascade, toCascade) {
    let freeSlots = 0;
    for (const cell of this.freecells) {
      if (cell === null) {
        freeSlots += 1;
      }
    }

    let emptyCascades = 0;
    for (let i = 0; i < this.cascades.length; i += 1) {
      if (i === fromCascade || i === toCascade) {
        continue;
      }
      if (this.cascades[i].length === 0) {
        emptyCascades += 1;
      }
    }

    return (freeSlots + 1) * 2 ** emptyCascades;
  }

  performMove(from, to) {
    const cards = this.cardsFrom(from);

    if (from.type === "freecell") {
      this.freecells[from.key] = null;
    } else if (from.type === "foundation") {
      this.foundations[from.key].pop();
    } else if (from.type === "cascade") {
      this.cascades[from.key].splice(from.depth, cards.length); // double-check this works
    }

    if (to.type === "freecell") {
      this.freecells[to.key] = cards[0];
    } else if (to.type === "foundation") {
      this.foundations[to.key].push(cards[0]);
    } else if (to.type === "cascade") {
      this.cascades[to.key].push(...cards);
    }
  }

  solved() {
    return (
      SUITS.reduce((sum, suit) => sum + this.foundations[suit].length, 0) === 52
    );
  }

  canAutoToFoundation(card) {
    const foundation = this.foundations[card.suit];
    if (
      foundation.length &&
      foundation[foundation.length - 1].rank + 1 !== card.rank
    ) {
      return false;
    }
    if (!foundation.length && card.rank !== 1) {
      return false;
    }

    // Keep auto-move conservative to avoid moving blockers too early.
    const oppositeSuits = card.color === "red" ? ["S", "C"] : ["H", "D"];
    const minOppositeFoundation = Math.min(
      this.foundations[oppositeSuits[0]].length,
      this.foundations[oppositeSuits[1]].length,
    );

    return card.rank <= minOppositeFoundation + 2;
  }

  foundationSafeMove() {
    for (let i = 0; i < 4; i += 1) {
      const card = this.freecells[i];
      if (card && this.canAutoToFoundation(card)) {
        const from = { type: "freecell", key: i, depth: 0 };
        const to = {
          type: "foundation",
          key: card.suit,
          depth: this.foundations[card.suit].length,
        };
        if (this.canMove(from, to)) {
          this.performMove(from, to);
          const move = { from, to };
          this.moves.push(move);
          return move;
        }
      }
    }

    for (let i = 0; i < this.cascades.length; i += 1) {
      const cascade = this.cascades[i];
      if (!cascade.length) {
        continue;
      }
      const card = cascade[cascade.length - 1];
      if (!this.canAutoToFoundation(card)) {
        continue;
      }

      const from = { type: "cascade", key: i, depth: cascade.length - 1 };
      const to = {
        type: "foundation",
        key: card.suit,
        depth: this.foundations[card.suit].length,
      };
      if (this.canMove(from, to)) {
        this.performMove(from, to);
        const move = { from, to };
        this.moves.push(move);
        return move;
      }
    }
    return null;
  }

  foundationSafeMoves() {
    let moved;
    do {
      moved = this.foundationSafeMove();
    } while (moved);
  }

  availableMoves(from) {
    const possibleMoves = [];

    for (const suit of SUITS) {
      const to = { type: "foundation", key: suit };
      if (this.canMove(from, to)) possibleMoves.push(to);
    }
    const nonEmptyCascadeMoves = [];
    const emptyCascadeMoves = [];
    for (let i = 0; i < 8; ++i) {
      const to = { type: "cascade", key: i };
      if (this.canMove(from, to)) {
        if (this.cascades[i].length > 0) {
          nonEmptyCascadeMoves.push(to);
        } else {
          emptyCascadeMoves.push(to);
        }
      }
    }
    possibleMoves.push(...nonEmptyCascadeMoves, ...emptyCascadeMoves);
    for (let i = 0; i < 4; ++i) {
      const to = { type: "freecell", key: i };
      if (this.canMove(from, to)) possibleMoves.push(to);
    }
    return possibleMoves;
  }

  allAvailableMoves() {
    const possibleMoves = [];
    for (let key = 0; key < 8; ++key) {
      for (let depth = 0; depth < this.cascades.length; ++depth) {
        const from = { type: "cascade", key, depth };
        const toArray = this.availableMoves(from);
        for (const to of toArray) {
          possibleMoves.push({ from, to });
        }
      }
    }
    for (let key = 0; key < 4; ++key) {
      const from = { type: "freecell", key, depth: 0 };
      const toArray = this.availableMoves(from);
      for (const to of toArray) {
        possibleMoves.push({ from, to });
      }
    }
    return possibleMoves;
  }
}

class Timer {
  constructor() {
    this.startedAt = null;
    this.elapsedSeconds = 0;
    this.timerId = null;
    this.tickHandler = () => {};
  }

  setTickHandler(handler) {
    this.tickHandler = typeof handler === "function" ? handler : () => {};
  }

  startTimer() {
    this.stopTimer();
    this.startedAt = Date.now();
    this.elapsedSeconds = 0;
    this.tickHandler();
    this.timerId = window.setInterval(() => {
      this.elapsedSeconds = Math.floor((Date.now() - this.startedAt) / 1000);
      this.tickHandler();
    }, 1000);
  }

  stopTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}

const board = document.getElementById("board");
const movesLabel = document.getElementById("moves-label");
const timeLabel = document.getElementById("time-label");
const newGameBtn = document.getElementById("new-game-btn");
const hintBtn = document.getElementById("hint-btn");
const winBanner = document.getElementById("win-banner");
const playAgainBtn = document.getElementById("play-again-btn");
const undoBtn = document.getElementById("undo-btn");
const winStats = document.getElementById("win-stats");

const game = new FreecellState();
const timer = new Timer();

timer.setTickHandler(() => {
  updateStatus();
});

function createPile(type, key, extraClass = "") {
  const pile = document.createElement("div");
  pile.className = `pile ${type} ${extraClass}`.trim();
  pile.dataset.pileType = type;
  pile.dataset.key = key;
  pile.style.setProperty("--row", type === "cascade" ? 1 : 0);
  pile.style.setProperty(
    "--column",
    type === "foundation" ? SUITS.indexOf(key) + 4 : key,
  );
  return pile;
}

function createCardEl(card, source, depth) {
  const cardEl = document.createElement("div");
  cardEl.className = `card ${card.color}`;
  cardEl.dataset.cardId = card.id;
  cardEl.dataset.sourceType = source.type;
  cardEl.dataset.sourceKey = String(source.key);
  cardEl.dataset.depth = String(depth);
  let column;
  if (source.type === "foundation") column = 4 + SUITS.indexOf(card.suit);
  else column = source.key;
  cardEl.style.setProperty("--column", column);
  cardEl.style.setProperty("--row", source.type === "cascade" ? 1 : 0);
  cardEl.style.setProperty("--depth", depth);

  const lab = document.createElement("span");
  lab.textContent = card.rankLabel;
  const sym = document.createElement("span");
  sym.textContent = SUIT_SYMBOL[card.suit];
  const span = document.createElement("span");
  span.appendChild(lab);
  span.appendChild(sym);
  span.classList.add("corner");
  const span2 = span.cloneNode(true);
  span2.classList.add("bottom");
  cardEl.appendChild(span);
  cardEl.appendChild(span2);

  cardEl.addEventListener("pointerdown", onPointerDown);
  return cardEl;
}

function render() {
  board.replaceChildren();

  for (let i = 0; i < 4; i += 1) {
    const pile = createPile("freecell", i);
    board.appendChild(pile);
    const card = game.freecells[i];
    if (card) {
      const cardEl = createCardEl(card, { type: "freecell", key: i }, 0);
      board.appendChild(cardEl);
    }
  }

  for (let i = 0; i < 4; i += 1) {
    const suit = SUITS[i];
    const pile = createPile("foundation", suit);
    const sym = document.createElement("span");
    sym.className = "pile-symbol";
    sym.textContent = SUIT_SYMBOL[suit];
    pile.appendChild(sym);
    board.appendChild(pile);
    const stack = game.foundations[suit];
    for (let i = 0; i < stack.length; ++i) {
      const cardEl = createCardEl(
        stack[i],
        { type: "foundation", key: suit },
        i,
      );
      board.appendChild(cardEl);
    }
  }

  game.cascades.forEach((cascade, cascadeIndex) => {
    const pile = createPile("cascade", cascadeIndex);
    board.appendChild(pile);
    cascade.forEach((card, cardDepth) => {
      const cardEl = createCardEl(
        card,
        { type: "cascade", key: cascadeIndex },
        cardDepth,
      );
      board.appendChild(cardEl);
    });
  });

  updateStatus();
  updateUndoButtonState();
  updateWinBanner();
}

function renderMove(move, silent = false) {
  const from = move.from;
  const to = move.to;
  const cards = game.cardsFrom(to);
  for (let i = 0; i < cards.length; ++i) {
    const card = cards[i];
    const cardEl = board.querySelector(`[data-card-id="${card.id}"]`);
    cardEl.setAttribute("data-source-type", to.type);
    cardEl.setAttribute("data-source-key", to.key);
    cardEl.setAttribute("data-depth", to.depth + i);
    let column;
    if (to.type === "foundation") column = 4 + SUITS.indexOf(card.suit);
    else column = to.key;
    cardEl.style.setProperty("--column", column);
    cardEl.style.setProperty("--row", to.type === "cascade" ? 1 : 0);
    cardEl.style.setProperty("--depth", to.depth + i);
  }

  updateStatus();
  updateUndoButtonState();
  updateWinBanner();
  clearHintState();
  clearHighlight();

  if (!silent) {
    let safeMove = game.foundationSafeMove();
    if (safeMove) {
      window.setTimeout(() => {
        renderMove(safeMove);
      }, 120);
    }
  }
}

function undoMove() {
  const move = game.undo();
  if (move) {
    renderMove({ from: move.to, to: move.from }, true);
  }
}

function updateStatus() {
  movesLabel.textContent = `Moves: ${game.moves.length}`;
  timeLabel.textContent = `Time: ${formatSeconds(timer.elapsedSeconds)}`;
}

function updateUndoButtonState() {
  if (!undoBtn) {
    return;
  }
  undoBtn.disabled = !game.canUndo();
}

function updateWinBanner() {
  if (!game.solved()) {
    winBanner.classList.remove("show");
    return;
  }

  timer.stopTimer();
  winStats.textContent = `Solved in ${game.moves.length} moves, time ${formatSeconds(timer.elapsedSeconds)}.`;
  winBanner.classList.add("show");
}

function formatSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getDraggedCardElements(cardEl, from) {
  if (from.type !== "cascade") {
    return [cardEl];
  }

  const cards = Array.from(
    board.querySelectorAll(
      `[data-source-type="${from.type}"][data-source-key="${from.key}"]`,
    ),
  );
  return cards.filter((el) => Number(el.dataset.depth) >= from.depth);
}

function onPointerDown(event) {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }
  clearHighlight();

  const cardEl = event.currentTarget;
  const from = {
    type: cardEl.dataset.sourceType,
    key: parseSourceKey(cardEl.dataset.sourceType, cardEl.dataset.sourceKey),
    depth: Number(cardEl.dataset.depth),
  };
  if (!game.movable(from)) {
    return;
  }

  const draggedCards = getDraggedCardElements(cardEl, from);
  const anchorRect = cardEl.getBoundingClientRect();
  const sourcePileRect = cardEl.parentElement.getBoundingClientRect();
  const grabOffsetX = event.clientX - anchorRect.left;
  const grabOffsetY = event.clientY - anchorRect.top;
  const dragOffsets = draggedCards.map((el, index) => {
    const rect = el.getBoundingClientRect();
    el.classList.add("dragging");
    return {
      el,
      deltaX: rect.left - anchorRect.left,
      deltaY: rect.top - anchorRect.top,
    };
  });

  cardEl.setPointerCapture(event.pointerId);

  function moveAt(clientX, clientY) {
    const anchorX = clientX - sourcePileRect.left - grabOffsetX;
    const anchorY = clientY - sourcePileRect.top - grabOffsetY;
    dragOffsets.forEach(({ el, deltaX, deltaY }) => {
      const x = anchorX + deltaX;
      const y = anchorY + deltaY;
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
  }

  let left = event.clientX;
  let top = event.clientY;
  moveAt(left, top);

  function onPointerMove(event) {
    left = event.clientX;
    top = event.clientY;
    moveAt(left, top);
    event.preventDefault(); // prevent scrolling on touchscreens
  }

  function release(event) {
    cardEl.releasePointerCapture(event.pointerId);

    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", release);
    document.removeEventListener("pointercancel", release);
    const [row, column] = getPileFromPoint(event.clientX, event.clientY);
    const type = row == 1 ? "cascade" : column < 4 ? "freecell" : "foundation";
    const key = type === "foundation" ? SUITS[column - 4] : column;
    let to = { type, key };
    if (from.type === to.type && from.key === to.key) {
      const possibleMoves = game.availableMoves(from);
      if (possibleMoves.length > 0) {
        to = possibleMoves[0];
      }
    }
    const move = game.tryMove(from, to);

    dragOffsets.forEach(({ el }) => {
      el.classList.remove("dragging");
      el.style.removeProperty("transform");
    });

    if (move) renderMove(move);
  }

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", release, false);
  document.addEventListener("pointercancel", release, false);
}

function getPileFromPoint(clientX, clientY) {
  const boardRect = board.getBoundingClientRect();
  const cardRect = board.children[0].getBoundingClientRect();

  const x = clientX - boardRect.left;
  const y = clientY - boardRect.top;
  const column = Math.floor((8 * x) / boardRect.width);

  const row = y > cardRect.height ? 1 : 0;
  return [row, column];
}

function parseSourceKey(type, key) {
  if (type === "cascade" || type === "freecell") {
    return Number(key);
  }
  return key;
}

function highlight(move) {
  clearHighlight();
  const cards = game.cardsFrom(move.from);
  for (const card of cards) {
    const cardEl = board.querySelector(`[data-card-id="${card.id}"]`);
    cardEl.classList.add("highlighted");
  }
  if (move.to.type === "cascade" && game.cascades[move.to.key].length > 0) {
    const card =
      game.cascades[move.to.key][game.cascades[move.to.key].length - 1];
    const cardEl = board.querySelector(`[data-card-id="${card.id}"]`);
    cardEl.classList.add("highlighted");
  } else {
    const pileEl = board.querySelector(
      `[data-pile-type="${move.to.type}"][data-key="${move.to.key}"]`,
    );
    pileEl.classList.add("highlighted");
  }
}

function clearHighlight() {
  const cardEls = board.querySelectorAll(".card, .pile");
  for (const cardEl of cardEls) {
    cardEl.classList.remove("highlighted");
  }
}

const hintState = { availableMoves: null, i: 0 };

function clearHintState() {
  hintState.availableMoves = null;
  hintState.i = 0;
}

function updateHintState() {
  if (hintState.availableMoves === null) {
    hintState.availableMoves = game.allAvailableMoves();
    hintState.i = 0;
  } else {
    ++hintState.i;
    if (hintState.i === hintState.availableMoves.length) hintState.i = 0;
  }
  if (hintState.availableMoves.length > 0) {
    highlight(hintState.availableMoves[hintState.i]);
  }
}

newGameBtn.addEventListener("click", () => {
  game.resetBoard();
  timer.startTimer();
  render();
});

hintBtn.addEventListener("click", () => {
  updateHintState();
});

playAgainBtn.addEventListener("click", () => {
  game.resetBoard();
  timer.startTimer();
  render();
});

undoBtn.addEventListener("click", () => {
  undoMove();
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement) {
    const tag = target.tagName;
    if (
      target.isContentEditable ||
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT"
    ) {
      return;
    }
  }

  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "z" &&
    !event.shiftKey &&
    !event.altKey
  ) {
    event.preventDefault();
    undoMove();
  }

  if (event.key.toLowerCase() === "h") {
    updateHintState();
  }

  const keys = [
    "a",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "0",
    "j",
    "q",
    "k",
  ];
  if (keys.includes(event.key.toLowerCase())) {
    event.preventDefault();
    clearHighlight();
    const idNumber = keys.indexOf(event.key.toLowerCase()) + 1;
    for (const suit of SUITS) {
      const cardEl = board.querySelector(`[data-card-id=${suit}${idNumber}]`);
      cardEl.classList.add("highlighted");
    }
  }
  if (event.key === "Escape") clearHighlight();
});

game.resetBoard();
timer.startTimer();
render();
