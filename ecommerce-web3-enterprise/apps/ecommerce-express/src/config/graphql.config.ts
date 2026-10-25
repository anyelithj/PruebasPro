// graphql.config.ts (Apollo Server 5 + graphql-ws) => API GraphQL: Queries (catálogo), Mutations (reseñas) y
// Subscriptions (notificaciones en tiempo real por WebSocket).
// DRY: UN solo esquema ejecutable (typeDefs + resolvers) lo sirven dos transportes: HTTP (Apollo Server) y
// WebSocket (graphql-ws); los resolvers delegan en los MISMOS services que la API REST (una lógica, dos protocolos).
// Apollo Server 5 ya no trae middleware para Express: se integra con "executeHTTPGraphQLRequest", su API
// oficial para integraciones propias (patrón Adapter: Request/Response de Express <-> HTTPGraphQLRequest).
import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import type { RequestHandler } from "express";
import { ApolloServer, HeaderMap } from "@apollo/server";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { GraphQLError, GraphQLScalarType, Kind } from "graphql";
import { useServer } from "graphql-ws/use/ws";
import { WebSocketServer } from "ws";
import { ZodError } from "zod";
import { isProduction } from "./app.config";
import { productService } from "../module/product/service/product.service";
import { categoryService } from "../module/category/service/category.service";
import { brandService } from "../module/brand/service/brand.service";
import { collectionService } from "../module/collection/service/collection.service";
import { reviewService } from "../module/review/service/review.service";
import { liveNotifications } from "../module/notification/service/notification.service";
import { ListProductsQuerySchema } from "../module/product/schema/product.schema";
import { CreateReviewSchema } from "../module/review/schema/review.schema";
import { REVIEW_CREATE_LIMIT } from "../module/review/route/review.route";
import type { ProductDetailDto } from "../module/product/dto/product.dto";
import type { AuthenticatedRequestUser } from "../module/auth/types/auth.types";
import { resolveAccessToken } from "../module/auth/strategy/jwt.strategy";
import { assertRateLimit } from "../shared/middleware/rate-limit.middleware";
import { AppException, UnauthorizedException } from "../shared/filter/http-exception.filter";
import { logger } from "../shared/middleware/logger.middleware";

// Contexto por operación: quién consulta (visibilidad de borradores, autoría) y su IP (rate limit compartido con REST)
interface GraphqlContext {
  viewer: AuthenticatedRequestUser | undefined;
  ip: string;
}

// GRAPHQL_PATH => misma ruta para HTTP (queries/mutations) y WebSocket (subscriptions): un solo endpoint
export const GRAPHQL_PATH = "/graphql";

// SDL (Schema Definition Language) => contrato tipado de la API GraphQL. "#graphql" habilita resaltado en el IDE.
// Los tipos reflejan los MISMOS campos que los DTO de REST: el frontend recibe la misma forma por ambos protocolos.
const typeDefs = `#graphql
  scalar DateTime

  type Ref { id: ID! name: String! slug: String! }
  type Attribute { name: String! value: String! }
  type Variant {
    id: ID! sku: String! name: String! attributes: [Attribute!]!
    priceCents: Int! compareAtPriceCents: Int available: Int! weightGrams: Int! isActive: Boolean!
  }
  type Image { id: ID! url: String! alt: String! width: Int height: Int position: Int! variantId: ID }
  type ProductCard {
    id: ID! name: String! slug: String! status: String! currency: String!
    minPriceCents: Int! maxPriceCents: Int! compareAtPriceCents: Int
    ratingAvg: Float! ratingCount: Int! imageUrl: String imageAlt: String inStock: Boolean!
    brand: Ref category: Ref
  }
  type Product {
    id: ID! name: String! slug: String! status: String! description: String! currency: String! vendorId: ID
    minPriceCents: Int! maxPriceCents: Int! compareAtPriceCents: Int ratingAvg: Float! ratingCount: Int! inStock: Boolean!
    brand: Ref category: Ref collections: [Ref!]! variants: [Variant!]! images: [Image!]!
    createdAt: DateTime! updatedAt: DateTime!
  }
  type PageMeta { page: Int! limit: Int! total: Int! totalPages: Int! }
  type ProductPage { items: [ProductCard!]! meta: PageMeta! }
  type Category {
    id: ID! name: String! slug: String! description: String imageUrl: String parentId: ID
    productCount: Int! children: [Category!]!
  }
  type Brand { id: ID! name: String! slug: String! description: String logoUrl: String website: String productCount: Int! }
  type Collection { id: ID! name: String! slug: String! description: String imageUrl: String productCount: Int! }

  type ReviewAuthor { id: ID! name: String! avatarUrl: String }
  type Review {
    id: ID! productId: ID! productName: String! author: ReviewAuthor! rating: Int! title: String! body: String!
    status: String! isVerifiedPurchase: Boolean! vendorReply: String editableUntil: DateTime! createdAt: DateTime!
  }

  type Notification { id: ID! type: String! title: String! body: String! url: String read: Boolean! createdAt: DateTime! }

  input ProductFilter {
    q: String category: String brand: String collection: String
    minPrice: Int maxPrice: Int inStock: Boolean sort: String page: Int limit: Int
  }
  input CreateReviewInput { productId: ID! rating: Int! title: String! body: String! }

  type Query {
    products(filter: ProductFilter): ProductPage!
    product(idOrSlug: String!): Product
    categories: [Category!]!
    brands: [Brand!]!
    collections: [Collection!]!
  }

  type Mutation {
    "Publica una reseña (mismo cupo anti-spam que POST /api/v1/review)"
    createReview(input: CreateReviewInput!): Review!
  }

  type Subscription {
    "Notificaciones in-app del usuario autenticado, en tiempo real"
    notificationReceived: Notification!
  }
`;

