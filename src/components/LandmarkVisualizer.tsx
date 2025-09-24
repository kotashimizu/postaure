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
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const img = new Image();
    const imageUrl = URL.createObjectURL(image);
    let isCancelled = false;

    img.onload = () => {
      if (isCancelled) {
        URL.revokeObjectURL(imageUrl);
        return;
      }

      canvas.width = imageWidth;
      canvas.height = imageHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, imageWidth, imageHeight);

      applyEdgeVignette(ctx, imageWidth, imageHeight);
      drawReferenceGuides(ctx, landmarks, imageWidth, imageHeight);
      drawPoseConnections(ctx, landmarks, imageWidth, imageHeight);
      drawPoseLandmarks(ctx, landmarks, imageWidth, imageHeight);

      URL.revokeObjectURL(imageUrl);
    };

    img.src = imageUrl;

    return () => {
      isCancelled = true;
      URL.revokeObjectURL(imageUrl);
    };
  }, [image, landmarks, imageWidth, imageHeight]);

  return (
    <div className="landmark-visualizer">
      <h3>{title}</h3>
      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          className="landmark-canvas"
          style={{
            maxWidth: '100%',
            height: 'auto'
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
        <div className="legend-item">
          <span className="legend-color guide"></span>
          <span>ガイドライン</span>
        </div>
      </div>
    </div>
  );
}

function applyEdgeVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.save();
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.25,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawPoseLandmarks(
  ctx: CanvasRenderingContext2D,
  poseLandmarks: Landmark[],
  width: number,
  height: number
) {
  ctx.save();
  ctx.font = '600 12px "Inter", Arial, sans-serif';
  ctx.textBaseline = 'middle';

  poseLandmarks.forEach((landmark, index) => {
    if (landmark.visibility > 0.5) {
      const x = landmark.x * width;
      const y = landmark.y * height;
      const color = getLandmarkColor(index);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (isKeyLandmark(index)) {
        drawLabel(ctx, x, y - 18, index.toString(), 'center');
      }
    }
  });

  ctx.restore();
}

function drawPoseConnections(
  ctx: CanvasRenderingContext2D,
  poseLandmarks: Landmark[],
  width: number,
  height: number
) {
  const connections = getPoseConnections();

  ctx.save();
  ctx.lineWidth = 4;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 10;

  connections.forEach(([startIdx, endIdx]) => {
    const startLandmark = poseLandmarks[startIdx];
    const endLandmark = poseLandmarks[endIdx];

    if (startLandmark?.visibility > 0.5 && endLandmark?.visibility > 0.5) {
      const startX = startLandmark.x * width;
      const startY = startLandmark.y * height;
      const endX = endLandmark.x * width;
      const endY = endLandmark.y * height;

      const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
      gradient.addColorStop(0, hexToRgba(getLandmarkColor(startIdx), 0.9));
      gradient.addColorStop(1, hexToRgba(getLandmarkColor(endIdx), 0.9));

      ctx.strokeStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  });

  ctx.restore();
}

function drawReferenceGuides(
  ctx: CanvasRenderingContext2D,
  poseLandmarks: Landmark[],
  width: number,
  height: number
) {
  ctx.save();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();

  const leftShoulder = poseLandmarks[11];
  const rightShoulder = poseLandmarks[12];
  const leftHip = poseLandmarks[23];
  const rightHip = poseLandmarks[24];

  if (leftShoulder?.visibility > 0.5 && rightShoulder?.visibility > 0.5) {
    const y = ((leftShoulder.y + rightShoulder.y) / 2) * height;
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.75)';
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    drawLabel(ctx, width - 24, y - 16, 'Shoulder Line', 'right');
  }

  if (leftHip?.visibility > 0.5 && rightHip?.visibility > 0.5) {
    const y = ((leftHip.y + rightHip.y) / 2) * height;
    ctx.strokeStyle = 'rgba(33, 150, 243, 0.75)';
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    drawLabel(ctx, width - 24, y + 16, 'Pelvic Line', 'right');
  }

  drawLabel(ctx, width / 2, 28, 'Center Line', 'center');

  ctx.restore();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  align: CanvasTextAlign = 'center'
) {
  ctx.save();
  ctx.font = '600 12px "Inter", Arial, sans-serif';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';

  const textWidth = ctx.measureText(text).width;
  const paddingX = 6;
  const paddingY = 4;
  const rectHeight = 16 + paddingY * 2;
  let rectX = x - textWidth / 2 - paddingX;

  if (align === 'left') {
    rectX = x - paddingX;
  } else if (align === 'right') {
    rectX = x - textWidth - paddingX;
  }

  const rectY = y - rectHeight / 2;
  const rectWidth = textWidth + paddingX * 2;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function isKeyLandmark(index: number): boolean {
  const keyLandmarks = [0, 7, 8, 11, 12, 15, 16, 23, 24, 25, 26, 27, 28];
  return keyLandmarks.includes(index);
}

function getLandmarkColor(index: number): string {
  if (index >= 0 && index <= 10) {
    return '#FF5722';
  }
  if (index >= 11 && index <= 16) {
    return '#4CAF50';
  }
  if (index >= 17 && index <= 22) {
    return '#2196F3';
  }
  if (index >= 23 && index <= 28) {
    return '#FF9800';
  }
  if (index >= 29 && index <= 32) {
    return '#9C27B0';
  }
  return '#00A99D';
}

function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '');
  const bigint = parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getPoseConnections(): [number, number][] {
  return [
    // Face
    [0, 1], [1, 2], [2, 3], [3, 7],
    [0, 4], [4, 5], [5, 6], [6, 8],
    [9, 10],

    // Arms
    [11, 12],
    [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],

    // Body
    [11, 23], [12, 24], [23, 24],

    // Legs
    [23, 25], [25, 27], [27, 29], [29, 31],
    [24, 26], [26, 28], [28, 30], [30, 32]
  ];
}
