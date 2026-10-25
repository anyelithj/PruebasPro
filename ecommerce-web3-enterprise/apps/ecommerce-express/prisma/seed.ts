// seed.ts => script ejecutado con "pnpm prisma:seed"; puebla datos MÍNIMOS para poder probar
// el sistema (RBAC completo, un usuario por rol, catálogo de muestra, cupón). Nunca contiene datos de producción reales.
// IDEMPOTENTE: usa "upsert" en todo => correrlo 2 veces no duplica datos (seguro en CI y en cada "docker compose up").
import { PrismaClient, Prisma } from "@prisma/client"; // Cliente tipado generado a partir de schema.prisma
import bcrypt from "bcrypt";
import { Actions, Resources, RolePolicies, Roles } from "../src/shared/constants/roles.constants"; // Fuente única RBAC (DRY)

// Instancia única de PrismaClient para este script (Singleton local, se cierra al final)
const prisma = new PrismaClient();

// Imágenes de muestra del CDN público de Cloudinary ("demo"): dominio ya permitido en next.config.ts
const DEMO_IMAGE = (publicId: string) => `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/${publicId}`;
// Fotos de accesorios (perfumes, bolsos, relojes, gafas) que el CDN "demo" no tiene: Unsplash, ya permitido en next.config.ts
// Operador ternario => una URL absoluta se usa tal cual; un publicId se resuelve contra Cloudinary (Strategy por origen)
const IMAGE = (source: string) => (source.startsWith("https://") ? source : DEMO_IMAGE(source));
const UNSPLASH = (id: string) => `https://images.unsplash.com/photo-${id}?w=864&q=75&auto=format`;

// --- 1. RBAC: todos los permisos ACCIÓN × recurso + roles base ---
async function seedRbac(): Promise<void> {
  // "flatMap" => producto cartesiano Actions × Resources en un arreglo plano (programación funcional)
  const allPermissions = Resources.flatMap((resource) => Actions.map((action) => ({ action, resource })));

  // "Promise.all" => ejecuta todas las creaciones EN PARALELO (asíncrono no bloqueante),
  // más rápido que un "for" con await secuencial cuando las operaciones son independientes entre sí
  const created = await Promise.all(
    allPermissions.map((permission) =>
      prisma.permission.upsert({
        where: { action_resource: permission },
        update: {},
        create: { ...permission, description: `${permission.action} sobre ${permission.resource}` },
      })
    )
  );
  // Índice "ACCIÓN:recurso" -> id para resolver las políticas por rol
  const idByCode = new Map(created.map((permission) => [`${permission.action}:${permission.resource}`, permission.id]));

  // ADMIN => todos los permisos | VENDOR/CUSTOMER => los definidos en RolePolicies (roles.constants.ts)
  const policies: Record<string, string[]> = {
    [Roles.ADMIN]: created.map((permission) => permission.id),
    [Roles.VENDOR]: RolePolicies.VENDOR.map((code) => idByCode.get(code)).filter((id): id is string => Boolean(id)),
    [Roles.CUSTOMER]: [],
  };
  const descriptions: Record<string, string> = {
    [Roles.ADMIN]: "Acceso total a la plataforma",
    [Roles.VENDOR]: "Gestión de catálogo propio y despacho",
    [Roles.CUSTOMER]: "Rol por defecto de comprador final",
  };

  // "Object.entries" + "for...of" => itera las políticas; secuencial porque cada rol hace varias escrituras
  for (const [name, permissionIds] of Object.entries(policies)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { description: descriptions[name] ?? null },
      create: { name, description: descriptions[name] ?? null },
    });
    // Reemplazo idempotente de la relación N-N (borrar + crear) => la política del código es la verdad
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })) });
  }
}

// --- 2. Un usuario de prueba por rol (credenciales configurables por entorno; listadas en PASOS_LEVANTAR_SERVICIOS.md) ---
const SEED_USERS = [
  { role: Roles.ADMIN, env: "ADMIN", email: "admin@ecommerce.local", password: "Admin12345!", firstName: "Admin", lastName: "Plataforma" },
  { role: Roles.VENDOR, env: "VENDOR", email: "vendedor@ecommerce.local", password: "Vendedor12345!", firstName: "Valeria", lastName: "Vendedora" },
  { role: Roles.CUSTOMER, env: "CUSTOMER", email: "cliente@ecommerce.local", password: "Cliente12345!", firstName: "Carlos", lastName: "Cliente" },
] as const;

