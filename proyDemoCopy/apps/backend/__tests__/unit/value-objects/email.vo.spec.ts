import {
  Email,
  InvalidEmailError,
} from '../../../src/modules/users/domain/value-objects/email.vo';

describe('Email (Value Object)', () => {
  describe('create', () => {
    it('crea un email valido', () => {
      const email = Email.create('user@example.com');
      expect(email.value).toBe('user@example.com');
    });

    it('normaliza con trim y lowercase', () => {
      const email = Email.create('  USER@Example.COM  ');
      expect(email.value).toBe('user@example.com');
    });

    it.each([
      'plainaddress',
      '@no-local.com',
      'no-domain@',
      'spaces in@mail.com',
      'no-tld@domain',
      '',
    ])('rechaza email invalido: "%s"', (raw) => {
      expect(() => Email.create(raw)).toThrow(InvalidEmailError);
    });

    it('conserva el valor original (sin normalizar) en el mensaje de error', () => {
      expect(() => Email.create('BAD')).toThrow('Invalid email: BAD');
    });
  });

  describe('equals', () => {
    it('es igual por valor, no por identidad', () => {
      expect(Email.create('a@b.com').equals(Email.create('A@B.COM'))).toBe(true);
    });

    it('es distinto cuando el valor difiere', () => {
      expect(Email.create('a@b.com').equals(Email.create('c@d.com'))).toBe(
        false,
      );
    });
  });
});
