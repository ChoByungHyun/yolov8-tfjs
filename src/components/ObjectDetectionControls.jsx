import React from "react";

const ObjectDetectionControls = ({
  detectObjects,
  trackObject,
  selectedFrame,
  setSelectedObject,
  selectedObject,
  isProcessing,
}) => {
  console.log("Selected Object:", selectedObject); // 디버깅을 위한 로그

  return (
    <div className="object-detection-controls">
      <button onClick={detectObjects} disabled={isProcessing}>
        Detect Objects
      </button>

      {selectedFrame && (
        <div>
          <h3>Detected Objects:</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {selectedFrame.objects.map((obj) => (
              <li
                key={obj.id}
                onClick={() => setSelectedObject(obj)}
                style={{
                  cursor: "pointer",
                  backgroundColor:
                    selectedObject && selectedObject.id === obj.id
                      ? "lightblue"
                      : "transparent",
                  padding: "5px",
                  margin: "5px 0",
                  border: "1px solid #ccc",
                  borderRadius: "3px",
                }}
              >
                {obj.class} (Score: {(obj.score * 100).toFixed(2)}%) - ID:{" "}
                {obj.id}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={trackObject} disabled={!selectedObject || isProcessing}>
        Track Selected Object
      </button>

      {selectedObject && (
        <p>
          Selected object: {selectedObject.class} (ID: {selectedObject.id})
        </p>
      )}
    </div>
  );
};

export default ObjectDetectionControls;
