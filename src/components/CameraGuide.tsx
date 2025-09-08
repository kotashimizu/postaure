interface CameraGuideProps {
  viewType: 'frontal' | 'sagittal';
  isAligned: boolean;
}

export default function CameraGuide({ viewType, isAligned }: CameraGuideProps) {
  const guideColor = isAligned ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.6)';
  const strokeWidth = isAligned ? 3 : 2;

  return (
    <div className="camera-guide-overlay">
      <svg
        viewBox="0 0 300 500"
        className="guide-silhouette"
        style={{ 
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '70%',
          height: '90%',
          zIndex: 2
        }}
      >
        {/* Grid lines */}
        <g className="grid-lines" stroke={guideColor} strokeWidth="1" opacity="0.5">
          {/* Horizontal grid lines */}
          <line x1="0" y1="125" x2="300" y2="125" />
          <line x1="0" y1="250" x2="300" y2="250" />
          <line x1="0" y1="375" x2="300" y2="375" />
          
          {/* Vertical center line */}
          <line x1="150" y1="0" x2="150" y2="500" strokeWidth="2" />
        </g>

        {/* Silhouette guide based on view type */}
        {viewType === 'frontal' ? (
          <g className="frontal-silhouette" fill="none" stroke={guideColor} strokeWidth={strokeWidth}>
            {/* Head */}
            <circle cx="150" cy="80" r="25" />
            
            {/* Shoulders */}
            <line x1="100" y1="130" x2="200" y2="130" />
            <circle cx="100" cy="130" r="3" />
            <circle cx="200" cy="130" r="3" />
            
            {/* Torso */}
            <rect x="125" y="130" width="50" height="120" rx="5" />
            
            {/* Arms */}
            <line x1="100" y1="150" x2="80" y2="220" />
            <line x1="200" y1="150" x2="220" y2="220" />
            
            {/* Pelvis */}
            <line x1="115" y1="250" x2="185" y2="250" />
            <circle cx="115" cy="250" r="3" />
            <circle cx="185" cy="250" r="3" />
            
            {/* Legs */}
            <line x1="130" y1="250" x2="130" y2="400" />
            <line x1="170" y1="250" x2="170" y2="400" />
            
            {/* Feet */}
            <line x1="120" y1="400" x2="140" y2="400" />
            <line x1="160" y1="400" x2="180" y2="400" />
          </g>
        ) : (
          <g className="sagittal-silhouette" fill="none" stroke={guideColor} strokeWidth={strokeWidth}>
            {/* Head profile */}
            <circle cx="170" cy="80" r="25" />
            <circle cx="185" cy="75" r="3" opacity="0.8" /> {/* Ear marker */}
            
            {/* Neck */}
            <line x1="170" y1="105" x2="165" y2="125" />
            
            {/* Shoulder */}
            <circle cx="160" cy="130" r="4" />
            
            {/* Spine curve */}
            <path d="M 160 130 Q 155 190 160 250" />
            
            {/* Torso */}
            <ellipse cx="140" cy="190" rx="20" ry="60" />
            
            {/* Hip */}
            <circle cx="155" cy="250" r="4" />
            
            {/* Thigh */}
            <line x1="155" y1="250" x2="165" y2="320" />
            
            {/* Knee */}
            <circle cx="165" cy="320" r="3" />
            
            {/* Lower leg */}
            <line x1="165" y1="320" x2="160" y2="400" />
            
            {/* Foot */}
            <line x1="145" y1="400" x2="175" y2="400" />
          </g>
        )}

        {/* Alignment indicators */}
        {viewType === 'frontal' && (
          <g className="alignment-indicators">
            <text x="150" y="20" textAnchor="middle" fill={guideColor} fontSize="12">
              肩と骨盤をフレーム内に
            </text>
            <text x="150" y="380" textAnchor="middle" fill={guideColor} fontSize="12">
              足全体が見えるように
            </text>
          </g>
        )}

        {viewType === 'sagittal' && (
          <g className="alignment-indicators">
            <text x="150" y="20" textAnchor="middle" fill={guideColor} fontSize="12">
              耳と肩のラインを確認
            </text>
            <text x="150" y="380" textAnchor="middle" fill={guideColor} fontSize="12">
              真横から撮影
            </text>
          </g>
        )}
      </svg>

      {/* Status indicator */}
      <div 
        className={`alignment-status ${isAligned ? 'aligned' : 'not-aligned'}`}
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          padding: '0.5rem 1rem',
          borderRadius: '20px',
          backgroundColor: isAligned ? 'var(--color-success)' : 'var(--color-warning)',
          color: 'white',
          fontSize: '0.8rem',
          fontWeight: 'bold',
          zIndex: 3
        }}
      >
        {isAligned ? '✓ 適切な位置' : '位置を調整してください'}
      </div>
    </div>
  );
}