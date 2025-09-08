import { useRef, useEffect } from 'react';
import type { Landmark } from '../services/MediaPipeService';

interface LandmarkVisualizerProps {
  image: Blob;
  landmarks: Landmark[];
  imageWidth: number;
  imageHeight: number;
  title: string;
}

export default function LandmarkVisualizer({
  image,
  landmarks,
  imageWidth,
  imageHeight,
  title
}: LandmarkVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    drawLandmarks();
  }, [image, landmarks, imageWidth, imageHeight]);

  const drawLandmarks = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load and draw the original image
    const img = new Image();
    const imageUrl = URL.createObjectURL(image);

    img.onload = () => {
      URL.revokeObjectURL(imageUrl);
      
      // Set canvas size to match image
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      
      // Draw the original image
      ctx.drawImage(img, 0, 0, imageWidth, imageHeight);
      
      // Draw pose landmarks and connections
      drawPoseConnections(ctx, landmarks, imageWidth, imageHeight);
      drawPoseLandmarks(ctx, landmarks, imageWidth, imageHeight);
    };

    img.src = imageUrl;
  };

  const drawPoseLandmarks = (
    ctx: CanvasRenderingContext2D,
    landmarks: Landmark[],
    width: number,
    height: number
  ) => {
    landmarks.forEach((landmark, index) => {
      if (landmark.visibility > 0.5) {
        const x = landmark.x * width;
        const y = landmark.y * height;
        
        // Color code different body parts
        let color = '#00A99D'; // Default accent color
        
        if (index >= 0 && index <= 10) {
          color = '#FF5722'; // Face - red
        } else if (index >= 11 && index <= 16) {
          color = '#4CAF50'; // Arms - green  
        } else if (index >= 17 && index <= 22) {
          color = '#2196F3'; // Hands - blue
        } else if (index >= 23 && index <= 28) {
          color = '#FF9800'; // Legs - orange
        } else if (index >= 29 && index <= 32) {
          color = '#9C27B0'; // Feet - purple
        }

        // Draw landmark point
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw landmark number for key points
        if (isKeyLandmark(index)) {
          ctx.fillStyle = 'white';
          ctx.font = '12px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(index.toString(), x, y - 8);
        }
      }
    });
  };

  const drawPoseConnections = (
    ctx: CanvasRenderingContext2D,
    landmarks: Landmark[],
    width: number,
    height: number
  ) => {
    const connections = getPoseConnections();
    
    ctx.strokeStyle = 'rgba(0, 169, 157, 0.6)';
    ctx.lineWidth = 2;
    
    connections.forEach(([startIdx, endIdx]) => {
      const startLandmark = landmarks[startIdx];
      const endLandmark = landmarks[endIdx];
      
      if (startLandmark && endLandmark && 
          startLandmark.visibility > 0.5 && endLandmark.visibility > 0.5) {
        
        const startX = startLandmark.x * width;
        const startY = startLandmark.y * height;
        const endX = endLandmark.x * width;
        const endY = endLandmark.y * height;
        
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    });
  };

  const isKeyLandmark = (index: number): boolean => {
    const keyLandmarks = [0, 7, 8, 11, 12, 15, 16, 23, 24, 25, 26, 27, 28];
    return keyLandmarks.includes(index);
  };

  const getPoseConnections = (): [number, number][] => {
    return [
      // Face
      [0, 1], [1, 2], [2, 3], [3, 7],
      [0, 4], [4, 5], [5, 6], [6, 8],
      [9, 10],
      
      // Arms
      [11, 12], // shoulders
      [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], // left arm
      [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], // right arm
      
      // Body
      [11, 23], [12, 24], [23, 24], // torso
      
      // Legs  
      [23, 25], [25, 27], [27, 29], [29, 31], // left leg
      [24, 26], [26, 28], [28, 30], [30, 32], // right leg
    ];
  };

  return (
    <div className="landmark-visualizer">
      <h3>{title}</h3>
      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          className="landmark-canvas"
          style={{
            maxWidth: '100%',
            height: 'auto',
            border: '1px solid var(--color-border)',
            borderRadius: '8px'
          }}
        />
      </div>
      
      <div className="landmark-legend">
        <div className="legend-item">
          <span className="legend-color face"></span>
          <span>顔部 (0-10)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color arms"></span>
          <span>腕部 (11-16)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color hands"></span>
          <span>手部 (17-22)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color legs"></span>
          <span>脚部 (23-28)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color feet"></span>
          <span>足部 (29-32)</span>
        </div>
      </div>
    </div>
  );
}