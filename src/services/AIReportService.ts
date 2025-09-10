// AI-powered report generation service
// Integrates with APIConfigService to generate enhanced analysis reports

import { apiConfigService } from './APIConfigService';
import type { AnalysisAPIRequest, ExercisePlan, NutritionAdvice } from './APIConfigService';
import type { EnhancedPostureAnalysisResult } from './EnhancedPostureAnalysisService';

export interface AIReportOptions {
  language: 'ja' | 'en';
  detailLevel: 'basic' | 'detailed' | 'professional';
  includeExercises: boolean;
  includeNutrition: boolean;
  includeRiskAssessment: boolean;
  includeLongTermPlan: boolean;
  patientAge?: number;
  patientGender?: 'male' | 'female' | 'other';
  patientOccupation?: string;
  currentSymptoms?: string[];
}

export interface AIReportResult {
  success: boolean;
  report?: AIGeneratedReport;
  error?: string;
  usage?: {
    tokens: number;
    cost: number;
    provider: string;
  };
}

export interface AIGeneratedReport {
  id: string;
  timestamp: string;
  analysisId: string;
  
  // Core Analysis
  executiveSummary: string;
  clinicalFindings: ClinicalFindings;
  riskAssessment: RiskAssessment;
  
  // Recommendations
  treatmentPlan: TreatmentPlan;
  exerciseProgram?: ExercisePlan;
  nutritionGuidance?: NutritionAdvice;
  lifestyleModifications: string[];
  
  // Follow-up
  monitoringPlan: MonitoringPlan;
  expectedOutcomes: string[];
  redFlags: string[];
  
  // Metadata
  reportMetadata: {
    aiProvider: string;
    confidence: number;
    evidenceLevel: string;
    disclaimers: string[];
  };
}

export interface ClinicalFindings {
  primaryDiagnosis: string;
  contributingFactors: string[];
  biomechanicalAnalysis: string;
  compensatoryPatterns: string[];
  musculoskeletalImbalances: string[];
}

export interface RiskAssessment {
  overallRisk: 'low' | 'moderate' | 'high' | 'severe';
  specificRisks: RiskFactor[];
  preventionStrategies: string[];
  urgencyLevel: string;
}

export interface RiskFactor {
  factor: string;
  severity: 'low' | 'moderate' | 'high';
  likelihood: number; // 0-100%
  timeframe: string;
  mitigation: string[];
}

export interface TreatmentPlan {
  phases: TreatmentPhase[];
  duration: string;
  frequency: string;
  progressMarkers: string[];
  modifications: ConditionalModification[];
}

export interface TreatmentPhase {
  name: string;
  duration: string;
  objectives: string[];
  interventions: string[];
  successCriteria: string[];
}

export interface ConditionalModification {
  condition: string;
  modification: string;
  rationale: string;
}

export interface MonitoringPlan {
  checkpoints: Checkpoint[];
  selfAssessmentTools: string[];
  warningsSigns: string[];
  reassessmentSchedule: string;
}

export interface Checkpoint {
  timepoint: string;
  assessments: string[];
  expectedProgress: string;
  contingencyPlan: string;
}

class AIReportService {
  private readonly REPORT_CACHE_KEY = 'postaure_ai_reports';
  private reports: Map<string, AIGeneratedReport> = new Map();

  constructor() {
    this.loadReportsFromCache();
  }

