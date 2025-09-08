import type { Landmark, MediaPipeDetectionResult } from './MediaPipeService';
import { advancedKendallAnalysisService, type AdvancedKendallAnalysisResult } from './AdvancedKendallAnalysisService';

export interface JointAngle {
  name: string;
  angle: number;
  normal_range: [number, number];
  deviation: 'normal' | 'increased' | 'decreased';
}


export interface EnhancedPostureAnalysisResult {
  frontal: {
    detection: MediaPipeDetectionResult;
    jointAngles: JointAngle[];
    asymmetries: {
      shoulderLevel: number;
      pelvicLevel: number;
      headTilt: number;
      legLength: number;
    };
  };
  sagittal: {
    detection: MediaPipeDetectionResult;
    jointAngles: JointAngle[];
    alignment: {
      headPosition: number;
      shoulderPosition: number;
      pelvisPosition: number;
      kneePosition: number;
    };
  };
  kendallClassification: {
    category: string;
    confidence: number;
    characteristics: string[];
    recommendations: string[];
    severity: 'mild' | 'moderate' | 'severe';
  };
  advancedKendallAnalysis: AdvancedKendallAnalysisResult;
  timestamp: number;
}

class EnhancedPostureAnalysisService {
  private readonly NORMAL_RANGES = {
    cva: [52, 66] as [number, number], // Cranio-vertebral angle
    shoulderFlexion: [0, 180] as [number, number],
    hipFlexion: [0, 125] as [number, number],
    kneeFlexion: [0, 135] as [number, number],
    ankleFlexion: [-20, 45] as [number, number],
    pelvicTilt: [8, 15] as [number, number], // Anterior pelvic tilt
    lumbarLordosis: [20, 45] as [number, number],
    thoracicKyphosis: [25, 45] as [number, number]
  };

  async analyzePosture(
    frontalDetection: MediaPipeDetectionResult,
    sagittalDetection: MediaPipeDetectionResult
  ): Promise<EnhancedPostureAnalysisResult> {
    
    // Analyze frontal plane
    const frontalAnalysis = this.analyzeFrontalPlane(frontalDetection);
    
    // Analyze sagittal plane
    const sagittalAnalysis = this.analyzeSagittalPlane(sagittalDetection);
    
    // Perform comprehensive Kendall classification
    const kendallClassification = this.performKendallClassification(
      frontalAnalysis,
      sagittalAnalysis
    );

    // Perform advanced Kendall analysis
    const advancedKendallAnalysis = await advancedKendallAnalysisService.analyzeAdvancedPosture(
      frontalDetection,
      sagittalDetection
    );

    return {
      frontal: frontalAnalysis,
      sagittal: sagittalAnalysis,
      kendallClassification,
      advancedKendallAnalysis,
      timestamp: Date.now()
    };
  }

  private analyzeFrontalPlane(detection: MediaPipeDetectionResult) {
    const { landmarks, imageWidth, imageHeight } = detection;
    
    // Calculate key joint angles
    const jointAngles = this.calculateFrontalJointAngles(landmarks, imageWidth, imageHeight);
    
    // Calculate asymmetries
    const asymmetries = {
      shoulderLevel: this.calculateShoulderLevelDifference(landmarks, imageHeight),
      pelvicLevel: this.calculatePelvicLevelDifference(landmarks, imageHeight),
      headTilt: this.calculateHeadTilt(landmarks, imageWidth, imageHeight),
      legLength: this.calculateLegLengthDifference(landmarks, imageHeight)
    };

    return {
      detection,
      jointAngles,
      asymmetries
    };
  }

  private analyzeSagittalPlane(detection: MediaPipeDetectionResult) {
    const { landmarks, imageWidth, imageHeight } = detection;
    
    // Calculate key joint angles
    const jointAngles = this.calculateSagittalJointAngles(landmarks, imageWidth, imageHeight);
    
    // Calculate alignment positions
    const alignment = {
      headPosition: this.calculateHeadAlignment(landmarks, imageWidth),
      shoulderPosition: this.calculateShoulderAlignment(landmarks, imageWidth),
      pelvisPosition: this.calculatePelvisAlignment(landmarks, imageWidth),
      kneePosition: this.calculateKneeAlignment(landmarks, imageWidth)
    };

    return {
      detection,
      jointAngles,
      alignment
    };
  }

