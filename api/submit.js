'use strict';
const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const schemas = require('./schema.json');

function validateAnswers(survey, answers) {
  const schema = schemas[survey];
  if (!schema || !answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  if (Object.keys(answers).length !== Object.keys(schema).length) return null;
  const normalized = {};
  for (const [key, rule] of Object.entries(schema)) {
    if (!Object.prototype.hasOwnProperty.call(answers,key)) return null;
    const value = answers[key];
    if (rule.type === 'text') {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (trimmed.length > rule.max) return null;
      // Prevent unintentional contact identifiers in public research free text.
      if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(trimmed) || /(?:\+?\d[\s.\-()]*){8,}/.test(trimmed)) return null;
      normalized[key] = trimmed;
    } else if (rule.type === 'single') {
      if (typeof value !== 'string' || (value !== '' && !rule.allowed.includes(value))) return null;
      normalized[key] = value;
    } else if (rule.type === 'multi') {
      if (!Array.isArray(value) || value.length > rule.allowed.length) return null;
      if (new Set(value).size !== value.length || !value.every(v => typeof v === 'string' && rule.allowed.includes(v))) return null;
      normalized[key] = value;
    } else return null;
  }
  if (!Object.values(normalized).some(value => Array.isArray(value) ? value.length > 0 : value !== '')) return null;
  return normalized;
}

function database() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    initializeApp({credential: cert(serviceAccount)});
  }
  return getFirestore();
}

async function verifyTurnstile(token) {
  const body = new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY,response:token});
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method:'POST',body,signal:AbortSignal.timeout(7000)
  });
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true && (!result.hostname || result.hostname === new URL(process.env.ALLOWED_ORIGIN || 'https://dagbetche.vercel.app').hostname);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method !== 'POST') {res.setHeader('Allow','POST');return res.status(405).json({saved:false,message:'Méthode refusée'});}
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON || !process.env.TURNSTILE_SECRET_KEY || !process.env.TURNSTILE_SITE_KEY) return res.status(503).json({saved:false,message:'Collecte temporairement indisponible'});
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://dagbetche.vercel.app';
  if (req.headers.origin !== allowedOrigin) return res.status(403).json({saved:false,message:'Origine non autorisée'});
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return res.status(415).json({saved:false,message:'Format invalide'});
  if (Number(req.headers['content-length'] || 0) > 30000) return res.status(413).json({saved:false,message:'Réponse trop volumineuse'});
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch {return res.status(400).json({saved:false,message:'Données invalides'});}
  if (!body || typeof body !== 'object' || Array.isArray(body) || body.ageConfirmed !== true || body.consent !== true || body.website !== '' || typeof body.turnstileToken !== 'string' || body.turnstileToken.length < 10 || body.turnstileToken.length > 4096) return res.status(400).json({saved:false,message:'Données ou consentement invalides'});
  const answers = validateAnswers(body.survey, body.answers);
  if (!answers) return res.status(400).json({saved:false,message:'Réponses incomplètes ou invalides'});
  try {
    const human = await verifyTurnstile(body.turnstileToken);
    if (!human) return res.status(403).json({saved:false,message:'Vérification anti-abus refusée'});
    const collection = body.survey === 'jeunes' ? 'enquete_jeunes' : 'enquete_professionnels';
    const expiration = Timestamp.fromDate(new Date(Date.now() + 90*24*60*60*1000));
    await database().collection(collection).add({ answers, submittedAt:FieldValue.serverTimestamp(), deleteAfter: expiration, consentVersion:'2026-10-27', adultSelfDeclared:true });
    return res.status(201).json({saved:true});
  } catch (err) {
    // Do not log answers, authorization headers, user IP or sensitive request body.
    console.error('survey_submission_failed',err?.code || 'internal_error');
    return res.status(503).json({saved:false,message:'Enregistrement indisponible. Veuillez réessayer.'});
  }
};
