'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Association,
  Character,
  CharacterFormData,
  Class,
  Occupation,
  Place,
  Race,
  State,
} from '@/types';
import Button from './Button';
import './CharacterTable.css';

interface CharacterTableProps {
  characters: Character[];
  states: State[];
  classes: Class[];
  races: Race[];
  occupations: Occupation[];
  associations: Association[];
  places: Place[];
  onAdd: (character: CharacterFormData) => void;
  onEdit: (id: string, character: CharacterFormData) => void;
  onDelete: (id: string) => void;
}

const emptyFormData: CharacterFormData = {
  name: '',
  description: '',
  image_url: '',
  image_file: null,
  age: '',
  state_id: '',
  class_ids: [],
  race_ids: [],
  occupation_ids: [],
  association_ids: [],
  place_ids: [],
};

export default function CharacterTable({
  characters,
  states,
  classes,
  races,
  occupations,
  associations,
  places,
  onAdd,
  onEdit,
  onDelete,
}: CharacterTableProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CharacterFormData>(emptyFormData);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [imageSource, setImageSource] = useState<'url' | 'upload'>('url');
  const [imagePreview, setImagePreview] = useState<string>('');
  const baseImageUrl = 'https://placehold.co/200x400?text=';

  const toggleSelection = (
    key: 'class_ids' | 'race_ids' | 'occupation_ids' | 'association_ids' | 'place_ids',
    value: string,
  ) => {
    setFormData((current) => {
      const list = current[key];
      const hasValue = list.includes(value);
      return {
        ...current,
        [key]: hasValue ? list.filter((item) => item !== value) : [...list, value],
      };
    });
  };

  const optionMaps = useMemo(
    () => ({
      class_ids: classes,
      race_ids: races,
      occupation_ids: occupations,
      association_ids: associations,
      place_ids: places,
    }),
    [classes, races, occupations, associations, places],
  );

  useEffect(() => {
    if (imageSource === 'url' && !formData.image_url) {
      setFormData((current) => ({
        ...current,
        image_url: baseImageUrl,
      }));
    }

    if (imageSource === 'upload' && formData.image_file) {
      const previewUrl = URL.createObjectURL(formData.image_file);
      setImagePreview(previewUrl);
      return () => {
        URL.revokeObjectURL(previewUrl);
      };
    }

    if (imageSource === 'url' && formData.image_url.trim()) {
      setImagePreview(formData.image_url.trim());
      return;
    }

    setImagePreview('');
  }, [imageSource, formData.image_file, formData.image_url]);

  const AttributePicker = ({
    label,
    fieldKey,
    options,
    selectedIds,
    onAdd,
    onRemove,
    single = false,
  }: {
    label: string;
    fieldKey: string;
    options: { id: string; name: string }[];
    selectedIds: string[];
    onAdd: (id: string) => void;
    onRemove: (id: string) => void;
    single?: boolean;
  }) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const isOpen = openMenu === fieldKey;
    const selectedItems = options.filter((option) => selectedIds.includes(option.id));

    useEffect(() => {
      if (!isOpen) return;
      const handleClickOutside = (event: MouseEvent) => {
        if (!ref.current) return;
        if (!ref.current.contains(event.target as Node)) {
          setOpenMenu(null);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen]);

    return (
      <div className="attribute-picker" ref={ref}>
        <div className="attribute-picker__header">
          <span className="attribute-picker__label">{label}</span>
          <button
            type="button"
            className="attribute-picker__add"
            onClick={() => setOpenMenu(isOpen ? null : fieldKey)}
          >
            +
          </button>
        </div>
        {isOpen && (
          <div className="attribute-picker__menu">
            {options.map((option) => {
              const isSelected = selectedIds.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`attribute-picker__option ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => {
                    if (single) {
                      onAdd(option.id);
                      setOpenMenu(null);
                      return;
                    }
                    if (isSelected) {
                      onRemove(option.id);
                    } else {
                      onAdd(option.id);
                    }
                  }}
                >
                  <span>{option.name}</span>
                  {isSelected && <span className="attribute-picker__check">v</span>}
                </button>
              );
            })}
          </div>
        )}
        <div className="attribute-picker__tags">
          {selectedItems.length === 0 ? (
            <span className="attribute-picker__empty">None</span>
          ) : (
            selectedItems.map((item) => (
              <span key={item.id} className="attribute-picker__tag">
                {item.name}
                <button
                  type="button"
                  className="attribute-picker__remove"
                  onClick={() => onRemove(item.id)}
                >
                  x
                </button>
              </span>
            ))
          )}
        </div>
      </div>
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      onEdit(editingId, formData);
      setEditingId(null);
    } else {
      onAdd(formData);
      setIsAdding(false);
    }
    setFormData(emptyFormData);
    setImageSource('url');
  };

  const handleEdit = (character: Character) => {
    setEditingId(character.id);
    setFormData({
      name: character.name,
      description: character.description || '',
      image_url: character.image_url || '',
      image_file: null,
      age: character.age ?? '',
      state_id: character.state?.id || '',
      class_ids: character.classes.map((item) => item.id),
      race_ids: character.races.map((item) => item.id),
      occupation_ids: character.occupations.map((item) => item.id),
      association_ids: character.associations.map((item) => item.id),
      place_ids: character.places.map((item) => item.id),
    });
    setIsAdding(true);
    setImageSource(character.image_url ? 'url' : 'upload');
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(emptyFormData);
    setImageSource('url');
  };

  const formatList = (items: { name: string }[]) =>
    items.length > 0 ? items.map((item) => item.name).join(', ') : '-';

  return (
    <div className="character-table">
      <div className="character-table__header">
        <h2>Characters</h2>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)}>
            Add Character
          </Button>
        )}
      </div>

      {isAdding && (
        <form className="character-form" onSubmit={handleSubmit}>
          <div className="character-form__grid">
            <div className="character-form__field character-form__field--wide">
              <label>Image</label>
              <div className="character-form__media">
                <div className="character-form__media-preview">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" />
                  ) : (
                    <span>No preview</span>
                  )}
                </div>
                <div className="character-form__media-controls">
                  <div className="character-form__toggle">
                    <button
                      type="button"
                      className={imageSource === 'url' ? 'is-active' : ''}
                      onClick={() => {
                        setImageSource('url');
                        setFormData((current) => ({
                          ...current,
                          image_url: current.image_url || baseImageUrl,
                        }));
                      }}
                    >
                      Use URL
                    </button>
                    <button
                      type="button"
                      className={imageSource === 'upload' ? 'is-active' : ''}
                      onClick={() => setImageSource('upload')}
                    >
                      Upload file
                    </button>
                  </div>
                  {imageSource === 'url' ? (
                    <input
                      id="image_url"
                      type="url"
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      placeholder={baseImageUrl}
                    />
                  ) : (
                    <div className="character-form__file">
                      <input
                        id="image_file"
                        type="file"
                        accept="image/*"
                        className="character-form__file-input"
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            image_file: e.target.files?.[0] ?? null,
                          })
                        }
                      />
                      <label htmlFor="image_file" className="character-form__file-button">
                        Choose file
                      </label>
                      <span className="character-form__file-name">
                        {formData.image_file?.name || 'No file selected'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="character-form__row character-form__row--two">
              <div className="character-form__field">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="character-form__field">
                <label htmlFor="age">Age</label>
                <input
                  id="age"
                  type="number"
                  min={0}
                  value={formData.age}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      age: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div className="character-form__attributes">
              <AttributePicker
                label="State"
                fieldKey="state_id"
                options={states}
                selectedIds={formData.state_id ? [formData.state_id] : []}
                onAdd={(id) => setFormData({ ...formData, state_id: id })}
                onRemove={() => setFormData({ ...formData, state_id: '' })}
                single
              />
              <AttributePicker
                label="Classes"
                fieldKey="class_ids"
                options={optionMaps.class_ids}
                selectedIds={formData.class_ids}
                onAdd={(id) => toggleSelection('class_ids', id)}
                onRemove={(id) => toggleSelection('class_ids', id)}
              />
              <AttributePicker
                label="Races"
                fieldKey="race_ids"
                options={optionMaps.race_ids}
                selectedIds={formData.race_ids}
                onAdd={(id) => toggleSelection('race_ids', id)}
                onRemove={(id) => toggleSelection('race_ids', id)}
              />
              <AttributePicker
                label="Occupations"
                fieldKey="occupation_ids"
                options={optionMaps.occupation_ids}
                selectedIds={formData.occupation_ids}
                onAdd={(id) => toggleSelection('occupation_ids', id)}
                onRemove={(id) => toggleSelection('occupation_ids', id)}
              />
              <AttributePicker
                label="Associations"
                fieldKey="association_ids"
                options={optionMaps.association_ids}
                selectedIds={formData.association_ids}
                onAdd={(id) => toggleSelection('association_ids', id)}
                onRemove={(id) => toggleSelection('association_ids', id)}
              />
              <AttributePicker
                label="Places"
                fieldKey="place_ids"
                options={optionMaps.place_ids}
                selectedIds={formData.place_ids}
                onAdd={(id) => toggleSelection('place_ids', id)}
                onRemove={(id) => toggleSelection('place_ids', id)}
              />
            </div>
          </div>
          <div className="character-form__field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="character-form__actions">
            <Button type="submit">{editingId ? 'Update' : 'Add'}</Button>
            <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="character-table__table-wrapper">
        <table className="character-table__table">
          <thead>
            <tr>
              <th>Name</th>
              <th>State</th>
              <th>Classes</th>
              <th>Races</th>
              <th>Occupations</th>
              <th>Associations</th>
              <th>Places</th>
              <th>Age</th>
              <th>Description</th>
              <th>Image</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {characters.map((character) => (
              <tr key={character.id}>
                <td>{character.name}</td>
                <td>{character.state?.name || '-'}</td>
                <td>{formatList(character.classes)}</td>
                <td>{formatList(character.races)}</td>
                <td>{formatList(character.occupations)}</td>
                <td>{formatList(character.associations)}</td>
                <td>{formatList(character.places)}</td>
                <td>{character.age ?? '-'}</td>
                <td>{character.description || '-'}</td>
                <td>
                  {character.image_url ? (
                    <img
                      src={character.image_url}
                      alt={character.name}
                      className="character-table__image-preview"
                    />
                  ) : (
                    '-'
                  )}
                </td>
                <td className="character-table__actions">
                  <Button variant="secondary" onClick={() => handleEdit(character)}>
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => onDelete(character.id)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
            {characters.length === 0 && (
              <tr>
                <td colSpan={11} className="character-table__empty">
                  No characters found. Add one to get started!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
