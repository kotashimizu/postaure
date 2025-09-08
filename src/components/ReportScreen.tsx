import { useState } from 'react';
import type { EnhancedPostureAnalysisResult } from '../services/EnhancedPostureAnalysisService';
import LandmarkVisualizer from './LandmarkVisualizer';
import { reportGenerationService } from '../services/ReportGenerationService';

interface ImageData {
  blob: Blob;
  width: number;
  height: number;
  timestamp: number;
  viewType: 'frontal' | 'sagittal';
}

interface ReportScreenProps {
  analysisResults: EnhancedPostureAnalysisResult;
  originalImages: { frontal: ImageData; sagittal: ImageData };
  onRestart: () => void;
}

export default function ReportScreen({ 
  analysisResults, 
  originalImages,
  onRestart 
}: ReportScreenProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingJSON, setIsGeneratingJSON] = useState(false);
  const [isGeneratingPNG, setIsGeneratingPNG] = useState(false);

  const handlePDFExport = async () => {
    setIsGeneratingPDF(true);
    try {
      await reportGenerationService.generateReport(
        analysisResults,
        originalImages,
        {
          format: 'pdf',
          includeImages: true,
          includeDetailedAnalysis: true,
          language: 'ja'
        }
      );
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('PDF生成中にエラーが発生しました。');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleJSONExport = async () => {
    setIsGeneratingJSON(true);
    try {
      await reportGenerationService.generateReport(
        analysisResults,
        originalImages,
        {
          format: 'json',
          includeImages: false,
          includeDetailedAnalysis: true,
          language: 'ja'
        }
      );
    } catch (error) {
      console.error('JSON export failed:', error);
      alert('JSONエクスポート中にエラーが発生しました。');
    } finally {
      setIsGeneratingJSON(false);
    }
  };

  const handleImageShare = async () => {
    if (navigator.share) {
      try {
        const frontalFile = new File([originalImages.frontal.blob], 'frontal-analysis.png', {
          type: 'image/png'
        });
        const sagittalFile = new File([originalImages.sagittal.blob], 'sagittal-analysis.png', {
          type: 'image/png'
        });

        const cvaAngle = analysisResults.sagittal.jointAngles.find(j => j.name === 'Cranio-Vertebral Angle');
        const cvaText = cvaAngle ? `CVA: ${cvaAngle.angle.toFixed(1)}°` : '';
        
        await navigator.share({
          title: '姿勢分析結果',
          text: `${cvaText}\nKendall分類: ${analysisResults.kendallClassification.category}\n重症度: ${analysisResults.kendallClassification.severity}`,
          files: [frontalFile, sagittalFile]
        });
      } catch (error) {
        console.error('Share failed:', error);
      }
    } else {
      // Fallback: download images
      handleImageDownload();
    }
  };

  const handlePNGExport = async () => {
    setIsGeneratingPNG(true);
    try {
      await reportGenerationService.generateReport(
        analysisResults,
        originalImages,
        {
          format: 'png',
          includeImages: true,
          includeDetailedAnalysis: true,
          language: 'ja'
        }
      );
    } catch (error) {
      console.error('PNG export failed:', error);
      alert('PNG生成中にエラーが発生しました。');
    } finally {
      setIsGeneratingPNG(false);
    }
  };

  const handleImageDownload = () => {
    const frontalUrl = URL.createObjectURL(originalImages.frontal.blob);
    const sagittalUrl = URL.createObjectURL(originalImages.sagittal.blob);
    
    const downloadImage = (url: string, filename: string) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
    
    downloadImage(frontalUrl, 'frontal-analysis.png');
    downloadImage(sagittalUrl, 'sagittal-analysis.png');
    
    URL.revokeObjectURL(frontalUrl);
    URL.revokeObjectURL(sagittalUrl);
  };

  return (
    <div className="report-screen">
      <div className="report-header">
        <h1>解析結果</h1>
        <p>姿勢分析が完了しました</p>
      </div>

      {/* Analysis Images at top */}
      <div className="result-images">
        <div className="image-result">
          <LandmarkVisualizer
            image={originalImages.frontal.blob}
            landmarks={analysisResults.frontal.detection.landmarks}
            imageWidth={analysisResults.frontal.detection.imageWidth}
            imageHeight={analysisResults.frontal.detection.imageHeight}
            title="前額面解析結果"
          />
        </div>
        
        <div className="image-result">
          <LandmarkVisualizer
            image={originalImages.sagittal.blob}
            landmarks={analysisResults.sagittal.detection.landmarks}
            imageWidth={analysisResults.sagittal.detection.imageWidth}
            imageHeight={analysisResults.sagittal.detection.imageHeight}
            title="矢状面解析結果"
          />
        </div>
      </div>

      {/* Advanced Kendall Analysis */}
      <div className="advanced-analysis-section">
        <h2>詳細Kendall分析結果</h2>
        
        {/* Primary Dysfunction */}
        <div className="primary-dysfunction">
          <h3>主要機能異常</h3>
          <div className="dysfunction-badge">
            {analysisResults.advancedKendallAnalysis.primaryDysfunction}
          </div>
        </div>

        {/* Posture Types */}
        <div className="posture-types-section">
          <h3>姿勢タイプ別詳細分析</h3>
          <div className="posture-types-grid">
            {analysisResults.advancedKendallAnalysis.postureTypes.map((postureType, index) => (
              <div key={index} className="posture-type-card">
                <div className="posture-type-header">
                  <h4>{postureType.classification}</h4>
                  {postureType.subtype && <p className="subtype">{postureType.subtype}</p>}
                  <div className="severity-prognosis">
                    <span className={`severity-tag ${postureType.severity}`}>
                      {postureType.severity === 'mild' ? '軽度' : postureType.severity === 'moderate' ? '中等度' : '重度'}
                    </span>
                    <span className={`prognosis-tag ${postureType.prognosis}`}>
                      予後: {postureType.prognosis === 'excellent' ? '優良' : postureType.prognosis === 'good' ? '良好' : postureType.prognosis === 'fair' ? '普通' : '要注意'}
                    </span>
                  </div>
                </div>

                <div className="posture-description">
                  <p>{postureType.description}</p>
                </div>

                <div className="clinical-implications">
                  <h5>筋骨格系への影響</h5>
                  <ul>
                    {postureType.musculoskeletalImplications.slice(0, 3).map((implication, idx) => (
                      <li key={idx}>{implication}</li>
                    ))}
                  </ul>
                </div>

                <div className="clinical-symptoms">
                  <h5>臨床症状</h5>
                  <ul>
                    {postureType.clinicalSymptoms.slice(0, 3).map((symptom, idx) => (
                      <li key={idx}>{symptom}</li>
                    ))}
                  </ul>
                </div>

                <div className="exercise-recommendations">
                  <h5>運動療法プログラム</h5>
                  <div className="exercise-categories">
                    <div className="exercise-category">
                      <h6>🧘 ストレッチング</h6>
                      <ul>
                        {postureType.exerciseRecommendations.stretching.slice(0, 2).map((exercise, idx) => (
                          <li key={idx}>{exercise}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="exercise-category">
                      <h6>💪 筋力強化</h6>
                      <ul>
                        {postureType.exerciseRecommendations.strengthening.slice(0, 2).map((exercise, idx) => (
                          <li key={idx}>{exercise}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="ergonomic-considerations">
                  <h5>人間工学的考慮事項</h5>
                  <ul>
                    {postureType.ergonomicConsiderations.slice(0, 2).map((consideration, idx) => (
                      <li key={idx}>{consideration}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compensatory Chain */}
        {analysisResults.advancedKendallAnalysis.compensatoryChain[0] !== '代償パターンなし' && (
          <div className="compensatory-chain">
            <h3>代償連鎖パターン</h3>
            <div className="chain-flow">
              {analysisResults.advancedKendallAnalysis.compensatoryChain.map((chain, index) => (
                <div key={index} className="chain-item">
                  <div className="chain-arrow">→</div>
                  <div className="chain-text">{chain}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Factors */}
        {analysisResults.advancedKendallAnalysis.riskFactors[0] !== '特記すべきリスク因子なし' && (
          <div className="risk-factors">
            <h3>⚠️ リスク要因</h3>
            <div className="risk-grid">
              {analysisResults.advancedKendallAnalysis.riskFactors.map((risk, index) => (
                <div key={index} className="risk-item">
                  <span className="risk-icon">⚠️</span>
                  <span className="risk-text">{risk}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Functional Limitations */}
        {analysisResults.advancedKendallAnalysis.functionalLimitations[0] !== '機能制限なし' && (
          <div className="functional-limitations">
            <h3>機能制限事項</h3>
            <div className="limitation-grid">
              {analysisResults.advancedKendallAnalysis.functionalLimitations.map((limitation, index) => (
                <div key={index} className="limitation-item">
                  <span className="limitation-icon">🚫</span>
                  <span className="limitation-text">{limitation}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="export-controls">
        <h3>結果のエクスポート</h3>
        
        <div className="export-buttons">
          <button
            onClick={handlePDFExport}
            disabled={isGeneratingPDF}
          >
            {isGeneratingPDF ? 'PDF生成中...' : 'PDFレポート'}
          </button>

          <button
            onClick={handlePNGExport}
            disabled={isGeneratingPNG}
            className="btn-secondary"
          >
            {isGeneratingPNG ? 'PNG生成中...' : '画像レポート'}
          </button>

          <button
            onClick={handleJSONExport}
            disabled={isGeneratingJSON}
            className="btn-secondary"
          >
            {isGeneratingJSON ? 'JSON生成中...' : 'データ(JSON)'}
          </button>

          <button
            onClick={handleImageShare}
            className="btn-secondary"
          >
            画像を共有
          </button>
        </div>
      </div>

      <div className="disclaimer">
        <p><strong>免責事項:</strong> このアプリケーションは診断ツールではありません。医療従事者の判断を補助するものであり、診断や治療の決定には使用しないでください。</p>
      </div>

      <div className="action-buttons">
        <button onClick={onRestart} className="btn-secondary">
          新しい解析を開始
        </button>
      </div>
    </div>
  );
}