// seedUsers => crea (o deja intacto si ya existe) cada usuario verificado con su rol; devuelve el ID del admin
async function seedUsers(): Promise<string> {
  const ids = new Map<string, string>();
  for (const seed of SEED_USERS) {
    const email = process.env[`SEED_${seed.env}_EMAIL`] ?? seed.email;
    const password = process.env[`SEED_${seed.env}_PASSWORD`] ?? seed.password;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        firstName: seed.firstName,
        lastName: seed.lastName,
        isVerified: true,
        roles: { create: [{ role: { connect: { name: seed.role } } }] },
        loyaltyAccount: { create: {} },
        notificationPrefs: { create: {} },
      },
    });
    ids.set(seed.role, user.id);
  }
  return ids.get(Roles.ADMIN) as string;
}

// --- 3. Catálogo de muestra: árbol de categorías (Composite), marcas, productos con variantes, colección ---
async function seedCatalog(vendorId: string): Promise<void> {
  const ropa = await prisma.category.upsert({
    where: { slug: "ropa" },
    update: {},
    create: { name: "Ropa", slug: "ropa", description: "Moda para todos", position: 1 },
  });
  const camisetas = await prisma.category.upsert({
    where: { slug: "camisetas" },
    update: {},
    create: { name: "Camisetas", slug: "camisetas", parentId: ropa.id, position: 1 },
  });
  const calzado = await prisma.category.upsert({
    where: { slug: "calzado" },
    update: {},
    create: { name: "Calzado", slug: "calzado", position: 2 },
  });

  // Accesorios => la tienda vende más que prendas: categoría padre con subcategorías (Composite)
  const accesorios = await prisma.category.upsert({
    where: { slug: "accesorios" },
    update: {},
    create: { name: "Accesorios", slug: "accesorios", description: "Perfumes, bolsos, relojes, gafas, belleza, hogar y más", position: 3 },
  });
  // "Promise.all" + "map" => las subcategorías se crean en paralelo; "Object.fromEntries" las indexa por slug
  const accessoryCategories = Object.fromEntries(
    await Promise.all(
      [
        { slug: "perfumes", name: "Perfumes y fragancias" },
        { slug: "bolsos", name: "Bolsos" },
        { slug: "relojes", name: "Relojes" },
        { slug: "gafas", name: "Gafas de sol" },
        { slug: "maquillaje", name: "Maquillaje y labiales" },
        { slug: "cosmeticos", name: "Cosméticos y cuidado de la piel" },
        { slug: "ropa-interior", name: "Ropa interior y descanso" },
        { slug: "velas", name: "Velas" },
        { slug: "aromatizantes", name: "Aromatizantes" },
        { slug: "objetos", name: "Objetos y decoración" },
      ].map(async ({ slug, name }, index) => [
        slug,
        (await prisma.category.upsert({ where: { slug }, update: {}, create: { name, slug, parentId: accesorios.id, position: index + 1 } })).id,
      ])
    )
  ) as Record<"perfumes" | "bolsos" | "relojes" | "gafas" | "maquillaje" | "cosmeticos" | "ropa-interior" | "velas" | "aromatizantes" | "objetos", string>; // "as" => todas las claves existen (se acaban de crear)

  // Portada de cada categoría raíz (la grilla "Compra por categoría" de la tienda). "updateMany" con "imageUrl: null"
  // => solo rellena la que no tiene imagen: nunca pisa la que el administrador ya cambió (idempotente)
  const covers = { ropa: "docs/models.jpg", calzado: "samples/ecommerce/shoes.png", accesorios: "samples/ecommerce/accessories-bag.jpg" };
  await Promise.all(Object.entries(covers).map(([slug, image]) => prisma.category.updateMany({ where: { slug, imageUrl: null }, data: { imageUrl: IMAGE(image) } })));

  const brand = await prisma.brand.upsert({
    where: { slug: "web3-wear" },
    update: {},
    create: { name: "Web3 Wear", slug: "web3-wear", description: "Ropa urbana con coleccionables NFT" },
  });

  // Productos de muestra con variantes y precio en centavos. "option" => atributo que distingue las variantes
  // (talla en ropa y calzado, contenido en perfumes, color en bolsos/relojes/gafas): un solo modelo para todo el catálogo
  type SeedProduct = { slug: string; name: string; categoryId: string; image: string; basePrice: number; option: { key: string; label: string; values: string[] }; weightGrams: number };
  const size = (values: string[]) => ({ key: "size", label: "Talla", values });
  const color = (values: string[]) => ({ key: "color", label: "Color", values });
  const tone = (values: string[]) => ({ key: "tone", label: "Tono", values }); // Maquillaje: mismo precio en todos los tonos
  const scent = (values: string[]) => ({ key: "scent", label: "Aroma", values }); // Velas y aromatizantes
  const format = (values: string[]) => ({ key: "format", label: "Presentación", values });
  // priceOf => precio de la variante N: en perfumes cada tamaño mayor suma $80.000; el resto conserva el precio base
  const priceOf = (item: SeedProduct, index: number) => item.basePrice + index * (item.option.key === "volume" ? 8000000 : 0);
  const products: SeedProduct[] = [
    { slug: "camiseta-genesis", name: "Camiseta Génesis", categoryId: camisetas.id, image: "sample.jpg", basePrice: 7990000, option: size(["S", "M", "L"]), weightGrams: 250 },
    { slug: "camiseta-blockchain", name: "Camiseta Blockchain", categoryId: camisetas.id, image: "couple.jpg", basePrice: 8990000, option: size(["M", "L", "XL"]), weightGrams: 250 },
    { slug: "tenis-metaverso", name: "Tenis Metaverso", categoryId: calzado.id, image: "shoes.png", basePrice: 25990000, option: size(["38", "40", "42"]), weightGrams: 900 },
    { slug: "perfume-nebula", name: "Perfume Nebula Eau de Parfum", categoryId: accessoryCategories.perfumes, image: UNSPLASH("1541643600914-78b084683601"), basePrice: 32990000, option: { key: "volume", label: "Contenido", values: ["50 ml", "100 ml"] }, weightGrams: 400 },
    { slug: "perfume-ether", name: "Perfume Ether Intense", categoryId: accessoryCategories.perfumes, image: UNSPLASH("1594035910387-fea47794261f"), basePrice: 28990000, option: { key: "volume", label: "Contenido", values: ["30 ml", "75 ml"] }, weightGrams: 350 },
    { slug: "bolso-cuero-ledger", name: "Bolso de cuero Ledger", categoryId: accessoryCategories.bolsos, image: "samples/ecommerce/leather-bag-gray.jpg", basePrice: 41990000, option: color(["Gris", "Negro"]), weightGrams: 1100 },
    { slug: "bolso-tote-cripto", name: "Bolso tote Cripto", categoryId: accessoryCategories.bolsos, image: "samples/ecommerce/accessories-bag.jpg", basePrice: 18990000, option: color(["Arena", "Negro"]), weightGrams: 700 },
    { slug: "reloj-hash-clasico", name: "Reloj Hash Clásico", categoryId: accessoryCategories.relojes, image: "samples/ecommerce/analog-classic.jpg", basePrice: 54990000, option: color(["Plata", "Dorado"]), weightGrams: 300 },
    { slug: "gafas-sol-satoshi", name: "Gafas de sol Satoshi", categoryId: accessoryCategories.gafas, image: "sunglasses.jpg", basePrice: 15990000, option: color(["Negro", "Carey"]), weightGrams: 150 },
    // Belleza, hogar y básicos: la categoría Accesorios cubre más que moda (fotos de Unsplash sin marcas visibles)
    { slug: "labial-mate-ruby", name: "Labial mate Ruby", categoryId: accessoryCategories.maquillaje, image: UNSPLASH("1586495777744-4413f21062fa"), basePrice: 4590000, option: tone(["Rojo rubí", "Rosa nude", "Vino"]), weightGrams: 40 },
    { slug: "paleta-sombras-aurora", name: "Paleta de sombras Aurora", categoryId: accessoryCategories.maquillaje, image: UNSPLASH("1512496015851-a90fb38ba796"), basePrice: 8990000, option: tone(["Cálidos", "Fríos"]), weightGrams: 180 },
    { slug: "kit-brochas-glow", name: "Kit de brochas y polvos Glow", categoryId: accessoryCategories.maquillaje, image: UNSPLASH("1596462502278-27bfdc403348"), basePrice: 12990000, option: tone(["Claro", "Medio", "Oscuro"]), weightGrams: 350 },
    { slug: "mascara-pestanas-volumen", name: "Máscara de pestañas Volumen", categoryId: accessoryCategories.maquillaje, image: UNSPLASH("1631214540553-ff044a3ff1d4"), basePrice: 5490000, option: tone(["Negro", "Café"]), weightGrams: 30 },
    { slug: "serum-rodillo-jade", name: "Sérum facial con rodillo de jade", categoryId: accessoryCategories.cosmeticos, image: UNSPLASH("1600428877878-1a0fd85beda8"), basePrice: 9990000, option: format(["Kit completo", "Solo sérum"]), weightGrams: 220 },
    { slug: "crema-hidratante-calma", name: "Crema hidratante Calma", categoryId: accessoryCategories.cosmeticos, image: UNSPLASH("1601049676869-702ea24cfd58"), basePrice: 6990000, option: format(["50 g", "100 g"]), weightGrams: 160 },
    { slug: "serum-vitamina-c", name: "Sérum vitamina C", categoryId: accessoryCategories.cosmeticos, image: UNSPLASH("1608571423902-eed4a5ad8108"), basePrice: 7490000, option: format(["30 ml"]), weightGrams: 90 },
    { slug: "limpiador-facial-suave", name: "Limpiador facial suave", categoryId: accessoryCategories.cosmeticos, image: UNSPLASH("1620916566398-39f1143ab7be"), basePrice: 4290000, option: format(["150 ml", "300 ml"]), weightGrams: 200 },
    { slug: "camiseta-interior-algodon", name: "Camiseta interior de algodón", categoryId: accessoryCategories["ropa-interior"], image: UNSPLASH("1586790170083-2f9ceadc732d"), basePrice: 3990000, option: size(["S", "M", "L", "XL"]), weightGrams: 150 },
    { slug: "pantalon-descanso-rosa", name: "Pantalón de descanso", categoryId: accessoryCategories["ropa-interior"], image: UNSPLASH("1594633312681-425c7b97ccd1"), basePrice: 6990000, option: size(["S", "M", "L"]), weightGrams: 280 },
    { slug: "set-velas-pilar", name: "Set de velas pilar", categoryId: accessoryCategories.velas, image: UNSPLASH("1602523961358-f9f03dd557db"), basePrice: 5990000, option: scent(["Vainilla", "Sándalo"]), weightGrams: 900 },
    { slug: "vela-aromatica-soya", name: "Vela aromática de soya", categoryId: accessoryCategories.velas, image: UNSPLASH("1603006905003-be475563bc59"), basePrice: 4990000, option: scent(["Lavanda", "Coco", "Canela"]), weightGrams: 450 },
    { slug: "kit-aceites-esenciales", name: "Kit de aceites esenciales", categoryId: accessoryCategories.aromatizantes, image: UNSPLASH("1612817288484-6f916006741a"), basePrice: 8490000, option: format(["6 aceites", "12 aceites"]), weightGrams: 400 },
    { slug: "difusor-ambiente-noir", name: "Difusor de ambiente Noir", categoryId: accessoryCategories.aromatizantes, image: UNSPLASH("1567721913486-6585f069b332"), basePrice: 6490000, option: scent(["Ámbar", "Té blanco"]), weightGrams: 500 },
    { slug: "set-tazas-ceramica", name: "Set de tazas de cerámica", categoryId: accessoryCategories.objetos, image: UNSPLASH("1610701596007-11502861dcfa"), basePrice: 7990000, option: color(["Arena", "Blanco"]), weightGrams: 1200 },
    { slug: "organizador-madera", name: "Organizador de madera", categoryId: accessoryCategories.objetos, image: UNSPLASH("1532372320572-cda25653a26d"), basePrice: 11990000, option: color(["Roble", "Nogal"]), weightGrams: 2500 },
    { slug: "panuelo-seda-prisma", name: "Pañuelo de seda Prisma", categoryId: accessoryCategories.objetos, image: UNSPLASH("1617331721458-bd3bd3f9c7f8"), basePrice: 6590000, option: color(["Multicolor"]), weightGrams: 60 },
  ];

  // Colección creada UNA vez antes del bucle; cada producto se vincula a ella
  const collection = await prisma.collection.upsert({
    where: { slug: "lanzamiento" },
    update: {},
    create: { name: "Lanzamiento", slug: "lanzamiento", description: "Primeros productos de la tienda" },
  });

  // ".entries()" => pares [índice, elemento] para usar el índice como posición en la colección
  for (const [index, item] of products.entries()) {
    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: {},
      create: {
        name: item.name,
        slug: item.slug,
        description: `${item.name}: producto de muestra del seed con variantes por ${item.option.label.toLowerCase()}.`,
        status: "ACTIVE",
        categoryId: item.categoryId,
        brandId: brand.id,
        vendorId,
        minPriceCents: item.basePrice,
        maxPriceCents: priceOf(item, item.option.values.length - 1),
        images: { create: [{ url: IMAGE(item.image), publicId: item.slug, alt: item.name, position: 0, width: 864, height: 576 }] },
        variants: {
          create: item.option.values.map((value, valueIndex) => ({
            // SKU sin espacios ni tildes: "50 ml" -> "50ML" (regex \W = todo lo que no sea letra/dígito/_)
            sku: `${item.slug.toUpperCase()}-${value.toUpperCase().replace(/\W/g, "")}`,
            name: `${item.option.label} ${value}`,
            attributes: { [item.option.key]: value } as Prisma.InputJsonValue, // Clave calculada: { size } | { color } | { volume }
            priceCents: priceOf(item, valueIndex),
            stock: 20 + valueIndex * 5,
            weightGrams: item.weightGrams,
          })),
        },
      },
    });
    // Colección destacada con orden manual ("position" = índice del producto en la lista)
    await prisma.collectionProduct.upsert({
      where: { collectionId_productId: { collectionId: collection.id, productId: product.id } },
      update: {},
      create: { collectionId: collection.id, productId: product.id, position: index },
    });
  }
}

