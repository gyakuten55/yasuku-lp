import { Resend } from 'resend';

const TO_EMAIL = process.env.TO_EMAIL || 'ohshita@riilgate.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set');
      return res.status(500).json({ error: 'RESEND_API_KEY 未設定（Vercel の環境変数を確認してください）' });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    let data = req.body || {};
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { data = {}; }
    }
    const v = sanitize(data);

    if (!v.email || !v.companyName || !v.fullName || !v.systemName || !v.usage) {
      return res.status(400).json({ error: '必要な項目が不足しています' });
    }

    const r = data.result || {};
    const html = renderEmailHtml(v, r);
    const text = renderEmailText(v, r);

    const { data: sendData, error } = await resend.emails.send({
      from: `ヤスク 削減診断フォーム <${FROM_EMAIL}>`,
      to: TO_EMAIL,
      reply_to: v.email,
      subject: `【ヤスク】削減診断：${v.companyName} ${v.fullName} 様（${v.systemName}）`,
      html,
      text,
    });

    if (error) {
      console.error('Resend error:', JSON.stringify(error));
      return res.status(502).json({
        error: 'メール送信に失敗しました',
        detail: error?.message || error?.name || String(error),
        from: FROM_EMAIL,
        to: TO_EMAIL,
      });
    }

    return res.status(200).json({ ok: true, id: sendData?.id });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'サーバーエラー', detail: err?.message || String(err) });
  }
}

function sanitize(data) {
  const s = (val) => (typeof val === 'string' ? val.trim().slice(0, 500) : '');
  const n = (val) => {
    const num = Number(val);
    return Number.isFinite(num) ? num : null;
  };
  return {
    systemName: s(data.systemName),
    usage: s(data.usage),
    monthlyFee: n(data.monthlyFee),
    features: s(data.features),
    employees: n(data.employees),
    industry: s(data.industry),
    companyName: s(data.companyName),
    fullName: s(data.fullName),
    position: s(data.position),
    email: s(data.email),
  };
}

function escapeHtml(input) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmt(n) {
  return Number.isFinite(n) ? Number(n).toLocaleString('ja-JP') : '-';
}

function renderEmailHtml(v, r) {
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Sans',sans-serif;color:#222;line-height:1.7;">
  <h2 style="border-bottom:2px solid #1d4f8b;padding-bottom:6px;">削減診断フォーム 受信</h2>

  <h3 style="color:#1d4f8b;margin-top:24px;">お客様情報</h3>
  <table cellpadding="6" style="border-collapse:collapse;font-size:14px;">
    <tr><td style="background:#f3f6fb;font-weight:600;width:120px;">会社名</td><td>${escapeHtml(v.companyName)}</td></tr>
    <tr><td style="background:#f3f6fb;font-weight:600;">氏名</td><td>${escapeHtml(v.fullName)}</td></tr>
    <tr><td style="background:#f3f6fb;font-weight:600;">役職</td><td>${escapeHtml(v.position) || '-'}</td></tr>
    <tr><td style="background:#f3f6fb;font-weight:600;">メール</td><td><a href="mailto:${escapeHtml(v.email)}">${escapeHtml(v.email)}</a></td></tr>
  </table>

  <h3 style="color:#1d4f8b;margin-top:24px;">診断対象システム</h3>
  <table cellpadding="6" style="border-collapse:collapse;font-size:14px;">
    <tr><td style="background:#f3f6fb;font-weight:600;width:120px;">システム名</td><td>${escapeHtml(v.systemName)}</td></tr>
    <tr><td style="background:#f3f6fb;font-weight:600;">主な用途</td><td>${escapeHtml(v.usage)}</td></tr>
    <tr><td style="background:#f3f6fb;font-weight:600;">月額費用</td><td>${fmt(v.monthlyFee)} 円</td></tr>
    <tr><td style="background:#f3f6fb;font-weight:600;">主な機能</td><td>${escapeHtml(v.features) || '-'}</td></tr>
    <tr><td style="background:#f3f6fb;font-weight:600;">従業員数</td><td>${fmt(v.employees)} 名</td></tr>
    <tr><td style="background:#f3f6fb;font-weight:600;">業種</td><td>${escapeHtml(v.industry) || '-'}</td></tr>
  </table>

  <h3 style="color:#1d4f8b;margin-top:24px;">診断結果（自動算出）</h3>
  <table cellpadding="6" style="border-collapse:collapse;font-size:14px;">
    <tr><td style="background:#f3f6fb;font-weight:600;width:160px;">現在の月額</td><td>${fmt(r.current)} 円</td></tr>
    <tr><td style="background:#f3f6fb;font-weight:600;">提案月額（目安）</td><td>${fmt(r.proposed)} 円</td></tr>
    <tr><td style="background:#f3f6fb;font-weight:600;">削減額（目安）</td><td><strong style="color:#d32f2f;">${fmt(r.diff)} 円</strong></td></tr>
    <tr><td style="background:#f3f6fb;font-weight:600;">削減率（目安）</td><td><strong style="color:#d32f2f;">${fmt(r.ratePct)} %</strong></td></tr>
  </table>

  <p style="margin-top:32px;padding:12px;background:#fff7ec;border-left:3px solid #ff8a3d;font-size:13px;">
    このメールはヤスク LP の削減診断フォームから自動送信されました。<br>
    返信ボタンを押すとお客様（${escapeHtml(v.email)}）に直接届きます。
  </p>
</body></html>`;
}

function renderEmailText(v, r) {
  return `削減診断フォーム 受信

[お客様情報]
会社名: ${v.companyName}
氏名: ${v.fullName}
役職: ${v.position || '-'}
メール: ${v.email}

[診断対象システム]
システム名: ${v.systemName}
主な用途: ${v.usage}
月額費用: ${fmt(v.monthlyFee)} 円
主な機能: ${v.features || '-'}
従業員数: ${fmt(v.employees)} 名
業種: ${v.industry || '-'}

[診断結果（自動算出）]
現在の月額: ${fmt(r.current)} 円
提案月額（目安）: ${fmt(r.proposed)} 円
削減額（目安）: ${fmt(r.diff)} 円
削減率（目安）: ${fmt(r.ratePct)} %

このメールはヤスク LP の削減診断フォームから自動送信されました。
返信するとお客様（${v.email}）に直接届きます。`;
}
