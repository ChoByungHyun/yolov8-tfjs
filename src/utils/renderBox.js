import labels from "./labels.json";

export const renderBoxes = (
  canvasRef,
  boxes_data,
  scores_data,
  classes_data,
  ratios,
  drawBoxes = true
) => {
  const ctx = canvasRef.getContext("2d");
  const colors = new Colors();

  const frameData = [];

  for (let i = 0; i < scores_data.length; ++i) {
    const klass = labels[classes_data[i]];
    const color = colors.get(classes_data[i]);
    const score = scores_data[i];

    let [y1, x1, y2, x2] = boxes_data.slice(i * 4, (i + 1) * 4);
    x1 *= ratios[0];
    x2 *= ratios[0];
    y1 *= ratios[1];
    y2 *= ratios[1];

    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;

    if (drawBoxes) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      ctx.fillStyle = color;
      ctx.font = "12px Arial";
      ctx.fillText(
        `${klass} ${(score * 100).toFixed(1)}%`,
        x1,
        y1 > 10 ? y1 - 5 : 10
      );
    }

    frameData.push({
      id: `${klass}_${i}_${centerX.toFixed(2)}_${centerY.toFixed(2)}`,
      x: centerX,
      y: centerY,
      class: klass,
      score: score,
      color: color,
    });
  }

  return frameData;
};

class Colors {
  constructor() {
    this.palette = [
      "red",
      "blue",
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
}
