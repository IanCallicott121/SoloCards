const SUITS = ["spades", "hearts", "clubs", "diamonds"];
const SUIT_SYMBOLS = {
  spades: "♠",
  hearts: "♥",
  clubs: "♣",
  diamonds: "♦"
};
const SUIT_COLORS = {
  spades: "black",
  clubs: "black",
  hearts: "red",
  diamonds: "red"
};
const FOUNDATION_SUIT_ORDER = ["spades", "hearts", "clubs", "diamonds"];
const RANK_LABELS = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K"
};

const state = {
  stock: [],
  waste: [],
  foundations: {},
  tableau: [],
  moves: 0
};

const els = {
  stock: document.querySelector("#stock"),
  waste: document.querySelector("#waste"),
  foundations: document.querySelector("#foundations"),
  tableau: document.querySelector("#tableau"),
  moveCount: document.querySelector("#move-count"),
  stockCount: document.querySelector("#stock-count"),
  message: document.querySelector("#message"),
  newGame: document.querySelector("#new-game"),
  hint: document.querySelector("#hint"),
  cardTemplate: document.querySelector("#card-template")
};

let dragContext = null;

function createDeck() {
  const deck = [];
  let id = 0;

  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({
        id: `card-${id}`,
        suit,
        rank,
        color: SUIT_COLORS[suit],
        faceUp: false
      });
      id += 1;
    }
  }

  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function startGame() {
  const deck = shuffle(createDeck());
  state.stock = [];
  state.waste = [];
  state.moves = 0;
  state.foundations = Object.fromEntries(
    FOUNDATION_SUIT_ORDER.map((suit) => [suit, []])
  );
  state.tableau = Array.from({ length: 7 }, () => []);

  for (let col = 0; col < 7; col += 1) {
    for (let depth = 0; depth <= col; depth += 1) {
      const card = deck.pop();
      card.faceUp = depth === col;
      state.tableau[col].push(card);
    }
  }

  state.stock = deck.map((card) => ({ ...card, faceUp: false }));
  setMessage("Build ascending dragon hoards by suit.");
  render();
}

function setMessage(message) {
  els.message.textContent = message;
}

function rankLabel(rank) {
  return RANK_LABELS[rank] ?? String(rank);
}

function moveCards(source, target) {
  source.remove(source.index, source.count);
  target.insert(source.cards);
  state.moves += 1;
  revealTopCards();
  render();
  checkForWin();
}

function revealTopCards() {
  for (const pile of state.tableau) {
    const top = pile[pile.length - 1];
    if (top && !top.faceUp) {
      top.faceUp = true;
    }
  }
}

function drawFromStock() {
  if (state.stock.length === 0) {
    if (state.waste.length === 0) {
      setMessage("No cards to draw.");
      return;
    }

    state.stock = [...state.waste].reverse().map((card) => ({ ...card, faceUp: false }));
    state.waste = [];
    state.moves += 1;
    setMessage("Waste returned to stock.");
    render();
    return;
  }

  const card = state.stock.pop();
  card.faceUp = true;
  state.waste.push(card);
  state.moves += 1;
  setMessage(`Drew ${describeCard(card)}.`);
  render();
}

function canPlaceOnFoundation(card, suit) {
  if (card.suit !== suit) {
    return false;
  }

  const pile = state.foundations[suit];
  if (pile.length === 0) {
    return card.rank === 1;
  }

  return pile[pile.length - 1].rank + 1 === card.rank;
}

function canPlaceOnTableau(card, pile) {
  const top = pile[pile.length - 1];
  if (!top) {
    return card.rank === 13;
  }

  return top.faceUp && top.color !== card.color && top.rank === card.rank + 1;
}

function isValidTableauStack(cards) {
  for (let index = 0; index < cards.length - 1; index += 1) {
    const current = cards[index];
    const next = cards[index + 1];
    if (!current.faceUp || !next.faceUp) {
      return false;
    }
    if (current.color === next.color || current.rank !== next.rank + 1) {
      return false;
    }
  }

  return true;
}

