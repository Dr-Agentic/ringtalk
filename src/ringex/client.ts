import { SDK } from '@ringcentral/sdk';
import { RingEXSender } from './sender.js';

export function createRingEXClient(): { sdk: SDK; sender: RingEXSender } {
  const clientId     = process.env.RINGEX_CLIENT_ID     ?? '';
  const clientSecret = process.env.RINGEX_CLIENT_SECRET ?? '';
  const serverUrl    = process.env.RINGEX_SERVER_URL    ?? 'https://platform.devtest.ringcentral.com';
  const botJwt       = process.env.RINGEX_BOT_JWT       ?? '';

  const sdk = new SDK({
    clientId,
    clientSecret,
    server: serverUrl,
  });

  // Bot JWT auth — login() accepts jwt as part of login options
  sdk.platform().login({ jwt: botJwt }).then(
    () => console.log('[RingEX] Bot authenticated successfully'),
    (err: unknown) => console.error('[RingEX] Bot auth failed:', err),
  );

  const sender = new RingEXSender(sdk);

  return { sdk, sender };
}
