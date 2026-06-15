// --- Configuration -----------------------------------------------------------
// URL de l'endpoint n8n qui renvoie les lignes du Google Sheet en JSON.
// Production : https://n8n.maikagency.dev/webhook/gallery
// Test (workflow ouvert dans l'éditeur n8n, bouton "Listen for test event") :
//           https://n8n.maikagency.dev/webhook-test/gallery
window.GALLERY_CONFIG = {
  apiUrl: "https://n8n.maikagency.dev/webhook/gallery",

  // Noms de colonnes attendus dans le Sheet (adaptez si vous les renommez).
  fields: {
    id: "id",
    imageUrl: "imageUrl",
    prompt: "prompt",
    category: "category",
    fileName: "fileName",
    driveViewUrl: "driveViewUrl",
    createdAt: "createdAt",
  },

  // Affiche les plus récentes en premier (basé sur createdAt).
  newestFirst: true,

  // Filtres par catégorie : les boutons sont générés automatiquement à partir
  // des catégories renvoyées par l'API (définies dans le nœud n8n "Gallery Categories").
  // Libellé du bouton qui affiche toutes les images.
  allCategoriesLabel: "Toutes",
};
