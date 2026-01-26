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
let blendshapes;
let smileL = 0;
let smileR = 0;
let jawOpen = 0;
let hasFace;

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
  // requestAnimationFrame tells the browser:
  // "Run this function again on the next screen repaint (~60fps)"
  // We use it to create a smooth, efficient loop without blocking the main thread.
  //
  // If the faceLandmarker (ML model) or the video element is not ready yet,
  // we wait and try again on the next frame instead of crashing.
  if (!faceLandmarker || !capture?.elt)
    return requestAnimationFrame(detectFace);

  // Get the underlying HTMLVideoElement from p5's capture wrapper.
  // MediaPipe expects a real <video> element, not the p5 object.
  const video = capture.elt;

  // video.readyState tells us how much video data is available.
  // readyState < 2 means:
  // 0 = no data
  // 1 = metadata only
  // 2 = enough data to render the current frame
  //
  // MediaPipe needs an actual video frame to run detection,
  // so we wait until readyState >= 2.
  if (video.readyState < 2) return requestAnimationFrame(detectFace);

  // Run the Face Landmarker on the current video frame.
  // performance.now() provides a timestamp so MediaPipe can
  // correctly track time between frames in VIDEO mode.
  faceLandmarkerResult = faceLandmarker.detectForVideo(
    video,
    performance.now(),
  );

  // faceLandmarks = raw geometric points (468 points per face).
  // If at least one face is detected, faceLandmarks will be non-empty.
  hasFace =
    faceLandmarkerResult.faceLandmarks &&
    faceLandmarkerResult.faceLandmarks.length > 0;

  // Difference between faceLandmarks and faceBlendshapes:
  //
  // - faceLandmarks:
  //   Exact 3D positions of facial points (eyes, mouth, nose, etc.).
  //   Used for geometry, drawing meshes, measuring distances.
  //
  // - faceBlendshapes:
  //   High-level expression scores (0–1), e.g. "smile", "jawOpen".
  //   These are computed *from* landmarks and are easier to use
  //   for interaction and emotion-based logic.
  if (faceLandmarkerResult.faceBlendshapes?.length) {
    const cats = faceLandmarkerResult.faceBlendshapes[0].categories;

    // Extract specific expression signals from blendshapes.
    // These values change continuously as the face moves.
    smileL = getBlendshape(cats, "mouthSmileLeft");
    smileR = getBlendshape(cats, "mouthSmileRight");
    jawOpen = getBlendshape(cats, "jawOpen");
  }

  // Schedule the next detection pass.
  // This keeps the face detection loop running continuously.
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
  if (smileL > 0.3 && smileR > 0.3) changeToSunny();
  else if (jawOpen > 0.3) changeToSnowy();
  else changeToRainy();
};

window.setup = function () {
  createCanvas(400, 400);
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

window.draw = function () {
  changeWeather();
  bgColor = lerpColor(bgColor, targetBgColor, 0.08);
  mountColor = lerpColor(mountColor, targetMountColor, 0.08);
  grassColor = lerpColor(grassColor, targetGrassColor, 0.08);
  snowAmount = lerp(snowAmount, targetSnowAmount, 0.1);
  sunAmount = lerp(sunAmount, targetSunAmount, 0.08);

  background(bgColor);

  // Sun (smooth fade + simple rising effect)
  // sunAmount controls visibility (0..1); sunY eases upward when SUNNY.
  if (sunAmount > 0.01) {
    noStroke();

    const x = 210;
    const y = 170;

    // Scale the sun a little as it appears (feels more "rising")
    const outerD = 130 * sunAmount;
    const innerD = 100 * sunAmount;

    // Use alpha so the transition is smooth (no popping)
    fill(255, 215, 120, 180 * sunAmount);
    circle(x, y, outerD);

    fill(255, 245, 180, 220 * sunAmount);
    circle(x, y, innerD);

    // Optional subtle highlight for "shine" (very light)
    fill(255, 250, 220, 90 * sunAmount);
    circle(x, y, 50 * sunAmount);
  }

  // Mountains
  stroke(0);
  fill(mountColor);
  triangle(-40, 300, 75, 100, 250, 300);
  triangle(100, 300, 300, 100, 500, 300);

  // Grass
  fill(grassColor);
  rect(0, 280, 400, 120);

  // Clouds
  noStroke();
  let cloudAlpha = weather === "SUN" ? 180 : 210;
  fill(255, cloudAlpha);
  ellipse(cloudOneX, 50, 80, 40);
  ellipse(cloudOneX - 40, 100, 60, 20);
  ellipse(cloudOneX + 20, 140, 40, 10);

  // Snow
  if (snowAmount > 0.1) {
    stroke(255, 255 * snowAmount);
    for (let i = 0; i < 25; i++) {
      fill(255, 255, 255, 220 * snowAmount);
      let x = random(0, width);
      let y = random(0, height);
      let d = random(0, 15);
      circle(x, y, d);
    }
  }

  cloudOneX = frameCount % width;

  // Video
  image(capture, 280, 290, 100, 100);

  noStroke();
  fill(255);
  textSize(12);
  text("Smile for Sunny, Open mounth for snowy!", 10, height - 10);
  text(`smileL: ${smileL.toFixed(2)}`, 10, 20);
  text(`smileR: ${smileR.toFixed(2)}`, 10, 35);
  text(`jawOpen: ${jawOpen.toFixed(2)}`, 10, 50);
  text(
    `hasFace: ${faceLandmarkerResult?.faceLandmarks?.length ? "YES" : "NO"}`,
    10,
    65,
  );
};
