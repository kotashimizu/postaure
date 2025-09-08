import { useState, useEffect } from 'react';
import { mediaPipeService } from '../services/MediaPipeService';
import { enhancedPostureAnalysisService } from '../services/EnhancedPostureAnalysisService';
import type { EnhancedPostureAnalysisResult } from '../services/EnhancedPostureAnalysisService';

interface ImageData {
  blob: Blob;
  width: number;
  height: number;
  timestamp: number;
  viewType: 'frontal' | 'sagittal';
}

interface AnalysisScreenProps {
  frontalImage: ImageData;
  sagittalImage: ImageData;
  onAnalysisComplete: (results: EnhancedPostureAnalysisResult) => void;
  onAnalysisError: (error: Error) => void;
}

export default function AnalysisScreen({
  frontalImage,
  sagittalImage,
  onAnalysisComplete,
  onAnalysisError
}: AnalysisScreenProps) {
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('MediaPipeモデルを読み込み中...');

  useEffect(() => {
    performAnalysis();
  }, [frontalImage, sagittalImage]);

  const performAnalysis = async () => {
    try {
      setCurrentStep('MediaPipeモデルを読み込み中...');
      setAnalysisProgress(10);

      // Initialize MediaPipe
      await mediaPipeService.initialize();
      setAnalysisProgress(25);

      setCurrentStep('前額面画像を解析中...');
      setAnalysisProgress(40);

      // Process frontal image
      const frontalDetection = await mediaPipeService.detectPose(frontalImage.blob);
      setAnalysisProgress(55);

      setCurrentStep('矢状面画像を解析中...');
      setAnalysisProgress(70);

      // Process sagittal image
      const sagittalDetection = await mediaPipeService.detectPose(sagittalImage.blob);
      setAnalysisProgress(85);

      setCurrentStep('姿勢指標を計算中...');
      setAnalysisProgress(95);

      // Analyze posture metrics with enhanced analysis
      const analysisResults = await enhancedPostureAnalysisService.analyzePosture(
        frontalDetection,
        sagittalDetection
      );

      setCurrentStep('完了');
      setAnalysisProgress(100);

      setTimeout(() => {
        onAnalysisComplete(analysisResults);
      }, 500);

    } catch (error) {
      console.error('Analysis failed:', error);
      onAnalysisError(error as Error);
    }
  };

  return (
    <div className="analysis-screen">
      <div className="analysis-header">
        <h1>姿勢解析中</h1>
        <p>画像を解析して姿勢指標を計算しています</p>
      </div>

      <div className="analysis-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${analysisProgress}%` }}
          />
        </div>
        <p className="progress-text">{currentStep}</p>
        <p className="progress-percentage">{analysisProgress}%</p>
      </div>

      <div className="analysis-images">
        <div className="image-preview">
          <h3>前額面</h3>
          <div className="image-container">
            <img 
              src={URL.createObjectURL(frontalImage.blob)} 
              alt="前額面画像"
              style={{ maxWidth: '200px', height: 'auto' }}
            />
          </div>
        </div>
        
        <div className="image-preview">
          <h3>矢状面</h3>
          <div className="image-container">
            <img 
              src={URL.createObjectURL(sagittalImage.blob)} 
              alt="矢状面画像"
              style={{ maxWidth: '200px', height: 'auto' }}
            />
          </div>
        </div>
      </div>

      <div className="analysis-info">
        <p>このプロセスには通常30秒程度かかります。すべての処理はデバイス上で実行され、画像は外部に送信されません。</p>
      </div>
    </div>
  );
}