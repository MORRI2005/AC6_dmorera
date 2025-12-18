let video;
let detectedColor = "Ninguno"; // Estado del input mostrado en pantalla
let detectedColorFill = null; // color visual del input
let detectionSize = 20; // tamaño del cuadrado de detección (en píxeles)
let colorCheckInterval = 200; // Milisegundos entre detección
let lastCheck = 0;

function setup() {
  const s = min(windowWidth, windowHeight) * 0.9;
  canvas = createCanvas(s, s);

  const x = (windowWidth - s) / 2;
  const y = (windowHeight - s) / 2;
  canvas.position(x, y);

  textFont("monospace");

  // ---- ACTIVAR CÁMARA ----
  video = createCapture(VIDEO);
  video.size(160, 120);
  video.hide();

  createRestartButton();
  startGame();
}

function startGame() {
  gameState = "PLAYING";
  score = 0;
  balls = [];
  pathProgress = 0;

  const screenLength = height + 200;
  const numBalls = ceil(screenLength / ballSpacing);

  for (let i = 0; i < numBalls; i++) {
    balls.push({
      colorIndex: floor(random(COLOR_CONFIG.length)),
      distanceFromFront: i * ballSpacing,
    });
  }

  pathProgress = ballSpacing * 6;
  restartButton.hide();
}

function windowResized() {
  const s = min(windowWidth, windowHeight) * 0.9;
  resizeCanvas(s, s);

  const x = (windowWidth - s) / 2;
  const y = (windowHeight - s) / 2;
  canvas.position(x, y);

  repositionRestartButton();
  redraw();
}

const COLOR_CONFIG = [
  { name: "ROJO", fill: "#e74c3c" },
  { name: "VERDE", fill: "#2ecc71" },
  { name: "AZUL", fill: "#3498db" },
];

let balls = [];
let score = 0;

let gameState = "PLAYING";

let ballRadius = 20;
let ballSpacing = ballRadius * 2;
let pathProgress = 0;

let pathSpeed = 0.5;
const SPEED_FAST = 1.4;
const SPEED_SLOW = 0.25;
const SPEED_CURVE = 1.6;

