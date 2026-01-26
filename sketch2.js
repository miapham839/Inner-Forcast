// Why do we need to import from CDN?

/** Import MediaPipe from a CDN because the browser can't resolve npm packages like "@mediapipe/tasks-vision" by itself. The CDN serves a browser-ready ES module, so we can use `import` directly without a bundler (Vite/Webpack). */
/** An ES module (ESM) is JavaScript’s standard module system.
    It lets us use `import` / `export` to split code into files.
    In the browser, ES modules must be loaded with
    <script type="module">, and imports must be real URLs
    (e.g. CDN links) unless a bundler is used.
*/

import {
  FaceLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

// Global variables
let cloudOneX = 50;
let weather = "RAIN";

let bgColor, targetBgColor;
let mountColor, targetMountColor;
let grassColor, targetGrassColor;

let sunAmount = 0;
let targetSunAmount = 0;

let snowAmount = 0;
let targetSnowAmount = 0;

let faceLandmarker;
let capture;
let faceLandmarkerResult;

let smileL = 0;
let smileR = 0;
let jawOpen = 0;
let hasFace = false;

// Sets up face land marker
const initializeFaceLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
  );

  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "models/face_landmarker.task",
    },
    runningMode: "VIDEO",
    outputFaceBlendshapes: true,
    numFaces: 1,
  });
};

function getBlendshape(blendshapes, name) {
  return blendshapes.find((b) => b.categoryName === name)?.score || 0;
}

const detectFace = () => {
  if (!faceLandmarker || !capture?.elt)
    return requestAnimationFrame(detectFace);

  const video = capture.elt;
  if (video.readyState < 2) return requestAnimationFrame(detectFace);

  faceLandmarkerResult = faceLandmarker.detectForVideo(
    video,
    performance.now(),
  );

  hasFace =
    faceLandmarkerResult.faceLandmarks &&
    faceLandmarkerResult.faceLandmarks.length > 0;

  if (faceLandmarkerResult.faceBlendshapes?.length) {
    const cats = faceLandmarkerResult.faceBlendshapes[0].categories;
    smileL = getBlendshape(cats, "mouthSmileLeft");
    smileR = getBlendshape(cats, "mouthSmileRight");
    jawOpen = getBlendshape(cats, "jawOpen");
  }

  requestAnimationFrame(detectFace);
};

function changeToSunny() {
  targetBgColor = color(165, 215, 250);
  targetMountColor = color(165, 180, 135);
  targetGrassColor = color(105, 165, 105);
  weather = "SUN";
  targetSnowAmount = 0;
  targetSunAmount = 1;
}

function changeToSnowy() {
  targetBgColor = color(210, 225, 240);
  targetMountColor = color(200, 205, 215);
  targetGrassColor = color(185, 210, 225);
  weather = "SNOWY";
  targetSnowAmount = 1;
  targetSunAmount = 0;
}

function changeToRainy() {
  targetBgColor = color(10, 10, 40);
  targetMountColor = color(71, 74, 61);
  targetGrassColor = color(50, 76, 50);
  weather = "RAIN";
  targetSnowAmount = 0;
  targetSunAmount = 0;
}

window.changeWeather = function () {
  if (smileL > 0.2 && smileR > 0.2) changeToSunny();
  else if (jawOpen > 0.3) changeToSnowy();
  else changeToRainy();
};

window.setup = function () {
  createCanvas(windowWidth, windowHeight);
  frameRate(40);

  capture = createCapture(VIDEO);
  capture.hide();

  bgColor = color(10, 10, 40);
  targetBgColor = color(10, 10, 40);

  mountColor = color(71, 74, 61);
  targetMountColor = color(71, 74, 61);

  grassColor = color(50, 76, 50);
  targetGrassColor = color(50, 76, 50);

  initializeFaceLandmarker().then(() => {
    detectFace();
  });
};

// Keep canvas responsive
window.windowResized = function () {
  resizeCanvas(windowWidth, windowHeight);
};

window.draw = function () {
  changeWeather();

  bgColor = lerpColor(bgColor, targetBgColor, 0.08);
  mountColor = lerpColor(mountColor, targetMountColor, 0.08);
  grassColor = lerpColor(grassColor, targetGrassColor, 0.08);
  snowAmount = lerp(snowAmount, targetSnowAmount, 0.1);
  sunAmount = lerp(sunAmount, targetSunAmount, 0.08);

  background(bgColor);

  // --- Layout (responsive positions) ---
  const groundY = height * 0.8;

  // Sun (smooth fade/scale, fixed position)
  if (sunAmount > 0.01) {
    noStroke();

    const x = width * 0.55;
    const y = height * 0.42;

    const outerD = min(width, height) * 0.42 * sunAmount;
    const innerD = min(width, height) * 0.35 * sunAmount;

    fill(255, 215, 120, 180 * sunAmount);
    circle(x, y, outerD);

    fill(255, 245, 180, 220 * sunAmount);
    circle(x, y, innerD);

    fill(255, 250, 220, 90 * sunAmount);
    circle(x, y, min(width, height) * 0.2 * sunAmount);
  }

  // Mountains
  stroke(0);
  fill(mountColor);

  triangle(
    -width * 0.1,
    groundY,
    width * 0.25,
    height * 0.28,
    width * 0.6,
    groundY,
  );

  triangle(
    width * 0.3,
    groundY,
    width * 0.75,
    height * 0.28,
    width * 1.1,
    groundY,
  );

  // Ground / grass
  noStroke();
  fill(grassColor);
  rect(0, groundY, width, height - groundY);

  // Clouds (scale-ish)
  noStroke();
  let cloudAlpha = weather === "SUN" ? 180 : 200;
  fill(255, cloudAlpha);

  const cY1 = height * 0.22;
  const cY2 = height * 0.3;
  const cY3 = height * 0.38;

  ellipse(cloudOneX, cY1, width * 0.24, height * 0.08);
  ellipse(cloudOneX - width * 0.12, cY2, width * 0.18, height * 0.045);
  ellipse(cloudOneX + width * 0.08, cY3, width * 0.14, height * 0.035);

  // Snow
  if (snowAmount > 0.1) {
    for (let i = 0; i < 25; i++) {
      fill(255, 255, 255, 220 * snowAmount);
      const x = random(0, width);
      const y = random(0, height);
      const d = random(0, min(15, min(width, height) * 0.02));
      circle(x, y, d);
    }
  }

  cloudOneX = frameCount % width;

  // Camera preview (bottom-right, responsive size)
  const camW = min(160, width * 0.35);
  const camH = camW * 0.75;
  image(capture, width - camW - 20, height - camH - 20, camW, camH);

  // HUD / debug text
  noStroke();
  fill(255);
  textSize(25);
  text("Smile for Sunny, Open mouth for Snowy!", 20, height - 40);
  textSize(15);
  text(`smileL: ${smileL.toFixed(2)}`, 20, 30);
  text(`smileR: ${smileR.toFixed(2)}`, 20, 45);
  text(`jawOpen: ${jawOpen.toFixed(2)}`, 20, 60);
  text(`hasFace: ${hasFace ? "YES" : "NO"}`, 20, 75);
};
