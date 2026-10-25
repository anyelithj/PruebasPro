// seed-demo.ts => "pnpm prisma:seed:demo": datos de DEMOSTRACIÓN realistas para que el panel muestre gráficas y tablas
// con contenido (ventas de 12 meses, clientes, pedidos, envíos, facturas, devoluciones, reseñas, fidelidad, proveedores
// y órdenes de compra en PostgreSQL; eventos de analítica, movimientos de inventario, campañas y CRM en MongoDB).
// Requiere el seed base (pnpm prisma:seed: catálogo y usuarios). Datos ficticios: nunca correr en producción.
// IDEMPOTENTE: si ya existen pedidos "DEMO-" no vuelve a crearlos (cada parte se salta si ya está). Determinista:
// generador pseudoaleatorio con semilla fija (mismo resultado en cada máquina).
import "dotenv/config";
import { PrismaClient, type OrderChannel, type OrderStatus, type ShipmentStatus, type RefundReason, type RefundStatus, type RefundResolution, type LoyaltyTier } from "@prisma/client";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

// mulberry32 => PRNG de 32 bits con semilla: datos idénticos en cada ejecución (reproducible, sin dependencias)
let seed = 20261011;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)] as T;
// weighted => elige según pesos ([valor, peso])
const weighted = <T>(pairs: ReadonlyArray<readonly [T, number]>): T => {
  let roll = rand() * pairs.reduce((sum, [, w]) => sum + w, 0);
  for (const [value, w] of pairs) if ((roll -= w) <= 0) return value;
  return pairs[pairs.length - 1]![0];
};
const hex = (length: number) => Array.from({ length }, () => Math.floor(rand() * 16).toString(16)).join("");
const at = (daysAgo: number, hour = int(8, 22)) => new Date(NOW - daysAgo * DAY - (24 - hour) * 3600_000 + int(0, 3599) * 1000);

const FIRST = ["Laura", "Andrés", "Camila", "Santiago", "Valentina", "Juan", "Mariana", "Sebastián", "Daniela", "Felipe", "Sofía", "Mateo", "Isabella", "Nicolás", "Paula", "Alejandro", "Natalia", "Tomás", "Gabriela", "Julián", "Manuela", "David", "Lucía", "Samuel", "Carolina"];
const LAST = ["Gómez", "Rodríguez", "Martínez", "López", "García", "Hernández", "Ramírez", "Torres", "Díaz", "Moreno", "Vargas", "Rojas", "Castro", "Ortiz", "Jiménez", "Restrepo", "Cardona", "Mejía", "Ospina", "Valencia"];
const CITIES = [
  ["Bogotá", "Cundinamarca", "110111", 30],
  ["Medellín", "Antioquia", "050021", 22],
  ["Cali", "Valle del Cauca", "760001", 15],
  ["Barranquilla", "Atlántico", "080001", 10],
  ["Cartagena", "Bolívar", "130001", 7],
  ["Bucaramanga", "Santander", "680001", 7],
  ["Pereira", "Risaralda", "660001", 5],
  ["Manizales", "Caldas", "170001", 4],
] as const;
const CARRIERS = [["SERVIENTREGA", "Servientrega"], ["COORDINADORA", "Coordinadora"], ["DEPRISA", "Deprisa"]] as const;
const PROVIDERS = [["STRIPE", 45], ["PSE", 25], ["CASH_ON_DELIVERY", 15], ["BANK_TRANSFER", 8], ["CRYPTO", 7]] as const;
const CHANNELS: ReadonlyArray<readonly [OrderChannel, number]> = [["WEB", 68], ["SOCIAL", 17], ["MARKETING", 11], ["MANUAL", 4]];
const SOURCES = [["google", 32], ["direct", 24], ["instagram", 16], ["facebook", 10], ["tiktok", 8], ["email", 7], ["whatsapp", 3]] as const;

// dayWeight => estacionalidad de ventas: crecimiento a lo largo del año, fines de semana y picos de Black Friday y diciembre
function dayWeight(daysAgo: number): number {
  const date = new Date(NOW - daysAgo * DAY);
  const growth = 0.55 + (365 - daysAgo) / 365; // El negocio crece: más pedidos recientes
  const weekend = [0, 6].includes(date.getDay()) ? 1.25 : 1;
  const month = date.getMonth();
  const day = date.getDate();
  const season = month === 10 && day >= 24 && day <= 30 ? 3 : month === 11 && day <= 24 ? 1.8 : month === 4 && day <= 12 ? 1.4 : 1; // Black Friday, Navidad, Día de la Madre
  return growth * weekend * season;
}

