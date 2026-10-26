// NFTBadgeGallery.tsx => insignias NFT del usuario: estado on-chain, enlace a la metadata IPFS y minteo pendiente.
"use client";

import Image from "next/image";
import { useState } from "react";
import { useBadges, useLoyaltyAccount, useMintBadge, useTransferBadge } from "../api/loyalty.api";
import { useTranslations } from "next-intl";
import { useBadgeSelection } from "../model/loyalty.store";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { toast } from "@/shared/ui/Toast";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";
import { cn } from "@/shared/lib/cn";

// EIP-1193 => proveedor que inyectan las wallets (MetaMask, Coinbase...) en window.ethereum
type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
const pad = (hex: string) => hex.replace(/^0x/, "").padStart(64, "0");
// encodeSafeTransfer => datos de safeTransferFrom(address,address,uint256) (selector 0x42842e0e) sin librerías Web3
const encodeSafeTransfer = (from: string, to: string, tokenId: string) => `0x42842e0e${pad(from)}${pad(to)}${pad(BigInt(tokenId).toString(16))}`;

// TransferBadge => RF-14.8 el DUEÑO firma la transferencia en su wallet; luego el backend la verifica on-chain
function TransferBadge({ accountId, badge }: { accountId: string; badge: { id: string; contractAddress: string | null; tokenId: string | null } }) {
  const t = useTranslations("loyalty.badges");
  const errorMessage = useErrorMessage();
  const transfer = useTransferBadge(accountId);
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const ethereum = typeof window === "undefined" ? undefined : (window as unknown as { ethereum?: Eip1193 }).ethereum;
  if (!badge.contractAddress || !badge.tokenId) return null;
  const submit = async () => {
    if (!ethereum) return toast.error(t("noWallet"));
    setSending(true);
    try {
      const [from] = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const txHash = (await ethereum.request({ method: "eth_sendTransaction", params: [{ from, to: badge.contractAddress, data: encodeSafeTransfer(from ?? "", to, badge.tokenId ?? "0") }] })) as string;
      transfer.mutate({ badgeId: badge.id, toAddress: to, txHash }, { onSuccess: () => toast.success(t("transferred")), onError: (error) => toast.error(errorMessage(error)) });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  };
  return (
    <form className="flex flex-col gap-2 sm:col-span-2" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <label htmlFor="transfer-to" className="text-slate-500">{t("transferTo")}</label>
      <input id="transfer-to" value={to} onChange={(event) => setTo(event.target.value.trim())} pattern="^0x[a-fA-F0-9]{40}$" required placeholder="0x…" className="h-9 rounded-md border border-slate-300 px-3 font-mono text-xs" />
      <Button type="submit" size="sm" variant="secondary" loading={sending || transfer.isPending} className="self-start">{t("transfer")}</Button>
    </form>
  );
}

export function NFTBadgeGallery() {
  const t = useTranslations("loyalty.badges");
  const tTier = useTranslations("loyalty.tiers");
  const errorMessage = useErrorMessage();
  const { data: account } = useLoyaltyAccount();
  const { data: badges = [] } = useBadges(account?.id);
  const mint = useMintBadge(account?.id ?? "");
  const { selectedBadgeId, select } = useBadgeSelection();
  const selected = badges.find((badge) => badge.id === selectedBadgeId);

  if (!account) return null;
  const canMintCurrent = account.tier !== "BRONZE" && !badges.some((badge) => badge.tier === account.tier && badge.status === "MINTED");

  return (
    <section aria-labelledby="badges-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="badges-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        {canMintCurrent && (
          <Button size="sm" loading={mint.isPending} onClick={() => mint.mutate(account.tier, { onSuccess: () => toast.success(t("minted")), onError: (error) => toast.error(errorMessage(error)) })}>
            {t("claim", { tier: tTier(account.tier) })}
          </Button>
        )}
      </div>
      {badges.length === 0 ? (
        <EmptyState icon="🏅" title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {badges.map((badge) => (
            <li key={badge.id}>
              <button type="button" aria-pressed={badge.id === selectedBadgeId} onClick={() => select(badge.id === selectedBadgeId ? null : badge.id)} className={cn("flex w-full flex-col items-center gap-2 rounded-lg border p-3 focus-visible:ring-2 focus-visible:ring-slate-900", badge.id === selectedBadgeId ? "border-slate-900" : "border-slate-200")}>
                <Image src={badge.imageUrl} alt={badge.name} width={96} height={96} className="rounded-full" />
                <span className="text-sm font-medium">{tTier(badge.tier)}</span>
                <Badge tone={badge.status === "MINTED" ? "success" : badge.status === "FAILED" ? "danger" : "warning"}>
                  {t(`status.${badge.status}`)}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <dl className="grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">{t("contract")}</dt><dd className="break-all font-mono text-xs">{selected.contractAddress ?? "—"}</dd></div>
          <div><dt className="text-slate-500">{t("tokenId")}</dt><dd className="font-mono text-xs">{selected.tokenId ?? "—"}</dd></div>
          <div><dt className="text-slate-500">{t("transaction")}</dt><dd className="break-all font-mono text-xs">{selected.txHash ?? "—"}</dd></div>
          {selected.ownerAddress && <div><dt className="text-slate-500">{t("owner")}</dt><dd className="break-all font-mono text-xs">{selected.ownerAddress}</dd></div>}
          {selected.status === "MINTED" && <TransferBadge accountId={account.id} badge={selected} />}
          <div>
            <dt className="text-slate-500">{t("metadata")}</dt>
            <dd>{selected.metadataUrl ? <a href={selected.metadataUrl} target="_blank" rel="noopener noreferrer" className="underline">{t("viewIpfs")}<span className="sr-only"> {t("newTab")}</span></a> : "—"}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
