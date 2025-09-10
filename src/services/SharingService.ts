// Web Share API Integration and Sharing Service
// Provides cross-platform sharing capabilities with fallback support

export interface ShareOptions {
  title: string;
  text: string;
  files?: File[];
  url?: string;
}

export interface ShareResult {
  success: boolean;
  method: 'native' | 'clipboard' | 'download' | 'fallback';
  error?: string;
}

class SharingService {

  // Check Web Share API availability
  isNativeShareSupported(): boolean {
    return 'share' in navigator && 'canShare' in navigator;
  }

  // Check if files can be shared natively
  canShareFiles(files?: File[]): boolean {
    if (!this.isNativeShareSupported() || !files?.length) {
      return false;
    }

    try {
      return navigator.canShare({ files });
    } catch {
      return false;
    }
  }

  // Main sharing function with intelligent fallback
  async shareContent(options: ShareOptions): Promise<ShareResult> {
    // Try native Web Share API first
    if (this.isNativeShareSupported()) {
      try {
        const shareData: ShareData = {
          title: options.title,
          text: options.text,
          ...(options.url && { url: options.url })
        };

        // Add files if supported
        if (options.files && this.canShareFiles(options.files)) {
          shareData.files = options.files;
        }

        // Check if the data can be shared
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return { success: true, method: 'native' };
        }
      } catch (error) {
        console.warn('Native share failed:', error);
        // Fall through to fallback methods
      }
    }

