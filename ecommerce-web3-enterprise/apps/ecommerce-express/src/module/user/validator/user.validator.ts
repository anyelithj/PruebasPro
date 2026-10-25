// user.validator.ts => validaciones que NO son de "forma" (eso ya lo hace Zod) sino de "estado en DB"
// (ej. unicidad de email contra la base de datos real). Se separan del Schema porque requieren I/O (async).
import { userRepository, type UserRepository } from "../repository/user.repository";

export class UserValidator {
  private readonly repository: UserRepository;

  constructor(repository: UserRepository) {
    this.repository = repository;
  }

  // isEmailUnique => true si NINGÚN otro usuario (distinto de "excludeUserId") ya usa ese email
  public async isEmailUnique(email: string, excludeUserId?: string): Promise<boolean> {
    const existingUser = await this.repository.findByEmailIncludingInactive(email);

    // Si no existe nadie con ese email, es único por definición
    if (!existingUser) return true;

    // Si existe, es "único" solo si el que lo tiene es el MISMO usuario que se está actualizando
    // (permite que un usuario guarde su perfil sin cambiar el email y no se autobloquee)
    return existingUser.id === excludeUserId;
  }

  // isColombianPhoneFormat => validación de negocio explícita y reutilizable (además del regex de Zod)
  public isColombianPhoneFormat(phone: string): boolean {
    // Regex: opcional "+57", luego "3" (todos los celulares colombianos inician en 3), luego 9 dígitos más
    return /^(\+57)?3\d{9}$/.test(phone);
  }
}

export const userValidator = new UserValidator(userRepository);
