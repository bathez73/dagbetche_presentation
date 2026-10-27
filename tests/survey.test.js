const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const schema = require('../api/schema.json');

test('formulaires présents et leurs questions alignées avec le backend', () => {
 for (const survey of ['jeunes','pros']) {
  const html = fs.readFileSync(path.join(root,`questionnaire-${survey}.html`),'utf8');
  assert.match(html,/<form\b/);
  assert.match(html,/<button type="submit"/);
  assert.match(html,/name="consent" required/);
  assert.match(html,/name="ageConfirmed" required/);
  assert.match(html,/survey\.js/);
  assert.equal([...html.matchAll(/data-question="q\d+"/g)].length, survey === 'jeunes' ? 17 : 15);
  for(const [key, rule] of Object.entries(schema[survey])) {
   assert.match(html,new RegExp(`name="${key}"`));
   if (rule.allowed) for (const choice of rule.allowed) {
    // HTML entities in quotes may vary; test important plain text string fragment.
    assert.ok(html.includes(choice.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('’','’').replaceAll('<','&lt;')),
      `${survey} ${key}: option absente ${choice}`);
   }
  }
 }
});

test('QR codes locaux et absence d’URL antérieure', () => {
 for(const [survey,qr] of [['jeunes','qr-jeunes.svg'],['pros','qr-professionnels.svg']]){
  const html=fs.readFileSync(path.join(root,`questionnaire-${survey}.html`),'utf8');
  assert.ok(fs.existsSync(path.join(root,qr)));
  assert.ok(html.includes(qr));
  assert.ok(!html.includes('dagbe-tche-presentation'));
 }
});

test('l’API interdit les lectures anonymes et le client ne conserve pas les réponses', () => {
 const rules = fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
 assert.match(rules,/allow read, write: if false/);
 const js=fs.readFileSync(path.join(root,'survey.js'),'utf8');
 assert.ok(!js.includes('localStorage.setItem'));
 assert.match(js,/result\.saved !== true/);
});
