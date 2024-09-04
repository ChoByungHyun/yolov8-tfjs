import { useState, useRef } from "react";

const ButtonHandler = ({ videoRef, processVideo, isProcessing }) => {
  const [streaming, setStreaming] = useState(null);
  const inputVideoRef = useRef(null);

  const closeVideo = () => {
    const url = videoRef.current.src;
    videoRef.current.src = "";
    URL.revokeObjectURL(url);
    setStreaming(null);
    inputVideoRef.current.value = "";
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
