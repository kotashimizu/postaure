// API Configuration and Integration Service
// Provides optional cloud-based analysis and AI report generation

export interface APIEndpoint {
  id: string;
  name: string;
  url: string;
  apiKey?: string;
  enabled: boolean;
  provider: 'openai' | 'anthropic' | 'google' | 'custom';
  capabilities: APICapability[];
}

export interface APICapability {
  type: 'analysis' | 'report_generation' | 'ai_insights' | 'cloud_storage';
  description: string;
  costPerRequest?: number;
  rateLimit?: {
    requests: number;
    period: 'minute' | 'hour' | 'day';
  };
}

export interface AnalysisAPIRequest {
  frontalImage?: string; // base64
  sagittalImage?: string; // base64
  localAnalysisResults: any;
  preferences: {
    language: 'ja' | 'en';
    includeExercises: boolean;
    includeNutrition: boolean;
    detailLevel: 'basic' | 'detailed' | 'professional';
  };
}

export interface AnalysisAPIResponse {
  success: boolean;
  data?: {
    aiInsights: string;
    recommendations: string[];
    riskAssessment: string;
    exercisePlan?: ExercisePlan;
    nutritionAdvice?: NutritionAdvice;
    followUpSuggestions: string[];
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  usage?: {
    tokens: number;
    cost: number;
    remainingQuota: number;
  };
}

export interface ExercisePlan {
  duration: number; // weeks
  phases: ExercisePhase[];
  progressionCriteria: string[];
}

export interface ExercisePhase {
  name: string;
  duration: number; // days
  exercises: Exercise[];
  frequency: string;
}

export interface Exercise {
  name: string;
  description: string;
  sets: number;
  reps: string;
  duration?: number; // seconds
  imageUrl?: string;
  videoUrl?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  muscleGroups: string[];
}

export interface NutritionAdvice {
  recommendations: string[];
  supplements?: string[];
  hydrationGuidance: string;
  antiInflammatoryFoods: string[];
}

class APIConfigService {
  private readonly CONFIG_KEY = 'postaure_api_config';
  private endpoints: Map<string, APIEndpoint> = new Map();

  constructor() {
    this.loadConfiguration();
    this.initializeDefaultEndpoints();
  }

  // Configuration Management
  private loadConfiguration(): void {
    try {
      const stored = localStorage.getItem(this.CONFIG_KEY);
      if (stored) {
        const config = JSON.parse(stored);
        config.endpoints?.forEach((endpoint: APIEndpoint) => {
          this.endpoints.set(endpoint.id, endpoint);
        });
      }
    } catch (error) {
      console.warn('Failed to load API configuration:', error);
    }
  }

