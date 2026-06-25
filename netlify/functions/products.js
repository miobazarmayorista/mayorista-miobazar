// netlify/functions/products.js
//
// Trae el catálogo desde la API de Tiendanube usando un access_token de
// solo lectura (scope: read_products), filtra los productos publicados que
// tienen stock disponible, y devuelve cada uno con el precio mayorista
// (20% de descuento sobre el precio minorista).
//
// Variables de entorno necesarias en Netlify (Site settings > Environment variables):
//   TN_STORE_ID     -> el ID numérico de tu tienda en Tiendanube
//   TN_ACCESS_TOKEN -> el access_token que obtenés siguiendo el README.md

const STORE_ID = process.env.TN_STORE_ID;
const ACCESS_TOKEN = process.env.TN_ACCESS_TOKEN;
const API_VERSION = "2025-03";
const API_BASE = `https://api.tiendanube.com/${API_VERSION}/${STORE_ID}`;
const WHOLESALE_DISCOUNT = 0.20; // 20% off
const PER_PAGE = 200;
const MAX_PAGES = 20; // salvaguarda (200 x 20 = 4000 productos)

// Cache simple en memoria: mientras el contenedor de la función esté
// "caliente", evitamos volver a pegarle a la API de Tiendanube en cada
// visita. Se refresca solo cada 5 minutos.
let cache = { data: null, timestamp: 0 };
const CACHE_MS = 5 * 60 * 1000;

async function fetchPage(page) {
  const url = `${API_BASE}/products?per_page=${PER_PAGE}&page=${page}&published=true`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "User-Agent": "MioBazarMayorista (contacto@miobazar.com.ar)",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tiendanube API respondió ${res.status}: ${body}`);
  }

  return res.json();
}

async function fetchAllProducts() {
  let all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await fetchPage(page);
    all = all.concat(batch);
    if (batch.length < PER_PAGE) break; // última página
  }
  return all;
}

// Un producto "tiene stock" si alguna de sus variantes tiene stock > 0,
// o si el control de stock está desactivado (stock === null), que en
// Tiendanube significa "stock ilimitado".
function hasStock(product) {
  if (!product.variants || product.variants.length === 0) return false;
  return product.variants.some(
    (v) => v.stock === null || v.stock === undefined || Number(v.stock) > 0
  );
}

function lowestRetailPrice(product) {
  const prices = product.variants
    .map((v) => {
      const promo = parseFloat(v.promotional_price);
      const base = parseFloat(v.price);
      return promo > 0 ? promo : base;
    })
    .filter((p) => !isNaN(p) && p > 0);
  return prices.length ? Math.min(...prices) : null;
}

function mapProduct(product) {
  const retail = lowestRetailPrice(product);
  if (retail === null) return null;

  const wholesale = Math.round(retail * (1 - WHOLESALE_DISCOUNT));
  const image =
    (product.images && product.images[0] && product.images[0].src) || null;
  const name =
    (product.name && (product.name.es || Object.values(product.name)[0])) ||
    "Producto";

  return {
    id: product.id,
    name,
    image,
    retailPrice: retail,
    price: wholesale,
  };
}

exports.handler = async function () {
  try {
    if (!STORE_ID || !ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error:
            "Faltan las variables de entorno TN_STORE_ID y/o TN_ACCESS_TOKEN en Netlify.",
        }),
      };
    }

    const now = Date.now();
    if (cache.data && now - cache.timestamp < CACHE_MS) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cache.data),
      };
    }

    const products = await fetchAllProducts();
    const result = products.filter(hasStock).map(mapProduct).filter(Boolean);

    cache = { data: result, timestamp: now };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