function getDragPayload(cardId) {
  const wasteTop = state.waste[state.waste.length - 1];
  if (wasteTop?.id === cardId) {
    return {
      cards: [wasteTop],
      index: state.waste.length - 1,
      count: 1,
      remove(index, count) {
        state.waste.splice(index, count);
      },
      origin: "waste"
    };
  }

  for (let pileIndex = 0; pileIndex < state.tableau.length; pileIndex += 1) {
    const pile = state.tableau[pileIndex];
    const index = pile.findIndex((card) => card.id === cardId);
    if (index !== -1) {
      const cards = pile.slice(index);
      if (!cards[0].faceUp) {
        return null;
      }
      if (!isValidTableauStack(cards)) {
        return null;
      }

      return {
        cards,
        index,
        count: cards.length,
        remove(removeIndex, count) {
          state.tableau[pileIndex].splice(removeIndex, count);
        },
        origin: `tableau-${pileIndex}`
      };
    }
  }

  return null;
}

function handleCardDragStart(event) {
  const card = event.currentTarget;
  const payload = getDragPayload(card.dataset.cardId);
  if (!payload) {
    event.preventDefault();
    return;
  }

  dragContext = payload;
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", card.dataset.cardId);
}

function handleCardDragEnd(event) {
  event.currentTarget.classList.remove("dragging");
  clearHighlights();
  dragContext = null;
}

function clearHighlights() {
  document
    .querySelectorAll(".highlight")
    .forEach((node) => node.classList.remove("highlight"));
}

function foundationDropHandler(suit) {
  return {
    dragover(event) {
      if (!dragContext || dragContext.cards.length !== 1) {
        return;
      }

      if (canPlaceOnFoundation(dragContext.cards[0], suit)) {
        event.preventDefault();
        event.currentTarget.classList.add("highlight");
      }
    },
    dragleave(event) {
      event.currentTarget.classList.remove("highlight");
    },
    drop(event) {
      event.preventDefault();
      event.currentTarget.classList.remove("highlight");
      if (!dragContext || dragContext.cards.length !== 1) {
        return;
      }

      const [card] = dragContext.cards;
      if (!canPlaceOnFoundation(card, suit)) {
        setMessage("That card cannot join this dragon hoard.");
        return;
      }

      moveCards(dragContext, {
        insert(cards) {
          state.foundations[suit].push(...cards);
        }
      });
      setMessage(`${describeCard(card)} moved to foundation.`);
    }
  };
}

function tableauDropHandler(index) {
  return {
    dragover(event) {
      if (!dragContext) {
        return;
      }

      if (canPlaceOnTableau(dragContext.cards[0], state.tableau[index])) {
        event.preventDefault();
        event.currentTarget.classList.add("highlight");
      }
    },
    dragleave(event) {
      event.currentTarget.classList.remove("highlight");
    },
    drop(event) {
      event.preventDefault();
      event.currentTarget.classList.remove("highlight");
      if (!dragContext) {
        return;
      }

      if (!canPlaceOnTableau(dragContext.cards[0], state.tableau[index])) {
        setMessage("That sequence does not fit here.");
        return;
      }

      moveCards(dragContext, {
        insert(cards) {
          state.tableau[index].push(...cards);
        }
      });
      setMessage("Sequence moved.");
    }
  };
}

function describeCard(card) {
  return `${rankLabel(card.rank)}${SUIT_SYMBOLS[card.suit]}`;
}

function autoMove() {
  const wasteTop = state.waste[state.waste.length - 1];
  if (wasteTop) {
    for (const suit of FOUNDATION_SUIT_ORDER) {
      if (canPlaceOnFoundation(wasteTop, suit)) {
        moveCards(
          {
            cards: [wasteTop],
            index: state.waste.length - 1,
            count: 1,
            remove(index, count) {
              state.waste.splice(index, count);
            }
          },
          {
            insert(cards) {
              state.foundations[suit].push(...cards);
            }
          }
        );
        setMessage(`${describeCard(wasteTop)} auto-moved to foundation.`);
        return;
      }
    }
  }

  for (let pileIndex = 0; pileIndex < state.tableau.length; pileIndex += 1) {
    const pile = state.tableau[pileIndex];
    const top = pile[pile.length - 1];
    if (!top || !top.faceUp) {
      continue;
    }

    for (const suit of FOUNDATION_SUIT_ORDER) {
      if (canPlaceOnFoundation(top, suit)) {
        moveCards(
          {
            cards: [top],
            index: pile.length - 1,
            count: 1,
            remove(index, count) {
              state.tableau[pileIndex].splice(index, count);
            }
          },
          {
            insert(cards) {
              state.foundations[suit].push(...cards);
            }
          }
        );
        setMessage(`${describeCard(top)} auto-moved to foundation.`);
        return;
      }
    }
  }

  setMessage("No safe auto-move available.");
}

