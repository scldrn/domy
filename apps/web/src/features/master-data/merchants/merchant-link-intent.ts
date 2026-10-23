export type MerchantLinkIntent = Readonly<{
  actorId: string;
  merchantId: string;
  actionId: string;
}>;

export function merchantLinkIntent(
  current: MerchantLinkIntent | null,
  actorId: string,
  merchantId: string,
  createActionId: () => string = () => crypto.randomUUID(),
): MerchantLinkIntent {
  if (current) {
    if (current.actorId !== actorId || current.merchantId !== merchantId)
      throw new Error("The pending merchant link replacement belongs to another intent.");
    return current;
  }
  return { actorId, merchantId, actionId: createActionId() };
}
