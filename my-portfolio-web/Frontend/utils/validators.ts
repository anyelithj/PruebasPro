// // utils/validators.ts
// export const isValidEmail = (email: string): boolean => {
//   const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
//   return regex.test(email)
// }
// 📁 utils/validators.ts
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

export function isNotEmpty(value: string): boolean {
  return value.trim().length > 0
}


