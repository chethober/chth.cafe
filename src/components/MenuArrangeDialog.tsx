import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Coffee, GripVertical } from 'lucide-react';
import { CategorySelect, MenuItemSelect } from '../db/schema';
import { store } from '../db/store';
import { Button, Dialog, IconButton } from '../ui';
import { CATEGORY_ICONS } from './shared';
import { tr } from '../i18n';

const move = (ids: string[], from: number, to: number) => {
  if (to < 0 || to >= ids.length || from === to) return ids;
  const next = [...ids];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
};

/**
 * A list rows can be dragged within, with up and down buttons for touch screens and keyboards.
 * Each list only accepts its own rows, so an item never lands in another category.
 */
function SortableList({ ids, label, render, onChange, nested }: {
  ids: string[]; label: string; render: (id: string) => { title: React.ReactNode; name: string; extra?: React.ReactNode; aside?: React.ReactNode };
  onChange: (ids: string[]) => void; nested?: boolean;
}) {
  const dragging = useRef<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  return (
    <ol className="ws-sortable" data-nested={nested || undefined} aria-label={label}>
      {ids.map((id, index) => {
        const row = render(id);
        return (
          <li
            key={id}
            className="ws-sortable-row"
            data-dragging={active === id || undefined}
            draggable
            onDragStart={e => { e.stopPropagation(); dragging.current = id; setActive(id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); }}
            onDragOver={e => {
              const from = dragging.current ? ids.indexOf(dragging.current) : -1;
              if (from < 0) return;
              e.preventDefault(); e.stopPropagation();
              if (from !== index) onChange(move(ids, from, index));
            }}
            onDrop={e => { if (dragging.current && ids.includes(dragging.current)) { e.preventDefault(); e.stopPropagation(); } }}
            onDragEnd={e => { e.stopPropagation(); dragging.current = null; setActive(null); }}
          >
            <div className="ws-sortable-head">
              <GripVertical className="ws-sortable-grip" aria-hidden="true" />
              <span className="ws-sortable-title">{row.title}</span>
              {row.aside}
              <span className="ws-sortable-moves">
                <IconButton label={tr('Move {name} up', { name: row.name })} disabled={index === 0} onClick={() => onChange(move(ids, index, index - 1))}><ArrowUp /></IconButton>
                <IconButton label={tr('Move {name} down', { name: row.name })} disabled={index === ids.length - 1} onClick={() => onChange(move(ids, index, index + 1))}><ArrowDown /></IconButton>
              </span>
            </div>
            {row.extra}
          </li>
        );
      })}
    </ol>
  );
}

/** Drag categories, and the items within each, into the order the public menu and the till show them. */
export function MenuArrangeDialog({ open, onClose, categories, menuItems, onSaved }: {
  open: boolean; onClose: () => void; categories: CategorySelect[]; menuItems: MenuItemSelect[]; onSaved: () => void;
}) {
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [itemIds, setItemIds] = useState<Record<string, string[]>>({});
  const [expanded, setExpanded] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    setCategoryIds(categories.map(c => c.id));
    setItemIds(Object.fromEntries(categories.map(c => [c.id, menuItems.filter(i => i.categoryId === c.id).map(i => i.id)])));
    setExpanded([]);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    const before = categories.map(c => c.id).join();
    const changedItems = Object.fromEntries(Object.entries(itemIds).filter(([categoryId, ids]) =>
      ids.join() !== menuItems.filter(i => i.categoryId === categoryId).map(i => i.id).join()));
    if (categoryIds.join() !== before || Object.keys(changedItems).length) store.saveMenuOrder(categoryIds.join() !== before ? categoryIds : null, changedItems);
    onSaved();
    onClose();
  };

  const byId = new Map(categories.map(c => [c.id, c]));
  const itemName = new Map(menuItems.map(i => [i.id, i.name]));
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={tr('Arrange the menu')}
      description={tr('Drag categories and items into place, or use the arrows. The public menu, the till and the kitchen show them in this order.')}
      footer={<><Button variant="ghost" onClick={onClose}>{tr('Cancel')}</Button><Button variant="primary" onClick={save}>{tr('Save order')}</Button></>}
    >
      <SortableList
        ids={categoryIds}
        label={tr('Categories')}
        onChange={setCategoryIds}
        render={id => {
          const cat = byId.get(id)!;
          const items = itemIds[id] || [];
          const isOpen = expanded.includes(id);
          return {
            name: cat.name,
            title: <><span className="muted" style={{ display: 'inline-flex', width: 18 }}>{CATEGORY_ICONS[cat.icon || '']?.icon || <Coffee />}</span><strong className="ws-truncate">{cat.name}</strong></>,
            aside: items.length > 1 && (
              <Button size="sm" variant="ghost" aria-expanded={isOpen} onClick={() => setExpanded(open => isOpen ? open.filter(c => c !== id) : [...open, id])}
                icon={<ChevronDown style={{ transform: isOpen ? 'rotate(180deg)' : undefined }} />}>
                {tr('{count} items', { count: items.length })}
              </Button>
            ),
            extra: isOpen && (
              <SortableList nested ids={items} label={tr('{name} items', { name: cat.name })}
                onChange={next => setItemIds(all => ({ ...all, [id]: next }))}
                render={itemId => ({ name: itemName.get(itemId) || '', title: <span className="ws-truncate">{itemName.get(itemId)}</span> })} />
            )
          };
        }}
      />
    </Dialog>
  );
}
