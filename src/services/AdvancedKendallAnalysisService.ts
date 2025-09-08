import type { Landmark, MediaPipeDetectionResult } from './MediaPipeService';

// Kendall本院の詳細な姿勢分析システム
// 「Posture and Pain」(Kendall, McCreary, Provance, 2005) に基づく実装

export interface DetailedPostureMetrics {
  // 頭頸部アライメント
  headPosture: {
    cva: number; // Cranio-vertebral angle (52-66°が正常)
    headTranslation: number; // 前方頭位の程度 (mm)
    suboccipitalCompression: 'normal' | 'mild' | 'moderate' | 'severe';
    upperCervicalExtension: number; // 上位頸椎伸展角度
    lowerCervicalFlexion: number; // 下位頸椎屈曲角度
  };

  // 肩甲胸郭関節
  shoulderGirdle: {
    shoulderElevation: { left: number; right: number }; // 肩甲骨挙上
    shoulderProtraction: { left: number; right: number }; // 肩甲骨前突
    shoulderRotation: { left: 'internal' | 'external' | 'neutral'; right: 'internal' | 'external' | 'neutral' };
    scapularWinging: { left: 'none' | 'mild' | 'moderate' | 'severe'; right: 'none' | 'mild' | 'moderate' | 'severe' };
    thoracicOutletCompression: 'negative' | 'positive';
  };

  // 脊柱カーブ
  spinalCurvature: {
    cervicalLordosis: number; // 頸椎前弯 (20-40°)
    thoracicKyphosis: number; // 胸椎後弯 (25-45°)
    lumbarLordosis: number; // 腰椎前弯 (30-50°)
    lateralDeviation: number; // 側弯度合い
    spinalBalance: 'balanced' | 'forward' | 'backward';
  };

  // 骨盤アライメント
  pelvis: {
    pelvicTilt: number; // 骨盤傾斜角 (前傾8-15°が正常)
    pelvicRotation: number; // 骨盤回旋
    pelvicShift: { lateral: number; anteroposterior: number };
    iliacCrestLevel: 'level' | 'left_high' | 'right_high';
    sacralAngle: number; // 仙骨角度
  };

  // 下肢アライメント
  lowerExtremity: {
    hipFlexion: { left: number; right: number };
    kneePosition: { left: 'normal' | 'hyperextended' | 'flexed'; right: 'normal' | 'hyperextended' | 'flexed' };
    anklePosition: { left: 'neutral' | 'plantarflexed' | 'dorsiflexed'; right: 'neutral' | 'plantarflexed' | 'dorsiflexed' };
    legLengthDiscrepancy: number; // 脚長差 (mm)
    genu: 'normal' | 'valgum' | 'varum'; // 膝内反・外反
  };
}

export interface KendallPostureType {
  classification: string;
  subtype?: string;
  description: string;
  musculoskeletalImplications: string[];
  compensatoryPatterns: string[];
  clinicalSymptoms: string[];
  exerciseRecommendations: {
    stretching: string[];
    strengthening: string[];
    postural: string[];
  };
  ergonomicConsiderations: string[];
  prognosis: 'excellent' | 'good' | 'fair' | 'guarded';
  severity: 'mild' | 'moderate' | 'severe';
  confidence: number;
}

export interface AdvancedKendallAnalysisResult {
  metrics: DetailedPostureMetrics;
  postureTypes: KendallPostureType[];
  primaryDysfunction: string;
  compensatoryChain: string[];
  riskFactors: string[];
  functionalLimitations: string[];
  timestamp: number;
}

class AdvancedKendallAnalysisService {
  // Kendall基準値（文献ベース）
  private readonly KENDALL_NORMS = {
    cva: { optimal: 59, range: [52, 66] },
    cervicalLordosis: { optimal: 30, range: [20, 40] },
    thoracicKyphosis: { optimal: 35, range: [25, 45] },
    lumbarLordosis: { optimal: 40, range: [30, 50] },
    pelvicTilt: { optimal: 11, range: [8, 15] },
    shoulderLevel: { maxDifference: 5 }, // mm
    pelvicLevel: { maxDifference: 3 }, // mm
    headTranslation: { maxForward: 15 }, // mm
    legLength: { maxDifference: 6 } // mm
  };

