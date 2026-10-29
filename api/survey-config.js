'use strict';
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({error:'method_not_allowed'}); }
  const enabled = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON && process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
  return res.status(200).json({ enabled, siteKey: enabled ? process.env.TURNSTILE_SITE_KEY : null });
};
