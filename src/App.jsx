import React, { useState, useEffect, useRef } from "react";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl"; // set backend to webgl
import Loader from "./components/loader";
import ButtonHandler from "./components/btn-handler";
import { detect, detectVideo } from "./utils/detect";
import "./style/App.css";

const App = () => {
  const [loading, setLoading] = useState({ loading: true, progress: 0 }); // loading state
  const [model, setModel] = useState({
    net: null,
    inputShape: [1, 0, 0, 3],
  }); // init model & input shape

  const [trajectories, setTrajectories] = useState([]);
  console.log("🚀 ~ App ~ trajectories:", trajectories);
  const [currentTime, setCurrentTime] = useState(0);
  const [isVideoEnded, setIsVideoEnded] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);

  // references
  const imageRef = useRef(null);
  const cameraRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // model configs
  const modelName = "yolov10n";

  useEffect(() => {
    tf.ready().then(async () => {
      const yolov8 = await tf.loadGraphModel(
        `${window.location.href}/${modelName}_web_model/model.json`,
        {
          onProgress: (fractions) => {
            setLoading({ loading: true, progress: fractions }); // set loading fractions
          },
        }
      ); // load model

      // warming up model
      const dummyInput = tf.ones(yolov8.inputs[0].shape);
      const warmupResults = yolov8.execute(dummyInput);

      setLoading({ loading: false, progress: 1 });
      setModel({
        net: yolov8,
        inputShape: yolov8.inputs[0].shape,
      }); // set model & input shape

      tf.dispose([warmupResults, dummyInput]); // cleanup memory
    });
  }, []);

  const updateTrajectories = (newPoints, time) => {
    setTrajectories((prev) => [...prev, { time, points: newPoints }]);
  };

  const resetDetection = () => {
    setTrajectories([]);
    setCurrentTime(0);
    setIsVideoEnded(false);
    setVideoDuration(0);
    canvasRef.current
      .getContext("2d")
      .clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const handleVideoLoad = (event) => {
    resetDetection();
    const duration = event.target.duration;
    if (!isNaN(duration) && isFinite(duration)) {
      setVideoDuration(duration);
    } else {
      setVideoDuration(0);
    }
    setTrajectories([]);
    setCurrentTime(0);
    setIsVideoEnded(false);
  };

  const handleVideoEnd = () => {
    setIsVideoEnded(true);
  };

  const handleTimeUpdate = (event) => {
    setCurrentTime(event.target.currentTime);
  };

  const handleSliderChange = (event) => {
    const time = parseFloat(event.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    renderTrajectories(time);
  };

  const renderTrajectories = (time) => {
    console.log("Rendering trajectories at time:", time);
    console.log("Trajectories:", trajectories);

    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    trajectories
      .filter((t) => t.time <= time)
      .forEach((frame) => {
        console.log("Drawing frame:", frame);
        frame.points.forEach((point) => {
          console.log("Drawing point:", point);
          ctx.fillStyle = point.color;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
          ctx.fill();
        });
      });

    const currentFrame = trajectories.find(
      (t) => Math.abs(t.time - time) < 0.1
    );
    if (currentFrame) {
      console.log("Drawing current frame boxes");
      renderBoxes(
        canvasRef.current,
        currentFrame.boxes,
        currentFrame.scores,
        currentFrame.classes,
        currentFrame.ratios,
        true
      );
    }
  };

  return (
    <div className="App">
      {loading.loading && (
        <Loader>Loading model... {(loading.progress * 100).toFixed(2)}%</Loader>
      )}
      <div className="header">
        <h1>📷 YOLOv10 Live Detection App</h1>
        <p>
          YOLOv8 live detection application on browser powered by{" "}
          <code>tensorflow.js</code>
        </p>
        <p>
          Serving : <code className="code">{modelName}</code>
        </p>
      </div>

      <div className="content">
        <img
          src="#"
          ref={imageRef}
          onLoad={() =>
            detect(
              imageRef.current,
              model,
              canvasRef.current,
              updateTrajectories
            )
          }
        />
        <video
          autoPlay
          muted
          ref={cameraRef}
          onPlay={() =>
            detectVideo(
              cameraRef.current,
              model,
              canvasRef.current,
              updateTrajectories
            )
          }
        />
        <video
          ref={videoRef}
          autoPlay
          onLoadedMetadata={handleVideoLoad}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnd}
          onPlay={() =>
            detectVideo(
              videoRef.current,
              model,
              canvasRef.current,
              updateTrajectories
            )
          }
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
        handleResetTrajectories={resetDetection}
        imageRef={imageRef}
        cameraRef={cameraRef}
        videoRef={videoRef}
      />
    </div>
  );
};

export default App;
