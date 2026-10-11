import { renderToStaticMarkup } from 'react-dom/server';
import { AlertBanner } from './AlertBanner';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { StatusPill } from './StatusPill';

describe('Feature: catalog variants for pattern adoption (pattern adoption V1)', () => {
  describe('Card', () => {
    it('offers a flat surface that is opaque and shadowless', () => {
      const html = renderToStaticMarkup(<Card variant="flat" />);
      expect(html).toContain('bg-card');
      expect(html).toContain('border-border');
      expect(html).not.toContain('shadow-depth');
    });

    it('renders a div by default and a native landmark element on request', () => {
      expect(renderToStaticMarkup(<Card />)).toMatch(/^<div /);
      expect(renderToStaticMarkup(<Card as="article" aria-label="Ficha" />)).toMatch(/^<article [^>]*aria-label="Ficha"/);
      expect(renderToStaticMarkup(<Card as="section" />)).toMatch(/^<section /);
      expect(renderToStaticMarkup(<Card as="aside" />)).toMatch(/^<aside /);
    });

    it('applies the radius token and keeps card as the default', () => {
      expect(renderToStaticMarkup(<Card />)).toContain('rounded-card');
      expect(renderToStaticMarkup(<Card radius="section" />)).toContain('rounded-section');
      expect(renderToStaticMarkup(<Card radius="panel" />)).toContain('rounded-panel');
      expect(renderToStaticMarkup(<Card radius="section" />)).not.toContain('rounded-card');
    });
  });

  describe('StatusPill', () => {
    it('scales text with size and defaults to the existing size', () => {
      expect(renderToStaticMarkup(<StatusPill>x</StatusPill>)).toContain('text-micro');
      expect(renderToStaticMarkup(<StatusPill size="sm">x</StatusPill>)).toContain('text-nano');
      expect(renderToStaticMarkup(<StatusPill size="lg">x</StatusPill>)).toContain('text-caption');
    });

    it('can render as an uppercase status tag', () => {
      const tag = renderToStaticMarkup(<StatusPill uppercase>x</StatusPill>);
      expect(tag).toContain('uppercase');
      expect(tag).toContain('tracking-label');
      expect(renderToStaticMarkup(<StatusPill>x</StatusPill>)).toContain('normal-case');
    });
  });

  describe('AlertBanner', () => {
    it('has a compact size with a smaller icon and radius', () => {
      const compact = renderToStaticMarkup(<AlertBanner size="sm" message="x" />);
      const full = renderToStaticMarkup(<AlertBanner message="x" />);
      expect(compact).toContain('h-8 w-8');
      expect(compact).toContain('rounded-control');
      expect(full).toContain('h-10 w-10');
      expect(full).toContain('rounded-panel');
    });
  });

  describe('EmptyState', () => {
    it('has a dashed variant for in-page empty areas', () => {
      const html = renderToStaticMarkup(<EmptyState variant="dashed" title="Sin datos" />);
      expect(html).toContain('border-dashed');
      expect(html).toContain('Sin datos');
      expect(renderToStaticMarkup(<EmptyState title="Sin datos" />)).not.toContain('border-dashed');
    });
  });
});
