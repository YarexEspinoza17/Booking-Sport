import bcrypt from "bcryptjs";
export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}