function checkForWin() {
  const won = FOUNDATION_SUIT_ORDER.every(
    (suit) => state.foundations[suit].length === 13
  );
  if (won) {
    setMessage("Victory. The dragon hoard is complete.");
  }
}

function createCardElement(card, offsetY = 0) {
  const node = els.cardTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.cardId = card.id;
  node.dataset.color = card.color;
  node.style.top = `${offsetY}px`;
  node.style.zIndex = String(10 + offsetY);

  if (!card.faceUp) {
    node.classList.add("face-down");
    node.draggable = false;
    return node;
  }

  node.querySelector(".card-rank").textContent = rankLabel(card.rank);
  node.querySelector(".card-suit").textContent = SUIT_SYMBOLS[card.suit];
  node.querySelector(".card-suit-large").textContent = SUIT_SYMBOLS[card.suit];
  node.addEventListener("dragstart", handleCardDragStart);
  node.addEventListener("dragend", handleCardDragEnd);
  node.addEventListener("dblclick", () => tryMoveToFoundation(card.id));
  return node;
}

function tryMoveToFoundation(cardId) {
  const payload = getDragPayload(cardId);
  if (!payload || payload.cards.length !== 1) {
    return;
  }

  const [card] = payload.cards;
  for (const suit of FOUNDATION_SUIT_ORDER) {
    if (!canPlaceOnFoundation(card, suit)) {
      continue;
    }

    moveCards(payload, {
      insert(cards) {
        state.foundations[suit].push(...cards);
      }
    });
    setMessage(`${describeCard(card)} moved to foundation.`);
    return;
  }

  setMessage("No valid foundation move for that card.");
}

function renderStock() {
  els.stock.replaceChildren();
  els.stock.classList.toggle("stock-ready", state.stock.length > 0);

  if (state.stock.length > 0) {
    const top = createCardElement({ ...state.stock[state.stock.length - 1], faceUp: false });
    top.style.top = "0px";
    els.stock.append(top);
  }
}

function renderWaste() {
  els.waste.replaceChildren();
  const top = state.waste[state.waste.length - 1];
  if (top) {
    els.waste.append(createCardElement(top));
  }
}

function renderFoundations() {
  els.foundations.replaceChildren();

  for (const suit of FOUNDATION_SUIT_ORDER) {
    const frame = document.createElement("div");
    frame.className = "pile-frame";

    const label = document.createElement("div");
    label.className = "pile-label";
    label.textContent = `${suit[0].toUpperCase()}${suit.slice(1)}`;

    const pileNode = document.createElement("div");
    pileNode.className = "pile";
    pileNode.dataset.suit = suit;

    const handlers = foundationDropHandler(suit);
    pileNode.addEventListener("dragover", handlers.dragover);
    pileNode.addEventListener("dragleave", handlers.dragleave);
    pileNode.addEventListener("drop", handlers.drop);

    const cards = state.foundations[suit];
    if (cards.length > 0) {
      pileNode.append(createCardElement(cards[cards.length - 1]));
    }

    frame.append(label, pileNode);
    els.foundations.append(frame);
  }
}

function renderTableau() {
  els.tableau.replaceChildren();

  state.tableau.forEach((pile, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "tableau-pile";

    const dropzone = document.createElement("div");
    dropzone.className = "tableau-dropzone";
    const handlers = tableauDropHandler(index);
    wrapper.addEventListener("dragover", handlers.dragover);
    wrapper.addEventListener("dragleave", handlers.dragleave);
    wrapper.addEventListener("drop", handlers.drop);
    wrapper.append(dropzone);

    pile.forEach((card, cardIndex) => {
      const offsetY = card.faceUp ? 34 + cardIndex * 30 : 34 + cardIndex * 14;
      wrapper.append(createCardElement(card, offsetY));
    });

    els.tableau.append(wrapper);
  });
}

function render() {
  els.moveCount.textContent = String(state.moves);
  els.stockCount.textContent = String(state.stock.length);
  renderStock();
  renderWaste();
  renderFoundations();
  renderTableau();
}

els.stock.addEventListener("click", drawFromStock);
els.newGame.addEventListener("click", startGame);
els.hint.addEventListener("click", autoMove);

startGame();