  // Generate AI-powered comprehensive report
  async generateAIReport(
    analysisResult: EnhancedPostureAnalysisResult,
    options: AIReportOptions,
    endpointId?: string
  ): Promise<AIReportResult> {
    try {
      // Get enabled API endpoints
      const availableEndpoints = apiConfigService.getEnabledEndpoints();
      
      if (availableEndpoints.length === 0) {
        return {
          success: false,
          error: 'AI機能を使用するにはAPIエンドポイントの設定が必要です'
        };
      }

      // Select endpoint (user specified or first available)
      const selectedEndpoint = endpointId 
        ? availableEndpoints.find(ep => ep.id === endpointId)
        : availableEndpoints[0];

      if (!selectedEndpoint) {
        return {
          success: false,
          error: '指定されたAPIエンドポイントが見つかりません'
        };
      }

      // Prepare API request
      const apiRequest: AnalysisAPIRequest = {
        localAnalysisResults: this.prepareAnalysisData(analysisResult),
        preferences: {
          language: options.language,
          includeExercises: options.includeExercises,
          includeNutrition: options.includeNutrition,
          detailLevel: options.detailLevel
        }
      };

      // Add contextual information
      if (options.patientAge || options.patientGender || options.patientOccupation || options.currentSymptoms) {
        (apiRequest as any).patientContext = {
          age: options.patientAge,
          gender: options.patientGender,
          occupation: options.patientOccupation,
          symptoms: options.currentSymptoms
        };
      }

      // Call AI API
      const apiResponse = await apiConfigService.callAnalysisAPI(selectedEndpoint.id, apiRequest);

      if (!apiResponse.success) {
        return {
          success: false,
          error: apiResponse.error?.message || 'AI分析に失敗しました'
        };
      }

      // Process AI response into structured report
      const aiReport = await this.processAIResponse(
        apiResponse.data!,
        analysisResult,
        options,
        selectedEndpoint.provider
      );

      // Cache the report
      this.cacheReport(aiReport);

      return {
        success: true,
        report: aiReport,
        usage: apiResponse.usage && {
          tokens: apiResponse.usage.tokens,
          cost: apiResponse.usage.cost,
          provider: selectedEndpoint.provider
        }
      };

    } catch (error) {
      console.error('AI report generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI分析中にエラーが発生しました'
      };
    }
  }

  // Prepare analysis data for AI processing
  private prepareAnalysisData(analysisResult: EnhancedPostureAnalysisResult): any {
    const { advancedKendallAnalysis, sagittal, frontal } = analysisResult;

    return {
      // Kendall Analysis
      kendallAnalysis: {
        primaryDysfunction: advancedKendallAnalysis.primaryDysfunction,
        postureTypes: advancedKendallAnalysis.postureTypes.map(type => ({
          classification: type.classification,
          severity: type.severity,
          confidence: type.confidence,
          musculoskeletalImplications: type.musculoskeletalImplications,
          clinicalSymptoms: type.clinicalSymptoms
        })),
        compensatoryPatterns: advancedKendallAnalysis.compensatoryChain,
        riskFactors: advancedKendallAnalysis.riskFactors
      },
      
      // Quantitative Measurements
      measurements: {
        cva: sagittal.jointAngles.find(j => j.name === 'Cranio-Vertebral Angle')?.angle,
        shoulderAlignment: frontal.asymmetries?.shoulderLevel,
        pelvicAlignment: frontal.asymmetries?.pelvicLevel,
        spinalCurvature: sagittal.jointAngles.filter(j => j.name.includes('Spine')),
      },
      
      // Risk Assessment
      currentRisks: advancedKendallAnalysis.riskFactors,
      severity: advancedKendallAnalysis.postureTypes[0]?.severity || 'unknown'
    };
  }

