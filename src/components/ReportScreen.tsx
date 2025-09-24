import { useState, useCallback } from 'react';
import type { EnhancedPostureAnalysisResult } from '../services/EnhancedPostureAnalysisService';
import LandmarkVisualizer from './LandmarkVisualizer';
import { reportGenerationService } from '../services/ReportGenerationService';
import { aiReportService } from '../services/AIReportService';
import type { AIReportOptions, AIGeneratedReport } from '../services/AIReportService';
import APIConfigModal from './APIConfigModal';
import './APIConfigModal.css';

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
  const [isGeneratingPNG, setIsGeneratingPNG] = useState(false);
  const [isAPIConfigOpen, setIsAPIConfigOpen] = useState(false);
  const [isGeneratingAIReport, setIsGeneratingAIReport] = useState(false);
  const [aiReport, setAIReport] = useState<AIGeneratedReport | null>(null);
  const [aiError, setAIError] = useState<string | null>(null);
  const [isAIEnabled, setIsAIEnabled] = useState(aiReportService.isAIAvailable());

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

  const handleGenerateAIReport = useCallback(async () => {
    if (!aiReportService.isAIAvailable()) {
      setAIError('APIキーが設定されていません。先にAPIキーを登録してください。');
      setIsAIEnabled(false);
      return;
    }

    setIsGeneratingAIReport(true);
    setAIError(null);

    try {
      const options: AIReportOptions = {
        language: 'ja',
        detailLevel: 'detailed',
        includeExercises: true,
        includeNutrition: false,
        includeRiskAssessment: true,
        includeLongTermPlan: false
      };

      const result = await aiReportService.generateAIReport(analysisResults, options);

      if (result.success && result.report) {
        setAIReport(result.report);
      } else {
        setAIError(result.error || 'AIレポートの生成に失敗しました。');
      }
    } catch (error) {
      console.error('AI report generation failed:', error);
      setAIError('AIレポート生成中にエラーが発生しました。');
    } finally {
      setIsGeneratingAIReport(false);
      setIsAIEnabled(aiReportService.isAIAvailable());
    }
  }, [analysisResults]);

  const handleAPIConfigClose = useCallback(() => {
    setIsAPIConfigOpen(false);
    setIsAIEnabled(aiReportService.isAIAvailable());
  }, []);

  return (
    <div className="report-screen">
      <div className="report-header">
        <h1>解析結果</h1>
        <p>姿勢分析が完了しました</p>
      </div>

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

      <div className="advanced-analysis-section">
        <h2>詳細Kendall分析結果</h2>

        <div className="primary-dysfunction">
          <h3>主要機能異常</h3>
          <div className="dysfunction-badge">
            {analysisResults.advancedKendallAnalysis.primaryDysfunction}
          </div>
        </div>

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
          <button onClick={handlePDFExport} disabled={isGeneratingPDF}>
            {isGeneratingPDF ? 'PDF生成中...' : 'PDFレポート'}
          </button>

          <button onClick={handlePNGExport} disabled={isGeneratingPNG} className="btn-secondary">
            {isGeneratingPNG ? 'PNG生成中...' : '画像として保存'}
          </button>
        </div>
      </div>

      <div className="ai-settings">
        <div className="ai-settings-header">
          <div>
            <h3>AI統合設定</h3>
            <p>AIレポートを利用するにはAPIキーを登録し、レポートを生成してください。</p>
          </div>
          <button onClick={() => setIsAPIConfigOpen(true)} className="btn-api-config">
            APIキーを設定
          </button>
        </div>

        <div className="ai-settings-actions">
          <button
            onClick={handleGenerateAIReport}
            disabled={isGeneratingAIReport}
            className="btn-ai-generate"
          >
            {isGeneratingAIReport ? 'AI分析中…' : 'AI分析レポートを生成'}
          </button>

          {!isAIEnabled && <span className="ai-status disabled">APIキー未設定</span>}
          {isAIEnabled && !isGeneratingAIReport && <span className="ai-status enabled">APIキー設定済み</span>}
        </div>

        {aiError && <div className="ai-status-message error">{aiError}</div>}

        {aiReport && (
          <div className="ai-summary">
            <h4>AIレポートハイライト</h4>
            <p className="ai-summary-text">{aiReport.executiveSummary}</p>

            <div className="ai-summary-section">
              <h5>主要診断</h5>
              <p>{aiReport.clinicalFindings.primaryDiagnosis}</p>
            </div>

            {aiReport.clinicalFindings.contributingFactors.length > 0 && (
              <div className="ai-summary-section">
                <h5>寄与因子</h5>
                <ul>
                  {aiReport.clinicalFindings.contributingFactors.slice(0, 3).map((factor, idx) => (
                    <li key={idx}>{factor}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="ai-summary-section">
              <h5>推奨ケア</h5>
              <ul>
                {aiReport.treatmentPlan.phases.slice(0, 3).map((phase, idx) => (
                  <li key={idx}>{phase.name} — {phase.objectives[0]}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="disclaimer">
        <p><strong>免責事項:</strong> このアプリケーションは診断ツールではありません。医療従事者の判断を補助するものであり、診断や治療の決定には使用しないでください。</p>
      </div>

      <div className="action-buttons">
        <button onClick={onRestart} className="btn-secondary">
          新しい解析を開始
        </button>
      </div>

      <APIConfigModal isOpen={isAPIConfigOpen} onClose={handleAPIConfigClose} />
    </div>
  );
}
