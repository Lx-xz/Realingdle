import { useEffect, useRef, useState } from 'react';
import './SearchBar.css';
import ScrollArea from '../ScrollArea';

interface SearchSuggestion {
  name: string;
  image_url?: string | null;
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  suggestions?: SearchSuggestion[];
  onSelectSuggestion?: (value: string) => void;
  noResultsText?: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function SearchBar({ 
  value, 
  onChange, 
  onSubmit,
  suggestions = [],
  onSelectSuggestion,
  noResultsText = 'No results',
  placeholder = 'Search character...',
  disabled = false
}: SearchBarProps) {
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
      setIsOpen(false);
    }
  };

  const handlePick = (name: string) => {
    onSelectSuggestion?.(name);
    onSubmit(name);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!fieldRef.current) return;
      if (!fieldRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const showDropdown = isOpen && value.trim().length > 0;
  const hasSuggestions = suggestions.length > 0;

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <div className="search-bar__field" ref={fieldRef}>
        <input
          type="text"
          className="search-bar__input"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
        />
        {showDropdown && (
          <ScrollArea className="search-bar__dropdown" maxHeight={220}>
            {hasSuggestions ? (
              <ul className="search-bar__list">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.name} className="search-bar__item">
                    <button
                      type="button"
                      onClick={() => handlePick(suggestion.name)}
                      className="search-bar__option"
                    >
                      {suggestion.image_url ? (
                        <img
                          src={suggestion.image_url}
                          alt={suggestion.name}
                          className="search-bar__avatar"
                        />
                      ) : (
                        <span className="search-bar__avatar search-bar__avatar--placeholder">
                          {suggestion.name.charAt(0)}
                        </span>
                      )}
                      <span className="search-bar__option-text">{suggestion.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="search-bar__empty">{noResultsText}</div>
            )}
          </ScrollArea>
        )}
      </div>
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