  async analyzeAdvancedPosture(
    frontalDetection: MediaPipeDetectionResult,
    sagittalDetection: MediaPipeDetectionResult
  ): Promise<AdvancedKendallAnalysisResult> {
    
    // 詳細メトリクス計算
    const metrics = this.calculateDetailedMetrics(frontalDetection, sagittalDetection);
    
    // Kendall分類実行
    const postureTypes = this.performAdvancedKendallClassification(metrics);
    
    // 一次機能不全と代償パターンを特定
    const primaryDysfunction = this.identifyPrimaryDysfunction(metrics, postureTypes);
    const compensatoryChain = this.analyzeCompensatoryChain(metrics);
    
    // リスク要因と機能制限を評価
    const riskFactors = this.assessRiskFactors(metrics, postureTypes);
    const functionalLimitations = this.evaluateFunctionalLimitations(metrics);

    return {
      metrics,
      postureTypes,
      primaryDysfunction,
      compensatoryChain,
      riskFactors,
      functionalLimitations,
      timestamp: Date.now()
    };
  }

  private calculateDetailedMetrics(
    frontalDetection: MediaPipeDetectionResult,
    sagittalDetection: MediaPipeDetectionResult
  ): DetailedPostureMetrics {
    
    const frontalLandmarks = frontalDetection.landmarks;
    const sagittalLandmarks = sagittalDetection.landmarks;
    
    return {
      headPosture: this.analyzeHeadPosture(sagittalLandmarks, sagittalDetection.imageWidth, sagittalDetection.imageHeight),
      shoulderGirdle: this.analyzeShoulderGirdle(frontalLandmarks, sagittalLandmarks, frontalDetection.imageWidth, frontalDetection.imageHeight),
      spinalCurvature: this.analyzeSpinalCurvature(sagittalLandmarks, sagittalDetection.imageWidth, sagittalDetection.imageHeight),
      pelvis: this.analyzePelvis(frontalLandmarks, sagittalLandmarks, frontalDetection.imageWidth, frontalDetection.imageHeight),
      lowerExtremity: this.analyzeLowerExtremity(frontalLandmarks, sagittalLandmarks, frontalDetection.imageWidth, frontalDetection.imageHeight)
    };
  }

  private analyzeHeadPosture(landmarks: Landmark[], width: number, height: number) {
    const ear = landmarks[7].visibility > landmarks[8].visibility ? landmarks[7] : landmarks[8];
    const shoulder = landmarks[11].visibility > landmarks[12].visibility ? landmarks[11] : landmarks[12];
    
    // CVA計算
    const cva = this.calculateCVA(ear, shoulder, width, height);
    
    // 頭部前方移動距離
    const headTranslation = this.calculateHeadTranslation(ear, shoulder, width);
    
    // 後頭下筋群圧迫度評価
    const suboccipitalCompression = this.evaluateSuboccipitalCompression(cva, headTranslation);
    
    // 頸椎分節別角度（近似）
    const upperCervicalExtension = Math.max(0, 90 - cva); // 上位頸椎の代償的伸展
    const lowerCervicalFlexion = Math.max(0, cva - 45); // 下位頸椎の代償的屈曲

    return {
      cva,
      headTranslation,
      suboccipitalCompression,
      upperCervicalExtension,
      lowerCervicalFlexion
    };
  }

  private analyzeShoulderGirdle(frontalLandmarks: Landmark[], sagittalLandmarks: Landmark[], width: number, height: number) {
    const leftShoulder = frontalLandmarks[11];
    const rightShoulder = frontalLandmarks[12];
    
    // 肩甲骨挙上差
    const shoulderElevation = {
      left: (leftShoulder.y - rightShoulder.y) * height,
      right: (rightShoulder.y - leftShoulder.y) * height
    };
    
    // 肩甲骨前突（矢状面から推定）
    const sagittalShoulder = sagittalLandmarks[11].visibility > sagittalLandmarks[12].visibility 
      ? sagittalLandmarks[11] : sagittalLandmarks[12];
    const shoulderProtraction = {
      left: this.estimateProtraction(sagittalShoulder, width),
      right: this.estimateProtraction(sagittalShoulder, width)
    };
    
    // 肩関節内旋・外旋（肘と手首の位置関係から推定）
    const shoulderRotation = this.evaluateShoulderRotation(frontalLandmarks);
    
    // 肩甲骨翼状（推定）
    const scapularWinging = this.evaluateScapularWinging(shoulderProtraction);
    
    // 胸郭出口症候群リスク評価
    const thoracicOutletCompression = this.evaluateThoracicOutletRisk(shoulderElevation, shoulderProtraction);

    return {
      shoulderElevation,
      shoulderProtraction,
      shoulderRotation,
      scapularWinging,
      thoracicOutletCompression
    };
  }