  // Process AI response into structured report
  private async processAIResponse(
    aiData: any,
    originalAnalysis: EnhancedPostureAnalysisResult,
    options: AIReportOptions,
    provider: string
  ): Promise<AIGeneratedReport> {
    const reportId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Extract structured information from AI response
    const aiInsights = aiData.aiInsights || '';
    const recommendations = aiData.recommendations || [];
    const riskAssessment = aiData.riskAssessment || '';

    return {
      id: reportId,
      timestamp: new Date().toISOString(),
      analysisId: `analysis_${Date.now()}`,
      
      executiveSummary: this.extractExecutiveSummary(aiInsights),
      
      clinicalFindings: {
        primaryDiagnosis: this.extractPrimaryDiagnosis(aiInsights, originalAnalysis),
        contributingFactors: this.extractContributingFactors(aiInsights, recommendations),
        biomechanicalAnalysis: this.extractBiomechanicalAnalysis(aiInsights),
        compensatoryPatterns: originalAnalysis.advancedKendallAnalysis.compensatoryChain,
        musculoskeletalImbalances: this.extractImbalances(aiInsights, originalAnalysis)
      },
      
      riskAssessment: {
        overallRisk: this.determineOverallRisk(riskAssessment, originalAnalysis),
        specificRisks: this.extractSpecificRisks(riskAssessment, aiInsights),
        preventionStrategies: this.extractPreventionStrategies(recommendations),
        urgencyLevel: this.determineUrgencyLevel(riskAssessment, originalAnalysis)
      },
      
      treatmentPlan: await this.generateTreatmentPlan(aiInsights, recommendations, options),
      
      exerciseProgram: aiData.exercisePlan,
      nutritionGuidance: aiData.nutritionAdvice,
      
      lifestyleModifications: this.extractLifestyleModifications(recommendations),
      
      monitoringPlan: {
        checkpoints: this.generateCheckpoints(options),
        selfAssessmentTools: this.generateSelfAssessmentTools(options),
        warningsSigns: this.extractWarningsSigns(riskAssessment, aiInsights),
        reassessmentSchedule: this.determineReassessmentSchedule(originalAnalysis)
      },
      
      expectedOutcomes: this.extractExpectedOutcomes(aiInsights, recommendations),
      redFlags: this.extractRedFlags(riskAssessment, originalAnalysis),
      
      reportMetadata: {
        aiProvider: provider,
        confidence: this.calculateConfidence(originalAnalysis),
        evidenceLevel: this.determineEvidenceLevel(originalAnalysis),
        disclaimers: this.generateDisclaimers(options.language)
      }
    };
  }

  // Helper methods for data extraction
  private extractExecutiveSummary(aiInsights: string): string {
    const lines = aiInsights.split('\n');
    const summaryLines = lines.slice(0, 5).filter(line => line.trim().length > 0);
    return summaryLines.join(' ').substring(0, 500) + '...';
  }

  private extractPrimaryDiagnosis(_aiInsights: string, analysis: EnhancedPostureAnalysisResult): string {
    const primaryType = analysis.advancedKendallAnalysis.postureTypes[0];
    if (primaryType) {
      return `${primaryType.classification} (${primaryType.severity})`;
    }
    return analysis.advancedKendallAnalysis.primaryDysfunction;
  }

  private extractContributingFactors(aiInsights: string, _recommendations: string[]): string[] {
    // Extract factors mentioned in AI insights
    const factorKeywords = ['原因', '要因', '影響', 'による', 'から生じる'];
    const factors: string[] = [];
    
    const lines = aiInsights.split('\n');
    for (const line of lines) {
      if (factorKeywords.some(keyword => line.includes(keyword))) {
        factors.push(line.trim());
      }
    }
    
    return factors.slice(0, 5);
  }

  private extractBiomechanicalAnalysis(aiInsights: string): string {
    const biomechKeywords = ['バイオメカニクス', '生体力学', '筋骨格', '関節', '筋肉'];
    const lines = aiInsights.split('\n');
    
    for (const line of lines) {
      if (biomechKeywords.some(keyword => line.includes(keyword)) && line.length > 50) {
        return line.trim();
      }
    }
    
    return '詳細な生体力学的分析が必要です。';
  }

  private extractImbalances(_aiInsights: string, analysis: EnhancedPostureAnalysisResult): string[] {
    const imbalances: string[] = [];
    
    // From Kendall analysis
    analysis.advancedKendallAnalysis.postureTypes.forEach(type => {
      imbalances.push(...type.musculoskeletalImplications.slice(0, 2));
    });
    
    return [...new Set(imbalances)].slice(0, 5);
  }

  private determineOverallRisk(_riskAssessment: string, analysis: EnhancedPostureAnalysisResult): 'low' | 'moderate' | 'high' | 'severe' {
    const severity = analysis.advancedKendallAnalysis.postureTypes[0]?.severity;
    const riskFactors = analysis.advancedKendallAnalysis.riskFactors.length;
    
    if (severity === 'severe' || riskFactors > 5) return 'severe';
    if (severity === 'moderate' || riskFactors > 3) return 'high';
    if (riskFactors > 1) return 'moderate';
    return 'low';
  }

