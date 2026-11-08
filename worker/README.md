# Backend crypto (Cloudflare Worker)

Ce petit service garde tes clés API (lecture seule) OKX / Kraken et renvoie tes
soldes convertis en EUR. L'app l'appelle ; les clés ne quittent jamais le Worker.

## 1. Créer les clés API en LECTURE SEULE

> ⚠️ **Lecture seule uniquement.** Aucune permission de trading ni de retrait.

**OKX (ton compte, puis celui de ton père) :**
1. OKX → Profil → **API** → *Create API key*.
2. Permissions : coche **Read** seulement (pas *Trade*, pas *Withdraw*).
3. Note les 3 valeurs : **API Key**, **Secret Key**, **Passphrase**.
4. (Recommandé) Restreins par IP si proposé — sinon laisse vide.

**Kraken (compte secondaire) :**
1. Kraken → Settings → **API** → *Add key*.
2. Permissions : coche **Query Funds** seulement.
3. Note **API Key** et **Private Key (Secret)**.

## 2. Déployer le Worker

Pré-requis : un compte **Cloudflare** (gratuit) et **Node** (déjà installé).

Depuis le dossier `worker/` :

```bash
npx wrangler login
```

```bash
npx wrangler deploy
```

La commande affiche l'URL du Worker, par ex. :
`https://patrimoine-crypto.<ton-sous-domaine>.workers.dev`
→ garde-la, elle ira dans les Réglages de l'app.

## 3. Enregistrer les secrets

Un jeton partagé (invente une longue chaîne aléatoire) + tes clés :

```bash
npx wrangler secret put CLIENT_TOKEN
```

```bash
npx wrangler secret put OKX_ME_KEY
npx wrangler secret put OKX_ME_SECRET
npx wrangler secret put OKX_ME_PASS
```

Pour le compte de ton père (`PAPA`) et Kraken (`ME`) :

```bash
npx wrangler secret put OKX_PAPA_KEY
npx wrangler secret put OKX_PAPA_SECRET
npx wrangler secret put OKX_PAPA_PASS
npx wrangler secret put KRAKEN_ME_KEY
npx wrangler secret put KRAKEN_ME_SECRET
```

Chaque commande demande la valeur (collée, invisible). Les comptes sont donc :
`okx-me`, `okx-papa`, `kraken-me`.

## 4. Tester

```bash
curl -H "X-Auth: TON_CLIENT_TOKEN" "https://TON-WORKER.workers.dev/balances?account=okx-me"
```

Réponse attendue : `{ "account":"okx-me", "assets":[...], "totalEur": 123.45, ... }`

## 5. Brancher dans l'app

Réglages → *Backend crypto* : colle l'**URL du Worker** et le **CLIENT_TOKEN**.
(Partie app à venir.)

---

Mettre à jour le code plus tard : il suffit de relancer `npx wrangler deploy`
(on pourra l'automatiser via GitHub Actions). Les secrets restent en place.
