const fs = require("fs");
function fixDeck(f) {
  if (!fs.existsSync(f)) return;
  let c = fs.readFileSync(f, "utf8");
  c = c.replace(/background-color:\s*#[0-9a-fA-F]{3,6}/gi, "background-color: #ffffff");
  c = c.replace(/background:\s*#[0-9a-fA-F]{3,6}/gi, "background: #f8fafc");
  c = c.replace(/color:\s*#(ffffff|fff|f9fafb|e2e8f0)/gi, "color: #0f172a");
  c = c.replace(/body\s*\{[^}]*\}/gi, "body { background-color: #ffffff !important; color: #0f172a !important; font-family: system-ui, sans-serif; }");
  fs.writeFileSync(f, c, "utf8");
}
fixDeck("index.html");
console.log("Diapo passe en mode clair avec succes !");