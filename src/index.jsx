import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style/index.css";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgpu";

async function setupTensorFlow() {
  // Check if WebGPU is available
  if (tf.findBackend("webgpu") && (await tf.backend("webgpu").checkCompute())) {
    try {
      await tf.setBackend("webgpu");
      console.log("Using WebGPU backend");
      return;
    } catch (error) {
      console.warn("Failed to initialize WebGPU:", error);
    }
  } else {
    console.warn("WebGPU is not available");
  }

  // If WebGPU is not available, try WebGL
  try {
    await tf.setBackend("webgl");
    console.log("Using WebGL backend");
    return;
  } catch (error) {
    console.warn("Failed to initialize WebGL:", error);
  }

  // If WebGL is not available, try WASM
  try {
    await tf.setBackend("wasm");
    console.log("Using WASM backend");
    return;
  } catch (error) {
    console.warn("Failed to initialize WASM:", error);
  }

  // Fallback to CPU
  await tf.setBackend("cpu");
  console.log("Using CPU backend");
}

const root = createRoot(document.getElementById("root"));

setupTensorFlow().then(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
