// import * as tf from "@tensorflow/tfjs";
// import { renderBoxes } from "./renderBox";
// // import labels from "./labels.json";

// // const numClass = labels.length;

// /**
//  * Preprocess image / frame before forwarded into the model
//  * @param {HTMLVideoElement|HTMLImageElement} source
//  * @param {Number} modelWidth
//  * @param {Number} modelHeight
//  * @returns input tensor, xRatio and yRatio
//  */
// const preprocess = (source, modelWidth, modelHeight) => {
//   let xRatio, yRatio; // ratios for boxes

//   const input = tf.tidy(() => {
//     const img = tf.browser.fromPixels(source);

//     // padding image to square => [n, m] to [n, n], n > m
//     const [h, w] = img.shape.slice(0, 2); // get source width and height
//     const maxSize = Math.max(w, h); // get max size
//     const imgPadded = img.pad([
//       [0, maxSize - h], // padding y [bottom only]
//       [0, maxSize - w], // padding x [right only]
//       [0, 0],
//     ]);

//     xRatio = maxSize / w; // update xRatio
//     yRatio = maxSize / h; // update yRatio

//     return tf.image
//       .resizeBilinear(imgPadded, [modelWidth, modelHeight]) // resize frame
//       .div(255.0) // normalize
//       .expandDims(0); // add batch
//   });

//   return [input, xRatio, yRatio];
// };

// /**
//  * Function run inference and do detection from source.
//  * @param {HTMLImageElement|HTMLVideoElement} source
//  * @param {tf.GraphModel} model loaded YOLOv8 tensorflow.js model
//  * @param {HTMLCanvasElement} canvasRef canvas reference
//  * @param {VoidFunction} callback function to run after detection process
//  */

// export const detect = async (source, model, canvasRef, updateTrajectories) => {
//   const [modelWidth, modelHeight] = model.inputShape.slice(1, 3);

//   tf.engine().startScope();
//   const [input, xRatio, yRatio] = preprocess(source, modelWidth, modelHeight);

//   const [boxesTensor, scoresTensor] = model.net.execute(input);

//   const [boxes, scores, classes] = tf.tidy(() => {
//     const boxes = boxesTensor.squeeze();
//     const [x1, y1, x2, y2] = tf.split(boxes, 6, -1);
//     const processedBoxes = tf.concat([y1, x1, y2, x2], -1);
//     const scores = scoresTensor.squeeze();
//     const classes = tf.zeros(scores.shape, "int32");
//     return [processedBoxes, scores, classes];
//   });

//   const nms = await tf.image.nonMaxSuppressionAsync(
//     boxes,
//     scores,
//     500,
//     0.45,
//     0.2
//   );

//   const boxes_data = boxes.gather(nms, 0).dataSync();
//   const scores_data = scores.gather(nms, 0).dataSync();
//   const classes_data = classes.gather(nms, 0).dataSync();

//   const frameData = renderBoxes(
//     canvasRef,
//     boxes_data,
//     scores_data,
//     classes_data,
//     [xRatio, yRatio]
//   );
//   updateTrajectories({
//     time: source.currentTime || 0,
//     points: frameData,
//     boxes: boxes_data,
//     scores: scores_data,
//     classes: classes_data,
//     ratios: [xRatio, yRatio],
//   });

//   tf.dispose([boxesTensor, scoresTensor, boxes, scores, classes, nms]);

//   tf.engine().endScope();
// };
// /**
//  * Function to detect video from every source.
//  * @param {HTMLVideoElement} vidSource video source
//  * @param {tf.GraphModel} model loaded YOLOv8 tensorflow.js model
//  * @param {HTMLCanvasElement} canvasRef canvas reference
//  */
// export const detectVideo = (
//   vidSource,
//   model,
//   canvasRef,
//   updateTrajectories
// ) => {
//   const detectFrame = async () => {
//     if (vidSource.videoWidth === 0 && vidSource.srcObject === null) {
//       return;
//     }

//     await detect(vidSource, model, canvasRef, updateTrajectories);
//     requestAnimationFrame(detectFrame);
//   };

//   detectFrame();
// };
