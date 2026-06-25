# Mio Bazar Mayorista

Sitio mayorista que muestra los productos con stock de www.miobazar.com.ar
(traídos en vivo desde la API de Tiendanube), con 20% de descuento sobre el
precio de lista, mínimo de compra de $300.000, y un checkout que arma el
pedido y lo manda por WhatsApp a +54 9 11 7062-0278 para que cierres la venta
ahí.

No modifica ni depende de tu tienda minorista: solo LEE el catálogo.

## Variables de entorno necesarias en Netlify

| Variable          | Valor                                  |
|--------------------|-----------------------------------------|
| TN_STORE_ID         | el user_id de tu tienda en Tiendanube   |
| TN_ACCESS_TOKEN     | el access_token de tu app de Tiendanube |

## Cambiar el número de WhatsApp o el mínimo de compra

Están al principio de js/app.js:

const WHATSAPP_NUMBER = "5491170620278";
const MIN_PURCHASE = 300000;

## Cambiar el % de descuento mayorista

Está en netlify/functions/products.js:

const WHOLESALE_DISCOUNT = 0.20; // 20%