  private analyzeSpinalCurvature(landmarks: Landmark[], width: number, height: number) {
    const ear = landmarks[7].visibility > landmarks[8].visibility ? landmarks[7] : landmarks[8];
    const shoulder = landmarks[11].visibility > landmarks[12].visibility ? landmarks[11] : landmarks[12];
    const hip = landmarks[23].visibility > landmarks[24].visibility ? landmarks[23] : landmarks[24];
    
    // 脊柱カーブ推定（簡略化）
    const cervicalLordosis = this.estimateCervicalLordosis(ear, shoulder, width, height);
    const thoracicKyphosis = this.estimateThoracicKyphosis(shoulder, hip, width, height);
    const lumbarLordosis = this.estimateLumbarLordosis(hip, landmarks, width, height);
    
    // 側方偏位
    const lateralDeviation = this.calculateLateralDeviation(landmarks, width);
    
    // 脊柱バランス
    const spinalBalance = this.evaluateSpinalBalance(ear, hip, width);

    return {
      cervicalLordosis,
      thoracicKyphosis,
      lumbarLordosis,
      lateralDeviation,
      spinalBalance
    };
  }

  private analyzePelvis(frontalLandmarks: Landmark[], sagittalLandmarks: Landmark[], width: number, height: number) {
    const leftHip = frontalLandmarks[23];
    const rightHip = frontalLandmarks[24];
    const sagittalHip = sagittalLandmarks[23].visibility > sagittalLandmarks[24].visibility 
      ? sagittalLandmarks[23] : sagittalLandmarks[24];
    
    // 骨盤傾斜角
    const pelvicTilt = this.calculatePelvicTilt(sagittalHip, sagittalLandmarks, width, height);
    
    // 骨盤回旋
    const pelvicRotation = this.calculatePelvicRotation(leftHip, rightHip, width);
    
    // 骨盤シフト
    const pelvicShift = this.calculatePelvicShift(sagittalHip, frontalLandmarks, width, height);
    
    // 腸骨稜レベル
    const iliacCrestLevel = this.evaluateIliacCrestLevel(leftHip, rightHip, height);
    
    // 仙骨角度（推定）
    const sacralAngle = this.estimateSacralAngle(pelvicTilt);

    return {
      pelvicTilt,
      pelvicRotation,
      pelvicShift,
      iliacCrestLevel,
      sacralAngle
    };
  }

  private analyzeLowerExtremity(frontalLandmarks: Landmark[], sagittalLandmarks: Landmark[], width: number, height: number) {
    const leftHip = frontalLandmarks[23];
    const rightHip = frontalLandmarks[24];
    const leftKnee = frontalLandmarks[25];
    const rightKnee = frontalLandmarks[26];
    const leftAnkle = frontalLandmarks[27];
    const rightAnkle = frontalLandmarks[28];
    
    // 股関節屈曲角度
    const hipFlexion = {
      left: this.calculateHipFlexion(sagittalLandmarks[23], sagittalLandmarks[25]),
      right: this.calculateHipFlexion(sagittalLandmarks[24], sagittalLandmarks[26])
    };
    
    // 膝関節位置
    const kneePosition = {
      left: this.evaluateKneePosition(leftHip, leftKnee, leftAnkle),
      right: this.evaluateKneePosition(rightHip, rightKnee, rightAnkle)
    };
    
    // 足関節位置
    const anklePosition = {
      left: this.evaluateAnklePosition(leftKnee, leftAnkle),
      right: this.evaluateAnklePosition(rightKnee, rightAnkle)
    };
    
    // 脚長差
    const legLengthDiscrepancy = this.calculateLegLengthDiscrepancy(leftHip, rightHip, leftAnkle, rightAnkle, height);
    
    // 膝内反・外反
    const genu = this.evaluateGenu(leftKnee, rightKnee, leftAnkle, rightAnkle, width);

    return {
      hipFlexion,
      kneePosition,
      anklePosition,
      legLengthDiscrepancy,
      genu
    };
  }

