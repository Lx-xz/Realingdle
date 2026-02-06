import './LifeBar.css';

interface LifeBarProps {
  lives: number;
  maxLives?: number;
}

export default function LifeBar({ lives, maxLives = 10 }: LifeBarProps) {
  const percentage = Math.max(0, Math.min(100, (lives / maxLives) * 100));

  return (
    <div className="life-bar">
      <div className="life-bar__label">Lives: {lives}/{maxLives}</div>
      <div className="life-bar__track">
        <div className="life-bar__fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
