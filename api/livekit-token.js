const crypto = require('crypto');

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { identity, nickname, avatar, hostPassword } = req.body || {};
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;
  const expectedPassword = process.env.LIVEKIT_HOST_PASSWORD;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return res.status(500).json({ error: 'LiveKit не настроен на сервере' });
  }

  if (typeof hostPassword === 'string' && hostPassword.trim() !== '') {
    if (!expectedPassword || hostPassword.trim() !== expectedPassword) {
      return res.status(403).json({ error: 'Неверный пароль ведущего' });
    }
  }

  const isHost = Boolean(
    expectedPassword &&
    typeof hostPassword === 'string' &&
    hostPassword.trim() === expectedPassword
  );

  const safeIdentity = String(identity || `guest-${Date.now()}`).slice(0, 64);
  const safeName = String(nickname || 'Аноним').slice(0, 24);
  const safeAvatar = String(avatar || '').slice(0, 64);
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    exp: now + 60 * 60 * 4,
    iss: apiKey,
    nbf: now - 5,
    sub: safeIdentity,
    name: safeName,
    metadata: safeAvatar,
    video: {
      room: 'debug-night-air',
      roomJoin: true,
      canPublish: isHost,
      canPublishData: true,
      canSubscribe: true
    }
  }));

  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return res.status(200).json({
    token: `${header}.${payload}.${signature}`,
    url: livekitUrl,
    isHost
  });
};