  private performAdvancedKendallClassification(metrics: DetailedPostureMetrics): KendallPostureType[] {
    const classifications: KendallPostureType[] = [];
    
    // 1. 前方頭位症候群（Forward Head Posture）
    if (metrics.headPosture.cva < this.KENDALL_NORMS.cva.range[0]) {
      classifications.push(this.createForwardHeadPostureType(metrics));
    }
    
    // 2. 上位交差症候群（Upper Crossed Syndrome）
    if (this.hasUpperCrossedSyndrome(metrics)) {
      classifications.push(this.createUpperCrossedSyndromeType(metrics));
    }
    
    // 3. 下位交差症候群（Lower Crossed Syndrome）
    if (this.hasLowerCrossedSyndrome(metrics)) {
      classifications.push(this.createLowerCrossedSyndromeType(metrics));
    }
    
    // 4. 過度後弯姿勢（Kyphosis-Lordosis Posture）
    if (this.hasKyphosisLordosisPosture(metrics)) {
      classifications.push(this.createKyphosisLordosisType(metrics));
    }
    
    // 5. 平背姿勢（Flat Back Posture）
    if (this.hasFlatBackPosture(metrics)) {
      classifications.push(this.createFlatBackType(metrics));
    }
    
    // 6. スウェイバック姿勢（Sway Back Posture）
    if (this.hasSwayBackPosture(metrics)) {
      classifications.push(this.createSwayBackType(metrics));
    }
    
    // 7. 側弯姿勢（Scoliotic Posture）
    if (this.hasScolioticPosture(metrics)) {
      classifications.push(this.createScolioticType(metrics));
    }
    
    // 正常範囲の場合
    if (classifications.length === 0) {
      classifications.push(this.createIdealPostureType());
    }
    
    return classifications;
  }

  private createForwardHeadPostureType(metrics: DetailedPostureMetrics): KendallPostureType {
    const severity = this.determineSeverity(metrics.headPosture.cva, this.KENDALL_NORMS.cva.range);
    
    return {
      classification: '前方頭位症候群',
      subtype: 'Forward Head Posture',
      description: '頭部が理想的な位置より前方に位置している状態。現代のデスクワーク環境で最も一般的な姿勢異常の一つ。',
      musculoskeletalImplications: [
        '後頭下筋群の過度な短縮と緊張',
        '深層頸屈筋群（longus colli, longus capitis）の弱化',
        '胸鎖乳突筋と斜角筋の過活動',
        '上部僧帽筋と肩甲挙筋の緊張',
        '中部・下部僧帽筋の弱化',
        '胸椎上部の過度な屈曲固定'
      ],
      compensatoryPatterns: [
        '上位頸椎（C0-C2）の代償的過伸展',
        '下位頸椎（C3-C7）の過度屈曲',
        '肩甲骨の前突と挙上',
        '胸郭の前方移動',
        '呼吸補助筋の過度使用'
      ],
      clinicalSymptoms: [
        '頸部痛と頭痛（特に後頭部）',
        '肩こりと上背部痛',
        '顎関節症候群のリスク増加',
        '胸郭出口症候群様症状',
        '呼吸困難感',
        '眼精疲労',
        '集中力の低下'
      ],
      exerciseRecommendations: {
        stretching: [
          '後頭下筋群のストレッチング',
          '胸鎖乳突筋のストレッチング',
          '上部僧帽筋・肩甲挙筋のストレッチング',
          '胸椎伸展可動域運動',
          '大胸筋・小胸筋のストレッチング'
        ],
        strengthening: [
          '深層頸屈筋の強化訓練',
          '中部・下部僧帽筋の強化',
          '菱形筋の強化',
          '前鋸筋の強化',
          '胸椎伸筋群の強化'
        ],
        postural: [
          'チンタック練習',
          '壁を使った姿勢矯正運動',
          'ブレーシング練習',
          '呼吸パターン再教育',
          '作業姿勢の改善指導'
        ]
      },
      ergonomicConsiderations: [
        'モニター高さの調整（視線レベル）',
        'キーボード・マウスの適切な配置',
        '定期的な姿勢変換の促進',
        '頸部支持枕の使用',
        'デスクチェアのヘッドレスト調整'
      ],
      prognosis: severity === 'mild' ? 'excellent' : severity === 'moderate' ? 'good' : 'fair',
      severity,
      confidence: this.calculateConfidence(metrics.headPosture.cva, this.KENDALL_NORMS.cva.range)
    };
  }

