// invoice.model.ts => reglas de facturación electrónica DIAN (Colombia) como funciones puras.
// CUFE/CUDE según el Anexo Técnico de Factura Electrónica (SHA-384 sobre la concatenación de campos fiscales).
// Nota de alcance: la FIRMA XAdES del XML y el envío al web service de la DIAN requieren el certificado digital
// del emisor; aquí se genera el documento UBL listo para firmar. El gateway DIAN es un puerto (DianGateway)
// que en ambiente de pruebas ("2") registra el documento y en producción se reemplaza por el adaptador real (DIP).
import { sha384 } from "../../../shared/util/crypto.util";

// Formato de montos exigido por la DIAN: 2 decimales con punto ("129900.00")
export const dianAmount = (cents: number): string => (cents / 100).toFixed(2);

export interface CufeInput {
  number: string; // NumFac
  issuedAt: Date; // FecFac + HorFac
  subtotalCents: number; // ValFac (antes de impuestos)
  ivaCents: number; // ValImp1 (código 01 = IVA)
  totalCents: number; // ValTot
  sellerNit: string; // NitOFE
  buyerDocument: string; // NumAdq
  technicalKey: string; // ClTec (clave técnica de la resolución)
  environment: "1" | "2"; // TipoAmbiente
}

// computeCufe => SHA-384(NumFac + FecFac + HorFac + ValFac + 01 + ValImp1 + 04 + ValImp2 + 03 + ValImp3 + ValTot + NitOFE + NumAdq + ClTec + TipoAmbiente)
export function computeCufe(input: CufeInput): string {
  const date = input.issuedAt.toISOString().slice(0, 10); // YYYY-MM-DD
  const time = `${input.issuedAt.toISOString().slice(11, 19)}-05:00`; // HH:MM:SS con zona horaria de Colombia
  const zero = dianAmount(0);
  return sha384(
    [
      input.number,
      date,
      time,
      dianAmount(input.subtotalCents),
      "01",
      dianAmount(input.ivaCents),
      "04", // INC (impuesto al consumo): no aplica => 0.00
      zero,
      "03", // ICA: no aplica => 0.00
      zero,
      dianAmount(input.totalCents),
      input.sellerNit,
      input.buyerDocument,
      input.technicalKey,
      input.environment,
    ].join("")
  );
}

// escapeXml => evita romper el XML (o inyectar nodos) con datos del comprador/producto
export const escapeXml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export interface UblInvoiceInput {
  number: string;
  cufe: string;
  issuedAt: Date;
  currency: string;
  seller: { nit: string; name: string };
  buyer: { documentType: string; documentNumber: string; name: string; email: string };
  lines: Array<{ description: string; quantity: number; unitPriceCents: number; totalCents: number }>;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

// buildUblInvoice => documento UBL 2.1 (estructura base de la factura DIAN, sin firma XAdES)
export function buildUblInvoice(input: UblInvoiceInput): string {
  const lines = input.lines
    .map(
      (line, index) => `  <cac:InvoiceLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="94">${line.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${input.currency}">${dianAmount(line.totalCents)}</cbc:LineExtensionAmount>
    <cac:Item><cbc:Description>${escapeXml(line.description)}</cbc:Description></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="${input.currency}">${dianAmount(line.unitPriceCents)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:ProfileID>DIAN 2.1: Factura Electrónica de Venta</cbc:ProfileID>
  <cbc:ID>${escapeXml(input.number)}</cbc:ID>
  <cbc:UUID schemeName="CUFE-SHA384">${input.cufe}</cbc:UUID>
  <cbc:IssueDate>${input.issuedAt.toISOString().slice(0, 10)}</cbc:IssueDate>
  <cbc:IssueTime>${input.issuedAt.toISOString().slice(11, 19)}-05:00</cbc:IssueTime>
  <cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${input.currency}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyTaxScheme><cbc:RegistrationName>${escapeXml(input.seller.name)}</cbc:RegistrationName><cbc:CompanyID schemeName="31">${input.seller.nit}</cbc:CompanyID></cac:PartyTaxScheme>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PartyTaxScheme><cbc:RegistrationName>${escapeXml(input.buyer.name)}</cbc:RegistrationName><cbc:CompanyID schemeName="${escapeXml(input.buyer.documentType)}">${escapeXml(input.buyer.documentNumber)}</cbc:CompanyID></cac:PartyTaxScheme>
    <cac:Contact><cbc:ElectronicMail>${escapeXml(input.buyer.email)}</cbc:ElectronicMail></cac:Contact>
  </cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${input.currency}">${dianAmount(input.taxCents)}</cbc:TaxAmount>
    <cac:TaxSubtotal><cbc:TaxAmount currencyID="${input.currency}">${dianAmount(input.taxCents)}</cbc:TaxAmount><cac:TaxCategory><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${input.currency}">${dianAmount(input.subtotalCents)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="${input.currency}">${dianAmount(input.totalCents)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${input.currency}">${dianAmount(input.totalCents)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lines}
</Invoice>`;
}

// "interface DianGateway" => puerto hacia la DIAN (Hexagonal): el service no sabe si hay certificado o no
export interface DianGateway {
  submit(document: { number: string; cufe: string; xml: string }): Promise<{ accepted: boolean; response: Record<string, unknown> }>;
}

// SandboxDianGateway => adaptador del ambiente de habilitación: registra el documento como aceptado sin firmar.
// Para producción se implementa otro adaptador con firma XAdES-EPES + SOAP "SendBillSync" de la DIAN.
export class SandboxDianGateway implements DianGateway {
  public async submit(document: { number: string; cufe: string }): Promise<{ accepted: boolean; response: Record<string, unknown> }> {
    return { accepted: true, response: { environment: "habilitacion", number: document.number, cufe: document.cufe, receivedAt: new Date().toISOString() } };
  }
}