  private extractSpecificRisks(riskAssessment: string, aiInsights: string): RiskFactor[] {
    // Extract specific risks from AI analysis
    const risks: RiskFactor[] = [];
    
    const riskKeywords = ['リスク', '危険', '可能性', '懸念'];
    const lines = (riskAssessment + '\n' + aiInsights).split('\n');
    
    for (const line of lines) {
      if (riskKeywords.some(keyword => line.includes(keyword))) {
        risks.push({
          factor: line.trim(),
          severity: 'moderate',
          likelihood: 60,
          timeframe: '3-6ヶ月',
          mitigation: ['定期的な運動', '姿勢の改善']
        });
      }
    }
    
    return risks.slice(0, 3);
  }

  private extractPreventionStrategies(recommendations: string[]): string[] {
    return recommendations.filter(rec => 
      rec.includes('予防') || rec.includes('防止') || rec.includes('対策')
    ).slice(0, 5);
  }

  private determineUrgencyLevel(_riskAssessment: string, analysis: EnhancedPostureAnalysisResult): string {
    const severity = analysis.advancedKendallAnalysis.postureTypes[0]?.severity;
    
    switch (severity) {
      case 'severe': return '高優先度 - 早急な対応が必要';
      case 'moderate': return '中優先度 - 2-3週間以内に対応';
      case 'mild': return '低優先度 - 1-2ヶ月以内に対応';
      default: return '評価待ち';
    }
  }

  private async generateTreatmentPlan(
    _aiInsights: string,
    recommendations: string[],
    _options: AIReportOptions
  ): Promise<TreatmentPlan> {
    return {
      phases: [
        {
          name: '初期改善フェーズ',
          duration: '2-4週間',
          objectives: ['急性症状の軽減', '基本的な姿勢意識の向上'],
          interventions: recommendations.slice(0, 3),
          successCriteria: ['痛みの軽減', '姿勢意識の改善']
        },
        {
          name: '強化フェーズ',
          duration: '4-8週間',
          objectives: ['筋力バランスの改善', '持久力の向上'],
          interventions: recommendations.slice(3, 6),
          successCriteria: ['筋力バランスの改善', '日常活動の改善']
        }
      ],
      duration: '3-6ヶ月',
      frequency: '週2-3回',
      progressMarkers: ['姿勢測定値の改善', '症状の軽減', '機能的改善'],
      modifications: [
        {
          condition: '痛みが増悪した場合',
          modification: '強度を下げ、医師に相談',
          rationale: '安全性を最優先とする'
        }
      ]
    };
  }

  private generateCheckpoints(_options: AIReportOptions): Checkpoint[] {
    return [
      {
        timepoint: '2週間後',
        assessments: ['主観的症状評価', '姿勢写真撮影'],
        expectedProgress: '初期改善の兆候',
        contingencyPlan: '改善が見られない場合は強度調整'
      },
      {
        timepoint: '1ヶ月後',
        assessments: ['詳細姿勢分析', '機能評価'],
        expectedProgress: '客観的指標の改善',
        contingencyPlan: 'プログラムの再評価と調整'
      }
    ];
  }

  private generateSelfAssessmentTools(options: AIReportOptions): string[] {
    const tools = [
      '日常痛みスケール（1-10）',
      '姿勢チェックリスト',
      '活動制限評価'
    ];
    
    if (options.language === 'en') {
      return [
        'Daily Pain Scale (1-10)',
        'Posture Checklist',
        'Activity Limitation Assessment'
      ];
    }
    
    return tools;
  }

  private extractWarningsSigns(riskAssessment: string, aiInsights: string): string[] {
    const warningKeywords = ['注意', '警告', '悪化', '急激'];
    const signs: string[] = [];
    
    const lines = (riskAssessment + '\n' + aiInsights).split('\n');
    for (const line of lines) {
      if (warningKeywords.some(keyword => line.includes(keyword))) {
        signs.push(line.trim());
      }
    }
    
    return signs.slice(0, 5);
  }

  private determineReassessmentSchedule(analysis: EnhancedPostureAnalysisResult): string {
    const severity = analysis.advancedKendallAnalysis.postureTypes[0]?.severity;
    
    switch (severity) {
      case 'severe': return '2週間毎';
      case 'moderate': return '1ヶ月毎';
      case 'mild': return '2-3ヶ月毎';
      default: return '状況に応じて';
    }
  }