  private createUpperCrossedSyndromeType(metrics: DetailedPostureMetrics): KendallPostureType {
    return {
      classification: '上位交差症候群',
      subtype: 'Upper Crossed Syndrome (Janda)',
      description: 'Vladimir Janda博士により提唱された上半身の筋不均衡パターン。特定の筋群の過活動と弱化が交差パターンを形成。',
      musculoskeletalImplications: [
        '過活動筋群: 上部僧帽筋、肩甲挙筋、胸鎖乳突筋、後頭下筋群、大胸筋、小胸筋',
        '弱化筋群: 深層頸屈筋、中部・下部僧帽筋、菱形筋、前鋸筋',
        '関節機能異常: 後頭関節、頸胸椎移行部、胸肋関節、肩甲上腕関節',
        '筋膜の適応的短縮'
      ],
      compensatoryPatterns: [
        '頭部前方位と頸椎伸展',
        '胸椎上部の後弯増強',
        '肩甲骨の前突・挙上・下方回旋',
        '肩関節の内旋位固定'
      ],
      clinicalSymptoms: [
        '慢性頸肩痛',
        '緊張型頭痛',
        '上肢の神経症状',
        '呼吸機能の低下',
        '運動パフォーマンスの低下'
      ],
      exerciseRecommendations: {
        stretching: [
          '上部僧帽筋・肩甲挙筋の抑制テクニック',
          '大胸筋・小胸筋のPIRストレッチング',
          '後頭下筋群のリリーステクニック',
          '胸鎖乳突筋のMET'
        ],
        strengthening: [
          '深層頸屈筋の漸進的強化',
          '中部・下部僧帽筋の選択的強化',
          '菱形筋・前鋸筋の協調性訓練',
          '胸椎伸展筋群の強化'
        ],
        postural: [
          '統合的姿勢再教育',
          '運動連鎖の正常化',
          '呼吸パターンの改善',
          '日常動作の修正'
        ]
      },
      ergonomicConsiderations: [
        '作業環境の包括的見直し',
        'ストレス管理の重要性',
        '定期的な運動習慣の確立',
        '睡眠環境の改善'
      ],
      prognosis: 'good',
      severity: this.assessUpperCrossedSeverity(metrics),
      confidence: 0.85
    };
  }

  // 他の分類タイプも同様に実装...
  private createLowerCrossedSyndromeType(metrics: DetailedPostureMetrics): KendallPostureType {
    return {
      classification: '下位交差症候群',
      subtype: 'Lower Crossed Syndrome (Janda)',
      description: '腰椎-骨盤-股関節複合体における筋不均衡パターン。現代の座位生活により頻発。',
      musculoskeletalImplications: [
        '過活動筋群: 腰椎伸筋、股関節屈筋群、大腿筋膜張筋',
        '弱化筋群: 腹筋群、大臀筋、中臀筋、ハムストリングス',
        '仙腸関節機能異常',
        '腰椎前弯の増強'
      ],
      compensatoryPatterns: [
        '骨盤前傾位の固定',
        '腰椎過前弯',
        '股関節屈筋群の短縮',
        '腹圧の低下'
      ],
      clinicalSymptoms: [
        '腰痛（特に伸展時痛）',
        '股関節前面痛',
        '仙腸関節痛',
        '下肢の筋力低下'
      ],
      exerciseRecommendations: {
        stretching: [
          '腸腰筋群のストレッチング',
          '大腿筋膜張筋のストレッチング',
          '腰方形筋のリリース',
          '胸腰筋膜のモビリゼーション'
        ],
        strengthening: [
          '腹横筋の選択的強化',
          '大臀筋・中臀筋の強化',
          'ハムストリングスの強化',
          '多裂筋の安定化訓練'
        ],
        postural: [
          '骨盤中間位の学習',
          'コアスタビリゼーション',
          '股関節分離運動',
          '正しい立位・座位姿勢の習得'
        ]
      },
      ergonomicConsiderations: [
        '椅子の高さと背もたれ調整',
        'フットレストの使用',
        '立位作業の取り入れ',
        'ランバーサポートの活用'
      ],
      prognosis: 'good',
      severity: this.assessLowerCrossedSeverity(metrics),
      confidence: 0.80
    };
  }

