// [DIP][ISP] contrato de canal de mensajería — send(to, msg): Promise<providerMessageId>
export interface MessagingChannel {
  readonly channel: string;
  send(to: string, message: string): Promise<string>;
}
