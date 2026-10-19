    (() => {
      "use strict";

      const DIFFICULTIES = {
        beginner: { columns: 9, rows: 9, mines: 10 },
        intermediate: { columns: 16, rows: 16, mines: 40 },
        expert: { columns: 30, rows: 16, mines: 99 }
      };
      const boardElement = document.querySelector("#board");
      const mineCountElement = document.querySelector("#mine-count");
      const timerElement = document.querySelector("#timer");
      const statusElement = document.querySelector("#status");
      const resetButton = document.querySelector("#reset");
      const difficultyButtons = document.querySelectorAll(".difficulty-button");
      const bestRecordElement = document.querySelector("#best-record");
      const confettiElement = document.querySelector("#confetti");

      let cells = [];
      let difficulty = "beginner";
      let config = DIFFICULTIES[difficulty];
      let started = false;
      let gameOver = false;
      let flags = 0;
      let seconds = 0;
      let timerId = null;

      function formatTime(value) {
        return String(value).padStart(3, "0");
      }

      function neighborsOf(index) {
        const row = Math.floor(index / config.columns);
        const column = index % config.columns;
        const neighbors = [];

        for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
          for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
            if (rowOffset === 0 && columnOffset === 0) continue;
            const nextRow = row + rowOffset;
            const nextColumn = column + columnOffset;
            if (nextRow >= 0 && nextRow < config.rows && nextColumn >= 0 && nextColumn < config.columns) {
              neighbors.push(nextRow * config.columns + nextColumn);
            }
          }
        }

        return neighbors;
      }

      function startTimer() {
        if (started) return;
        started = true;
        timerId = window.setInterval(() => {
          if (seconds === 999) {
            window.clearInterval(timerId);
            timerId = null;
            return;
          }
          seconds += 1;
          timerElement.textContent = formatTime(seconds);
        }, 1000);
        resetButton.textContent = "😮";
      }

      function updateMineCount() {
        const remaining = config.mines - flags;
        mineCountElement.textContent = remaining < 0
          ? `-${String(Math.abs(remaining)).padStart(2, "0")}`
          : String(remaining).padStart(3, "0");
      }

      function renderCell(index) {
        const cell = cells[index];
        const element = cell.element;

        element.classList.toggle("revealed", cell.revealed);
        element.classList.toggle("flagged", cell.flagged && !cell.revealed);
        element.classList.toggle("mine-hit", cell.hit);
        element.classList.toggle("wrong-flag", cell.wrongFlag);
        element.removeAttribute("data-number");

        if (cell.wrongFlag) {
          element.textContent = "✕";
          element.setAttribute("aria-label", `행 ${Math.floor(index / config.columns) + 1}, 열 ${index % config.columns + 1}: 잘못된 깃발`);
        } else if (cell.flagged && !cell.revealed) {
          element.textContent = "🚩";
          element.setAttribute("aria-label", `행 ${Math.floor(index / config.columns) + 1}, 열 ${index % config.columns + 1}: 깃발`);
        } else if (cell.revealed && cell.mine) {
          element.textContent = "💣";
          element.setAttribute("aria-label", `행 ${Math.floor(index / config.columns) + 1}, 열 ${index % config.columns + 1}: 지뢰`);
        } else if (cell.revealed && cell.neighborMines > 0) {
          element.textContent = String(cell.neighborMines);
          element.dataset.number = String(cell.neighborMines);
          element.setAttribute("aria-label", `행 ${Math.floor(index / config.columns) + 1}, 열 ${index % config.columns + 1}: 주변 지뢰 ${cell.neighborMines}개`);
        } else {
          element.textContent = "";
          element.setAttribute("aria-label", `행 ${Math.floor(index / config.columns) + 1}, 열 ${index % config.columns + 1}${cell.revealed ? ": 빈 칸" : ": 닫힌 칸"}`);
        }
      }

      function placeMines(firstIndex) {
        const protectedCells = new Set([firstIndex, ...neighborsOf(firstIndex)]);
        const available = cells
          .map((_, index) => index)
          .filter((index) => !protectedCells.has(index));

        for (let index = available.length - 1; index > 0; index -= 1) {
          const randomIndex = Math.floor(Math.random() * (index + 1));
          [available[index], available[randomIndex]] = [available[randomIndex], available[index]];
        }

        available.slice(0, config.mines).forEach((index) => {
          cells[index].mine = true;
        });

        cells.forEach((cell, index) => {
          cell.neighborMines = neighborsOf(index).filter((neighbor) => cells[neighbor].mine).length;
        });
      }

      function finish(won) {
        gameOver = true;
        window.clearInterval(timerId);
        resetButton.textContent = won ? "😎" : "😵";
        resetButton.setAttribute("aria-label", won ? "새 게임 (승리)" : "새 게임 (게임 종료)");
        statusElement.dataset.state = won ? "won" : "lost";
        let isNewRecord = false;
        if (won) {
          const recordKey = `minesweeper.best.${difficulty}`;
          const savedRecord = window.localStorage.getItem(recordKey);
          const bestTime = savedRecord === null ? null : Number(savedRecord);
          if (bestTime === null || !Number.isFinite(bestTime) || seconds < bestTime) {
            window.localStorage.setItem(recordKey, String(seconds));
            isNewRecord = true;
          }
          updateBestRecord();
          statusElement.textContent = `클리어! 기록 ${seconds}초${isNewRecord ? " (신기록!)" : ""}`;
          if (isNewRecord) celebrateRecord();
        } else {
          statusElement.textContent = "게임 오버";
        }

        cells.forEach((cell, index) => {
          if (won && cell.mine) cell.flagged = true;
          if (!won && cell.mine && !cell.flagged) cell.revealed = true;
          if (!cell.mine && cell.flagged) cell.wrongFlag = true;
          renderCell(index);
        });
        if (won) {
          flags = config.mines;
          updateMineCount();
        }
      }

      function checkWin() {
        if (cells.every((cell) => cell.mine || cell.revealed)) finish(true);
      }

      function chord(index) {
        const cell = cells[index];
        if (gameOver || !cell.revealed || cell.neighborMines === 0) return;

        const neighbors = neighborsOf(index);
        const flaggedNeighbors = neighbors.filter((neighbor) => cells[neighbor].flagged).length;
        if (flaggedNeighbors !== cell.neighborMines) return;

        neighbors.forEach((neighbor) => {
          if (!gameOver && !cells[neighbor].flagged && !cells[neighbor].revealed) reveal(neighbor);
        });
      }

      function reveal(index) {
        if (gameOver) return;
        if (cells[index].revealed) {
          chord(index);
          return;
        }
        if (cells[index].flagged) return;

        if (!cells.some((cell) => cell.mine)) placeMines(index);
        startTimer();

        const queue = [index];
        while (queue.length > 0) {
          const currentIndex = queue.shift();
          const current = cells[currentIndex];
          if (current.revealed || current.flagged) continue;
          current.revealed = true;
          renderCell(currentIndex);

          if (current.neighborMines === 0 && !current.mine) {
            neighborsOf(currentIndex).forEach((neighbor) => {
              if (!cells[neighbor].revealed && !cells[neighbor].flagged) queue.push(neighbor);
            });
          }
        }

        if (cells[index].mine) {
          cells[index].hit = true;
          finish(false);
          return;
        }

        checkWin();
      }

      function toggleFlag(index) {
        if (gameOver || cells[index].revealed) return;
        cells[index].flagged = !cells[index].flagged;
        flags += cells[index].flagged ? 1 : -1;
        updateMineCount();
        renderCell(index);
      }

      function newGame() {
        window.clearInterval(timerId);
        config = DIFFICULTIES[difficulty];
        cells = Array.from({ length: config.columns * config.rows }, () => ({
          mine: false,
          neighborMines: 0,
          revealed: false,
          flagged: false,
          hit: false,
          wrongFlag: false,
          element: null
        }));
        started = false;
        gameOver = false;
        flags = 0;
        seconds = 0;
        timerId = null;
        timerElement.textContent = "000";
        boardElement.style.setProperty("--columns", config.columns);
        boardElement.setAttribute("aria-label", `${config.rows}행 ${config.columns}열 지뢰찾기 게임판`);
        resetButton.textContent = "🙂";
        resetButton.setAttribute("aria-label", "새 게임");
        difficultyButtons.forEach((button) => {
          const isSelected = button.dataset.difficulty === difficulty;
          button.classList.toggle("is-selected", isSelected);
          button.setAttribute("aria-pressed", String(isSelected));
        });
        statusElement.textContent = "칸을 열어 게임을 시작하세요.";
        delete statusElement.dataset.state;

        const fragment = document.createDocumentFragment();
        cells.forEach((cell, index) => {
          const button = document.createElement("button");
          button.className = "cell";
          button.type = "button";
          button.setAttribute("role", "gridcell");
          button.setAttribute("aria-label", `행 ${Math.floor(index / config.columns) + 1}, 열 ${index % config.columns + 1}: 닫힌 칸`);
          button.addEventListener("click", () => reveal(index));
          button.addEventListener("mousedown", (event) => {
            if (event.buttons === 3) {
              event.preventDefault();
              chord(index);
            }
          });
          button.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            toggleFlag(index);
          });
          cell.element = button;
          fragment.append(button);
        });
        boardElement.replaceChildren(fragment);
        updateMineCount();
        updateBestRecord();
        confettiElement.replaceChildren();
      }

      function updateBestRecord() {
        const savedRecord = window.localStorage.getItem(`minesweeper.best.${difficulty}`);
        const bestTime = savedRecord === null ? null : Number(savedRecord);
        bestRecordElement.textContent = bestTime !== null && Number.isFinite(bestTime)
          ? `${formatTime(bestTime)}초`
          : "--";
      }

      function celebrateRecord() {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const colors = ["#f4c95d", "#f28b82", "#68b984", "#78a9e8", "#b28ce0"];
        const fragment = document.createDocumentFragment();
        for (let index = 0; index < 90; index += 1) {
          const piece = document.createElement("span");
          piece.className = "confetti-piece";
          piece.style.setProperty("--left", `${Math.random() * 100}vw`);
          piece.style.setProperty("--color", colors[index % colors.length]);
          piece.style.setProperty("--drift", `${Math.random() * 240 - 120}px`);
          piece.style.setProperty("--spin", `${Math.random() * 1080 - 540}deg`);
          piece.style.setProperty("--delay", `${Math.random() * 0.35}s`);
          fragment.append(piece);
        }
        confettiElement.replaceChildren(fragment);
        window.setTimeout(() => confettiElement.replaceChildren(), 3400);
      }

      difficultyButtons.forEach((button) => {
        button.addEventListener("click", () => {
          difficulty = button.dataset.difficulty;
          newGame();
        });
      });
      resetButton.addEventListener("click", newGame);
      newGame();
    })();