  private saveConfiguration(): void {
    try {
      const config = {
        endpoints: Array.from(this.endpoints.values()),
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save API configuration:', error);
    }
  }

  private initializeDefaultEndpoints(): void {
    // Only initialize if no custom endpoints are configured
    if (this.endpoints.size === 0) {
      const defaultEndpoints: APIEndpoint[] = [
        {
          id: 'openai-gpt4',
          name: 'OpenAI GPT-4 Analysis',
          url: 'https://api.openai.com/v1/chat/completions',
          enabled: false,
          provider: 'openai',
          capabilities: [
            {
              type: 'ai_insights',
              description: 'AI-powered posture analysis insights',
              costPerRequest: 0.03,
              rateLimit: { requests: 60, period: 'minute' }
            },
            {
              type: 'report_generation',
              description: 'Natural language report generation',
              costPerRequest: 0.02
            }
          ]
        },
        {
          id: 'anthropic-claude',
          name: 'Anthropic Claude Analysis',
          url: 'https://api.anthropic.com/v1/messages',
          enabled: false,
          provider: 'anthropic',
          capabilities: [
            {
              type: 'ai_insights',
              description: 'Clinical-grade analysis insights',
              costPerRequest: 0.025
            },
            {
              type: 'report_generation',
              description: 'Professional medical-style reports'
            }
          ]
        }
      ];

      defaultEndpoints.forEach(endpoint => {
        this.endpoints.set(endpoint.id, endpoint);
      });
    }
  }

  // Endpoint Management
  getEndpoints(): APIEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  getEnabledEndpoints(): APIEndpoint[] {
    return this.getEndpoints().filter(endpoint => endpoint.enabled && endpoint.apiKey);
  }

  getEndpoint(id: string): APIEndpoint | undefined {
    return this.endpoints.get(id);
  }

  addEndpoint(endpoint: APIEndpoint): boolean {
    try {
      this.endpoints.set(endpoint.id, endpoint);
      this.saveConfiguration();
      return true;
    } catch (error) {
      console.error('Failed to add endpoint:', error);
      return false;
    }
  }

  updateEndpoint(id: string, updates: Partial<APIEndpoint>): boolean {
    try {
      const existing = this.endpoints.get(id);
      if (existing) {
        const updated = { ...existing, ...updates };
        this.endpoints.set(id, updated);
        this.saveConfiguration();
        return true;
      }
    } catch (error) {
      console.error('Failed to update endpoint:', error);
    }
    return false;
  }

  removeEndpoint(id: string): boolean {
    try {
      const deleted = this.endpoints.delete(id);
      if (deleted) {
        this.saveConfiguration();
      }
      return deleted;
    } catch (error) {
      console.error('Failed to remove endpoint:', error);
      return false;
    }
  }

  // API Communication
  async callAnalysisAPI(
    endpointId: string,
    request: AnalysisAPIRequest
  ): Promise<AnalysisAPIResponse> {
    const endpoint = this.endpoints.get(endpointId);
    
    if (!endpoint || !endpoint.enabled || !endpoint.apiKey) {
      return {
        success: false,
        error: {
          code: 'ENDPOINT_NOT_CONFIGURED',
          message: 'APIエンドポイントが設定されていません'
        }
      };
    }

    try {
      const payload = this.buildAPIPayload(endpoint, request);
      
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(endpoint)
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseAPIResponse(endpoint, data);

    } catch (error) {
      console.error('API call failed:', error);
      return {
        success: false,
        error: {
          code: 'API_REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'APIリクエストが失敗しました',
          details: error
        }
      };
    }
  }

  private getAuthHeaders(endpoint: APIEndpoint): Record<string, string> {
    const headers: Record<string, string> = {};
    
    switch (endpoint.provider) {
      case 'openai':
        headers['Authorization'] = `Bearer ${endpoint.apiKey}`;
        break;
      case 'anthropic':
        headers['x-api-key'] = endpoint.apiKey!;
        headers['anthropic-version'] = '2023-06-01';
        break;
      case 'google':
        headers['Authorization'] = `Bearer ${endpoint.apiKey}`;
        break;
      case 'custom':
        headers['Authorization'] = `Bearer ${endpoint.apiKey}`;
        break;
    }
    
    return headers;
  }

  private buildAPIPayload(endpoint: APIEndpoint, request: AnalysisAPIRequest): any {
    const { localAnalysisResults, preferences } = request;
    
    // Build context from local analysis
    const context = this.buildAnalysisContext(localAnalysisResults);
    
    switch (endpoint.provider) {
      case 'openai':
        return {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt(preferences.language)
            },
            {
              role: 'user',
              content: `姿勢分析結果: ${context}\n\n詳細レベル: ${preferences.detailLevel}\n運動プログラム含む: ${preferences.includeExercises}\n栄養アドバイス含む: ${preferences.includeNutrition}`
            }
          ],
          max_tokens: 2000,
          temperature: 0.7
        };
      
      case 'anthropic':
        return {
          model: 'claude-3-sonnet-20240229',
          messages: [
            {
              role: 'user',
              content: `${this.getSystemPrompt(preferences.language)}\n\n姿勢分析結果: ${context}\n\n詳細レベル: ${preferences.detailLevel}`
            }
          ],
          max_tokens: 2000
        };
      
      default:
        return {
          analysis_data: context,
          preferences: preferences
        };
    }
  }

  private buildAnalysisContext(analysisResults: any): string {
    // Extract key metrics from local analysis
    const context = [];
    
    if (analysisResults.advancedKendallAnalysis) {
      const kendall = analysisResults.advancedKendallAnalysis;
      context.push(`主要機能異常: ${kendall.primaryDysfunction}`);
      
      if (kendall.postureTypes.length > 0) {
        context.push(`姿勢タイプ: ${kendall.postureTypes.map((pt: any) => pt.classification).join(', ')}`);
      }
      
      if (kendall.riskFactors.length > 0) {
        context.push(`リスク要因: ${kendall.riskFactors.join(', ')}`);
      }
    }
    
    if (analysisResults.sagittal?.jointAngles) {
      const cva = analysisResults.sagittal.jointAngles.find((j: any) => j.name === 'Cranio-Vertebral Angle');
      if (cva) {
        context.push(`CVA: ${cva.angle.toFixed(1)}°`);
      }
    }
    
    return context.join('\n');
  }