// DateTime => escalar personalizado: Date de JS <-> texto ISO 8601 (JSON no tiene tipo fecha)
const DateTime = new GraphQLScalarType<Date, string>({
  name: "DateTime",
  serialize: (value) => (value instanceof Date ? value : new Date(String(value))).toISOString(),
  parseValue: (value) => new Date(String(value)),
  // "Kind.STRING" => literal escrito directamente en la consulta; cualquier otro tipo es un error de la consulta
  parseLiteral: (ast) => {
    if (ast.kind !== Kind.STRING) throw new GraphQLError("DateTime debe ser un texto ISO 8601");
    return new Date(ast.value);
  },
});

// requireViewer => Guard de resolvers: las operaciones privadas exigen usuario autenticado
function requireViewer(context: GraphqlContext): AuthenticatedRequestUser {
  if (!context.viewer) throw new UnauthorizedException();
  return context.viewer;
}

// Resolvers => una función por campo raíz (Strategy por campo); delegan en los services (N-Layer)
const resolvers = {
  DateTime,
  Query: {
    // "_parent" => no se usa en campos raíz; "args" => argumentos tipados de la consulta
    products: async (_parent: unknown, args: { filter?: Record<string, unknown> | null }, context: GraphqlContext) =>
      // El filtro GraphQL pasa por el MISMO schema Zod que la API REST (validación única). "inStock" llega como
      // Boolean de GraphQL y el schema REST espera el texto de la query string ("true"/"false")
      productService.listProducts(
        ListProductsQuerySchema.parse({ ...args.filter, inStock: args.filter?.["inStock"] == null ? undefined : String(args.filter["inStock"]) }),
        context.viewer
      ),

    product: async (_parent: unknown, args: { idOrSlug: string }, context: GraphqlContext) => {
      const product: ProductDetailDto = await productService.getProductById(args.idOrSlug, context.viewer);
      // Adapter: Record<string,string> -> [{ name, value }] (GraphQL no tiene tipo "mapa")
      return {
        ...product,
        variants: product.variants.map((variant) => ({
          ...variant,
          attributes: Object.entries(variant.attributes).map(([name, value]) => ({ name, value })),
        })),
      };
    },

    categories: () => categoryService.listCategories(),
    brands: async () => (await brandService.listBrands({ page: 1, limit: 100 }, false)).items,
    collections: () => collectionService.listCollections(false),
  },

  Mutation: {
    createReview: async (_parent: unknown, args: { input: unknown }, context: GraphqlContext) => {
      const viewer = requireViewer(context);
      await assertRateLimit(REVIEW_CREATE_LIMIT, context.ip); // Mismo bucket que REST (sin evasión del límite)
      return reviewService.createReview(CreateReviewSchema.parse(args.input), viewer.id);
    },
  },

  Subscription: {
    notificationReceived: {
      // "async function*" => generador asíncrono: graphql-ws envía al cliente cada valor "yield" (Observer)
      subscribe: async function* (_parent: unknown, _args: unknown, context: GraphqlContext) {
        const viewer = requireViewer(context);
        // Filtro por destinatario: el bus es global, cada conexión recibe solo SUS notificaciones (privacidad)
        for await (const event of liveNotifications.iterate("notification.created")) {
          if (event.userId === viewer.id) yield { notificationReceived: event.notification };
        }
      },
    },
  },
};

