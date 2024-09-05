import React, { useState, useEffect, useRef } from "react";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import Loader from "./components/loader";
import ButtonHandler from "./components/btn-handler";
import { renderBoxes } from "./utils/renderBox";
import "./style/App.css";
import { nonMaxSuppression, postprocess, preprocess } from "./utils/process";
import { getVideoInfo } from "./utils/getVideoInfo";
import ObjectDetectionControls from "./components/ObjectDetectionControls";
import { createObjectTracker } from "./utils/kalmanfilter";

const App = () => {
  const [loading, setLoading] = useState({ loading: true, progress: 0 });
  const [model, setModel] = useState({
    net: null,
    inputShape: [1, 0, 0, 3],
  });

  const [detectionResults, setDetectionResults] = useState([]);
  console.log("🚀 ~ App ~ detectionResults:", detectionResults);
  const [currentTime, setCurrentTime] = useState(0);
  // const [isVideoEnded, setIsVideoEnded] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const [tracker, setTracker] = useState(null);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [selectedObject, setSelectedObject] = useState(null);
  const [trackingResults, setTrackingResults] = useState([]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const modelName = "yolov10n";

  console.log("🚀 ~ App ~ model:", model);
  useEffect(() => {
    tf.ready().then(async () => {
      const yolov8 = await tf.loadGraphModel(
        `${modelName}_web_model/model.json`,
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

  const resetDetection = () => {
    setDetectionResults([]);
    setCurrentTime(0);
    setVideoInfo(null);
    // setIsVideoEnded(false);
    setIsProcessing(false);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };
  const renderTrackingFrame = (results, canvas) => {
    if (results.length === 0) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 추적 경로 그리기
    ctx.beginPath();
    ctx.moveTo(results[0].x, results[0].y);
    for (let i = 1; i < results.length; i++) {
      ctx.lineTo(results[i].x, results[i].y);
    }
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 각 프레임의 위치에 점 그리기
    results.forEach((result) => {
      ctx.fillStyle = "blue";
      ctx.beginPath();
      ctx.arc(result.x, result.y, 3, 0, 2 * Math.PI);
      ctx.fill();

      // 바운딩 박스 그리기 (있는 경우에만)
      if (result.box) {
        ctx.strokeStyle = "green";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          result.box.x,
          result.box.y,
          result.box.width,
          result.box.height
        );
      }
    });

    // 마지막 위치에 큰 점 그리기
    const lastResult = results[results.length - 1];
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(lastResult.x, lastResult.y, 5, 0, 2 * Math.PI);
    ctx.fill();
  };
  const detectObjects = async () => {
    if (!videoRef.current || !model.net) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

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
      true
    );

    setSelectedFrame({
      time: video.currentTime,
      objects: frameData,
      boxes: filteredBoxes,
      scores: filteredScores,
      classes: filteredClasses,
      ratios: [xRatio, yRatio],
    });

    tf.dispose([input, boxesTensor, scoresTensor, boxes, scores, classes]);
  };

  const trackObject = async () => {
    if (!selectedObject || !videoRef.current || !model.net) {
      console.error("Cannot start tracking:", {
        selectedObject,
        videoRef: videoRef.current,
        model: model.net,
      });
      return;
    }

    setIsProcessing({ status: true, progress: 0 });
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const results = [];

    console.log("Starting tracking for object:", selectedObject);
    console.log("Starting tracking from time:", selectedFrame.time);
    video.currentTime = selectedFrame.time;
    const frameDuration = 1 / videoInfo.videoFPS;

    // Initialize the tracker
    const tracker = new createObjectTracker(selectedObject);

    while (video.currentTime < video.duration) {
      const currentTime = video.currentTime;

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
        false
      );

      // Predict the object's new position
      const predictedPosition = tracker.predict(currentTime);

      // Find the closest detection of the same class
      const closestDetection = frameData.reduce((closest, obj) => {
        if (obj.class !== tracker.class) return closest;

        const distance = Math.sqrt(
          Math.pow(obj.x - predictedPosition.x, 2) +
            Math.pow(obj.y - predictedPosition.y, 2)
        );

        if (!closest || distance < closest.distance) {
          return { ...obj, distance };
        }
        return closest;
      }, null);

      let updatedPosition;
      if (closestDetection && closestDetection.distance < 100) {
        // If a close detection is found, update the tracker
        updatedPosition = tracker.update(closestDetection, currentTime);
        console.log(`Object found at time ${currentTime}:`, updatedPosition);
      } else {
        // If no close detection is found, use the predicted position
        if (tracker.incrementMissedFrames()) {
          updatedPosition = tracker.predict(currentTime);
          console.log(
            `Object not found at time ${currentTime}, using predicted position:`,
            updatedPosition
          );
        } else {
          console.log(`Object lost at time ${currentTime}`);
          break;
        }
      }

      results.push({
        time: currentTime,
        x: updatedPosition.x,
        y: updatedPosition.y,
        box: closestDetection ? closestDetection.box : null,
      });

      // Render tracking results
      renderTrackingFrame(results, canvas);

      tf.dispose([input, boxesTensor, scoresTensor, boxes, scores, classes]);

      await new Promise((resolve) => {
        video.onseeked = resolve;
        video.currentTime += frameDuration;
      });

      setIsProcessing((prev) => ({
        ...prev,
        progress: (currentTime / video.duration) * 100,
      }));

      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    console.log("Tracking completed. Results:", results);
    setTrackingResults(results);
    setIsProcessing({ status: false, progress: 100 });
    video.currentTime = selectedFrame.time;
    renderTrackingFrame(results, canvas);
  };

  const renderTracking = (results) => {
    if (results.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.beginPath();
    ctx.moveTo(results[0].x, results[0].y);

    for (let i = 1; i < results.length; i++) {
      ctx.lineTo(results[i].x, results[i].y);
    }

    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.stroke();
  };

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

    // Find the frame that is closest to the current time
    const currentFrame = detectionResults.reduce((prev, curr) =>
      Math.abs(curr.time - time) < Math.abs(prev.time - time) ? curr : prev
    );

    // Draw all previous points up to the current frame
    detectionResults
      .filter((r) => r.time <= currentFrame.time)
      .forEach((frame) => {
        frame.points.forEach((point) => {
          ctx.fillStyle = point.color;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
          ctx.fill();
        });
      });

    // Draw current frame's bounding boxes
    renderBoxes(
      canvas,
      currentFrame.boxes,
      currentFrame.scores,
      currentFrame.classes,
      currentFrame.ratios,
      true
    );
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
    // setIsVideoEnded(false);
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
    // setIsVideoEnded(true);
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
          Serving : <code className="code">{modelName}</code>
        </p>
      </div>

      <div className="content">
        <video
          ref={videoRef}
          onLoadedMetadata={handleVideoLoad}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnd}
          style={{ display: "none" }}
        />
        <canvas
          width={model.inputShape[1]}
          height={model.inputShape[2]}
          ref={canvasRef}
        />
      </div>

      {videoInfo && (
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

      <ObjectDetectionControls
        detectObjects={detectObjects}
        trackObject={trackObject}
        selectedFrame={selectedFrame}
        setSelectedObject={setSelectedObject}
        selectedObject={selectedObject}
        isProcessing={isProcessing}
      />

      <ButtonHandler
        videoRef={videoRef}
        processVideo={processVideo}
        isProcessing={isProcessing}
        setIsProcessing={setIsProcessing}
        resetDetection={resetDetection}
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
