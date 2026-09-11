// /api/submit-order.js — принимает заказ напрямую из мини-аппа.
// Не зависит от того, как был открыт Mini App (Menu Button, "Открыть" в списке
// чатов, кнопка в сообщении) — работает по initData, единому для всех входов.

import crypto from 'crypto';

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// проверка подписи initData по алгоритму Telegram:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function verifyInitData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');

    const pairs = [...params.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (computedHash !== hash) return null;

    const userRaw = params.get('user');
    return userRaw ? JSON.parse(userRaw) : null;
  } catch (err) {
    console.error('[iksy] verifyInitData error:', err);
    return null;
  }
}

function formatOrder(payload) {
  const lines = payload.items.map((i) => {
    let line = `• ${i.category} — ${Number(i.total_rub).toLocaleString('ru-RU')} ₽`;
    if (i.link) line += `\n  ${i.link}`;
    if (i.size) line += `\n  размер: ${i.size}`;
    return line;
  });
  lines.push(`\nИтого: ${Number(payload.total_rub).toLocaleString('ru-RU')} ₽`);
  return lines.join('\n');
}

async function sendTelegramMessage(chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const data = await res.json();
  console.log('[iksy] telegram response:', JSON.stringify(data));
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed' });
    return;
  }

  try {
    const { initData, payload } = req.body || {};
    const user = verifyInitData(initData || '');

    if (!user) {
      console.error('[iksy] submit-order: invalid or missing initData');
      res.status(401).json({ ok: false, error: 'invalid init data' });
      return;
    }

    if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
      res.status(400).json({ ok: false, error: 'empty order' });
      return;
    }

    const summary = formatOrder(payload);
    const author = user.username ? `@${user.username}` : user.first_name;
    console.log('[iksy] order from', author, 'user.id =', user.id);

    const clientResult = await sendTelegramMessage(
      user.id,
      `Спасибо за заказ! Мы получили вашу заявку:\n\n${summary}\n\nСвяжемся с вами в ближайшее время, чтобы подтвердить детали заказа и доставки.`
    );

    if (ADMIN_CHAT_ID) {
      await sendTelegramMessage(ADMIN_CHAT_ID, `новый расчёт от ${author}:\n\n${summary}`);
    }

    if (!clientResult.ok) {
      console.error('[iksy] failed to message client:', clientResult.description);
      res.status(200).json({ ok: false, error: clientResult.description });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[iksy] submit-order ERROR:', err && err.stack ? err.stack : err);
    res.status(500).json({ ok: false, error: 'server error' });
  }
}