    // Fallback methods
    return await this.useFallbackSharing(options);
  }

  // Fallback sharing methods
  private async useFallbackSharing(options: ShareOptions): Promise<ShareResult> {
    // Try clipboard first (modern browsers)
    if (await this.tryClipboardShare(options)) {
      return { success: true, method: 'clipboard' };
    }

    // Try download method for files
    if (options.files?.length) {
      try {
        await this.downloadFiles(options.files);
        return { success: true, method: 'download' };
      } catch (error) {
        return { 
          success: false, 
          method: 'download', 
          error: error instanceof Error ? error.message : 'Download failed' 
        };
      }
    }

    // Final fallback - show sharing modal
    this.showSharingModal(options);
    return { success: true, method: 'fallback' };
  }

  // Clipboard sharing
  private async tryClipboardShare(options: ShareOptions): Promise<boolean> {
    if (!navigator.clipboard?.writeText) {
      return false;
    }

    try {
      const shareText = this.formatShareText(options);
      await navigator.clipboard.writeText(shareText);
      
      // Show notification
      this.showNotification('クリップボードにコピーしました', 'success');
      return true;
    } catch (error) {
      console.warn('Clipboard share failed:', error);
      return false;
    }
  }

  // Format text for sharing
  private formatShareText(options: ShareOptions): string {
    let text = `${options.title}\n\n${options.text}`;
    
    if (options.url) {
      text += `\n\n${options.url}`;
    }

    text += '\n\n#Postaure #姿勢分析 #PostureAnalysis';
    
    return text;
  }

  // Download files method
  private async downloadFiles(files: File[]): Promise<void> {
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }

  // Share analysis results specifically
  async shareAnalysisResults(
    analysisData: any,
    imageBlobs?: { frontal: Blob; sagittal: Blob }
  ): Promise<ShareResult> {
    const shareOptions: ShareOptions = {
      title: 'Postaure - 姿勢分析結果',
      text: this.generateAnalysisShareText(analysisData),
      url: window.location.href
    };

    // Add images if available and supported
    if (imageBlobs) {
      const files: File[] = [];
      
      if (imageBlobs.frontal) {
        files.push(new File([imageBlobs.frontal], 'frontal_analysis.png', { type: 'image/png' }));
      }
      
      if (imageBlobs.sagittal) {
        files.push(new File([imageBlobs.sagittal], 'sagittal_analysis.png', { type: 'image/png' }));
      }

      if (files.length > 0) {
        shareOptions.files = files;
      }
    }

    return await this.shareContent(shareOptions);
  }

  // Generate analysis text for sharing
  private generateAnalysisShareText(analysisData: any): string {
    const { advancedKendallAnalysis } = analysisData;
    
    if (!advancedKendallAnalysis) {
      return '姿勢分析が完了しました。詳細な結果をご確認ください。';
    }

    const lines = [
      '📊 姿勢分析結果',
      '',
      `🎯 主要所見: ${advancedKendallAnalysis.primaryDysfunction}`,
    ];

    // Add posture types if available
    if (advancedKendallAnalysis.postureTypes?.length > 0) {
      lines.push('');
      lines.push('📋 姿勢タイプ:');
      advancedKendallAnalysis.postureTypes.slice(0, 2).forEach((type: any) => {
        lines.push(`• ${type.classification}`);
      });
    }

    // Add risk factors if available
    if (advancedKendallAnalysis.riskFactors?.length > 0) {
      lines.push('');
      lines.push('⚠️ 注意点:');
      advancedKendallAnalysis.riskFactors.slice(0, 3).forEach((risk: string) => {
        lines.push(`• ${risk}`);
      });
    }

    lines.push('');
    lines.push('Postaureで詳細な姿勢分析を実施');

    return lines.join('\n');
  }

  // Share specific image
  async shareImage(imageBlob: Blob, title: string, description: string): Promise<ShareResult> {
    const file = new File([imageBlob], `${title.replace(/\s+/g, '_')}.png`, { 
      type: 'image/png' 
    });

    return await this.shareContent({
      title: `Postaure - ${title}`,
      text: description,
      files: [file]
    });
  }

  // Social media specific sharing
  async shareToSocialMedia(platform: 'twitter' | 'facebook' | 'linkedin', options: ShareOptions): Promise<void> {
    const text = this.formatShareText(options);
    const encodedText = encodeURIComponent(text);
    const encodedUrl = options.url ? encodeURIComponent(options.url) : '';

    let shareUrl = '';

    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}${encodedUrl ? `&url=${encodedUrl}` : ''}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&summary=${encodedText}`;
        break;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
    }
  }

  // Create shareable URL with analysis summary
  generateShareableUrl(analysisId: string, summaryData: any): string {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
      analysis: analysisId,
      summary: btoa(JSON.stringify(summaryData))
    });
    
    return `${baseUrl}/share?${params.toString()}`;
  }

  // Show fallback sharing modal
  private showSharingModal(options: ShareOptions): void {
    const modal = document.createElement('div');
    modal.className = 'sharing-modal-overlay';
    
    modal.innerHTML = `
      <div class="sharing-modal">
        <div class="sharing-modal-header">
          <h3>結果を共有</h3>
          <button class="close-button" onclick="this.closest('.sharing-modal-overlay').remove()">×</button>
        </div>
        <div class="sharing-modal-content">
          <p>以下の方法で結果を共有できます:</p>
          
          <div class="share-methods">
            <button class="share-method" onclick="sharingService.copyToClipboard('${options.title}', '${options.text}')">
              📋 テキストをコピー
            </button>
            
            <button class="share-method" onclick="sharingService.shareToSocialMedia('twitter', ${JSON.stringify(options)})">
              🐦 Twitter
            </button>
            
            <button class="share-method" onclick="sharingService.shareToSocialMedia('facebook', ${JSON.stringify(options)})">
              📘 Facebook
            </button>
            
            <button class="share-method" onclick="sharingService.shareToSocialMedia('linkedin', ${JSON.stringify(options)})">
              💼 LinkedIn
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }, 10000);
  }

  // Manual clipboard copy (exposed for modal buttons)
  async copyToClipboard(title: string, text: string): Promise<void> {
    const shareText = this.formatShareText({ title, text });
    
    try {
      await navigator.clipboard.writeText(shareText);
      this.showNotification('クリップボードにコピーしました', 'success');
    } catch {
      // Fallback for older browsers
      this.fallbackCopyToClipboard(shareText);
    }

    // Close modal if it exists
    const modal = document.querySelector('.sharing-modal-overlay');
    if (modal) {
      modal.remove();
    }
  }

  // Fallback clipboard copy
  private fallbackCopyToClipboard(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      this.showNotification('クリップボードにコピーしました', 'success');
    } catch {
      this.showNotification('コピーに失敗しました', 'error');
    } finally {
      document.body.removeChild(textArea);
    }
  }

  // Show notification
  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Show with animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Auto-remove
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // Check sharing capabilities and show appropriate UI
  getSharingCapabilities(): {
    nativeShare: boolean;
    fileShare: boolean;
    clipboard: boolean;
    socialShare: boolean;
  } {
    return {
      nativeShare: this.isNativeShareSupported(),
      fileShare: this.isNativeShareSupported() && 'canShare' in navigator,
      clipboard: !!navigator.clipboard?.writeText,
      socialShare: true // Always available via URL opening
    };
  }
}

// Export singleton instance
export const sharingService = new SharingService();

// Expose globally for modal buttons
(window as any).sharingService = sharingService;