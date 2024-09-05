import { useState, useRef } from "react";

/* eslint-disable */
const ButtonHandler = ({
  videoRef,
  processVideo,
  isProcessing,
  setIsProcessing,
  resetDetection,
}) => {
  const [streaming, setStreaming] = useState(null);
  const inputVideoRef = useRef(null);

  const closeVideo = () => {
    const url = videoRef.current.src;
    videoRef.current.src = "";
    URL.revokeObjectURL(url);
    setStreaming(null);
    inputVideoRef.current.value = "";
    setIsProcessing(false); // Stop processing
    resetDetection(); // Reset detection results and clear canvas
  };

  return (
    <div className="btn-container">
      <input
        type="file"
        accept="video/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const url = URL.createObjectURL(e.target.files[0]);
          videoRef.current.src = url;
          videoRef.current.style.display = "block";
          setStreaming("video");
          resetDetection(); // Reset detection when new video is loaded
        }}
        ref={inputVideoRef}
      />
      <button
        onClick={() => {
          if (streaming === null) inputVideoRef.current.click();
          else if (streaming === "video") closeVideo();
        }}
      >
        {streaming === "video" ? "Close" : "Open"} Video
      </button>
      <button
        onClick={processVideo}
        disabled={isProcessing || streaming !== "video"}
      >
        {isProcessing ? "Processing..." : "Process Video"}
      </button>
    </div>
  );
};

export default ButtonHandler;