// --- 4. Cupón de bienvenida ---
async function seedCoupons(): Promise<void> {
  await prisma.coupon.upsert({
    where: { code: "BIENVENIDA10" },
    update: {},
    create: {
      code: "BIENVENIDA10",
      description: "10% de descuento en tu primera compra (máximo $50.000)",
      type: "PERCENTAGE",
      value: 10,
      maxDiscountCents: 5000000,
      usagePerUser: 1,
      startsAt: new Date(),
    },
  });
}

// "async function main()" => punto de entrada; se usa async porque TODAS las queries de Prisma
// devuelven Promesas (paradigma asíncrono no bloqueante, igual que en los services de Express)
async function main(): Promise<void> {
  await seedRbac();
  const adminId = await seedUsers();
  await seedCatalog(adminId);
  await seedCoupons();
  console.log("Seed completo: RBAC, usuarios admin/vendedor/cliente, catálogo de muestra y cupón BIENVENIDA10");
}

// "main().catch().finally()" => patrón estándar de Prisma para scripts standalone
main()
  .catch((error: unknown) => {
    // "unknown" en vez de "any" en el catch => tipado seguro obligatorio, se debe verificar el tipo antes de usarlo
    console.error("Error ejecutando el seed:", error);
    process.exit(1); // Código de salida distinto de 0 => CI/CD detecta el fallo
  })
  .finally(async () => {
    // "finally" garantiza cerrar la conexión a la DB pase lo que pase (éxito o error)
    await prisma.$disconnect();
  });
