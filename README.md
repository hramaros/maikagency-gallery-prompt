# AI Photo Gallery

Galerie web statique (type [carephoto.art](https://www.carephoto.art/)) qui affiche des images IA
et leurs prompts de génération. Les données sont lues depuis Google Sheets via un endpoint n8n.

## Architecture

```
Upload image -> Google Drive (dossier surveillé)
   -> n8n: rendre public + vision LLM (OpenRouter / Hugging Face) -> prompt
   -> n8n: append Google Sheets
                                  |
   Site web  <--- GET /webhook/gallery (JSON) <--- n8n lit le Sheet
```

Workflow n8n : `Drive Image → Gallery (Vision Prompt + Sheets)`
(https://n8n.maikagency.dev/workflow/CH6rz1OSUGpVIrhH)

## Fichiers

- `index.html` — structure de la page
- `styles.css` — thème sombre, grille masonry, lightbox
- `app.js` — fetch de l'API, rendu des cartes, recherche, **filtres par catégorie**, lightbox, copie de prompt
- `config.js` — **à éditer** : URL de l'API et noms de colonnes

## Configuration

Dans `config.js`, vérifiez `apiUrl` :

```js
apiUrl: "https://n8n.maikagency.dev/webhook/gallery"
```

> Pendant les tests, ouvrez le workflow dans n8n, cliquez « Listen for test event »,
> et utilisez `https://n8n.maikagency.dev/webhook-test/gallery`.
> En production, **activez** le workflow et utilisez `/webhook/gallery`.

Format JSON attendu (tableau d'objets) :

```json
[
  {
    "id": "1AbC...",
    "fileName": "sunset-cat.png",
    "imageUrl": "https://lh3.googleusercontent.com/d/1AbC...",
    "prompt": "A photorealistic ginger cat ...",
    "category": "Animaux",
    "driveViewUrl": "https://drive.google.com/file/d/1AbC.../view",
    "createdAt": "2026-06-13T10:00:00.000Z"
  }
]
```

L'app accepte aussi `{ "data": [...] }` ou `{ "results": [...] }`.

### Filtres par catégorie

Le site génère automatiquement des boutons de filtre à partir des valeurs de la
colonne `category`. La liste des catégories est définie côté n8n dans le nœud Set
**Gallery Categories** ; elle est injectée dans le prompt de vision pour que l'IA
classe chaque image. Pour ajouter/retirer une catégorie, il suffit d'éditer ce nœud
(gardez `Autre` comme valeur de secours). Si la colonne `category` est absente,
la barre de filtres reste simplement masquée.

## Lancer en local

```bash
cd carephoto-gallery
python3 -m http.server 5173
# puis ouvrez http://localhost:5173
```

(N'ouvrez pas `index.html` en `file://` : le `fetch` cross-origin échouerait.)

## Déploiement

Site 100 % statique — déployable tel quel :

- **Vercel / Netlify** : glisser-déposer le dossier, ou `vercel` / `netlify deploy`.
- **GitHub Pages** : pousser le dossier sur une branche `gh-pages`.
- **Cloudflare Pages** : connecter le repo, aucun build nécessaire.

Aucune étape de build ; pas de dépendances.

## Prérequis côté n8n

1. Connecter un credential **Google Sheets** (OAuth2) sur les nœuds *Save to Gallery Sheet*
   et *Read Gallery Rows*, puis choisir le Spreadsheet + l'onglet.
2. Sélectionner les credentials Google Drive et Bearer (OpenRouter / Hugging Face).
3. Choisir le dossier Drive à surveiller.
4. **Activer** le workflow.

En-têtes de la feuille : `id | fileName | imageUrl | prompt | category | driveViewUrl | createdAt`.
(La colonne `category` est créée automatiquement par n8n si elle est absente.)
