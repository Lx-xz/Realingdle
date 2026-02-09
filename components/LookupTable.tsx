'use client';

import { useState } from 'react';
import Button from './Button';
import './LookupTable.css';

interface LookupItem {
  id: string;
  name: string;
}

interface LookupTableProps {
  title: string;
  items: LookupItem[];
  onAdd: (name: string) => void;
  onEdit: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export default function LookupTable({
  title,
  items,
  onAdd,
  onEdit,
  onDelete,
}: LookupTableProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValue, setFormValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValue.trim()) return;

    if (editingId) {
      onEdit(editingId, formValue.trim());
      setEditingId(null);
    } else {
      onAdd(formValue.trim());
      setIsAdding(false);
    }
    setFormValue('');
  };

  const handleEdit = (item: LookupItem) => {
    setEditingId(item.id);
    setFormValue(item.name);
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormValue('');
  };

  return (
    <div className="lookup-table">
      <div className="lookup-table__header">
        <h2>{title}</h2>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)}>Add {title.slice(0, -1)}</Button>
        )}
      </div>

      {isAdding && (
        <form className="lookup-table__form" onSubmit={handleSubmit}>
          <div className="lookup-table__field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              required
              placeholder={`Enter ${title.toLowerCase().slice(0, -1)} name`}
              autoFocus
            />
          </div>
          <div className="lookup-table__actions">
            <Button type="submit">{editingId ? 'Update' : 'Add'}</Button>
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="lookup-table__list">
        {items.length === 0 ? (
          <div className="lookup-table__empty">
            No {title.toLowerCase()} found. Add one to get started!
          </div>
        ) : (
          <table className="lookup-table__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td className="lookup-table__row-actions">
                    <Button variant="secondary" onClick={() => handleEdit(item)}>
                      Edit
                    </Button>
                    <Button variant="danger" onClick={() => onDelete(item.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
