# Hubungkan bot Telegram ↔ Samudra (sewa key)

## Masalah key lama

Bot lokal di Termux membuat key acak seperti:

`TODA_QWEX-P82JQZZ...`

Web Samudra **hanya menerima** key bertanda tangan HMAC:

`TODA_<payload>.<signature>`

Key acak bot **tidak akan pernah login** di web sampai bot memanggil API register.

## Secrets Cloudflare (Worker Samudra)

Tambah **Secret** (bukan Plaintext):

| Name | Contoh | Fungsi |
|------|--------|--------|
| `ACCESS_ADMIN_TOKEN` | string acak panjang | Bot pakai header `x-admin-token` |
| `ACCESS_HMAC_SECRET` | string acak ≥16 char | Tanda tangan key |
| `ACCESS_SITE_URL` | `https://samudra.aminaputra6.workers.dev` | Link yang dikirim buyer |

Lalu **Deploy** ulang.

## Ubah bagian Approve API di bot.js

Ganti blok `if (order.category === 'api_access')` dengan:

```js
if (order.category === 'api_access') {
  const SAMUDRA = process.env.SAMUDRA_URL || 'https://samudra.aminaputra6.workers.dev';
  const ADMIN = process.env.ACCESS_ADMIN_TOKEN || 'ISI_SAMA_DENGAN_CLOUDFLARE';

  let data;
  try {
    const res = await fetch(`${SAMUDRA}/api/access?action=register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': ADMIN,
      },
      body: JSON.stringify({
        days: order.days || 3,
        orderId: order.orderId,
      }),
    });
    data = await res.json();
    if (!res.ok || !data.ok) {
      return ctx.answerCbQuery('Gagal buat key: ' + (data.error || res.status), { show_alert: true });
    }
  } catch (e) {
    return ctx.answerCbQuery('Gagal hubungi Samudra', { show_alert: true });
  }

  const detailApi =
    `Detail Sewa Akses API\n\n` +
    `Link: ${data.link}\n` +
    `Username: ${data.username}\n` +
    `Password: ${data.password}\n` +
    `API Key: ${data.apiKey}\n\n` +
    `Aktif sampai: ${data.untilLabel}\n\n` +
    `Login di web: Pengaturan → Akses → tempel API Key → Login`;

  try {
    await ctx.telegram.sendMessage(order.userId, detailApi + teksPenutup);
  } catch (e) {
    return ctx.answerCbQuery('Gagal kirim ke buyer.');
  }
} else {
  // ... stock akun game seperti biasa
}
```

Di Termux / `.env` bot:

```
SAMUDRA_URL=https://samudra.aminaputra6.workers.dev
ACCESS_ADMIN_TOKEN=sama_persis_dengan_cloudflare
```

Restart bot setelah edit.

## Uji cepat (owner)

```bash
curl -X POST "https://samudra.aminaputra6.workers.dev/api/access?action=register" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: TOKEN_KAMU" \
  -d '{"days":1}'
```

Salin `apiKey` dari response → login di web.
