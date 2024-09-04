import React, { useState, useEffect, useRef } from "react";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import Loader from "./components/loader";
import ButtonHandler from "./components/btn-handler";
import { detect, detectVideo } from "./utils/detect";
import { renderBoxes } from "./utils/renderBox";
import "./style/App.css";
import { nonMaxSuppression, postprocess, preprocess } from "./utils/process";
import { getVideoInfo } from "./utils/getVideoInfo";

const App = () => {
  const [loading, setLoading] = useState({ loading: true, progress: 0 });
  const [model, setModel] = useState({
    net: null,
    inputShape: [1, 0, 0, 3],
  });

  const [detectionResults, setDetectionResults] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isVideoEnded, setIsVideoEnded] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);

  const imageRef = useRef(null);
  const cameraRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const modelName = "yolov10n";

  useEffect(() => {
    tf.ready().then(async () => {
      const yolov8 = await tf.loadGraphModel(
        `${window.location.href}/${modelName}_web_model/model.json`,
        {
          onProgress: (fractions) => {
            setLoading({ loading: true, progress: fractions });
          },
        }
      );

      const dummyInput = tf.ones(yolov8.inputs[0].shape);
      const warmupResults = yolov8.execute(dummyInput);

      setLoading({ loading: false, progress: 1 });
      setModel({
        net: yolov8,
        inputShape: yolov8.inputs[0].shape,
      });

      tf.dispose([warmupResults, dummyInput]);
    });
  }, []);

  const processVideo = async () => {
    if (!videoInfo) {
      console.error("Video info not available");
      return;
    }

    setIsProcessing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const results = [];

    video.currentTime = 0;
    const frameDuration = 1 / videoInfo.videoFPS;

    while (video.currentTime < video.duration) {
      const currentTime = video.currentTime;

      // Process the frame
      const [input, xRatio, yRatio] = preprocess(
        video,
        model.inputShape[1],
        model.inputShape[2]
      );
      const [boxesTensor, scoresTensor] = model.net.execute(input);
      const [boxes, scores, classes] = postprocess(boxesTensor, scoresTensor);

      const [filteredBoxes, filteredScores, filteredClasses] =
        await nonMaxSuppression(boxes, scores, classes);

      const frameData = renderBoxes(
        canvas,
        filteredBoxes,
        filteredScores,
        filteredClasses,
        [xRatio, yRatio],
        false // Set to false to not draw bounding boxes here
      );

      const newResult = {
        time: currentTime,
        points: frameData,
        boxes: filteredBoxes,
        scores: filteredScores,
        classes: filteredClasses,
        ratios: [xRatio, yRatio],
      };

      results.push(newResult);

      // Update state to trigger re-render
      setDetectionResults((prevResults) => [...prevResults, newResult]);
      setCurrentTime(currentTime);

      // Render current frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw all previous points
      results.forEach((result) => {
        result.points.forEach((point) => {
          ctx.fillStyle = point.color;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
          ctx.fill();
        });
      });

      // Draw current frame's bounding boxes
      renderBoxes(
        canvas,
        newResult.boxes,
        newResult.scores,
        newResult.classes,
        newResult.ratios,
        true
      );

      tf.dispose([input, boxesTensor, scoresTensor, boxes, scores, classes]);

      // Move to next frame
      await new Promise((resolve) => {
        video.onseeked = resolve;
        video.currentTime += frameDuration;
      });

      // Add a small delay to allow for rendering
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    setIsProcessing(false);
    video.currentTime = 0;
  };

  const renderFrame = (time) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (detectionResults.length === 0) return;

    // Find the frame that is closest to, but not exceeding the current time
    const currentFrame = detectionResults.reduce((prev, curr) =>
      curr.time <= time &&
      Math.abs(curr.time - time) < Math.abs(prev.time - time)
        ? curr
        : prev
    );

    // Draw all previous points
    detectionResults
      .filter((r) => r.time <= time)
      .forEach((frame) => {
        frame.points.forEach((point) => {
          ctx.fillStyle = point.color;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
          ctx.fill();
        });
      });

    // Draw current frame's bounding boxes
    if (currentFrame) {
      renderBoxes(
        canvas,
        currentFrame.boxes,
        currentFrame.scores,
        currentFrame.classes,
        currentFrame.ratios,
        true
      );
    }
  };

  const handleVideoLoad = async (event) => {
    const video = event.target;
    const duration = video.duration;
    if (!isNaN(duration) && isFinite(duration)) {
      setVideoDuration(duration);
    } else {
      setVideoDuration(0);
    }
    setCurrentTime(0);
    setIsVideoEnded(false);
    setDetectionResults([]);

    // Get video info
    const videoUrl = video.src;
    const info = await getVideoInfo(videoUrl);
    if (info) {
      setVideoInfo(info);
      console.log("Video FPS:", info.videoFPS);
    } else {
      console.error("Failed to get video info");
    }
  };

  const handleVideoEnd = () => {
    setIsVideoEnded(true);
  };

  const handleTimeUpdate = (event) => {
    const currentTime = event.target.currentTime;
    setCurrentTime(currentTime);
    renderFrame(currentTime);
  };

  const handleSliderChange = (event) => {
    const time = parseFloat(event.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    renderFrame(time);
  };

  return (
    <div className="App">
      {loading.loading && (
        <Loader>Loading model... {(loading.progress * 100).toFixed(2)}%</Loader>
      )}
      <div className="header">
        <h1>📷 YOLOv10 Object Tracking App</h1>
        <p>
          YOLOv10 object tracking application on browser powered by{" "}
          <code>tensorflow.js</code>
        </p>
        <p>
          Serving : <code className="code">{modelName}</code>
        </p>
      </div>

      <div className="content">
        <video
          ref={videoRef}
          onLoadedMetadata={handleVideoLoad}
          style={{ display: "none" }}
        />
        <canvas
          width={model.inputShape[1]}
          height={model.inputShape[2]}
          ref={canvasRef}
        />
      </div>

      {videoDuration > 0 && (
        <input
          type="range"
          min="0"
          max={videoDuration}
          step="0.1"
          value={currentTime}
          onChange={handleSliderChange}
          style={{ width: "100%" }}
        />
      )}

      <ButtonHandler
        videoRef={videoRef}
        processVideo={processVideo}
        isProcessing={isProcessing}
      />

      {isProcessing && (
        <div>
          <p>Processing: {((currentTime / videoDuration) * 100).toFixed(2)}%</p>
          <progress value={currentTime} max={videoDuration}></progress>
        </div>
      )}
    </div>
  );
};

export default App;
