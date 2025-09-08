import jsPDF from 'jspdf';
import * as htmlToImage from 'html-to-image';
import { saveAs } from 'file-saver';
import type { EnhancedPostureAnalysisResult } from './EnhancedPostureAnalysisService';

export interface ReportOptions {
  format: 'pdf' | 'png' | 'json';
  includeImages: boolean;
  includeDetailedAnalysis: boolean;
  language: 'ja' | 'en';
}

interface ImageData {
  blob: Blob;
  width: number;
  height: number;
  timestamp: number;
  viewType: 'frontal' | 'sagittal';
}

class ReportGenerationService {
  private readonly PDF_MARGIN = 20;
  private readonly PDF_WIDTH = 210; // A4
  private readonly PDF_HEIGHT = 297; // A4
  
  async generateReport(
    analysisResult: EnhancedPostureAnalysisResult,
    originalImages: { frontal: ImageData; sagittal: ImageData },
    options: ReportOptions
  ): Promise<void> {
    switch (options.format) {
      case 'pdf':
        await this.generatePDFReport(analysisResult, originalImages, options);
        break;
      case 'png':
        await this.generateImageReport(analysisResult, options);
        break;
      case 'json':
        this.generateJSONReport(analysisResult, options);
        break;
    }
  }

  private async generatePDFReport(
    analysisResult: EnhancedPostureAnalysisResult,
    originalImages: { frontal: ImageData; sagittal: ImageData },
    options: ReportOptions
  ): Promise<void> {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Add custom fonts for Japanese support
    // Note: In production, you'd need to add a Japanese font like NotoSansJP
    
    let yPosition = this.PDF_MARGIN;

    // Title
    pdf.setFontSize(24);
    pdf.text('姿勢分析レポート', this.PDF_WIDTH / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Date
    pdf.setFontSize(12);
    const date = new Date(analysisResult.timestamp);
    pdf.text(`分析日: ${date.toLocaleDateString('ja-JP')}`, this.PDF_WIDTH / 2, yPosition, { align: 'center' });
    yPosition += 20;

    // Add images if requested
    if (options.includeImages && originalImages) {
      const imgWidth = 80;
      const imgHeight = imgWidth * 1.5; // Assume 2:3 aspect ratio
      
      // Frontal image
      const frontalDataUrl = await this.blobToDataURL(originalImages.frontal.blob);
      pdf.addImage(frontalDataUrl, 'PNG', this.PDF_MARGIN, yPosition, imgWidth, imgHeight);
      
      // Sagittal image
      const sagittalDataUrl = await this.blobToDataURL(originalImages.sagittal.blob);
      pdf.addImage(sagittalDataUrl, 'PNG', this.PDF_WIDTH - this.PDF_MARGIN - imgWidth, yPosition, imgWidth, imgHeight);
      
      yPosition += imgHeight + 10;
    }

    // Primary dysfunction
    pdf.setFontSize(16);
    pdf.text('主要機能異常', this.PDF_MARGIN, yPosition);
    yPosition += 10;
    
    pdf.setFontSize(12);
    pdf.text(analysisResult.advancedKendallAnalysis.primaryDysfunction, this.PDF_MARGIN, yPosition);
    yPosition += 15;

    // Posture types
    if (options.includeDetailedAnalysis) {
      pdf.setFontSize(16);
      pdf.text('姿勢タイプ詳細', this.PDF_MARGIN, yPosition);
      yPosition += 10;

      for (const postureType of analysisResult.advancedKendallAnalysis.postureTypes) {
        // Check if we need a new page
        if (yPosition > this.PDF_HEIGHT - 50) {
          pdf.addPage();
          yPosition = this.PDF_MARGIN;
        }

        pdf.setFontSize(14);
        pdf.text(postureType.classification, this.PDF_MARGIN, yPosition);
        yPosition += 8;

        pdf.setFontSize(11);
        const descriptionLines = pdf.splitTextToSize(postureType.description, this.PDF_WIDTH - 2 * this.PDF_MARGIN);
        pdf.text(descriptionLines, this.PDF_MARGIN, yPosition);
        yPosition += descriptionLines.length * 5 + 10;
      }
    }

    // Save the PDF
    const filename = `posture-analysis-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);
  }

  private async generateImageReport(
    _analysisResult: EnhancedPostureAnalysisResult,
    _options: ReportOptions
  ): Promise<void> {
    const reportElement = document.querySelector('.report-screen');
    if (!reportElement) {
      throw new Error('Report element not found');
    }

    try {
      const dataUrl = await htmlToImage.toPng(reportElement as HTMLElement, {
        quality: 0.95,
        backgroundColor: '#ffffff',
      });

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Save the image
      const filename = `posture-analysis-${new Date().toISOString().split('T')[0]}.png`;
      saveAs(blob, filename);
    } catch (error) {
      console.error('Failed to generate image report:', error);
      throw error;
    }
  }

  private generateJSONReport(
    analysisResult: EnhancedPostureAnalysisResult,
    options: ReportOptions
  ): void {
    const reportData = {
      metadata: {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        language: options.language,
      },
      analysis: {
        timestamp: analysisResult.timestamp,
        frontalAnalysis: {
          jointAngles: analysisResult.frontal.jointAngles,
          asymmetries: analysisResult.frontal.asymmetries,
        },
        sagittalAnalysis: {
          jointAngles: analysisResult.sagittal.jointAngles,
          alignment: analysisResult.sagittal.alignment,
        },
        kendallClassification: analysisResult.kendallClassification,
        advancedKendallAnalysis: options.includeDetailedAnalysis 
          ? analysisResult.advancedKendallAnalysis 
          : {
              primaryDysfunction: analysisResult.advancedKendallAnalysis.primaryDysfunction,
              postureTypes: analysisResult.advancedKendallAnalysis.postureTypes.map(pt => ({
                classification: pt.classification,
                severity: pt.severity,
                prognosis: pt.prognosis,
              }))
            }
      }
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });

    const filename = `posture-analysis-${new Date().toISOString().split('T')[0]}.json`;
    saveAs(blob, filename);
  }

  private async blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const reportGenerationService = new ReportGenerationService();