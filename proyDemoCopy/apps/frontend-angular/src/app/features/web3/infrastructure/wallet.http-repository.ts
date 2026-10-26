import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import { API_URL } from '@core/http/api-url.token';
import { WalletRepository } from '../domain/wallet.repository.port';
import {
  CryptoPaymentSchema,
  SiweChallengeSchema,
  WalletSchema,
  type CryptoPayment,
  type CryptoProgress,
  type LinkedWallet,
  type SiweChallenge,
} from '../domain/models/wallet';
import { cryptoPaymentStream } from './crypto-payment.stream';
// [WalletHttpRepository · Infraestructura]: HttpClient hacia /api/web3/* (BFF de Next.js → NestJS) + SSE de confirmaciones | [Patrón]: Adapter + Repository | [Principio]: SRP (único lugar con HTTP) + DIP | [Paradigma]: Reactivo
// [Seguridad]: solo viajan mensaje + firma + hash de transacción; NestJS verifica todo contra la cadena

@Injectable()
export class WalletHttpRepository extends WalletRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly base = `${this.api}/web3`;
  private readonly id = (v: string) => encodeURIComponent(v);

  nonce(): Observable<SiweChallenge> {
    return this.http.post<unknown>(`${this.base}/wallets/nonce`, {}).pipe(map((r) => SiweChallengeSchema.parse(r)));
  }

  verify(message: string, signature: string): Observable<LinkedWallet> {
    return this.http.post<unknown>(`${this.base}/wallets/verify`, { message, signature }).pipe(map((r) => WalletSchema.parse(r)));
  }

  mine(): Observable<LinkedWallet[]> {
    return this.http.get<unknown>(`${this.base}/wallets/me`).pipe(map((r) => z.array(WalletSchema).parse(r)));
  }

  unlink(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/wallets/${this.id(id)}`);
  }

  createCryptoPayment(orderId: string): Observable<CryptoPayment> {
    return this.http.post<unknown>(`${this.base}/payments`, { orderId }).pipe(map((r) => CryptoPaymentSchema.parse(r)));
  }

  cryptoPayment(id: string): Observable<CryptoPayment> {
    return this.http.get<unknown>(`${this.base}/payments/${this.id(id)}`).pipe(map((r) => CryptoPaymentSchema.parse(r)));
  }

  registerTx(id: string, txHash: string): Observable<CryptoPayment> {
    return this.http.patch<unknown>(`${this.base}/payments/${this.id(id)}/tx`, { txHash }).pipe(map((r) => CryptoPaymentSchema.parse(r)));
  }

  progress(): Observable<CryptoProgress> {
    return cryptoPaymentStream(this.api);
  }
}
