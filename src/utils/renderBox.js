import labels from "./labels.json";

/**
 * Render prediction boxes
 * @param {HTMLCanvasElement} canvasRef canvas tag reference
 * @param {Array} boxes_data boxes array
 * @param {Array} scores_data scores array
 * @param {Array} classes_data class array
 * @param {Array[Number]} ratios boxes ratio [xRatio, yRatio]
 */
export const renderBoxes = (
  canvasRef,
  boxes_data,
  scores_data,
  classes_data,
  ratios
) => {
  const ctx = canvasRef.getContext("2d");
  const colors = new Colors();

  const frameData = [];

  for (let i = 0; i < scores_data.length; ++i) {
    const klass = labels[classes_data[i]];
    const color = colors.get(classes_data[i]);
    const score = (scores_data[i] * 100).toFixed(1);

    let [y1, x1, y2, x2] = boxes_data.slice(i * 4, (i + 1) * 4);
    x1 *= ratios[0];
    x2 *= ratios[0];
    y1 *= ratios[1];
    y2 *= ratios[1];

    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
    ctx.fill();

    frameData.push({ x: centerX, y: centerY, class: klass, color: color });
  }

  return [boxes_data, scores_data, classes_data, ratios, frameData];
};

class Colors {
  // ultralytics color palette https://ultralytics.com/
  constructor() {
    this.palette = [
      "#FF3838",
      "#FF9D97",
      "#FF701F",
      "#FFB21D",
      "#CFD231",
      "#48F90A",
      "#92CC17",
      "#3DDB86",
      "#1A9334",
      "#00D4BB",
      "#2C99A8",
      "#00C2FF",
      "#344593",
      "#6473FF",
      "#0018EC",
      "#8438FF",
      "#520085",
      "#CB38FF",
      "#FF95C8",
      "#FF37C7",
    ];
    this.n = this.palette.length;
  }

  get = (i) => this.palette[Math.floor(i) % this.n];

  static hexToRgba = (hex, alpha) => {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `rgba(${[
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16),
        ].join(", ")}, ${alpha})`
      : null;
  };
}
