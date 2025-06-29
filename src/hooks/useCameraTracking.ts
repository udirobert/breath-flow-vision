import { useState, useEffect, useRef, useCallback } from "react";
import * as faceapi from "face-api.js";

export type TrackingStatus =
  | "INITIALIZING"
  | "REQUESTING_CAMERA"
  | "TRACKING"
  | "NO_FACE"
  | "IDLE"
  | "ERROR";

type UseCameraTrackingProps = {
  videoRef: React.RefObject<HTMLVideoElement>;
  isTracking: boolean;
};

export type Keypoint = {
  x: number;
  y: number;
  z?: number;
  name?: string;
};

interface Point2D {
  x: number;
  y: number;
}

interface MovementData {
  timestamp: number;
  center: Point2D;
  jitter: number;
}

const euclidianDistance = (p1: Point2D, p2: Point2D) => {
  if (!p1 || !p2) return 0;
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

const calculateCenterOfMass = (points: Point2D[]): Point2D => {
  if (points.length === 0) return { x: 0, y: 0 };

  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );

  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
};

const getStableReferencePoints = (
  landmarks: faceapi.FaceLandmarks68,
): Point2D[] => {
  // Use multiple stable facial landmarks for better tracking
  const positions = landmarks.positions;

  // Nose bridge (more stable than nose tip)
  const noseBridge = positions.slice(27, 31);

  // Inner eye corners (very stable)
  const leftEyeInner = positions[39];
  const rightEyeInner = positions[42];

  // Mouth corners (reasonably stable)
  const leftMouth = positions[48];
  const rightMouth = positions[54];

  return [
    ...noseBridge.map((p) => ({ x: p.x, y: p.y })),
    { x: leftEyeInner.x, y: leftEyeInner.y },
    { x: rightEyeInner.x, y: rightEyeInner.y },
    { x: leftMouth.x, y: leftMouth.y },
    { x: rightMouth.x, y: rightMouth.y },
  ];
};

