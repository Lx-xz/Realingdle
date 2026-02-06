import './LifeBar.css';

interface LifeBarProps {
  lives: number;
  maxLives?: number;
}

export default function LifeBar({ lives, maxLives = 10 }: LifeBarProps) {
  const hearts = Array.from({ length: maxLives }, (_, i) => i < lives);

  return (
    <div className="life-bar">
      <div className="life-bar__label">Lives: {lives}/{maxLives}</div>
      <div className="life-bar__hearts">
        {hearts.map((filled, index) => (
          <span key={index} className={`life-bar__heart ${filled ? 'life-bar__heart--filled' : 'life-bar__heart--empty'}`}>
            ♥
          </span>
        ))}
      </div>
    </div>
  );
}
