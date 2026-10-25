// user.guard.ts => re-exporta el guard compartido de Auth con el nombre de dominio que espera
// este módulo (según la matriz: "SelfOrAdminGuard: valida req.user.id === params.id || rol ADMIN").
// Se mantiene un archivo propio en /user/guard para respetar la separación de módulos (SRP a nivel de carpeta),
// aunque la implementación real vive en un solo lugar (DRY: auth.guard.ts es la fuente de verdad).
export { selfOrAdminGuard as SelfOrAdminGuard } from "../../auth/guard/auth.guard";
