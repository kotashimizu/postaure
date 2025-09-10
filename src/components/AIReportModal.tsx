import React, { useState } from 'react';
import type { AIGeneratedReport, RiskFactor, TreatmentPhase, Checkpoint } from '../services/AIReportService';
import type { EnhancedPostureAnalysisResult } from '../services/EnhancedPostureAnalysisService';
import { reportGenerationService } from '../services/ReportGenerationService';

interface AIReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: AIGeneratedReport | null;
  originalAnalysis: EnhancedPostureAnalysisResult;
}

const AIReportModal: React.FC<AIReportModalProps> = ({
  isOpen,
  onClose,
  report,
  originalAnalysis
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'clinical' | 'treatment' | 'monitoring'>('summary');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen || !report) return null;

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      // Create a comprehensive report including AI insights
      const enhancedReport = {
        ...originalAnalysis,
        aiInsights: report
      };

      await reportGenerationService.generateReport(
        enhancedReport as any,
        { frontal: { blob: new Blob(), width: 0, height: 0, timestamp: Date.now(), viewType: 'frontal' as const }, 
          sagittal: { blob: new Blob(), width: 0, height: 0, timestamp: Date.now(), viewType: 'sagittal' as const } },
        {
          format: 'pdf',
          includeImages: false,
          includeDetailedAnalysis: true,
          language: 'ja'
        }
      );
    } catch (error) {
      console.error('AI report PDF export failed:', error);
      alert('PDFエクスポートに失敗しました。');
    } finally {
      setIsExporting(false);
    }
  };

  const formatRiskSeverity = (severity: string): string => {
    const severityMap: Record<string, string> = {
      'low': '低',
      'moderate': '中',
      'high': '高',
      'severe': '重篤'
    };
    return severityMap[severity] || severity;
  };

  const formatOverallRisk = (risk: string): string => {
    const riskMap: Record<string, string> = {
      'low': '低リスク',
      'moderate': '中リスク',
      'high': '高リスク',
      'severe': '重篤リスク'
    };
    return riskMap[risk] || risk;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ai-report-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🤖 AI分析レポート</h2>
          <div className="report-meta">
            <span className="provider-badge">{report.reportMetadata.aiProvider}</span>
            <span className="confidence-badge">
              信頼度: {Math.round(report.reportMetadata.confidence * 100)}%
            </span>
          </div>
          <button className="close-button" onClick={onClose} aria-label="閉じる">×</button>
        </div>

        <div className="ai-report-content">
          {/* Tab Navigation */}
          <div className="report-tabs">
            <button
              className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              📊 概要
            </button>
            <button
              className={`tab ${activeTab === 'clinical' ? 'active' : ''}`}
              onClick={() => setActiveTab('clinical')}
            >
              🏥 臨床所見
            </button>
            <button
              className={`tab ${activeTab === 'treatment' ? 'active' : ''}`}
              onClick={() => setActiveTab('treatment')}
            >
              💊 治療計画
            </button>
            <button
              className={`tab ${activeTab === 'monitoring' ? 'active' : ''}`}
              onClick={() => setActiveTab('monitoring')}
            >
              📈 経過観察
            </button>
          </div>

          <div className="report-tab-content">
            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <div className="tab-panel">
                <section className="executive-summary">
                  <h3>📋 エグゼクティブサマリー</h3>
                  <div className="summary-card">
                    <p>{report.executiveSummary}</p>
                  </div>
                </section>

                <section className="risk-overview">
                  <h3>⚠️ リスク評価</h3>
                  <div className="risk-card">
                    <div className={`overall-risk risk-${report.riskAssessment.overallRisk}`}>
                      <strong>{formatOverallRisk(report.riskAssessment.overallRisk)}</strong>
                    </div>
                    <p className="urgency">{report.riskAssessment.urgencyLevel}</p>
                  </div>
                </section>

                <section className="key-findings">
                  <h3>🔍 主要所見</h3>
                  <div className="findings-grid">
                    <div className="finding-item">
                      <h4>主要診断</h4>
                      <p>{report.clinicalFindings.primaryDiagnosis}</p>
                    </div>
                    <div className="finding-item">
                      <h4>治療期間</h4>
                      <p>{report.treatmentPlan.duration}</p>
                    </div>
                    <div className="finding-item">
                      <h4>実施頻度</h4>
                      <p>{report.treatmentPlan.frequency}</p>
                    </div>
                  </div>
                </section>

                <section className="expected-outcomes">
                  <h3>🎯 予想される結果</h3>
                  <ul className="outcomes-list">
                    {report.expectedOutcomes.map((outcome, index) => (
                      <li key={index}>{outcome}</li>
                    ))}
                  </ul>
                </section>
              </div>
            )}

            {/* Clinical Tab */}
            {activeTab === 'clinical' && (
              <div className="tab-panel">
                <section className="clinical-findings-detail">
                  <h3>🏥 詳細臨床所見</h3>
                  
                  <div className="finding-section">
                    <h4>主要診断</h4>
                    <p className="primary-diagnosis">{report.clinicalFindings.primaryDiagnosis}</p>
                  </div>

                  <div className="finding-section">
                    <h4>生体力学的分析</h4>
                    <p>{report.clinicalFindings.biomechanicalAnalysis}</p>
                  </div>

                  <div className="finding-section">
                    <h4>寄与因子</h4>
                    <ul>
                      {report.clinicalFindings.contributingFactors.map((factor, index) => (
                        <li key={index}>{factor}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="finding-section">
                    <h4>代償パターン</h4>
                    <ul>
                      {report.clinicalFindings.compensatoryPatterns.map((pattern, index) => (
                        <li key={index}>{pattern}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="finding-section">
                    <h4>筋骨格系不均衡</h4>
                    <ul>
                      {report.clinicalFindings.musculoskeletalImbalances.map((imbalance, index) => (
                        <li key={index}>{imbalance}</li>
                      ))}
                    </ul>
                  </div>
                </section>

                <section className="risk-assessment-detail">
                  <h3>⚠️ 詳細リスク評価</h3>
                  
                  <div className="specific-risks">
                    <h4>特定リスク因子</h4>
                    {report.riskAssessment.specificRisks.map((risk: RiskFactor, index) => (
                      <div key={index} className="risk-factor-card">
                        <div className="risk-header">
                          <strong>{risk.factor}</strong>
                          <span className={`risk-severity severity-${risk.severity}`}>
                            {formatRiskSeverity(risk.severity)}
                          </span>
                        </div>
                        <div className="risk-details">
                          <div className="risk-likelihood">
                            発生確率: {risk.likelihood}% ({risk.timeframe})
                          </div>
                          <div className="risk-mitigation">
                            <strong>軽減策:</strong>
                            <ul>
                              {risk.mitigation.map((strategy, idx) => (
                                <li key={idx}>{strategy}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="prevention-strategies">
                    <h4>予防戦略</h4>
                    <ul>
                      {report.riskAssessment.preventionStrategies.map((strategy, index) => (
                        <li key={index}>{strategy}</li>
                      ))}
                    </ul>
                  </div>
                </section>
              </div>
            )}

            {/* Treatment Tab */}
            {activeTab === 'treatment' && (
              <div className="tab-panel">
                <section className="treatment-plan-detail">
                  <h3>💊 詳細治療計画</h3>
                  
                  <div className="treatment-overview">
                    <div className="treatment-summary">
                      <div className="summary-item">
                        <strong>治療期間:</strong> {report.treatmentPlan.duration}
                      </div>
                      <div className="summary-item">
                        <strong>実施頻度:</strong> {report.treatmentPlan.frequency}
                      </div>
                    </div>
                  </div>

                  <div className="treatment-phases">
                    <h4>治療フェーズ</h4>
                    {report.treatmentPlan.phases.map((phase: TreatmentPhase, index) => (
                      <div key={index} className="phase-card">
                        <div className="phase-header">
                          <h5>フェーズ {index + 1}: {phase.name}</h5>
                          <span className="phase-duration">{phase.duration}</span>
                        </div>
                        
                        <div className="phase-content">
                          <div className="phase-objectives">
                            <strong>目標:</strong>
                            <ul>
                              {phase.objectives.map((objective, idx) => (
                                <li key={idx}>{objective}</li>
                              ))}
                            </ul>
                          </div>
                          
                          <div className="phase-interventions">
                            <strong>介入方法:</strong>
                            <ul>
                              {phase.interventions.map((intervention, idx) => (
                                <li key={idx}>{intervention}</li>
                              ))}
                            </ul>
                          </div>
                          
                          <div className="phase-success-criteria">
                            <strong>成功基準:</strong>
                            <ul>
                              {phase.successCriteria.map((criterion, idx) => (
                                <li key={idx}>{criterion}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="progress-markers">
                    <h4>進捗指標</h4>
                    <ul>
                      {report.treatmentPlan.progressMarkers.map((marker, index) => (
                        <li key={index}>{marker}</li>
                      ))}
                    </ul>
                  </div>

                  {report.exerciseProgram && (
                    <div className="exercise-program">
                      <h4>運動プログラム</h4>
                      <div className="program-overview">
                        <p>期間: {report.exerciseProgram.duration}週間</p>
                        {report.exerciseProgram.phases.map((phase, index) => (
                          <div key={index} className="exercise-phase">
                            <h5>{phase.name} ({phase.duration}日間)</h5>
                            <p>頻度: {phase.frequency}</p>
                            <div className="exercises">
                              {phase.exercises.map((exercise, idx) => (
                                <div key={idx} className="exercise-item">
                                  <strong>{exercise.name}</strong> - {exercise.sets}セット × {exercise.reps}
                                  <p>{exercise.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {report.nutritionGuidance && (
                    <div className="nutrition-guidance">
                      <h4>栄養指導</h4>
                      <div className="nutrition-recommendations">
                        <strong>推奨事項:</strong>
                        <ul>
                          {report.nutritionGuidance.recommendations.map((rec, index) => (
                            <li key={index}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="hydration">
                        <strong>水分摂取:</strong>
                        <p>{report.nutritionGuidance.hydrationGuidance}</p>
                      </div>

                      <div className="anti-inflammatory-foods">
                        <strong>抗炎症食品:</strong>
                        <ul>
                          {report.nutritionGuidance.antiInflammatoryFoods.map((food, index) => (
                            <li key={index}>{food}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </section>

                <section className="lifestyle-modifications">
                  <h3>🏠 ライフスタイル改善</h3>
                  <ul>
                    {report.lifestyleModifications.map((modification, index) => (
                      <li key={index}>{modification}</li>
                    ))}
                  </ul>
                </section>
              </div>
            )}

            {/* Monitoring Tab */}
            {activeTab === 'monitoring' && (
              <div className="tab-panel">
                <section className="monitoring-plan-detail">
                  <h3>📈 経過観察計画</h3>
                  
                  <div className="reassessment-schedule">
                    <div className="schedule-info">
                      <strong>再評価スケジュール:</strong> {report.monitoringPlan.reassessmentSchedule}
                    </div>
                  </div>

                  <div className="checkpoints">
                    <h4>チェックポイント</h4>
                    {report.monitoringPlan.checkpoints.map((checkpoint: Checkpoint, index) => (
                      <div key={index} className="checkpoint-card">
                        <div className="checkpoint-header">
                          <h5>{checkpoint.timepoint}</h5>
                        </div>
                        
                        <div className="checkpoint-content">
                          <div className="assessments">
                            <strong>評価項目:</strong>
                            <ul>
                              {checkpoint.assessments.map((assessment, idx) => (
                                <li key={idx}>{assessment}</li>
                              ))}
                            </ul>
                          </div>
                          
                          <div className="expected-progress">
                            <strong>予想される進捗:</strong>
                            <p>{checkpoint.expectedProgress}</p>
                          </div>
                          
                          <div className="contingency-plan">
                            <strong>代替計画:</strong>
                            <p>{checkpoint.contingencyPlan}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="self-assessment-tools">
                    <h4>セルフアセスメントツール</h4>
                    <ul>
                      {report.monitoringPlan.selfAssessmentTools.map((tool, index) => (
                        <li key={index}>{tool}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="warning-signs">
                    <h4>⚠️ 注意すべき兆候</h4>
                    <ul className="warning-list">
                      {report.monitoringPlan.warningsSigns.map((sign, index) => (
                        <li key={index} className="warning-item">{sign}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="red-flags">
                    <h4>🚨 緊急対応が必要な症状</h4>
                    <ul className="red-flag-list">
                      {report.redFlags.map((flag, index) => (
                        <li key={index} className="red-flag-item">{flag}</li>
                      ))}
                    </ul>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <div className="report-actions">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="export-button"
            >
              {isExporting ? '🔄 エクスポート中...' : '📄 PDFエクスポート'}
            </button>
          </div>
          
          <div className="ai-disclaimers">
            <h4>⚠️ 重要な注意事項</h4>
            <ul>
              {report.reportMetadata.disclaimers.map((disclaimer, index) => (
                <li key={index}>{disclaimer}</li>
              ))}
            </ul>
            <div className="evidence-level">
              エビデンスレベル: {report.reportMetadata.evidenceLevel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIReportModal;