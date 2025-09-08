import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
  presence: number;
}

export interface MediaPipeDetectionResult {
  landmarks: Landmark[];
  confidence: number;
  imageWidth: number;
  imageHeight: number;
}

class MediaPipeService {
  private poseLandmarker: PoseLandmarker | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initializeInternal();
    return this.initializationPromise;
  }

  private async initializeInternal(): Promise<void> {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU'
        },
        runningMode: 'IMAGE',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize MediaPipe:', error);
      throw error;
    }
  }

  async detectPose(imageBlob: Blob): Promise<MediaPipeDetectionResult> {
    if (!this.poseLandmarker || !this.isInitialized) {
      throw new Error('MediaPipe not initialized. Call initialize() first.');
    }

    try {
      // Convert blob to HTMLImageElement
      const imageElement = await this.blobToImage(imageBlob);
      
      // Detect pose landmarks
      const results = this.poseLandmarker.detect(imageElement);

      if (!results.landmarks || results.landmarks.length === 0) {
        throw new Error('No pose landmarks detected. Please ensure the person is visible and try again.');
      }

      // Extract the first pose (we're only processing one pose)
      const poseLandmarks = results.landmarks[0];
      
      // Calculate average confidence from visibility scores
      const confidenceScores = poseLandmarks
        .map(landmark => landmark.visibility || 0)
        .filter(score => score > 0);
      
      const averageConfidence = confidenceScores.length > 0
        ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
        : 0;

      // Convert landmarks to our format
      const landmarks: Landmark[] = poseLandmarks.map(landmark => ({
        x: landmark.x,
        y: landmark.y,
        z: landmark.z || 0,
        visibility: landmark.visibility || 0,
        presence: 1.0 // MediaPipe Tasks doesn't provide presence, default to 1.0
      }));

      return {
        landmarks,
        confidence: averageConfidence,
        imageWidth: imageElement.naturalWidth,
        imageHeight: imageElement.naturalHeight
      };
    } catch (error) {
      console.error('Pose detection failed:', error);
      throw error;
    }
  }

  private async blobToImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  // MediaPipe pose landmark indices (33 landmarks total)
  static readonly LANDMARK_INDICES = {
    // Face landmarks (0-10)
    NOSE: 0,
    LEFT_EYE_INNER: 1,
    LEFT_EYE: 2,
    LEFT_EYE_OUTER: 3,
    RIGHT_EYE_INNER: 4,
    RIGHT_EYE: 5,
    RIGHT_EYE_OUTER: 6,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    MOUTH_LEFT: 9,
    MOUTH_RIGHT: 10,

    // Upper body landmarks (11-16)
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,

    // Lower body landmarks (17-22)
    LEFT_PINKY: 17,
    RIGHT_PINKY: 18,
    LEFT_INDEX: 19,
    RIGHT_INDEX: 20,
    LEFT_THUMB: 21,
    RIGHT_THUMB: 22,

    // Hip and leg landmarks (23-32)
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
    LEFT_HEEL: 29,
    RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32
  };

  // Helper methods for landmark access
  getKeyLandmarks(landmarks: Landmark[]) {
    const indices = MediaPipeService.LANDMARK_INDICES;
    
    return {
      // Head landmarks
      nose: landmarks[indices.NOSE],
      leftEar: landmarks[indices.LEFT_EAR],
      rightEar: landmarks[indices.RIGHT_EAR],

      // Shoulder landmarks
      leftShoulder: landmarks[indices.LEFT_SHOULDER],
      rightShoulder: landmarks[indices.RIGHT_SHOULDER],

      // Hip landmarks
      leftHip: landmarks[indices.LEFT_HIP],
      rightHip: landmarks[indices.RIGHT_HIP],

      // Knee landmarks
      leftKnee: landmarks[indices.LEFT_KNEE],
      rightKnee: landmarks[indices.RIGHT_KNEE],

      // Ankle landmarks
      leftAnkle: landmarks[indices.LEFT_ANKLE],
      rightAnkle: landmarks[indices.RIGHT_ANKLE]
    };
  }

  dispose(): void {
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }
    this.isInitialized = false;
    this.initializationPromise = null;
  }
}

// Singleton instance
export const mediaPipeService = new MediaPipeService();