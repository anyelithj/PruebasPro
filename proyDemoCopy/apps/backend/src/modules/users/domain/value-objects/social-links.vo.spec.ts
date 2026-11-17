import { isSocialUrl, socialLinksOf } from './social-links.vo';
// [Spec SocialLinks · 2026-10-28]: la regla única de redes sociales (https + dominio de la red) | [Patrón]: Table-driven tests (`it.each`) | [Principio]: Defensa en profundidad (lo que no pase aquí nunca llega a un href)

describe('isSocialUrl', () => {
  // `it.each` (Jest): una fila = un caso → [red, url, esperado]
  it.each([
    ['linkedin', 'https://www.linkedin.com/in/ana', true],
    ['linkedin', 'https://co.linkedin.com/in/ana', true],
    ['linkedin', 'http://www.linkedin.com/in/ana', false], // solo https
    ['linkedin', 'https://evillinkedin.com/in/ana', false], // dominio parecido
    ['linkedin', 'https://linkedin.com@evil.tld/', false], // credenciales embebidas → host real evil.tld
    ['twitter', 'https://x.com/ana', true],
    ['twitter', 'https://twitter.com/ana', true],
    ['twitter', 'https://x.com.evil.tld/ana', false],
    ['spotify', 'https://open.spotify.com/show/123', true],
    ['youtube', 'https://www.youtube.com/@ana', true],
    ['youtube', 'https://youtu.be/abc', true],
    ['youtube', 'javascript:alert(1)', false],
    ['youtube', 'no es una url', false],
  ] as const)('%s · %s → %s', (network, url, expected) => {
    expect(isSocialUrl(network, url)).toBe(expected);
  });
});

describe('socialLinksOf', () => {
  it('devuelve null en redes vacías o inválidas (re-valida al leer de BD)', () => {
    expect(
      socialLinksOf({
        linkedinUrl: ' https://www.linkedin.com/in/ana ',
        twitterUrl: '',
        spotifyUrl: 'https://evil.tld/x',
        youtubeUrl: null,
      }),
    ).toEqual({
      linkedin: 'https://www.linkedin.com/in/ana',
      twitter: null,
      spotify: null,
      youtube: null,
    });
  });
});
