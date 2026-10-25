// invoice.repository.ts => persistencia de facturas y notas crédito + consecutivos por SEQUENCE de Postgres.
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import type { InvoiceDetailDto, InvoiceSummaryDto } from "../dto/invoice.dto";
import { BuyerSchema } from "../schema/invoice.schema";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";

const DETAIL_INCLUDE = {
  creditNotes: { orderBy: { issuedAt: "asc" }, select: { id: true, number: true, amountCents: true, reason: true, cude: true, issuedAt: true } },
} satisfies Prisma.InvoiceInclude;

type DetailRow = Prisma.InvoiceGetPayload<{ include: typeof DETAIL_INCLUDE }>;

export class InvoiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // nextInvoiceNumber => nextval() de la SEQUENCE: único aunque se emitan facturas en paralelo
  public async nextInvoiceNumber(): Promise<bigint> {
    const [row] = await this.prisma.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('invoice_number_seq') AS value`;
    return row?.value ?? 0n; // "0n" => literal BigInt
  }

  // takeResolutionNumber => RF-11.3 consecutivo de la resolución DIAN vigente con UN UPDATE atómico (dos facturas en
  // paralelo nunca reciben el mismo número); null si no hay resolución activa, vigente y con rango disponible
  public async takeResolutionNumber(today: Date): Promise<{ id: string; prefix: string; number: number; technicalKey: string } | null> {
    const [row] = await this.prisma.$queryRaw<Array<{ id: string; prefix: string; number: number; technicalKey: string }>>`
      UPDATE "dian_resolutions" SET "nextNumber" = "nextNumber" + 1
      WHERE "id" = (
        SELECT "id" FROM "dian_resolutions"
        WHERE "isActive" AND "validFrom" <= ${today}::date AND "validTo" >= ${today}::date AND "nextNumber" <= "toNumber"
        ORDER BY "validTo" ASC LIMIT 1 FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "prefix", "nextNumber" - 1 AS "number", "technicalKey"`;
    return row ?? null;
  }

  // --- RF-11.3 resoluciones ---
  public listResolutions() {
    return this.prisma.dianResolution.findMany({ orderBy: { validTo: "desc" } });
  }

  public createResolution(data: Prisma.DianResolutionUncheckedCreateInput) {
    return this.prisma.dianResolution.create({ data });
  }

  public updateResolution(id: string, data: Prisma.DianResolutionUncheckedUpdateInput) {
    return this.prisma.dianResolution.update({ where: { id }, data });
  }

  // taxReport => RF-11.3 reporte tributario por mes: facturas (sin anuladas por completo), base, IVA, total y notas crédito.
  // Dos agregaciones SQL (facturas y notas) unidas en memoria por mes
  public async taxReport(from: Date, to: Date): Promise<Array<{ month: string; invoices: number; subtotalCents: number; taxCents: number; totalCents: number; creditNotesCents: number }>> {
    const [invoices, notes] = await Promise.all([
      this.prisma.$queryRaw<Array<{ month: string; invoices: bigint; subtotal: bigint; tax: bigint; total: bigint }>>`
        SELECT to_char("issuedAt", 'YYYY-MM') AS month, COUNT(*) AS invoices, SUM("subtotalCents") AS subtotal, SUM("taxCents") AS tax, SUM("totalCents") AS total
        FROM "invoices" WHERE "issuedAt" BETWEEN ${from} AND ${to} AND "status" <> 'REJECTED' GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<Array<{ month: string; amount: bigint }>>`
        SELECT to_char("issuedAt", 'YYYY-MM') AS month, SUM("amountCents") AS amount
        FROM "credit_notes" WHERE "issuedAt" BETWEEN ${from} AND ${to} GROUP BY 1`,
    ]);
    const creditBy = new Map(notes.map((row) => [row.month, Number(row.amount)]));
    const months = [...new Set([...invoices.map((row) => row.month), ...notes.map((row) => row.month)])].sort();
    return months.map((month) => {
      const row = invoices.find((entry) => entry.month === month);
      return { month, invoices: Number(row?.invoices ?? 0), subtotalCents: Number(row?.subtotal ?? 0), taxCents: Number(row?.tax ?? 0), totalCents: Number(row?.total ?? 0), creditNotesCents: creditBy.get(month) ?? 0 };
    });
  }

  public async nextCreditNoteNumber(): Promise<bigint> {
    const [row] = await this.prisma.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('credit_note_number_seq') AS value`;
    return row?.value ?? 0n;
  }

  public async findMany(userId: string | undefined, range: { from?: Date | undefined; to?: Date | undefined }, page: PageParams): Promise<Paginated<InvoiceSummaryDto>> {
    const where: Prisma.InvoiceWhereInput = {
      ...(userId ? { userId } : {}),
      ...(range.from || range.to ? { issuedAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: page.skip,
        take: page.limit,
        select: { id: true, number: true, orderId: true, status: true, currency: true, totalCents: true, issuedAt: true },
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { items: rows, total };
  }

  public async findById(id: string): Promise<InvoiceDetailDto | null> {
    const row = await this.prisma.invoice.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    return row ? toDetail(row) : null;
  }

  public async findByOrder(orderId: string): Promise<InvoiceDetailDto | null> {
    const row = await this.prisma.invoice.findUnique({ where: { orderId }, include: DETAIL_INCLUDE });
    return row ? toDetail(row) : null;
  }

  public async create(data: Prisma.InvoiceUncheckedCreateInput): Promise<InvoiceDetailDto> {
    return toDetail(await this.prisma.invoice.create({ data, include: DETAIL_INCLUDE }));
  }

  public async update(id: string, data: Prisma.InvoiceUncheckedUpdateInput): Promise<InvoiceDetailDto> {
    return toDetail(await this.prisma.invoice.update({ where: { id }, data, include: DETAIL_INCLUDE }));
  }

  public async createCreditNote(data: Prisma.CreditNoteUncheckedCreateInput): Promise<void> {
    await this.prisma.creditNote.create({ data });
  }
}

function toDetail(row: DetailRow): InvoiceDetailDto {
  return {
    id: row.id,
    number: row.number,
    orderId: row.orderId,
    status: row.status,
    currency: row.currency,
    totalCents: row.totalCents,
    issuedAt: row.issuedAt,
    userId: row.userId,
    cufe: row.cufe,
    buyer: BuyerSchema.parse(row.buyer), // El Json se valida al leerlo
    subtotalCents: row.subtotalCents,
    taxCents: row.taxCents,
    xml: row.xml,
    pdfUrl: row.pdfUrl,
    creditNotes: row.creditNotes,
  };
}

export const invoiceRepository = new InvoiceRepository(prisma);
