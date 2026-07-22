import { SDK } from '@ringcentral/sdk';
import { RingEXSender } from './sender.js';
import { RingEXSender as SenderClass } from './sender.js';

// ── Bot client factory ─────────────────────────────────────────────────────────

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

  // JWT auth — the standard way to authenticate a bot server-side
  sdk.auth().setData({ jwt: botJwt });
  sdk.auth().setToken({
    access_token: '',
    token_type: 'bearer',
    expires_in: 0,
    owner_id: '',
  });

  // Install JWT grant for bot auth
  sdk.platform().login.bind(sdk.platform());

  const sender = new RingEXSender(sdk);

  return { sdk, sender };
}

export { RingEXSender };
