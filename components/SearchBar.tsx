import './SearchBar.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function SearchBar({ 
  value, 
  onChange, 
  onSubmit,
  placeholder = 'Search character...',
  disabled = false
}: SearchBarProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        className="search-bar__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      <button 
        type="submit" 
        className="search-bar__button"
        disabled={disabled || !value.trim()}
      >
        Guess
      </button>
    </form>
  );
}
