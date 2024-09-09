import React, { useState, useEffect, useRef } from "react";
import * as tf from "@tensorflow/tfjs";
import Loader from "./components/loader";
import ButtonHandler from "./components/btn-handler";
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
  const [processingTime, setProcessingTime] = useState(0);
  const [processedFrames, setProcessedFrames] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [isRealtimeMode, setIsRealtimeMode] = useState(false);
  const [realtimeStats, setRealtimeStats] = useState({ frames: 0, time: 0 });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  const modelName = "yolov10n";

  useEffect(() => {
    tf.ready().then(async () => {
      const yolov8 = await tf.loadGraphModel(
        `${modelName}_web_model_640/model.json`,
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

  const processVideoRealtime = async (start, end) => {
    if (!videoInfo) {
      console.error("Video info not available");
      return;
    }

    setIsProcessing(true);
    setProcessingTime(0);
    setProcessedFrames(0);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    video.currentTime = start;

    const frameSkip = 1;
    const frameDuration = 1 / videoInfo.videoFPS;
    const skipDuration = frameDuration * frameSkip;

    const startTime = performance.now();

    while (video.currentTime < end) {
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

      renderBoxes(
        canvas,
        filteredBoxes,
        filteredScores,
        filteredClasses,
        [xRatio, yRatio],
        true
      );

      setProcessedFrames((prev) => prev + 1);
      setCurrentTime(currentTime);

      tf.dispose([input, boxesTensor, scoresTensor, boxes, scores, classes]);

      const nextTime = Math.min(currentTime + skipDuration, end);
      await new Promise((resolve) => {
        video.onseeked = resolve;
        video.currentTime = nextTime;
      });

      const currentProcessingTime = (performance.now() - startTime) / 1000;
      setProcessingTime(currentProcessingTime);

      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const endTime = performance.now();
    const totalProcessingTime = (endTime - startTime) / 1000;
    setProcessingTime(totalProcessingTime);
    setRealtimeStats({ frames: processedFrames, time: totalProcessingTime });

    setIsProcessing(false);
    video.currentTime = start;
  };

  const processVideo = async (start, end) => {
    if (!videoInfo) {
      console.error("Video info not available");
      return;
    }
    if (isRealtimeMode) {
      await processVideoRealtime(start, end);
    } else {
      setIsProcessing(true);
      setProcessingTime(0);
      setProcessedFrames(0);

      const video = videoRef.current;
      const results = [];

      video.currentTime = start;
      const frameSkip = 1;
      const frameDuration = 1 / videoInfo.videoFPS;
      const skipDuration = frameDuration * frameSkip;

      const startTime = performance.now();

      while (video.currentTime < end) {
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

        results.push({
          time: currentTime,
          boxes: filteredBoxes,
          scores: filteredScores,
          classes: filteredClasses,
          ratios: [xRatio, yRatio],
        });

        setProcessedFrames((prev) => prev + 1);
        setCurrentTime(currentTime);

        tf.dispose([input, boxesTensor, scoresTensor, boxes, scores, classes]);

        const nextTime = Math.min(currentTime + skipDuration, end);
        await new Promise((resolve) => {
          video.onseeked = resolve;
          video.currentTime = nextTime;
        });
      }

      const endTime = performance.now();
      const totalProcessingTime = (endTime - startTime) / 1000;
      setProcessingTime(totalProcessingTime);

      setIsProcessing(false);
      setDetectionResults(results);
      video.currentTime = start;
    }
  };

  const renderResults = (time) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const video = videoRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Find the closest result to the current time
    const currentResult = detectionResults.reduce((prev, curr) =>
      Math.abs(curr.time - time) < Math.abs(prev.time - time) ? curr : prev
    );

    if (currentResult) {
      renderBoxes(
        canvas,
        currentResult.boxes,
        currentResult.scores,
        currentResult.classes,
        currentResult.ratios,
        true
      );
    }

    setCurrentTime(time);
  };

  const playResults = () => {
    setIsPlaying(true);
    videoRef.current.play();
    animate();
  };

  const pauseResults = () => {
    setIsPlaying(false);
    videoRef.current.pause();
    cancelAnimationFrame(animationRef.current);
  };

  const animate = () => {
    renderResults(videoRef.current.currentTime);
    if (videoRef.current.currentTime >= endTime) {
      pauseResults();
      setIsVideoEnded(true);
    } else {
      animationRef.current = requestAnimationFrame(animate);
    }
  };

  const handleSliderChange = (event) => {
    const time = parseFloat(event.target.value);
    setCurrentTime(time);
    videoRef.current.currentTime = time;
    renderResults(time);
  };

  const handleVideoLoad = async (event) => {
    const video = event.target;
    const duration = video.duration;
    if (!isNaN(duration) && isFinite(duration)) {
      setVideoDuration(duration);
      setEndTime(duration);
    } else {
      setVideoDuration(0);
    }
    setCurrentTime(0);
    setIsVideoEnded(false);
    setDetectionResults([]);

    const videoUrl = video.src;
    const info = await getVideoInfo(videoUrl);
    if (info) {
      setVideoInfo(info);
      console.log("Video FPS:", info.videoFPS);
    } else {
      console.error("Failed to get video info");
    }
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

      <div>
        <label>
          Start Time:
          <input
            type="number"
            value={startTime}
            onChange={(e) => setStartTime(Number(e.target.value))}
            min={0}
            max={videoDuration}
            step={0.1}
          />
        </label>
        <label>
          End Time:
          <input
            type="number"
            value={endTime}
            onChange={(e) => setEndTime(Number(e.target.value))}
            min={0}
            max={videoDuration}
            step={0.1}
          />
        </label>
      </div>

      <ButtonHandler
        videoRef={videoRef}
        processVideo={() => processVideo(startTime, endTime)}
        isProcessing={isProcessing}
      />

      {detectionResults.length > 0 && (
        <div>
          <button onClick={playResults} disabled={isPlaying}>
            Play
          </button>
          <button onClick={pauseResults} disabled={!isPlaying}>
            Pause
          </button>
          <input
            type="range"
            min={startTime}
            max={endTime}
            step={0.1}
            value={currentTime}
            onChange={handleSliderChange}
            style={{ width: "100%" }}
          />
        </div>
      )}

      <div>
        <label>
          Realtime Processing:
          <input
            type="checkbox"
            checked={isRealtimeMode}
            onChange={(e) => setIsRealtimeMode(e.target.checked)}
          />
        </label>
      </div>

      {!isProcessing && processingTime > 0 && (
        <div>
          <h3>
            {isRealtimeMode
              ? "Realtime Processing Results"
              : "Batch Processing Results"}
          </h3>
          <p>Total Processing Time: {processingTime.toFixed(2)} seconds</p>
          <p>Total Processed Frames: {processedFrames}</p>
          <p>
            One Frame CalcRate: {(processingTime / processedFrames).toFixed(4)}{" "}
            seconds
          </p>
        </div>
      )}

      {!isRealtimeMode && !isProcessing && realtimeStats.time > 0 && (
        <div>
          <h3>Previous Realtime Processing Results</h3>
          <p>Total Processing Time: {realtimeStats.time.toFixed(2)} seconds</p>
          <p>Total Processed Frames: {realtimeStats.frames}</p>
          <p>
            One Frame CalcRate:{" "}
            {(realtimeStats.time / realtimeStats.frames).toFixed(4)} seconds
          </p>
        </div>
      )}
    </div>
  );
};

export default App;