function smoothstep(edge0, edge1, x) {
  const t = constrain((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function computePathSpeed(frontY) {
  let p = constrain(frontY / height, 0, 1);
  p = pow(p, SPEED_CURVE);
  const eased = smoothstep(0, 1, p);
  return lerp(SPEED_FAST, SPEED_SLOW, eased);
}

function getPathPosition(distance) {
  const t = distance / 100;
  const amplitude = width * 0.06;
  const x = width / 2 + sin(t * 2) * amplitude;
  const y = distance;
  return { x, y };
}

function findNextDistance(previousDistance) {
  return previousDistance + ballSpacing;
}

function draw() {
  background(10);

  if (gameState === "GAMEOVER") {
    drawGameOver();
    return;
  }

  drawHud();

  if (balls.length > 0) {
    const frontY = pathProgress - balls[0].distanceFromFront;
    if (frontY >= height - ballRadius * 1.2) {
      gameState = "GAMEOVER";
      drawGameOver();
      return;
    }
    pathSpeed = computePathSpeed(frontY);
  }

  pathProgress += pathSpeed;
  updateAndDrawBalls();
  checkBallsAtEnd();
  detectColorFromCamera();
}

function drawHud() {
  noStroke();
  fill(255);
  textSize(20);
  textAlign(LEFT, TOP);

  text(`Puntuación: ${score}`, 20, 20);
  const inputText = `Input: ${detectedColor}`;
  text(inputText, 20, 50);

  const textW = textWidth(inputText);

  const squareX = 20 + textW + 10;
  const squareY = 52;

  if (detectedColorFill) {
    noStroke();
    fill(detectedColorFill);
    rect(squareX, squareY, 20, 20, 4);
  } else {
    noFill();
    stroke(150);
    rect(squareX, squareY, 20, 20, 4);
  }

  textAlign(RIGHT, TOP);
  if (balls.length > 0) {
    const frontColor = COLOR_CONFIG[balls[0].colorIndex].name;
    text(`Dispara al ${frontColor}`, width - 20, 20);
  }
}

function drawGameOver() {
  fill(255, 60, 60);
  textAlign(CENTER, CENTER);
  textSize(50);
  text("GAME OVER", width / 2, height / 2 - 60);

  textSize(25);
  fill(255);
  text(`Puntuación final: ${score}`, width / 2, height / 2);

  restartButton.show();
}

function addNewBall() {
  const lastBall = balls[balls.length - 1];
  balls.push({
    colorIndex: floor(random(COLOR_CONFIG.length)),
    distanceFromFront: lastBall
      ? findNextDistance(lastBall.distanceFromFront)
      : 0,
  });
}

function updateAndDrawBalls() {
  for (let i = balls.length - 1; i >= 0; i--) {
    const ball = balls[i];
    const distance = pathProgress - ball.distanceFromFront;
    const pos = getPathPosition(distance);

    const currentRadius = i === 0 ? ballRadius * 1.5 : ballRadius;

    noStroke();
    fill(COLOR_CONFIG[ball.colorIndex].fill);
    circle(pos.x, pos.y, currentRadius * 2);

    if (i === 0) {
      stroke(255, 200);
      strokeWeight(3);
      noFill();
      circle(pos.x, pos.y, currentRadius * 2 + 5);
    }
  }
}

function checkBallsAtEnd() {
  if (balls.length === 0) return;

  const frontBall = balls[0];
  const distance = pathProgress - frontBall.distanceFromFront;

  if (distance > height + ballRadius * 2) {
    const removedBall = balls.shift();

    const lastBall = balls[balls.length - 1];
    removedBall.distanceFromFront = findNextDistance(
      lastBall.distanceFromFront
    );
    removedBall.colorIndex = floor(random(COLOR_CONFIG.length));

    balls.push(removedBall);
  }
}

function shootWithColor(colorIndex) {
  if (balls.length === 0) return;

  const frontBall = balls[0];
  const lastBall = balls[balls.length - 1];

  if (frontBall.colorIndex === colorIndex) {
    balls.shift();
    score += 5;
  } else {
    score = max(0, score - 1);
  }

  balls.push({
    colorIndex: floor(random(COLOR_CONFIG.length)),
    distanceFromFront: findNextDistance(lastBall.distanceFromFront),
  });
}

/* ---------------------------
   SISTEMA DE DETECCIÓN DE COLOR
-----------------------------*/
function detectColorFromCamera() {
  if (millis() - lastCheck < colorCheckInterval) return;
  lastCheck = millis();

  video.loadPixels();
  if (video.pixels.length === 0) return;

  const cx = floor(video.width / 2);
  const cy = floor(video.height / 2);
  const half = floor(detectionSize / 2);

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  // Recorremos un cuadrado alrededor del centro
  for (let x = cx - half; x <= cx + half; x++) {
    for (let y = cy - half; y <= cy + half; y++) {
      const index = (x + y * video.width) * 4;
      if (index < 0 || index >= video.pixels.length) continue;

      rSum += video.pixels[index];
      gSum += video.pixels[index + 1];
      bSum += video.pixels[index + 2];
      count++;
    }
  }

  // Color promedio
  const r = rSum / count;
  const g = gSum / count;
  const b = bSum / count;

  let chosen = "Ninguno";
  let chosenFill = null;

  if (r > g + 40 && r > b + 40) {
    chosen = "ROJO";
    chosenFill = color(231, 76, 60);
    shootWithColor(0);
  } else if (g > r + 40 && g > b + 40) {
    chosen = "VERDE";
    chosenFill = color(46, 204, 113);
    shootWithColor(1);
  } else if (b > r + 40 && b > g + 40) {
    chosen = "AZUL";
    chosenFill = color(52, 152, 219);
    shootWithColor(2);
  }

  detectedColor = chosen;
  detectedColorFill = chosenFill;
}

/* --------------- RESTART BUTTON --------------- */

let restartButton;

function createRestartButton() {
  restartButton = createButton("REINICIAR");
  restartButton.style("font-family", "monospace");
  restartButton.style("font-size", "20px");
  restartButton.style("border", "none");
  restartButton.style("background", "#4caf50");
  restartButton.style("color", "white");
  restartButton.style("padding", "10px 20px");
  restartButton.style("border-radius", "8px");

  restartButton.mousePressed(() => {
    startGame();
    restartButton.hide();
  });

  repositionRestartButton();
  restartButton.hide();
}

function repositionRestartButton() {
  const x = (windowWidth - width) / 2 + width / 2 - 100;
  const y = (windowHeight - height) / 2 + height / 2 + 100;
  restartButton.position(x, y);
}