  // ヘルパーメソッド群
  private calculateCVA(ear: Landmark, shoulder: Landmark, width: number, height: number): number {
    const earPoint = { x: ear.x * width, y: ear.y * height };
    const shoulderPoint = { x: shoulder.x * width, y: shoulder.y * height };
    const horizontalRef = { x: shoulderPoint.x + 100, y: shoulderPoint.y };
    
    const v1 = { x: earPoint.x - shoulderPoint.x, y: earPoint.y - shoulderPoint.y };
    const v2 = { x: horizontalRef.x - shoulderPoint.x, y: horizontalRef.y - shoulderPoint.y };
    
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    if (mag1 === 0 || mag2 === 0) return 0;
    
    const cos = dot / (mag1 * mag2);
    return Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
  }

  private calculateHeadTranslation(ear: Landmark, shoulder: Landmark, width: number): number {
    return Math.abs((ear.x - shoulder.x) * width);
  }

  private evaluateSuboccipitalCompression(cva: number, headTranslation: number): 'normal' | 'mild' | 'moderate' | 'severe' {
    const compressionScore = (66 - cva) + (headTranslation / 10);
    if (compressionScore < 5) return 'normal';
    if (compressionScore < 10) return 'mild';
    if (compressionScore < 15) return 'moderate';
    return 'severe';
  }

  private determineSeverity(value: number, range: [number, number] | number[]): 'mild' | 'moderate' | 'severe' {
    const normalizedRange = Array.isArray(range) && range.length >= 2 ? [range[0], range[1]] as [number, number] : range as [number, number];
    const deviation = Math.min(Math.abs(value - normalizedRange[0]), Math.abs(value - normalizedRange[1]));
    const rangeSize = normalizedRange[1] - normalizedRange[0];
    const deviationRatio = deviation / rangeSize;
    
    if (deviationRatio < 0.3) return 'mild';
    if (deviationRatio < 0.6) return 'moderate';
    return 'severe';
  }

  private calculateConfidence(value: number, range: [number, number] | number[]): number {
    const normalizedRange = Array.isArray(range) && range.length >= 2 ? [range[0], range[1]] as [number, number] : range as [number, number];
    const center = (normalizedRange[0] + normalizedRange[1]) / 2;
    const maxDeviation = Math.max(Math.abs(normalizedRange[0] - center), Math.abs(normalizedRange[1] - center));
    const actualDeviation = Math.abs(value - center);
    return Math.max(0.6, 1 - (actualDeviation / (maxDeviation * 2)));
  }

  private hasUpperCrossedSyndrome(metrics: DetailedPostureMetrics): boolean {
    return metrics.headPosture.cva < 52 && 
           metrics.shoulderGirdle.shoulderProtraction.left > 20 &&
           metrics.spinalCurvature.thoracicKyphosis > 45;
  }

  private hasLowerCrossedSyndrome(metrics: DetailedPostureMetrics): boolean {
    return metrics.pelvis.pelvicTilt > 15 && 
           metrics.spinalCurvature.lumbarLordosis > 50;
  }

  private assessUpperCrossedSeverity(metrics: DetailedPostureMetrics): 'mild' | 'moderate' | 'severe' {
    let severityScore = 0;
    if (metrics.headPosture.cva < 45) severityScore += 2;
    else if (metrics.headPosture.cva < 50) severityScore += 1;
    
    if (metrics.shoulderGirdle.shoulderProtraction.left > 30) severityScore += 2;
    else if (metrics.shoulderGirdle.shoulderProtraction.left > 20) severityScore += 1;
    
    if (severityScore >= 3) return 'severe';
    if (severityScore >= 2) return 'moderate';
    return 'mild';
  }

  private assessLowerCrossedSeverity(metrics: DetailedPostureMetrics): 'mild' | 'moderate' | 'severe' {
    let severityScore = 0;
    if (metrics.pelvis.pelvicTilt > 20) severityScore += 2;
    else if (metrics.pelvis.pelvicTilt > 15) severityScore += 1;
    
    if (metrics.spinalCurvature.lumbarLordosis > 55) severityScore += 2;
    else if (metrics.spinalCurvature.lumbarLordosis > 50) severityScore += 1;
    
    if (severityScore >= 3) return 'severe';
    if (severityScore >= 2) return 'moderate';
    return 'mild';
  }

