// [FP][SRP] argon2 hash/verify puro
import * as argon2 from 'argon2';

export const hashPassword = (plain: string): Promise<string> => argon2.hash(plain);

export const verifyPassword = async (hash: string, plain: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
};
