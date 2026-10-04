import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Pencil } from 'lucide-react';
import { ActionMenu, getActionMenuPosition, shouldDismissActionMenu } from './ActionMenu';

describe('Feature: Shared dashboard action menu (AC48)', () => {
  it('Scenario: Trigger exposes a named closed menu, without rendering hidden actions', () => {
    const html = renderToStaticMarkup(React.createElement(ActionMenu, { label: 'Section actions', items: [{ label: 'Edit', icon: Pencil, onSelect: () => {} }] }));
    expect(html).toContain('aria-label="Section actions"');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="menuitem"');
    expect(html).not.toContain('<details');
  });
  it('Scenario: Popup fits mobile width and opens above the trigger when the keyboard leaves little room', () => {
    const normal = getActionMenuPosition({ top: 80, bottom: 124, right: 300 }, 132, { top: 0, left: 0, width: 320, height: 800 });
    expect(normal).toMatchObject({ top: 132, left: 76, width: 224 });
    const keyboard = getActionMenuPosition({ top: 360, bottom: 404, right: 300 }, 132, { top: 0, left: 0, width: 320, height: 420 });
    expect(keyboard.top).toBe(220);
    expect(keyboard.top + Math.min(132, keyboard.maxHeight)).toBeLessThanOrEqual(420);
    const narrow = getActionMenuPosition({ top: 80, bottom: 124, right: 100 }, 400, { top: 30, left: 20, width: 180, height: 300 });
    expect(narrow.left).toBe(28);
    expect(narrow.width).toBe(164);
    expect(narrow.top + narrow.maxHeight).toBeLessThanOrEqual(330);
  });
  it('Scenario: Compact Section popup uses measured longest-label width', () => {
    expect(getActionMenuPosition({ top: 80, bottom: 124, right: 300 }, 132, { top: 0, left: 0, width: 320, height: 800 }, 132)).toMatchObject({ width: 132, left: 168 });
  });
  it('Scenario: Outside pointer or focus dismisses, while trigger and portal interactions do not', () => {
    const target = {} as Node;
    expect(shouldDismissActionMenu(target, { contains: () => false }, { contains: () => false })).toBe(true);
    expect(shouldDismissActionMenu(target, { contains: () => true }, { contains: () => false })).toBe(false);
    expect(shouldDismissActionMenu(target, { contains: () => false }, { contains: () => true })).toBe(false);
    expect(shouldDismissActionMenu(null, null, null)).toBe(false);
  });
});