  // 簡略実装のヘルパーメソッド群（実際の実装では詳細化が必要）
  private estimateProtraction(_shoulder: Landmark, _width: number): number { 
    // TODO: Implement actual protraction calculation
    return 15; 
  }
  
  private evaluateShoulderRotation(_landmarks: Landmark[]): { left: 'internal' | 'external' | 'neutral'; right: 'internal' | 'external' | 'neutral' } { 
    // TODO: Implement shoulder rotation evaluation
    return { left: 'neutral', right: 'neutral' }; 
  }
  
  private evaluateScapularWinging(_protraction: any): { left: 'none' | 'mild' | 'moderate' | 'severe'; right: 'none' | 'mild' | 'moderate' | 'severe' } { 
    // TODO: Implement scapular winging evaluation
    return { left: 'none', right: 'none' }; 
  }
  
  private evaluateThoracicOutletRisk(_elevation: any, _protraction: any): 'negative' | 'positive' { 
    // TODO: Implement thoracic outlet risk assessment
    return 'negative'; 
  }

  // TODO: Implement missing helper methods with proper calculations
  private estimateCervicalLordosis(_ear: Landmark, _shoulder: Landmark, _width: number, _height: number): number { 
    // TODO: Calculate cervical lordosis from landmarks
    return 30; 
  }
  
  private estimateThoracicKyphosis(_shoulder: Landmark, _hip: Landmark, _width: number, _height: number): number { 
    // TODO: Calculate thoracic kyphosis from landmarks
    return 35; 
  }
  
  private estimateLumbarLordosis(_hip: Landmark, _landmarks: Landmark[], _width: number, _height: number): number { 
    // TODO: Calculate lumbar lordosis from landmarks
    return 40; 
  }
  
  private calculateLateralDeviation(_landmarks: Landmark[], _width: number): number { 
    // TODO: Calculate lateral spinal deviation
    return 0; 
  }
  
  private evaluateSpinalBalance(_ear: Landmark, _hip: Landmark, _width: number): 'balanced' | 'forward' | 'backward' { 
    // TODO: Evaluate spinal balance
    return 'balanced'; 
  }
  
  private calculatePelvicTilt(_hip: Landmark, _landmarks: Landmark[], _width: number, _height: number): number { 
    // TODO: Calculate pelvic tilt angle
    return 11; 
  }
  
  private calculatePelvicRotation(_leftHip: Landmark, _rightHip: Landmark, _width: number): number { 
    // TODO: Calculate pelvic rotation
    return 0; 
  }
  
  private calculatePelvicShift(_hip: Landmark, _landmarks: Landmark[], _width: number, _height: number): { lateral: number; anteroposterior: number } { 
    // TODO: Calculate pelvic shift
    return { lateral: 0, anteroposterior: 0 }; 
  }
  
  private evaluateIliacCrestLevel(_leftHip: Landmark, _rightHip: Landmark, _height: number): 'level' | 'left_high' | 'right_high' { 
    // TODO: Evaluate iliac crest level differences
    return 'level'; 
  }
  
  private estimateSacralAngle(_pelvicTilt: number): number { 
    // TODO: Calculate sacral angle from pelvic tilt
    return 30; 
  }
  
  private calculateHipFlexion(_hip: Landmark, _knee: Landmark): number { 
    // TODO: Calculate hip flexion angle
    return 0; 
  }
  
  private evaluateKneePosition(_hip: Landmark, _knee: Landmark, _ankle: Landmark): 'normal' | 'hyperextended' | 'flexed' { 
    // TODO: Evaluate knee position
    return 'normal'; 
  }
  
  private evaluateAnklePosition(_knee: Landmark, _ankle: Landmark): 'neutral' | 'plantarflexed' | 'dorsiflexed' { 
    // TODO: Evaluate ankle position
    return 'neutral'; 
  }
  
  private calculateLegLengthDiscrepancy(_leftHip: Landmark, _rightHip: Landmark, _leftAnkle: Landmark, _rightAnkle: Landmark, _height: number): number { 
    // TODO: Calculate leg length discrepancy
    return 0; 
  }
  
  private evaluateGenu(_leftKnee: Landmark, _rightKnee: Landmark, _leftAnkle: Landmark, _rightAnkle: Landmark, _width: number): 'normal' | 'valgum' | 'varum' { 
    // TODO: Evaluate genu valgum/varum
    return 'normal'; 
  }