const ORDER_COUNT = 420;
const CUSTOMER_COUNT = 48;

async function seedPostgres() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env["SEED_ADMIN_EMAIL"] ?? "admin@ecommerce.local" } });
  if (await prisma.order.count({ where: { orderNumber: { startsWith: "DEMO-" } } })) {
    console.log("PostgreSQL: ya hay pedidos DEMO-, se omite (borra los datos demo para regenerarlos)");
    return admin.id;
  }
  const variants = await prisma.productVariant.findMany({ where: { product: { status: "ACTIVE" } }, include: { product: { include: { images: { take: 1, orderBy: { position: "asc" } } } } } });
  if (!variants.length) throw new Error("Sin productos: corre primero pnpm prisma:seed");
  // Popularidad por producto (Zipf): unos pocos productos venden mucho, la mayoría poco (como una tienda real)
  const productIds = [...new Set(variants.map((v) => v.productId))];
  const popularity = new Map(productIds.map((id, index) => [id, 1 / (1 + ((index * 7) % productIds.length)) ** 0.8]));
  const variantPairs = variants.map((v) => [v, popularity.get(v.productId) ?? 0.1] as const);

  // ---------- Clientes ----------
  const passwordHash = await bcrypt.hash("Demo12345!", 10);
  const customers: Array<{ id: string; createdAt: Date; weight: number; address: Record<string, string>; name: string; email: string }> = [];
  for (let i = 1; i <= CUSTOMER_COUNT; i++) {
    const firstName = pick(FIRST);
    const lastName = `${pick(LAST)} ${pick(LAST)}`;
    const email = `demo.cliente${String(i).padStart(2, "0")}@ecommerce.local`;
    const [city, state, postalCode] = weighted(CITIES.map((c) => [c, c[3]] as const));
    const createdAt = at(int(5, 365));
    const phone = `+573${int(0, 2)}${int(10000000, 99999999)}`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email, passwordHash, firstName, lastName, phone, isVerified: true, createdAt, birthDate: new Date(Date.UTC(int(1970, 2004), int(0, 11), int(1, 28))),
        roles: { create: [{ role: { connect: { name: "CUSTOMER" } } }] },
        loyaltyAccount: { create: {} },
        notificationPrefs: { create: {} },
        addresses: { create: [{ label: "Casa", recipientName: `${firstName} ${lastName}`, phone, line1: `Calle ${int(1, 150)} # ${int(1, 99)}-${int(1, 99)}`, city, state, postalCode, country: "CO", isDefault: true }] },
      },
    });
    // Peso de compra: ~15 % son clientes frecuentes (VIP), ~20 % casi no compran (inactivos)
    const weight = weighted([[6, 15], [2, 45], [1, 20], [0.25, 20]] as const);
    customers.push({ id: user.id, createdAt: user.createdAt, weight, name: `${firstName} ${lastName}`, email, address: { recipientName: `${firstName} ${lastName}`, phone, line1: `Calle ${int(1, 150)} # ${int(1, 99)}-${int(1, 99)}`, city, state, postalCode, country: "CO" } });
  }

  // ---------- Pedidos ----------
  const dayPairs = Array.from({ length: 365 }, (_, d) => [d, dayWeight(d)] as const);
  const resolution = await prisma.dianResolution.upsert({
    where: { resolutionNumber: "18764000000001" },
    update: {},
    create: { resolutionNumber: "18764000000001", prefix: "SETP", fromNumber: 990000000, toNumber: 995000000, nextNumber: 990000000, technicalKey: "fc8eac422eba16e22ffd8c6f94b3f40a6e38162c", validFrom: new Date(NOW - 400 * DAY), validTo: new Date(NOW + 330 * DAY) },
  });
  let invoiceNumber = resolution.nextNumber;
  const loyalty = new Map<string, number>();
  const delivered: Array<{ id: string; userId: string; placedAt: Date; totalCents: number; paymentId: string; items: Array<{ productId: string; sku: string; name: string }> }> = [];
  const placedDays = Array.from({ length: ORDER_COUNT }, () => weighted(dayPairs)).sort((a, b) => b - a); // Del más antiguo al más reciente

  for (const [index, daysAgo] of placedDays.entries()) {
    const placedAt = at(daysAgo);
    const eligible = customers.filter((c) => c.createdAt <= placedAt);
    const customer = eligible.length ? weighted(eligible.map((c) => [c, c.weight] as const)) : customers[0]!;
    // Ítems: 1-3 variantes distintas, cantidad 1-2
    const chosen = new Map<string, (typeof variants)[number]>();
    for (let n = weighted([[1, 55], [2, 32], [3, 13]] as const); chosen.size < n; ) {
      const v = weighted(variantPairs);
      chosen.set(v.id, v);
    }
    const items = [...chosen.values()].map((v) => {
      const quantity = weighted([[1, 80], [2, 20]] as const);
      return { v, quantity, total: v.priceCents * quantity };
    });
    const subtotalCents = items.reduce((sum, i) => sum + i.total, 0);
    const useCoupon = rand() < 0.12;
    const discountCents = useCoupon ? Math.min(Math.round(subtotalCents * 0.1), 5_000_000) : 0;
    const shippingCents = subtotalCents >= 20_000_000 ? 0 : 1_200_000;
    const taxCents = Math.round((subtotalCents - discountCents) * 0.19);
    const totalCents = subtotalCents - discountCents + shippingCents + taxCents;
    const channel = weighted(CHANNELS);
    const cancelled = rand() < 0.05;
    // Estado según la antigüedad: lo viejo ya se entregó; lo de esta semana sigue en proceso
    const status: OrderStatus = cancelled ? "CANCELLED" : daysAgo > 9 ? "DELIVERED" : daysAgo > 5 ? pick(["SHIPPED", "DELIVERED"] as const) : daysAgo > 2 ? pick(["PREPARING", "PACKED", "SHIPPED"] as const) : pick(["CONFIRMED", "PREPARING"] as const);
    const orderNumber = `DEMO-${placedAt.toISOString().slice(0, 10).replaceAll("-", "")}-${String(index + 1).padStart(4, "0")}`;
    const provider = weighted(PROVIDERS);
    const [carrierCode, carrierName] = pick(CARRIERS);
    const express = rand() < 0.25;
    const itemsJson = items.map((i) => ({ variantId: i.v.id, productId: i.v.productId, sku: i.v.sku, name: i.v.product.name, quantity: i.quantity, unitPriceCents: i.v.priceCents }));

    const cart = await prisma.cart.create({ data: { userId: customer.id, status: "CONVERTED", expiresAt: placedAt, createdAt: placedAt } });
    const checkout = await prisma.checkoutSession.create({
      data: { userId: customer.id, cartId: cart.id, status: "COMPLETED", items: itemsJson, shippingAddress: customer.address, shippingRateCode: `${carrierCode}_${express ? "EXPRESS" : "STANDARD"}`, channel, currency: "COP", subtotalCents, discountCents, shippingCents, taxCents, totalCents, expiresAt: new Date(placedAt.getTime() + 30 * 60_000), createdAt: placedAt },
    });
    // Línea de tiempo de estados hasta el actual
    const flow: OrderStatus[] = ["CONFIRMED", "PREPARING", "PACKED", "SHIPPED", "DELIVERED"];
    const steps = cancelled ? (["CONFIRMED", "CANCELLED"] as OrderStatus[]) : flow.slice(0, flow.indexOf(status) + 1);
    const stepAt = (i: number) => new Date(placedAt.getTime() + i * (express ? 0.6 : 1.1) * DAY);
    const order = await prisma.order.create({
      data: {
        orderNumber, userId: customer.id, status, checkoutSessionId: checkout.id, currency: "COP", subtotalCents, discountCents, shippingCents, taxCents, totalCents, shippingAddress: customer.address, channel,
        channelRef: channel === "SOCIAL" ? pick(["instagram:post", "tiktok:live", "facebook:shop"]) : channel === "MARKETING" ? pick(["email:newsletter", "whatsapp:promo", "google:cpc"]) : null,
        placedAt, cancelledAt: cancelled ? stepAt(1) : null,
        items: { create: items.map((i) => ({ productId: i.v.productId, variantId: i.v.id, productName: i.v.product.name, variantName: i.v.name, sku: i.v.sku, imageUrl: i.v.product.images[0]?.url ?? null, unitPriceCents: i.v.priceCents, quantity: i.quantity, totalCents: i.total })) },
        statusHistory: { create: steps.map((to, i) => ({ fromStatus: i ? steps[i - 1]! : null, toStatus: to, createdAt: stepAt(i), changedById: i ? admin.id : null })) },
      },
    });
    const payment = await prisma.payment.create({
      data: { userId: customer.id, checkoutSessionId: checkout.id, orderId: order.id, provider, providerPaymentId: `demo_${orderNumber}`, amountCents: totalCents, refundedCents: cancelled ? totalCents : 0, currency: "COP", status: cancelled ? "REFUNDED" : "SUCCEEDED", createdAt: placedAt },
    });
    if (cancelled) continue;

    // Envío: guía de la transportadora y eventos de seguimiento
    const shipStatus: ShipmentStatus = status === "DELIVERED" ? "DELIVERED" : status === "SHIPPED" ? "IN_TRANSIT" : status === "PACKED" ? "LABEL_CREATED" : "PENDING";
    const shippedAt = ["IN_TRANSIT", "DELIVERED"].includes(shipStatus) ? stepAt(3) : null;
    const deliveredAt = shipStatus === "DELIVERED" ? stepAt(4) : null;
    const cityOf = customer.address["city"] ?? "Bogotá";
    await prisma.shipment.create({
      data: {
        orderId: order.id, status: shipStatus, rateCode: `${carrierCode}_${express ? "EXPRESS" : "STANDARD"}`, carrier: carrierName, service: express ? "Express" : "Estándar",
        trackingNumber: shipStatus === "PENDING" ? null : `${carrierCode.slice(0, 3)}${hex(10).toUpperCase()}`, costCents: express ? 1_800_000 : 900_000,
        estimatedDelivery: new Date(placedAt.getTime() + (express ? 2 : 5) * DAY), shippedAt, deliveredAt, createdAt: placedAt,
        events: {
          create: [
            ...(shippedAt ? [{ status: "IN_TRANSIT" as const, description: "Paquete en tránsito", location: "Centro de distribución Bogotá", occurredAt: shippedAt }] : []),
            ...(deliveredAt ? [{ status: "DELIVERED" as const, description: "Entregado al destinatario", location: cityOf, occurredAt: deliveredAt }] : []),
          ],
        },
      },
    });
    // Factura electrónica DIAN aceptada
    const issuedAt = new Date(placedAt.getTime() + 3600_000);
    await prisma.invoice.create({
      data: { number: `SETP${invoiceNumber++}`, orderId: order.id, userId: customer.id, status: "ACCEPTED", cufe: hex(96), buyer: { name: customer.name, email: customer.email, documentType: "CC", document: String(int(10_000_000, 1_199_999_999)) }, currency: "COP", subtotalCents: subtotalCents - discountCents + shippingCents, taxCents, totalCents, resolutionId: resolution.id, emailedAt: issuedAt, issuedAt, createdAt: issuedAt },
    });
    // Puntos de fidelidad: 1 punto por cada $1.000
    const points = Math.floor(totalCents / 100_000);
    const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: customer.id } });
    await prisma.loyaltyTransaction.create({ data: { accountId: account.id, operation: "ADD", points, remaining: points, reason: `Compra ${orderNumber}`, reasonCode: "ORDER", orderId: order.id, expiresAt: new Date(placedAt.getTime() + 365 * DAY), createdAt: placedAt } });
    loyalty.set(customer.id, (loyalty.get(customer.id) ?? 0) + points);
    if (status === "DELIVERED") delivered.push({ id: order.id, userId: customer.id, placedAt, totalCents, paymentId: payment.id, items: items.map((i) => ({ productId: i.v.productId, sku: i.v.sku, name: i.v.product.name })) });
  }
  await prisma.dianResolution.update({ where: { id: resolution.id }, data: { nextNumber: invoiceNumber } });

  // Nivel de fidelidad según los puntos acumulados
  const tierOf = (lifetime: number): LoyaltyTier => (lifetime >= 15_000 ? "PLATINUM" : lifetime >= 8_000 ? "DIAMOND" : lifetime >= 4_000 ? "GOLD" : lifetime >= 1_500 ? "SILVER" : "BRONZE");
  for (const [userId, points] of loyalty) await prisma.loyaltyAccount.update({ where: { userId }, data: { pointsBalance: points, lifetimePoints: points, tier: tierOf(points) } });

  // ---------- Devoluciones ----------
  const REASONS: Array<[RefundReason, string]> = [["DAMAGED", "El producto llegó con la caja golpeada y una pieza rota."], ["WRONG_ITEM", "Recibí otra talla distinta a la que pedí."], ["NOT_AS_DESCRIBED", "El color no corresponde a las fotos de la tienda."], ["CHANGED_MIND", "Ya no lo necesito, está sin abrir."], ["NOT_RECEIVED", "El seguimiento dice entregado pero no lo recibí."]];
  for (const order of delivered.filter(() => rand() < 0.06).slice(0, 22)) {
    const [reason, description] = pick(REASONS);
    const status: RefundStatus = weighted([["PROCESSED", 50], ["APPROVED", 15], ["REQUESTED", 20], ["REJECTED", 15]] as const);
    const resolution: RefundResolution = weighted([["REFUND", 70], ["EXCHANGE", 20], ["STORE_CREDIT", 10]] as const);
    const createdAt = new Date(order.placedAt.getTime() + int(6, 14) * DAY);
    await prisma.refund.create({
      data: { orderId: order.id, userId: order.userId, paymentId: order.paymentId, reason, description, evidenceUrls: [], amountCents: Math.round(order.totalCents * (rand() < 0.7 ? 1 : 0.5)), status, resolution, reviewedById: status === "REQUESTED" ? null : admin.id, reviewNote: status === "REJECTED" ? "Fuera de la ventana de devolución" : null, processedAt: status === "PROCESSED" ? new Date(createdAt.getTime() + 3 * DAY) : null, createdAt },
    });
  }

  // ---------- Reseñas (una por cliente y producto, solo compras entregadas) ----------
  const TEXTS: Record<number, Array<[string, string]>> = {
    5: [["Excelente calidad", "Superó mis expectativas, llegó rápido y muy bien empacado."], ["Me encantó", "Tal cual las fotos, lo volvería a comprar sin dudarlo."], ["Perfecto", "Muy buena relación calidad-precio. Recomendado."]],
    4: [["Muy bueno", "Buen producto, el envío tardó un día más de lo esperado."], ["Buena compra", "Cumple lo prometido, la presentación podría mejorar."]],
    3: [["Está bien", "Es correcto pero esperaba un poco más por el precio."]],
    2: [["Regular", "La talla es más pequeña de lo indicado en la guía."]],
    1: [["No lo recomiendo", "Llegó con defectos y el proceso de cambio fue lento."]],
  };
  const reviewed = new Set<string>();
  for (const order of delivered) {
    for (const item of order.items) {
      const key = `${item.productId}:${order.userId}`;
      if (reviewed.has(key) || rand() > 0.35) continue;
      reviewed.add(key);
      const rating = weighted([[5, 46], [4, 30], [3, 12], [2, 7], [1, 5]] as const);
      const [title, body] = pick(TEXTS[rating]!);
      const createdAt = new Date(order.placedAt.getTime() + int(5, 12) * DAY);
      if (createdAt.getTime() > NOW) continue;
      const score = (rating - 3) / 2;
      await prisma.review.create({
        data: { productId: item.productId, userId: order.userId, orderId: order.id, rating, title, body, status: rand() < 0.9 ? "APPROVED" : "PENDING", sentimentScore: score, sentimentLabel: score > 0.2 ? "positive" : score < -0.2 ? "negative" : "neutral", isVerifiedPurchase: true, editableUntil: new Date(createdAt.getTime() + 30 * DAY), helpfulCount: int(0, 12), createdAt },
      });
    }
  }

  // ---------- Proveedores y órdenes de compra ----------
  const SUPPLIERS = [
    ["Textiles Andinos S.A.S.", "900123456-1", "ventas@textilesandinos.co", 30, 7, 4.6],
    ["Belleza Natural Ltda.", "900234567-2", "pedidos@bellezanatural.co", 45, 10, 4.2],
    ["Aromas del Caribe S.A.S.", "900345678-3", "comercial@aromascaribe.co", 30, 12, 3.9],
    ["Calzado Medellín S.A.", "890456789-4", "b2b@calzadomedellin.co", 60, 15, 4.4],
    ["Cerámicas y Hogar S.A.S.", "901567890-5", "info@ceramicashogar.co", 30, 9, 4.0],
  ] as const;
  const suppliers = [];
  for (const [name, taxId, email, paymentTermsDays, leadTimeDays, rating] of SUPPLIERS) {
    suppliers.push(await prisma.supplier.upsert({ where: { taxId }, update: {}, create: { name, taxId, email, phone: `+5760${int(1000000, 9999999)}`, contactName: `${pick(FIRST)} ${pick(LAST)}`, paymentTermsDays, leadTimeDays, rating, contractEndsAt: new Date(NOW + int(-20, 300) * DAY) } }));
  }
  for (let n = 1; n <= 16; n++) {
    const supplier = pick(suppliers);
    const createdAt = at(int(3, 330));
    const status = createdAt.getTime() > NOW - 10 * DAY ? pick(["DRAFT", "SENT", "PARTIAL"] as const) : weighted([["RECEIVED", 85], ["CANCELLED", 15]] as const);
    const lines = Array.from(new Map(Array.from({ length: int(2, 4) }, () => { const v = pick(variants); return [v.id, v] as const; })).values()).map((v) => ({ variantId: v.id, quantity: int(10, 60), unitCostCents: Math.round(v.priceCents * 0.55) }));
    const totalCents = lines.reduce((sum, l) => sum + l.quantity * l.unitCostCents, 0);
    const received = status === "RECEIVED";
    const receivedAt = received ? new Date(createdAt.getTime() + supplier.leadTimeDays * DAY) : null;
    const po = await prisma.purchaseOrder.create({
      data: {
        number: `OC-DEMO-${String(n).padStart(4, "0")}`, supplierId: supplier.id, status, totalCents, expectedAt: new Date(createdAt.getTime() + supplier.leadTimeDays * DAY), sentAt: status === "DRAFT" ? null : createdAt, sentVia: status === "DRAFT" ? [] : ["EMAIL"],
        receivedAt, dueAt: receivedAt ? new Date(receivedAt.getTime() + supplier.paymentTermsDays * DAY) : null, paidAt: receivedAt && receivedAt.getTime() + supplier.paymentTermsDays * DAY < NOW ? new Date(receivedAt.getTime() + supplier.paymentTermsDays * DAY) : null, createdById: admin.id, createdAt,
        items: { create: lines.map((l) => ({ ...l, receivedQuantity: received ? l.quantity - (rand() < 0.15 ? 2 : 0) : status === "PARTIAL" ? Math.floor(l.quantity / 2) : 0, rejectedQuantity: received && rand() < 0.15 ? 2 : 0 })) },
      },
    });
    if (received) await prisma.inventoryCostLayer.createMany({ data: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitCostCents: l.unitCostCents, purchaseOrderId: po.id, createdAt: receivedAt! })) });
  }
  console.log(`PostgreSQL: ${CUSTOMER_COUNT} clientes, ${ORDER_COUNT} pedidos, devoluciones, reseñas, fidelidad, 5 proveedores y 16 órdenes de compra`);
  return admin.id;
}