  private calculateFrontalJointAngles(landmarks: Landmark[], width: number, height: number): JointAngle[] {
    const angles: JointAngle[] = [];
    
    // Shoulder angle (slope)
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    if (leftShoulder.visibility > 0.5 && rightShoulder.visibility > 0.5) {
      const shoulderAngle = this.calculateAngleBetweenPoints(
        { x: leftShoulder.x * width, y: leftShoulder.y * height },
        { x: rightShoulder.x * width, y: rightShoulder.y * height },
        { x: rightShoulder.x * width + 100, y: rightShoulder.y * height } // horizontal reference
      );
      
      angles.push({
        name: 'Shoulder Level',
        angle: shoulderAngle,
        normal_range: [-5, 5],
        deviation: Math.abs(shoulderAngle) > 5 ? 'increased' : 'normal'
      });
    }

    // Pelvic angle (slope)
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    if (leftHip.visibility > 0.5 && rightHip.visibility > 0.5) {
      const pelvicAngle = this.calculateAngleBetweenPoints(
        { x: leftHip.x * width, y: leftHip.y * height },
        { x: rightHip.x * width, y: rightHip.y * height },
        { x: rightHip.x * width + 100, y: rightHip.y * height }
      );
      
      angles.push({
        name: 'Pelvic Level',
        angle: pelvicAngle,
        normal_range: [-3, 3],
        deviation: Math.abs(pelvicAngle) > 3 ? 'increased' : 'normal'
      });
    }

    return angles;
  }

  private calculateSagittalJointAngles(landmarks: Landmark[], width: number, height: number): JointAngle[] {
    const angles: JointAngle[] = [];

    // CVA (Cranio-vertebral angle)
    const ear = landmarks[7].visibility > landmarks[8].visibility ? landmarks[7] : landmarks[8];
    const shoulder = landmarks[11].visibility > landmarks[12].visibility ? landmarks[11] : landmarks[12];
    
    if (ear.visibility > 0.5 && shoulder.visibility > 0.5) {
      const cva = this.calculateCVA(ear, shoulder, width, height);
      angles.push({
        name: 'Cranio-Vertebral Angle',
        angle: cva,
        normal_range: this.NORMAL_RANGES.cva,
        deviation: cva < this.NORMAL_RANGES.cva[0] ? 'decreased' : 
                   cva > this.NORMAL_RANGES.cva[1] ? 'increased' : 'normal'
      });
    }

    // Hip flexion angle
    const hip = landmarks[23].visibility > landmarks[24].visibility ? landmarks[23] : landmarks[24];
    const knee = landmarks[25].visibility > landmarks[26].visibility ? landmarks[25] : landmarks[26];
    const shoulder2 = landmarks[11].visibility > landmarks[12].visibility ? landmarks[11] : landmarks[12];
    
    if (hip.visibility > 0.5 && knee.visibility > 0.5 && shoulder2.visibility > 0.5) {
      const hipAngle = this.calculateAngleBetweenPoints(
        { x: shoulder2.x * width, y: shoulder2.y * height },
        { x: hip.x * width, y: hip.y * height },
        { x: knee.x * width, y: knee.y * height }
      );
      
      angles.push({
        name: 'Hip Angle',
        angle: 180 - hipAngle, // Convert to flexion angle
        normal_range: [170, 185],
        deviation: Math.abs(180 - hipAngle - 177.5) > 7.5 ? 'increased' : 'normal'
      });
    }

    // Knee angle
    const ankle = landmarks[27].visibility > landmarks[28].visibility ? landmarks[27] : landmarks[28];
    
    if (hip.visibility > 0.5 && knee.visibility > 0.5 && ankle.visibility > 0.5) {
      const kneeAngle = this.calculateAngleBetweenPoints(
        { x: hip.x * width, y: hip.y * height },
        { x: knee.x * width, y: knee.y * height },
        { x: ankle.x * width, y: ankle.y * height }
      );
      
      angles.push({
        name: 'Knee Angle',
        angle: kneeAngle,
        normal_range: [170, 185],
        deviation: kneeAngle < 170 ? 'decreased' : kneeAngle > 185 ? 'increased' : 'normal'
      });
    }

    return angles;
  }

  private calculateCVA(ear: Landmark, shoulder: Landmark, width: number, height: number): number {
    const earPoint = { x: ear.x * width, y: ear.y * height };
    const shoulderPoint = { x: shoulder.x * width, y: shoulder.y * height };
    const horizontalRef = { x: shoulderPoint.x + 100, y: shoulderPoint.y };
    
    return this.calculateAngleBetweenPoints(earPoint, shoulderPoint, horizontalRef);
  }

