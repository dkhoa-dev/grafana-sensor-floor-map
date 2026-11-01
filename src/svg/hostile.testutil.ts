import { loadsExternalResource } from './externalRefs';

/**
 * Children of an <svg> mixing harmless drawing (a path, a text label) with markup that must never
 * reach the page: scripts, handlers, foreign HTML, images, resource-loading CSS and a </svg> breakout.
 */
export const HOSTILE_FRAGMENT = [
  '<script>window.pwned = 1</script>',
  '<path d="M0 0 L50 50" stroke="#000" onclick="window.pwned = 2"/>',
  '<image href="https://example.invalid/i.png" width="5" height="5"/>',
  `<rect width="5" height="5" style="fill:image-set('https://example.invalid/s.png' 1x)"/>`,
  '<rect width="5" height="5" fill="url(https://example.invalid/f.svg#p)"/>',
  '<use href="https://example.invalid/sprite.svg#icon"/>',
  '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="window.pwned = 3"></div></foreignObject>',
  '<text x="5" y="20">Corridor</text>',
  '</svg><img src="x" onerror="window.pwned = 4"><svg>',
].join('');

export const HOSTILE_PLAN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${HOSTILE_FRAGMENT}</svg>`;

/** Fails when anything under `root` could run script or load a resource from outside the document. */
export function expectInert(root: Element) {
  expect(root.querySelectorAll('script, foreignObject, image, img, iframe, style')).toHaveLength(0);
  const offending: string[] = [];
  root.querySelectorAll('*').forEach((el) => {
    for (const { name, value } of Array.from(el.attributes)) {
      const lower = name.toLowerCase();
      const badHref = (lower === 'href' || lower.endsWith(':href')) && !value.trim().startsWith('#');
      if (lower.startsWith('on') || badHref || loadsExternalResource(value)) {
        offending.push(`<${el.tagName} ${name}="${value}">`);
      }
    }
  });
  expect(offending).toEqual([]);
}
