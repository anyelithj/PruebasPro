import type { Observable } from 'rxjs';
import type { CryptoPayment, CryptoProgress, LinkedWallet, SiweChallenge } from './models/wallet';
// [Puerto WalletRepository · Dominio]: billeteras (reto SIWE, vincular, listar, desvincular) y pagos cripto (crear, consultar, registrar tx, progreso en vivo) | [Patrón]: Port (Hexagonal) + Repository + Observer | [Principio]: DIP + ISP
// `abstract class` (TS): contrato + token de inyección

export abstract class WalletRepository {
  abstract nonce(): Observable<SiweChallenge>;
  abstract verify(message: string, signature: string): Observable<LinkedWallet>;
  abstract mine(): Observable<LinkedWallet[]>;
  abstract unlink(id: string): Observable<unknown>;
  abstract createCryptoPayment(orderId: string): Observable<CryptoPayment>;
  abstract cryptoPayment(id: string): Observable<CryptoPayment>;
  abstract registerTx(id: string, txHash: string): Observable<CryptoPayment>;
  abstract progress(): Observable<CryptoProgress>;
}
