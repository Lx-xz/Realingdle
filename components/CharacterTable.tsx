'use client';

import { useState } from 'react';
import { Character } from '@/types';
import Button from './Button';
import './CharacterTable.css';

interface CharacterTableProps {
  characters: Character[];
  onAdd: (character: Omit<Character, 'id' | 'created_at' | 'updated_at'>) => void;
  onEdit: (id: string, character: Partial<Character>) => void;
  onDelete: (id: string) => void;
}

export default function CharacterTable({ characters, onAdd, onEdit, onDelete }: CharacterTableProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      onEdit(editingId, formData);
      setEditingId(null);
    } else {
      onAdd(formData);
      setIsAdding(false);
    }
    setFormData({ name: '', description: '' });
  };

  const handleEdit = (character: Character) => {
    setEditingId(character.id);
    setFormData({ name: character.name, description: character.description || '' });
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: '', description: '' });
  };

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

      <table className="character-table__table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {characters.map((character) => (
            <tr key={character.id}>
              <td>{character.name}</td>
              <td>{character.description || '-'}</td>
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
              <td colSpan={3} className="character-table__empty">
                No characters found. Add one to get started!
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