export const useCameraTracking = ({
  videoRef,
  isTracking,
}: UseCameraTrackingProps) => {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [restlessnessScore, setRestlessnessScore] = useState(0);
  const [landmarks, setLandmarks] = useState<Keypoint[]>([]);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>("IDLE");

  const requestRef = useRef<number>();
  const movementHistory = useRef<MovementData[]>([]);
  const detectionFailureCount = useRef(0);
  const lastDetectionTime = useRef<number>(0);

  // Configuration
  const HISTORY_WINDOW = 30; // Keep last 30 measurements
  const MAX_DETECTION_FAILURES = 5;
  const DETECTION_TIMEOUT = 2000; // 2 seconds

  const loadModels = useCallback(async () => {
    try {
      // Try multiple model loading strategies with different CDN sources
      const MODEL_STRATEGIES = [
        {
          name: "JSDelivr CDN",
          url: "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model",
        },
        {
          name: "UNPKG CDN",
          url: "https://unpkg.com/@vladmandic/face-api@latest/model",
        },
        {
          name: "Local models",
          url: "/models",
        },
      ];

      let modelsLoadedSuccessfully = false;

      for (const strategy of MODEL_STRATEGIES) {
        try {
          // Load only essential models for face detection and landmarks
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(strategy.url),
            faceapi.nets.faceLandmark68Net.loadFromUri(strategy.url),
          ]);

          modelsLoadedSuccessfully = true;
          break;
        } catch (error) {
          continue;
        }
      }

      if (!modelsLoadedSuccessfully) {
        // Try minimal setup with just face detection
        try {
          await faceapi.nets.tinyFaceDetector.loadFromUri(
            "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model",
          );
          modelsLoadedSuccessfully = true;
        } catch (error) {
          throw new Error(
            "Failed to load face detection models from all sources",
          );
        }
      }

      setModelsLoaded(true);
    } catch (error) {
      console.error("Critical error loading face detection models:", error);
      setTrackingStatus("ERROR");
    }
  }, []);

  const calculateRestlessness = useCallback(
    (
      detection:
        | faceapi.WithFaceLandmarks<
            { detection: faceapi.FaceDetection },
            faceapi.FaceLandmarks68
          >
        | faceapi.FaceDetection
        | null,
    ) => {
      const now = Date.now();

      if (!detection) {
        detectionFailureCount.current++;

        if (
          detectionFailureCount.current > MAX_DETECTION_FAILURES ||
          now - lastDetectionTime.current > DETECTION_TIMEOUT
        ) {
          setTrackingStatus("NO_FACE");
          setLandmarks([]);
          movementHistory.current = [];
          return;
        }
        return;
      }

      // Reset failure count on successful detection
      detectionFailureCount.current = 0;
      lastDetectionTime.current = now;
      setTrackingStatus("TRACKING");

      // Convert landmarks to our format (handle case where landmarks might not be available)
      let newLandmarks: Keypoint[] = [];
      let currentCenter: Point2D;

      // Type guard to check if detection has landmarks
      if ("landmarks" in detection && detection.landmarks) {
        newLandmarks = detection.landmarks.positions.map((p) => ({
          x: p.x,
          y: p.y,
        }));

        setLandmarks(newLandmarks);

        // Get stable reference points for movement calculation
        const stablePoints = getStableReferencePoints(detection.landmarks);
        currentCenter = calculateCenterOfMass(stablePoints);
      } else {
        // Fallback to bounding box center if no landmarks
        let box;
        if ("detection" in detection && detection.detection) {
          box = detection.detection.box;
        } else if ("box" in detection) {
          box = detection.box;
        } else {
          // Last fallback - extract box property directly
          box = (detection as unknown as { box: faceapi.Box }).box;
        }

        currentCenter = {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
        };
        setLandmarks([]);
      }

      // Calculate movement if we have previous data
      let jitter = 0;
      if (movementHistory.current.length > 0) {
        const lastData =
          movementHistory.current[movementHistory.current.length - 1];
        jitter = euclidianDistance(currentCenter, lastData.center);
      }

      // Add to movement history
      movementHistory.current.push({
        timestamp: now,
        center: currentCenter,
        jitter,
      });

      // Keep only recent history
      if (movementHistory.current.length > HISTORY_WINDOW) {
        movementHistory.current =
          movementHistory.current.slice(-HISTORY_WINDOW);
      }

      // Calculate restlessness score based on movement patterns
      if (movementHistory.current.length >= 5) {
        const recentHistory = movementHistory.current.slice(-10); // Last 10 measurements

        // Calculate different movement metrics
        const averageJitter =
          recentHistory.reduce((sum, data) => sum + data.jitter, 0) /
          recentHistory.length;
        const maxJitter = Math.max(...recentHistory.map((data) => data.jitter));

        // Calculate movement velocity (change in position over time)
        const velocityJitter =
          recentHistory.length > 1
            ? recentHistory
                .slice(1)
                .map((data, i) => {
                  const timeDiff = data.timestamp - recentHistory[i].timestamp;
                  return timeDiff > 0 ? (data.jitter / timeDiff) * 1000 : 0; // pixels per second
                })
                .reduce((sum, vel) => sum + vel, 0) /
              (recentHistory.length - 1)
            : 0;

        // Calculate movement consistency (lower is more restless)
        const jitterVariance =
          recentHistory.length > 1
            ? recentHistory.reduce(
                (sum, data) => sum + Math.pow(data.jitter - averageJitter, 2),
                0,
              ) / recentHistory.length
            : 0;

        // Combine metrics into a restlessness score (0-100)
        const baseScore = Math.min(100, averageJitter * 2); // Base movement
        const velocityScore = Math.min(30, velocityJitter * 0.5); // Movement speed
        const consistencyScore = Math.min(20, Math.sqrt(jitterVariance) * 0.5); // Movement inconsistency

        const combinedScore = Math.min(
          100,
          baseScore + velocityScore + consistencyScore,
        );

        // Apply smoothing to avoid jittery score updates
        const smoothingFactor = 0.3;
        const smoothedScore =
          restlessnessScore * (1 - smoothingFactor) +
          combinedScore * smoothingFactor;

        setRestlessnessScore(Math.round(smoothedScore));
      }
    },
    [restlessnessScore],
  );

  const detectionLoop = useCallback(async () => {
    // Check if we should continue detection
    if (!isTracking) {
      return;
    }

    if (!videoRef.current) {
      if (isTracking) {
        requestRef.current = window.setTimeout(detectionLoop, 500);
      }
      return;
    }

    if (videoRef.current.readyState < 2) {
      if (isTracking) {
        requestRef.current = window.setTimeout(detectionLoop, 500);
      }
      return;
    }

    if (!videoRef.current.srcObject) {
      if (isTracking) {
        requestRef.current = window.setTimeout(detectionLoop, 1000);
      }
      return;
    }

    try {
      // Try detection with landmarks first, fallback to simple detection
      let detection;
      try {
        detection = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 320,
              scoreThreshold: 0.5,
            }),
          )
          .withFaceLandmarks();
      } catch (landmarkError) {
        // Fallback to detection only
        detection = await faceapi.detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5,
          }),
        );
      }

      if (detection) {
        setTrackingStatus("TRACKING");
        detectionFailureCount.current = 0;

        // Handle landmarks if available
        if ("landmarks" in detection && detection.landmarks) {
          const newLandmarks = detection.landmarks.positions.map((p) => ({
            x: p.x,
            y: p.y,
          }));

          setLandmarks(newLandmarks);
          calculateRestlessness(detection);
        } else {
          setLandmarks([]);
          calculateRestlessness(detection);
        }
      } else {
        detectionFailureCount.current++;
        if (detectionFailureCount.current > 5) {
          setTrackingStatus("NO_FACE");
        }
      }
    } catch (error) {
      console.warn("Detection error:", error);
      detectionFailureCount.current++;
      if (detectionFailureCount.current > 10) {
        setTrackingStatus("ERROR");
        return;
      }
    }

    // Continue detection loop if tracking is still active
    if (isTracking) {
      requestRef.current = window.setTimeout(detectionLoop, 500);
    }
  }, [videoRef, isTracking, calculateRestlessness]);

  // Camera initialization function (to be called by user interaction)
  const initializeCamera = useCallback(async () => {
    if (!videoRef.current) {
      throw new Error("Video element not available");
    }

    if (videoRef.current.srcObject) {
      return;
    }

    setTrackingStatus("REQUESTING_CAMERA");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        setTrackingStatus("INITIALIZING");

        // Wait for video to be ready
        const onMetadataLoaded = () => {
          video.play().catch(console.error);

          // Detection will be started by the useEffect that watches isTracking
          // No need to call detectionLoop directly here
        };

        video.onloadedmetadata = onMetadataLoaded;

        // Fallback - try to play after a delay
        setTimeout(() => {
          if (video && video.readyState === 0) {
            video.play().catch(console.error);
          }
        }, 500);
      }
    } catch (error) {
      console.error("Camera access error:", error);
      setTrackingStatus("ERROR");
    }
  }, [videoRef, isTracking, modelsLoaded]);

  // Load models on mount
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Effect to handle tracking state changes
  useEffect(() => {
    if (!isTracking) {
      if (requestRef.current) {
        clearTimeout(requestRef.current);
        requestRef.current = undefined;
      }
      // Don't immediately clear video stream - only stop detection loop
      // This preserves the camera stream during session transitions
    } else if (isTracking && modelsLoaded && videoRef.current?.srcObject) {
      // Start/resume detection when tracking is enabled and camera is ready
      // Small delay to ensure video is ready
      setTimeout(() => {
        if (isTracking && videoRef.current?.srcObject) {
          detectionLoop();
        }
      }, 100);
    }
  }, [isTracking, modelsLoaded, detectionLoop]);

  // Cleanup camera stream when component unmounts
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video?.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [videoRef]);

  // Camera cleanup function
  const cleanup = useCallback(() => {
    if (requestRef.current) {
      clearTimeout(requestRef.current);
    }

    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      videoRef.current.srcObject = null;
    }

    setTrackingStatus("IDLE");
    setLandmarks([]);
    setRestlessnessScore(0);
    movementHistory.current = [];
    detectionFailureCount.current = 0;
  }, [videoRef]);

  return {
    restlessnessScore,
    landmarks,
    trackingStatus,
    isModelsLoaded: modelsLoaded,
    initializeCamera,
    cleanup,
  };
};
