const fs = require("fs");
function mod(f) {
  if (!fs.existsSync(f)) return;
  let c = fs.readFileSync(f, "utf8");
  c = c.replace(/&/g, "et");
  c = c.replace(/#0f172a|#1e293b|#000000/g, "#ffffff");
  c = c.replace(/body\s*\{[^}]*\}/g, "body { background-color: #ffffff !important; color: #111827 !important; font-family: system-ui, sans-serif; display: flex; justify-content: center; margin: 0; padding: 20px; }");
  fs.writeFileSync(f, c, "utf8");
}
mod("questionnaire-jeunes.html");
mod("questionnaire-pros.html");
console.log("Termine avec succes !");