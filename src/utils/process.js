import * as tf from "@tensorflow/tfjs";

/**
 * Preprocess image / frame before forwarded into the model
 * @param {HTMLVideoElement|HTMLImageElement} source
 * @param {Number} modelWidth
 * @param {Number} modelHeight
 * @returns input tensor, xRatio and yRatio
 */
export const preprocess = (source, modelWidth, modelHeight) => {
  let xRatio, yRatio; // ratios for boxes

  const input = tf.tidy(() => {
    const img = tf.browser.fromPixels(source);

    // padding image to square => [n, m] to [n, n], n > m
    const [h, w] = img.shape.slice(0, 2); // get source width and height
    const maxSize = Math.max(w, h); // get max size
    const imgPadded = img.pad([
      [0, maxSize - h], // padding y [bottom only]
      [0, maxSize - w], // padding x [right only]
      [0, 0],
    ]);

    xRatio = maxSize / w; // update xRatio
    yRatio = maxSize / h; // update yRatio

    return tf.image
      .resizeBilinear(imgPadded, [modelWidth, modelHeight]) // resize frame
      .div(255.0) // normalize
      .expandDims(0); // add batch
  });

  return [input, xRatio, yRatio];
};

/**
 * Postprocess output from the model
 * @param {tf.Tensor} boxesTensor
 * @param {tf.Tensor} scoresTensor
 * @returns processed boxes, scores, and classes
 */
export const postprocess = (boxesTensor, scoresTensor) => {
  const [boxes, scores, classes] = tf.tidy(() => {
    const boxes = boxesTensor.squeeze();
    const [x1, y1, x2, y2, objectness, classScore] = tf.split(boxes, 6, -1);
    const processedBoxes = tf.concat([y1, x1, y2, x2], -1);
    const scores = scoresTensor.squeeze();
    const classes = tf.zeros(scores.shape, "int32");
    return [processedBoxes, scores, classes];
  });

  return [boxes, scores, classes];
};

/**
 * Perform non-maximum suppression to filter out overlapping bounding boxes
 * @param {tf.Tensor} boxes
 * @param {tf.Tensor} scores
 * @param {tf.Tensor} classes
 * @param {Number} maxOutputSize
 * @param {Number} iouThreshold
 * @param {Number} scoreThreshold
 * @returns filtered boxes, scores, and classes
 */
export const nonMaxSuppression = async (
  boxes,
  scores,
  classes,
  maxOutputSize = 100,
  iouThreshold = 0.5,
  scoreThreshold = 0.25
) => {
  const nms = await tf.image.nonMaxSuppressionAsync(
    boxes,
    scores,
    maxOutputSize,
    iouThreshold,
    scoreThreshold
  );

  const boxes_data = boxes.gather(nms, 0).dataSync();
  const scores_data = scores.gather(nms, 0).dataSync();
  const classes_data = classes.gather(nms, 0).dataSync();

  return [boxes_data, scores_data, classes_data];
};
