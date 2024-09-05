// KalmanFilter.js
import { KalmanFilter } from "kalman-filter";

export function createObjectTracker(initialState, options = {}) {
  const kf = KalmanFilter({
    observation: {
      dimension: 2,
      stateProjection: [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
      ],
    },
    dynamic: {
      dimension: 4,
      transition: [
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
    },
  });

  let state = {
    mean: [initialState.x, initialState.y, 0, 0],
    covariance: [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1000, 0],
      [0, 0, 0, 1000],
    ],
  };

  let lastUpdateTime = initialState.time;
  let missedFrames = 0;
  const maxMissedFrames = options.maxMissedFrames || 10;

  return {
    id: initialState.id,
    class: initialState.class,

    predict(currentTime) {
      const dt = currentTime - lastUpdateTime;
      state = kf.predict({
        previousCorrected: state,
        timeDelta: dt,
      });
      return { x: state.mean[0], y: state.mean[1] };
    },

    update(measurement, currentTime) {
      state = kf.correct({
        predicted: state,
        observation: [measurement.x, measurement.y],
      });
      lastUpdateTime = currentTime;
      missedFrames = 0;
      return { x: state.mean[0], y: state.mean[1] };
    },

    incrementMissedFrames() {
      missedFrames++;
      return missedFrames <= maxMissedFrames;
    },
  };
}