  private getSystemPrompt(language: 'ja' | 'en'): string {
    if (language === 'en') {
      return `You are a professional posture analysis specialist. Analyze the provided posture assessment data and provide comprehensive insights including:
1. Clinical interpretation of findings
2. Risk assessment and implications
3. Personalized recommendations
4. Exercise and lifestyle modifications
5. Follow-up suggestions

Provide clear, actionable advice suitable for both healthcare providers and patients.`;
    }
    
    return `あなたは姿勢分析の専門家です。提供された姿勢評価データを分析し、以下を含む包括的な洞察を提供してください：
1. 所見の臨床的解釈
2. リスク評価と影響
3. 個別化された推奨事項
4. 運動とライフスタイルの修正
5. フォローアップの提案

医療従事者と患者の両方に適した、明確で実行可能なアドバイスを提供してください。`;
  }

  private parseAPIResponse(endpoint: APIEndpoint, data: any): AnalysisAPIResponse {
    try {
      switch (endpoint.provider) {
        case 'openai':
          return {
            success: true,
            data: {
              aiInsights: data.choices[0].message.content,
              recommendations: this.extractRecommendations(data.choices[0].message.content),
              riskAssessment: this.extractRiskAssessment(data.choices[0].message.content),
              followUpSuggestions: this.extractFollowUp(data.choices[0].message.content)
            },
            usage: {
              tokens: data.usage.total_tokens,
              cost: this.calculateCost(endpoint, data.usage.total_tokens),
              remainingQuota: 0 // Would need to track this separately
            }
          };
        
        case 'anthropic':
          return {
            success: true,
            data: {
              aiInsights: data.content[0].text,
              recommendations: this.extractRecommendations(data.content[0].text),
              riskAssessment: this.extractRiskAssessment(data.content[0].text),
              followUpSuggestions: this.extractFollowUp(data.content[0].text)
            },
            usage: {
              tokens: data.usage.output_tokens,
              cost: this.calculateCost(endpoint, data.usage.output_tokens),
              remainingQuota: 0
            }
          };
        
        default:
          return {
            success: true,
            data: data
          };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'RESPONSE_PARSE_ERROR',
          message: 'APIレスポンスの解析に失敗しました',
          details: error
        }
      };
    }
  }

  private extractRecommendations(text: string): string[] {
    // Simple extraction - in production, use more sophisticated NLP
    const lines = text.split('\n');
    return lines
      .filter(line => line.includes('推奨') || line.includes('おすすめ') || line.includes('改善'))
      .map(line => line.trim())
      .slice(0, 5);
  }

  private extractRiskAssessment(text: string): string {
    const lines = text.split('\n');
    const riskLine = lines.find(line => line.includes('リスク') || line.includes('危険'));
    return riskLine ? riskLine.trim() : '特記すべきリスクは検出されませんでした';
  }

  private extractFollowUp(text: string): string[] {
    const lines = text.split('\n');
    return lines
      .filter(line => line.includes('フォローアップ') || line.includes('次回') || line.includes('継続'))
      .map(line => line.trim())
      .slice(0, 3);
  }

  private calculateCost(endpoint: APIEndpoint, tokens: number): number {
    const capability = endpoint.capabilities.find(cap => cap.type === 'ai_insights');
    if (capability && capability.costPerRequest) {
      return capability.costPerRequest * (tokens / 1000); // Assume cost per 1K tokens
    }
    return 0;
  }

  // Validation
  validateEndpoint(endpoint: Partial<APIEndpoint>): string[] {
    const errors: string[] = [];
    
    if (!endpoint.name?.trim()) {
      errors.push('エンドポイント名は必須です');
    }
    
    if (!endpoint.url?.trim()) {
      errors.push('URLは必須です');
    } else {
      try {
        new URL(endpoint.url);
      } catch {
        errors.push('有効なURLを入力してください');
      }
    }
    
    if (endpoint.enabled && !endpoint.apiKey?.trim()) {
      errors.push('有効にするにはAPIキーが必要です');
    }
    
    return errors;
  }

  // Testing
  async testEndpoint(endpointId: string): Promise<{ success: boolean; message: string; latency?: number }> {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      return { success: false, message: 'エンドポイントが見つかりません' };
    }

    const startTime = Date.now();
    
    try {
      const testRequest: AnalysisAPIRequest = {
        localAnalysisResults: { test: true },
        preferences: {
          language: 'ja',
          includeExercises: false,
          includeNutrition: false,
          detailLevel: 'basic'
        }
      };

      const response = await this.callAnalysisAPI(endpointId, testRequest);
      const latency = Date.now() - startTime;
      
      if (response.success) {
        return { 
          success: true, 
          message: 'エンドポイントは正常に動作しています',
          latency 
        };
      } else {
        return { 
          success: false, 
          message: response.error?.message || 'テストに失敗しました',
          latency 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'テスト中にエラーが発生しました',
        latency: Date.now() - startTime
      };
    }
  }
}

export const apiConfigService = new APIConfigService();