  private extractLifestyleModifications(recommendations: string[]): string[] {
    return recommendations.filter(rec => 
      rec.includes('生活') || rec.includes('習慣') || rec.includes('環境')
    ).slice(0, 5);
  }

  private extractExpectedOutcomes(aiInsights: string, _recommendations: string[]): string[] {
    const outcomeKeywords = ['改善', '向上', '軽減', '回復'];
    const outcomes: string[] = [];
    
    const lines = aiInsights.split('\n');
    for (const line of lines) {
      if (outcomeKeywords.some(keyword => line.includes(keyword))) {
        outcomes.push(line.trim());
      }
    }
    
    return outcomes.slice(0, 5);
  }

  private extractRedFlags(_riskAssessment: string, analysis: EnhancedPostureAnalysisResult): string[] {
    const redFlags = [
      '急激な痛みの増悪',
      '神経症状の出現',
      '運動制限の悪化',
      '生活の質の著しい低下'
    ];
    
    // Add analysis-specific red flags
    if (analysis.advancedKendallAnalysis.riskFactors.length > 3) {
      redFlags.push('複数のリスク要因の同時発生');
    }
    
    return redFlags;
  }

  private calculateConfidence(analysis: EnhancedPostureAnalysisResult): number {
    const postureType = analysis.advancedKendallAnalysis.postureTypes[0];
    return postureType?.confidence || 0.75;
  }

  private determineEvidenceLevel(analysis: EnhancedPostureAnalysisResult): string {
    const confidence = this.calculateConfidence(analysis);
    
    if (confidence >= 0.9) return 'High Evidence';
    if (confidence >= 0.75) return 'Moderate Evidence';
    if (confidence >= 0.6) return 'Low Evidence';
    return 'Limited Evidence';
  }

  private generateDisclaimers(language: 'ja' | 'en'): string[] {
    if (language === 'en') {
      return [
        'This AI-generated report is for educational purposes only',
        'Not intended for medical diagnosis or treatment decisions',
        'Consult qualified healthcare professionals for medical advice',
        'Individual results may vary'
      ];
    }
    
    return [
      'このAI生成レポートは教育目的のみです',
      '医療診断や治療決定には使用しないでください',
      '医学的助言については資格を持つ医療従事者にご相談ください',
      '個人差があることをご理解ください'
    ];
  }

  // Cache management
  private cacheReport(report: AIGeneratedReport): void {
    this.reports.set(report.id, report);
    this.saveReportsToCache();
  }

  private loadReportsFromCache(): void {
    try {
      const cached = localStorage.getItem(this.REPORT_CACHE_KEY);
      if (cached) {
        const reportsArray = JSON.parse(cached);
        reportsArray.forEach((report: AIGeneratedReport) => {
          this.reports.set(report.id, report);
        });
      }
    } catch (error) {
      console.warn('Failed to load cached AI reports:', error);
    }
  }

  private saveReportsToCache(): void {
    try {
      const reportsArray = Array.from(this.reports.values());
      // Keep only last 10 reports to manage storage
      const recentReports = reportsArray
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);
      
      localStorage.setItem(this.REPORT_CACHE_KEY, JSON.stringify(recentReports));
    } catch (error) {
      console.warn('Failed to save AI reports to cache:', error);
    }
  }

  // Public methods
  getReport(reportId: string): AIGeneratedReport | undefined {
    return this.reports.get(reportId);
  }

  getAllReports(): AIGeneratedReport[] {
    return Array.from(this.reports.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  deleteReport(reportId: string): boolean {
    const deleted = this.reports.delete(reportId);
    if (deleted) {
      this.saveReportsToCache();
    }
    return deleted;
  }

  clearAllReports(): void {
    this.reports.clear();
    localStorage.removeItem(this.REPORT_CACHE_KEY);
  }

  // Get available AI providers
  getAvailableProviders(): string[] {
    return apiConfigService.getEnabledEndpoints().map(ep => ep.provider);
  }

  // Check if AI features are available
  isAIAvailable(): boolean {
    return apiConfigService.getEnabledEndpoints().length > 0;
  }
}

export const aiReportService = new AIReportService();