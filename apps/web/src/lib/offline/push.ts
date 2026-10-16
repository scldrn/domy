import { courierPushConfig, pushSubscriptionInput } from "@domy/domain";
import { api, unwrap, unwrapEmpty } from "@/lib/api-client";

export async function loadPushKey(): Promise<string | null> {
  return courierPushConfig.parse(await unwrap(api.api.courier["push-config"].$get())).publicKey;
}

/** FR-040/R8: called by a user gesture; refusal never affects route work. */
export async function enablePush(publicKey: string): Promise<boolean> {
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) return false;
  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== "granted") return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: publicKey,
    }));
  const input = pushSubscriptionInput.parse({
    actionId: crypto.randomUUID(),
    ...subscription.toJSON(),
  });
  await unwrapEmpty(api.api.courier["push-subscriptions"].$post({ json: input }));
  return true;
}

/** Sign-out stops notifications on this device, even if server removal cannot be delivered. */
export async function removePush(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try {
    await unwrapEmpty(
      api.api.courier["push-subscriptions"].remove.$post({
        json: { actionId: crypto.randomUUID(), endpoint: subscription.endpoint },
      }),
    );
  } finally {
    await subscription.unsubscribe();
  }
}
