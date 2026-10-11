import { buildRouteSlug, fitWithin } from './viewConfigModel';

describe('viewConfigModel', () => {
  it('slugifies the draft title without accents or edge dashes', () => {
    expect(buildRouteSlug('  Sala  Principal! ', 'x')).toBe('sala-principal');
    expect(buildRouteSlug('Cocina Ñandú', 'x')).toBe('cocina-nandu');
  });

  it('falls back to the saved title and then to "view"', () => {
    expect(buildRouteSlug('   ', 'Garaje')).toBe('garaje');
    expect(buildRouteSlug('', '')).toBe('view');
    expect(buildRouteSlug('***', 'Garaje')).toBe('view');
  });

  it('keeps images that already fit', () => {
    expect(fitWithin(800, 600, 1920)).toEqual({ width: 800, height: 600 });
  });

  it('scales landscape and portrait images to the longest side', () => {
    expect(fitWithin(3840, 2160, 1920)).toEqual({ width: 1920, height: 1080 });
    expect(fitWithin(1000, 4000, 1920)).toEqual({ width: 480, height: 1920 });
  });
});