// schema => esquema ejecutable ÚNICO (Apollo para HTTP y graphql-ws para WebSocket)
const schema = makeExecutableSchema({ typeDefs, resolvers });

const apollo = new ApolloServer<GraphqlContext>({
  schema,
  introspection: !isProduction, // En producción no se expone el esquema completo (reduce superficie de ataque)
  // formatError => mismo contrato de errores que REST: "extensions.code" estable para que el frontend traduzca
  formatError: (formatted, error) => {
    const original = error instanceof GraphQLError ? error.originalError : error;
    if (original instanceof AppException) {
      return { ...formatted, message: original.message, extensions: { code: original.code, status: original.statusCode, details: original.details } };
    }
    if (original instanceof ZodError) {
      return { ...formatted, message: "Datos inválidos", extensions: { code: "VALIDATION_ERROR", status: 400, details: original.flatten().fieldErrors } };
    }
    return formatted;
  },
});

// createGraphqlHandler => arranca Apollo y devuelve un middleware de Express (Factory asíncrona)
export async function createGraphqlHandler(): Promise<RequestHandler> {
  await apollo.start();

  return (req, res, next) => {
    // Headers de Express -> HeaderMap de Apollo (normaliza arreglos a "a, b")
    const headers = new HeaderMap();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }

    apollo
      .executeHTTPGraphQLRequest({
        httpGraphQLRequest: {
          method: req.method.toUpperCase(),
          headers,
          search: new URL(req.originalUrl, "http://localhost").search, // Query string (?query=... en GET)
          body: req.body as unknown, // express.json() ya parseó el cuerpo
        },
        context: async () => ({ viewer: req.user, ip: req.ip ?? "unknown" }), // req.user lo agrega optionalAuth
      })
      .then(async (response) => {
        // HeaderMap es iterable: se copian los headers de la respuesta GraphQL
        for (const [key, value] of response.headers) res.setHeader(key, value);
        res.status(response.status ?? 200);
        if (response.body.kind === "complete") {
          res.send(response.body.string);
          return;
        }
        // Respuestas incrementales (@defer): se transmiten por partes (chunked)
        for await (const chunk of response.body.asyncIterator) res.write(chunk);
        res.end();
      })
      .catch(next); // Cualquier error llega al error.middleware global
  };
}

// Datos por conexión WebSocket: el usuario se resuelve UNA vez al conectar (no en cada mensaje).
// "type" (y no "interface") => graphql-ws exige un Record indexable, y solo los alias de tipo lo satisfacen
type SocketExtra = {
  request: IncomingMessage;
  viewer?: AuthenticatedRequestUser;
};

// attachGraphqlSubscriptions => GraphQL Subscriptions sobre WebSocket (protocolo graphql-transport-ws) en /graphql.
// "noServer" + enrutamiento manual del "upgrade": así conviven con Socket.io (/ws/socket.io) en el MISMO servidor
// HTTP sin que uno cierre los handshakes del otro.
export function attachGraphqlSubscriptions(httpServer: HttpServer): void {
  const wsServer = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    // Solo se atienden los upgrades de /graphql; los demás (Socket.io) los maneja su propio listener
    if (new URL(request.url ?? "/", "http://localhost").pathname !== GRAPHQL_PATH) return;
    wsServer.handleUpgrade(request, socket, head, (client) => wsServer.emit("connection", client, request));
  });

  useServer<Record<string, unknown> | undefined, SocketExtra>(
    {
      schema,
      // onConnect => autenticación del handshake con el access token en "connectionParams" (no en la URL: no queda en logs)
      onConnect: async (ctx) => {
        const token = ctx.connectionParams?.["token"];
        const viewer = typeof token === "string" ? await resolveAccessToken(token) : null;
        if (!viewer) return false; // "false" => graphql-ws cierra con 4403 Forbidden
        ctx.extra.viewer = viewer;
        return true;
      },
      context: (ctx): GraphqlContext => ({ viewer: ctx.extra.viewer, ip: ctx.extra.request.socket.remoteAddress ?? "unknown" }),
      // Llaves (bloque) => el handler no devuelve nada: devolver un valor reemplazaría los errores enviados al cliente
      onError: (_ctx, _id, _payload, errors) => {
        logger.warn("graphql_ws_error", { errors: errors.map((error) => error.message) });
      },
    },
    wsServer
  );
}