// ---------- MongoDB: analítica, inventario, campañas y CRM ----------
async function seedMongo(adminId: string) {
  const url = process.env["MONGO_URL"];
  if (!url) return console.log("MongoDB: sin MONGO_URL, se omite");
  try {
    await mongoose.connect(url, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.db!.collection("analyticevents").estimatedDocumentCount(); // Exige permisos (ping no): detecta otra instancia con auth
  } catch (error) {
    console.log(`MongoDB no disponible (${(error as Error).message}): se omite la parte de Mongo. Vuelve a correr el seed cuando esté arriba.`);
    return;
  }
  const db = mongoose.connection.db!;
  // Colecciones con los nombres que usa Mongoose (modelo en plural y minúsculas); inserción directa con el driver para
  // conservar "createdAt" del pasado (los timestamps de Mongoose lo pisarían con la fecha actual)
  const events = db.collection("analyticevents");
  if (await events.countDocuments({ "metadata.demo": true })) {
    console.log("MongoDB: ya hay datos demo, se omite");
    return;
  }
  const products = await prisma.product.findMany({ where: { status: "ACTIVE" }, select: { id: true, slug: true, minPriceCents: true } });
  const customers = await prisma.user.findMany({ where: { email: { startsWith: "demo.cliente" } }, select: { id: true } });
  const recentOrders = await prisma.order.findMany({ where: { orderNumber: { startsWith: "DEMO-" }, placedAt: { gte: new Date(NOW - 60 * DAY) } }, select: { userId: true, totalCents: true, placedAt: true, channel: true, items: { select: { productId: true } } } });

  // Sesiones de navegación con embudo: vista -> producto -> carrito -> checkout (la compra sale de los pedidos reales)
  const PAGES = ["/", "/products", "/categories/accesorios", "/categories/ropa", "/blog", "/landing/black-friday"];
  const ELEMENTS = ["button.add-to-cart", "a.product-card", "nav a.category", "button.search", "a.hero-cta", "button.wishlist"];
  const docs: Array<Record<string, unknown>> = [];
  const push = (type: string, sessionId: string, userId: string | null, path: string, createdAt: Date, extra: Record<string, unknown> = {}) => {
    const { metadata, ...rest } = extra as { metadata?: Record<string, unknown> };
    docs.push({ type, sessionId, userId, path, productId: null, value: null, channel: null, referrer: null, ...rest, metadata: { ...(metadata ?? {}), demo: true }, createdAt });
  };
  for (let d = 59; d >= 0; d--) {
    const sessions = Math.round(55 * dayWeight(d));
    for (let s = 0; s < sessions; s++) {
      const sessionId = randomUUID();
      const userId = rand() < 0.3 ? pick(customers).id : null;
      const source = weighted(SOURCES);
      const device = rand() < 0.62 ? "mobile" : "desktop";
      let time = at(d).getTime();
      const tick = () => new Date((time += int(8, 90) * 1000));
      const landing = pick(PAGES);
      push("page_view", sessionId, userId, landing, tick(), { channel: source === "direct" ? null : source, referrer: source === "google" ? "https://www.google.com/" : null, metadata: { device } });
      if (rand() < 0.2) push("web_vital", sessionId, userId, landing, tick(), { metadata: { device, lcp: int(900, 4200), cls: Math.round(rand() * 25) / 100, inp: int(60, 450), ttfb: int(80, 900), load: int(1200, 6000) } });
      for (let c = int(0, 4); c > 0; c--) push("click", sessionId, userId, landing, tick(), { metadata: { device, x: Math.round(rand() * 100), y: Math.round(Math.abs(rand() + rand() - 1) * 2400), h: 3200, w: device === "mobile" ? 390 : 1440, el: pick(ELEMENTS) } });
      if (rand() < 0.15) push("search", sessionId, userId, "/products", tick(), { metadata: { q: pick(["labial", "perfume", "vela", "camiseta", "tenis", "bolso", "crema", "gafas"]) } });
      if (rand() > 0.62) continue;
      const product = pick(products);
      push("view_item", sessionId, userId, `/products/${product.slug}`, tick(), { productId: product.id, value: product.minPriceCents, metadata: { device } });
      if (rand() > 0.28) continue;
      push("add_to_cart", sessionId, userId, `/products/${product.slug}`, tick(), { productId: product.id, value: product.minPriceCents, metadata: { device } });
      if (rand() > 0.55) continue;
      push("begin_checkout", sessionId, userId, "/checkout", tick(), { value: product.minPriceCents, metadata: { device } });
    }
  }
  // Compras: una sesión por pedido real de los últimos 60 días (la analítica cuadra con las ventas)
  for (const order of recentOrders) {
    const sessionId = randomUUID();
    const source = order.channel === "SOCIAL" ? pick(["instagram", "tiktok", "facebook"]) : order.channel === "MARKETING" ? pick(["email", "whatsapp"]) : weighted(SOURCES);
    const t0 = order.placedAt.getTime() - 15 * 60_000;
    push("page_view", sessionId, order.userId, "/", new Date(t0), { channel: source === "direct" ? null : source, metadata: { device: "mobile" } });
    push("view_item", sessionId, order.userId, "/products", new Date(t0 + 120_000), { productId: order.items[0]?.productId ?? null });
    push("add_to_cart", sessionId, order.userId, "/products", new Date(t0 + 240_000), { productId: order.items[0]?.productId ?? null });
    push("begin_checkout", sessionId, order.userId, "/checkout", new Date(t0 + 420_000), { value: order.totalCents });
    push("purchase", sessionId, order.userId, "/checkout/success", order.placedAt, { value: order.totalCents, channel: source === "direct" ? null : source });
  }
  for (let i = 0; i < docs.length; i += 5_000) await events.insertMany(docs.slice(i, i + 5_000));

  // Movimientos de inventario de los últimos 90 días: salidas por venta, entradas por compra, mermas y traslados
  const variants = await prisma.productVariant.findMany({ select: { id: true, sku: true, stock: true } });
  const movements = [];
  for (let d = 89; d >= 0; d -= 1) {
    for (let k = int(1, 4); k > 0; k--) {
      const v = pick(variants);
      const type = weighted([["OUT", 60], ["IN", 22], ["RETURN", 6], ["DAMAGE", 5], ["TRANSFER", 5], ["ADJUSTMENT", 2]] as const);
      const quantity = type === "IN" ? int(10, 40) : int(1, 3);
      const delta = type === "IN" || type === "RETURN" ? quantity : type === "TRANSFER" ? 0 : type === "ADJUSTMENT" ? pick([-1, 1]) * quantity : -quantity;
      const reason = { OUT: "Venta de pedido", IN: "Recepción de orden de compra", RETURN: "Devolución de cliente", DAMAGE: "Producto averiado en bodega", TRANSFER: "Traslado a tienda física", ADJUSTMENT: "Ajuste por conteo físico" }[type];
      movements.push({ variantId: v.id, sku: v.sku, type, delta, quantity, warehouse: "MAIN", toWarehouse: type === "TRANSFER" ? "STORE" : null, reason, reference: type === "IN" ? `OC-DEMO-${String(int(1, 16)).padStart(4, "0")}` : null, stockAfter: Math.max(0, v.stock + int(-5, 15)), actorId: adminId, voidedAt: null, voidedBy: null, createdAt: at(d) });
    }
  }
  await db.collection("stockmovements").insertMany(movements);

  // Campañas enviadas con métricas (correo, WhatsApp y push)
  const CAMPAIGNS = [
    ["Black Friday: hasta 40 % en accesorios", "EMAIL", "ALL", 330, 1800],
    ["Nueva colección de velas y aromas", "EMAIL", "REGULAR", 120, 640],
    ["Día de la Madre: belleza y fragancias", "WHATSAPP", "VIP", 150, 220],
    ["Te extrañamos: 15 % de regreso", "EMAIL", "INACTIVE", 75, 410],
    ["Bienvenida a la tienda", "PUSH", "NEW", 40, 380],
    ["Navidad: envío gratis", "EMAIL", "ALL", 300, 1750],
    ["Lanzamiento labiales Ruby", "WHATSAPP", "REGULAR", 20, 260],
  ] as const;
  await db.collection("campaigns").insertMany(
    CAMPAIGNS.map(([name, channel, audience, daysAgo, targeted], i) => {
      const sentAt = at(daysAgo);
      const failed = Math.round(targeted * rand() * 0.03);
      const scheduled = i === CAMPAIGNS.length - 1;
      return { name, channel, audience, subject: name, content: `<h1>${name}</h1><p>Descubre las novedades de la tienda.</p>`, templateId: null, url: "https://localhost:3001/cms", status: scheduled ? "SCHEDULED" : "SENT", scheduledAt: scheduled ? new Date(NOW + 3 * DAY) : sentAt, sentAt: scheduled ? null : sentAt, metrics: { targeted, sent: scheduled ? 0 : targeted - failed, failed: scheduled ? 0 : failed }, error: null, costCents: channel === "WHATSAPP" ? targeted * 30_000 : channel === "EMAIL" ? targeted * 500 : 0, abTest: null, createdBy: adminId, createdAt: sentAt, updatedAt: sentAt };
    })
  );

  // CRM: etiquetas, notas y puntaje de una parte de los clientes
  const TAGS = ["mayorista", "influencer", "cumpleaños-octubre", "prefiere-whatsapp", "cliente-corporativo", "belleza"];
  const NOTES = ["Pidió factura a nombre de su empresa.", "Prefiere entregas en la tarde.", "Interesada en la línea de velas y aromatizantes.", "Reclamó por un retraso; se le dio cupón de compensación.", "Compra regalos cada diciembre."];
  await db.collection("crmprofiles").insertMany(
    customers.slice(0, 18).map((c) => ({ userId: c.id, tags: [pick(TAGS), pick(TAGS)].filter((t, i, a) => a.indexOf(t) === i), notes: [{ text: pick(NOTES), authorId: adminId, at: at(int(1, 120)) }], score: int(35, 98), archivedAt: null, suiteCrmId: null, createdAt: at(int(30, 200)), updatedAt: at(int(0, 29)) }))
  );
  console.log(`MongoDB: ${docs.length} eventos de analítica, ${movements.length} movimientos de inventario, ${CAMPAIGNS.length} campañas y 18 perfiles CRM`);
}

async function main() {
  const adminId = await seedPostgres();
  await seedMongo(adminId);
}

main()
  .catch((error: unknown) => {
    console.error("Error en el seed demo:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
