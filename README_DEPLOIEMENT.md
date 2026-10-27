# Dagbétché × Dis-Moi Care — Correctif de collecte (version 32 questions)

**État au 27 octobre 2026 : code préparé et testé localement avec services simulés ; NON intégré à GitHub, NON déployé sur Vercel, Firestore réel NON vérifié.**

## Pourquoi ce correctif ?

Le site public https://dagbetche.vercel.app/ présente **17 questions pour les jeunes** et **15 questions pour les professionnels**, alors que le dépôt GitHub `bathez73/dagbetche_presentation`, branche `main`, expose encore d'anciens fichiers HTML contenant **8 et 6 questions**. Ce patch reprend les **32 questions du site public** et les rend interactives. Quelques choix secondaires ont été ajustés pour la phase 18+ ; l'échelle des tranches d'âge des mineurs est retirée, car la collecte reste fermée aux personnes de moins de 18 ans.

### À ne pas faire

- Ne pas remplacer tout le dépôt : conserver `index.html`, `clean.css`, `custom.css` et autres fichiers existants.
- Ne pas utiliser l'ancienne archive « 8 + 6 questions ».
- Ne pas exposer les identifiants Firebase dans GitHub, le navigateur ou un fichier Vercel public.
- Ne pas distribuer de QR codes à des participants avant les tests de bout en bout et la revue éthique/juridique.

## Fichiers à ajouter/remplacer à la racine du dépôt

**Remplacer** : `questionnaire-jeunes.html`, `questionnaire-pros.html`.

**Ajouter** : `survey.css`, `survey.js`, `qr-jeunes.svg`, `qr-professionnels.svg`, `api/schema.json`, `api/submit.js`, `api/survey-config.js`, `package.json`, `firestore.rules`, `.gitignore`, `.env.example`, `tests/`.

Les fichiers n'incluent ni informations personnelles ni données d'étude.

## GitHub (si le connecteur refuse les écritures)

Dans un terminal avec Git connecté au dépôt :

```bash
git clone https://github.com/bathez73/dagbetche_presentation.git
cd dagbetche_presentation
git checkout -b feature/enquete-32-questions-20261027
# Copier les fichiers de ce ZIP à la racine du dépôt (sans supprimer les fichiers existants).
npm install
npm test
git add questionnaire-jeunes.html questionnaire-pros.html survey.css survey.js qr-jeunes.svg qr-professionnels.svg api package.json firestore.rules .gitignore .env.example tests
git commit -m "feat: formulaires d'enquête sécurisés 17+15 questions"
git push -u origin feature/enquete-32-questions-20261027
```

Ouvrir ensuite une Pull Request de cette branche vers `main`, faire vérifier les changements, puis seulement fusionner. Le déploiement Vercel dépend de la configuration effective du projet GitHub/Vercel.

## Firebase / Vercel / Turnstile

1. Créer ou sélectionner un **projet Firebase dédié** et activer **Cloud Firestore**, dans une région choisie en accord avec la revue des données sensibles et leurs transferts éventuels.
2. Utiliser une identité serveur dédiée et aux permissions aussi limitées que possible ; stocker le JSON de service **uniquement en variable d'environnement Vercel**. Éviter une clé durable si une fédération d'identité appropriée est disponible.
3. Configurer un widget **Cloudflare Turnstile** pour `dagbetche.vercel.app`, puis renseigner dans le projet Vercel :

   | Variable | Valeur |
   |---|---|
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON d'authentification Firebase (secret serveur) |
   | `TURNSTILE_SITE_KEY` | clé de site Turnstile (publique) |
   | `TURNSTILE_SECRET_KEY` | secret Turnstile (serveur) |
   | `ALLOWED_ORIGIN` | `https://dagbetche.vercel.app` |

4. Configurer l'exécution Node.js compatible avec `firebase-admin` depuis le `package.json` (Node 22 ou version compatible).
5. Configurer les **règles Firestore : refus des lectures et écritures directes via SDK navigateur**. Le fichier `firestore.rules` fourni contient un **deny all** pour un projet Firestore dédié ; **ne pas le déployer tel quel sur une base Firestore partagée**, car il bloquerait les autres usages. Les écritures serveur passent par les permissions IAM de l'identité Firebase Admin.
6. Activer les politiques Firestore **TTL sur le champ `deleteAfter`** ; le champ vaut environ 90 jours, mais **la suppression n'est pas assurée tant que les politiques TTL ne sont pas activées**. Vérifier la conservation réelle, les exports et sauvegardes.
7. La soumission s'effectue par `POST /api/submit`, et `/api/survey-config` ne renvoie que la clé de site publique et l'état de configuration. Aucun endpoint public de lecture des résultats n'est inclus.

## Points de sécurité et de méthode

- Les questions portent sur le bien-être psychologique : **avis juridique, règlementaire (APDP), éthique et professionnel de santé indispensables** avant mise en collecte. Définir responsable de traitement, droits, personnes autorisées, localisation et durée de conservation. Le message de consentement actuel est **provisoire**, pas une politique complète.
- **18 ans ou plus uniquement** dans cette version. Ne pas solliciter de mineurs avant une procédure et des protections dédiées. La question « âge » ne contient que des tranches adultes.
- Aucune garantie d'« anonymat total » ou de chiffrement de bout en bout n'est donnée. Les champs libres restent susceptibles de contenir des informations sensibles ; un filtre serveur refuse les numéros et emails évidents, sans pouvoir empêcher toutes les données identifiantes.
- Ne pas considérer le QR code ni une page web visible comme preuve d'une collecte opérationnelle. Seule l'écriture vérifiée dans Firestore et une confirmation côté navigateur permettent d'accepter les réponses.
- La présentation générale `index.html` de la branche existante évoque un « anonymat total » et des données chiffrées comme si les garanties étaient acquises ; réviser ces formulations avant communication institutionnelle.
- Cloudflare Turnstile réduit certains abus mais n'est pas une protection complète contre les bots ; envisager une limitation de débit et surveillance en cas d'usage soutenu.

## Critères d'acceptation avant enquête

- [ ] URLs des deux questionnaires mises à jour par un déploiement Vercel confirmé ; anciens documents obsolètes retirés.
- [ ] Tests de lecture et d'envoi sur mobile, Safari/iPhone et Android, avec connexions lentes.
- [ ] Test soumis avec consentement, 18+ et anti-abus : confirmation *uniquement après* document reçu dans la bonne collection Firestore.
- [ ] Tests de non-collecte sans consentement, avec origine non autorisée et avec Turnstile invalide.
- [ ] Vérification des accès IAM, des règles Firestore, de la rétention et des journaux serveur.
- [ ] Suppression de tous les documents de test ; vérification de la purge selon politique interne.
- [ ] Texte de confidentialité, recrutement 18+, coordonnées de référence, modalités d'urgence et protocole terrain validés par l'équipe et les conseillers compétents.
- [ ] QR codes imprimés testés, qui renvoient vers `https://dagbetche.vercel.app/questionnaire-jeunes.html` ou `/questionnaire-pros.html`.

## Vérifications effectuées hors production

- 9 tests unitaires Node.js : **réussis** (stockage Firestore simulé, vérification Turnstile simulée).
- 2 scénarios navigateur simulés avec réponse positive API : jeunes / pros **réussis**, avec contrôle de consentement, confirmation et totalité des champs.
- Rendu Chromium vérifié à 390 px et 1280 px : 17/15 questions, **aucun débordement horizontal**.
- **Aucun test réel Firebase, Turnstile ou déploiement Vercel n'a pu être réalisé** sans les services et droits nécessaires.