  // TODO: Implement additional posture classification methods
  private hasKyphosisLordosisPosture(_metrics: DetailedPostureMetrics): boolean { 
    // TODO: Implement kyphosis-lordosis detection
    return false; 
  }
  
  private hasFlatBackPosture(_metrics: DetailedPostureMetrics): boolean { 
    // TODO: Implement flat back detection
    return false; 
  }
  
  private hasSwayBackPosture(_metrics: DetailedPostureMetrics): boolean { 
    // TODO: Implement sway back detection
    return false; 
  }
  
  private hasScolioticPosture(_metrics: DetailedPostureMetrics): boolean { 
    // TODO: Implement scoliotic detection
    return false; 
  }

  // TODO: Implement specific posture type creation methods
  private createKyphosisLordosisType(_metrics: DetailedPostureMetrics): KendallPostureType { 
    // TODO: Create proper kyphosis-lordosis type
    return this.createIdealPostureType(); 
  }
  
  private createFlatBackType(_metrics: DetailedPostureMetrics): KendallPostureType { 
    // TODO: Create proper flat back type
    return this.createIdealPostureType(); 
  }
  
  private createSwayBackType(_metrics: DetailedPostureMetrics): KendallPostureType { 
    // TODO: Create proper sway back type
    return this.createIdealPostureType(); 
  }
  
  private createScolioticType(_metrics: DetailedPostureMetrics): KendallPostureType { 
    // TODO: Create proper scoliotic type
    return this.createIdealPostureType(); 
  }

  private createIdealPostureType(): KendallPostureType {
    return {
      classification: '理想姿勢',
      description: 'Kendall基準に基づく良好な姿勢アライメント',
      musculoskeletalImplications: ['筋バランス良好', '関節負荷最小'],
      compensatoryPatterns: [],
      clinicalSymptoms: [],
      exerciseRecommendations: {
        stretching: ['定期的な可動域維持運動'],
        strengthening: ['全身の筋力バランス維持'],
        postural: ['現在の良好な姿勢の維持']
      },
      ergonomicConsiderations: ['現在の環境維持'],
      prognosis: 'excellent',
      severity: 'mild',
      confidence: 0.95
    };
  }

  private identifyPrimaryDysfunction(_metrics: DetailedPostureMetrics, postureTypes: KendallPostureType[]): string {
    if (postureTypes.length === 0) return '機能異常なし';
    return postureTypes[0].classification;
  }

  private analyzeCompensatoryChain(metrics: DetailedPostureMetrics): string[] {
    const chain: string[] = [];
    
    if (metrics.headPosture.cva < 52) {
      chain.push('前方頭位 → 上位頸椎過伸展 → 肩甲骨前突 → 胸椎屈曲増強');
    }
    
    if (metrics.pelvis.pelvicTilt > 15) {
      chain.push('骨盤前傾 → 腰椎過前弯 → 股関節屈筋短縮 → 腹筋弱化');
    }
    
    return chain.length > 0 ? chain : ['代償パターンなし'];
  }

  private assessRiskFactors(metrics: DetailedPostureMetrics, postureTypes: KendallPostureType[]): string[] {
    const risks: string[] = [];
    
    postureTypes.forEach(type => {
      if (type.severity === 'severe') {
        risks.push(`${type.classification}による重度機能異常`);
      }
    });
    
    if (metrics.headPosture.headTranslation > 30) {
      risks.push('頸椎症性神経根症リスク');
    }
    
    if (metrics.pelvis.pelvicTilt > 20) {
      risks.push('腰椎椎間板症リスク');
    }
    
    return risks.length > 0 ? risks : ['特記すべきリスク因子なし'];
  }

  private evaluateFunctionalLimitations(metrics: DetailedPostureMetrics): string[] {
    const limitations: string[] = [];
    
    if (metrics.headPosture.cva < 45) {
      limitations.push('頸椎可動域制限', '視覚的注意機能低下');
    }
    
    if (metrics.pelvis.pelvicTilt > 20) {
      limitations.push('股関節伸展制限', '体幹安定性低下');
    }
    
    return limitations.length > 0 ? limitations : ['機能制限なし'];
  }
}

export const advancedKendallAnalysisService = new AdvancedKendallAnalysisService();