  private calculateAngleBetweenPoints(p1: {x: number, y: number}, p2: {x: number, y: number}, p3: {x: number, y: number}): number {
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    if (mag1 === 0 || mag2 === 0) return 0;
    
    const cos = dot / (mag1 * mag2);
    return Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
  }

  private calculateShoulderLevelDifference(landmarks: Landmark[], height: number): number {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    
    if (leftShoulder.visibility > 0.5 && rightShoulder.visibility > 0.5) {
      return Math.abs(leftShoulder.y - rightShoulder.y) * height;
    }
    return 0;
  }

  private calculatePelvicLevelDifference(landmarks: Landmark[], height: number): number {
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    
    if (leftHip.visibility > 0.5 && rightHip.visibility > 0.5) {
      return Math.abs(leftHip.y - rightHip.y) * height;
    }
    return 0;
  }

  private calculateHeadTilt(landmarks: Landmark[], width: number, height: number): number {
    const nose = landmarks[0];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];
    
    if (nose.visibility > 0.5 && leftEar.visibility > 0.5 && rightEar.visibility > 0.5) {
      const earMidpoint = {
        x: (leftEar.x + rightEar.x) / 2 * width,
        y: (leftEar.y + rightEar.y) / 2 * height
      };
      
      return Math.abs(nose.x * width - earMidpoint.x);
    }
    return 0;
  }

  private calculateLegLengthDifference(landmarks: Landmark[], height: number): number {
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    
    if (leftHip.visibility > 0.5 && rightHip.visibility > 0.5 && 
        leftAnkle.visibility > 0.5 && rightAnkle.visibility > 0.5) {
      
      const leftLegLength = Math.abs(leftHip.y - leftAnkle.y) * height;
      const rightLegLength = Math.abs(rightHip.y - rightAnkle.y) * height;
      
      return Math.abs(leftLegLength - rightLegLength);
    }
    return 0;
  }

  private calculateHeadAlignment(landmarks: Landmark[], width: number): number {
    const ear = landmarks[7].visibility > landmarks[8].visibility ? landmarks[7] : landmarks[8];
    const shoulder = landmarks[11].visibility > landmarks[12].visibility ? landmarks[11] : landmarks[12];
    
    if (ear.visibility > 0.5 && shoulder.visibility > 0.5) {
      return (ear.x - shoulder.x) * width;
    }
    return 0;
  }

  private calculateShoulderAlignment(landmarks: Landmark[], width: number): number {
    const shoulder = landmarks[11].visibility > landmarks[12].visibility ? landmarks[11] : landmarks[12];
    const hip = landmarks[23].visibility > landmarks[24].visibility ? landmarks[23] : landmarks[24];
    
    if (shoulder.visibility > 0.5 && hip.visibility > 0.5) {
      return (shoulder.x - hip.x) * width;
    }
    return 0;
  }

  private calculatePelvisAlignment(landmarks: Landmark[], width: number): number {
    const hip = landmarks[23].visibility > landmarks[24].visibility ? landmarks[23] : landmarks[24];
    const ankle = landmarks[27].visibility > landmarks[28].visibility ? landmarks[27] : landmarks[28];
    
    if (hip.visibility > 0.5 && ankle.visibility > 0.5) {
      return (hip.x - ankle.x) * width;
    }
    return 0;
  }

  private calculateKneeAlignment(landmarks: Landmark[], width: number): number {
    const knee = landmarks[25].visibility > landmarks[26].visibility ? landmarks[25] : landmarks[26];
    const ankle = landmarks[27].visibility > landmarks[28].visibility ? landmarks[27] : landmarks[28];
    
    if (knee.visibility > 0.5 && ankle.visibility > 0.5) {
      return (knee.x - ankle.x) * width;
    }
    return 0;
  }

  // Simplified legacy classification for backward compatibility
  private performKendallClassification(_frontalAnalysis: any, _sagittalAnalysis: any) {
    return {
      category: '詳細分析を参照',
      confidence: 0.95,
      characteristics: ['詳細Kendall分析結果をご確認ください'],
      recommendations: ['詳細分析に基づく推奨事項をご参照ください'],
      severity: 'mild' as const
    };
  }
}

export const enhancedPostureAnalysisService = new EnhancedPostureAnalysisService();