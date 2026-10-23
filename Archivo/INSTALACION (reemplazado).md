# Instalación — publicar, conectar el dominio y pasárselo a Pablo

Pasos que se hacen **una sola vez**. Para el día a día está [COMO-USARLO.md](COMO-USARLO.md).

## Qué hay en esta carpeta

| Carpeta / archivo | Qué es | ¿Se publica? |
|---|---|---|
| `sitio/` | El sitio completo: `index.html`, `estilos.css`, `app.js`, `config.js`, `fotos/` | **Sí: es lo único que se sube al hosting** |
| `apps-script/Codigo.gs` | El código del script. Se pega dentro de la planilla (Extensiones → Apps Script) | No |
| `pruebas/` | Pruebas automáticas del script y del sitio, para quien modifique el código. Abrir `prueba-script.html` y `prueba-sitio.html` con el servidor local y la pestaña a la vista | No |
| `.claude/` | Configuración para probar el sitio en la compu | No |

Cómo encaja todo: la **planilla** guarda los datos → el **script** (dentro de la planilla) elige
qué datos son públicos y recibe los pedidos → el **sitio** (archivos en Netlify) le pide el catálogo
al script y le manda los pedidos.

---

## 1. Publicar el sitio en Netlify

### Lo que hay que saber antes (verificado el 19/10/2026; Netlify cambia seguido)

- El plan gratuito da **300 créditos por mes**, que se renuevan al empezar cada ciclo y no se acumulan.
- **Cada publicación gasta 15 créditos** (unas 20 por mes si no se gasta nada más).
- **Cada GB que descargan los visitantes gasta 20 créditos**, y cada 10.000 solicitudes, 2. Netlify no
  aclara si cada foto o archivo cuenta como solicitud aparte; conviene suponer que sí (una visita ≈ 10–30).
- **Si se terminan los créditos, el sitio queda pausado** ("Site not available") hasta el ciclo
  siguiente. En el plan gratuito no se pueden comprar créditos sueltos: solo esperar o pasar a un
  plan pago (Personal: US$ 9/mes, 1.000 créditos).
- Fuentes: [precios](https://www.netlify.com/pricing/) ·
  [planes por créditos](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/) ·
  [proyectos pausados](https://docs.netlify.com/manage/accounts-and-billing/billing/resume-paused-projects/).

**Qué significa en la práctica:** los productos, precios y stock viven en la planilla, así que el
sitio casi nunca necesita volver a publicarse. Solo hace falta para fotos nuevas, cambios de diseño
o de `config.js`. **Juntá esos cambios y publicá una vez**, no en cada ajuste. Las fotos en WebP de
unos 50–100 KB mantienen bajo el consumo de tráfico.

**Plan B si el tráfico crece:** Cloudflare Pages. Según fuentes no oficiales, en su plan gratuito no
mide el tráfico de un sitio como este: el límite es de 500 publicaciones por mes y 20.000 archivos
([límites oficiales](https://developers.cloudflare.com/pages/platform/limits/)). El sitio funciona
igual ahí, sin cambiar nada: son los mismos archivos.

### Primera publicación

1. Entrá a **app.netlify.com** con la cuenta **del dueño del negocio** (ver punto 3).
2. **Add new project** (o "Add new site") → **Deploy manually**.
3. Arrastrá la carpeta **`sitio`** (la carpeta entera, no su contenido suelto) al recuadro.
4. **Salió bien si:** en un minuto aparece "Published" y una dirección del tipo `algo-raro-123.netlify.app`.
   Abrila: tiene que cargar el catálogo.
5. Para cambiar esa dirección: **Project configuration → Change project name** → por ejemplo `minegocio`
   → queda `minegocio.netlify.app`.

### Publicar cambios después

Proyecto → pestaña **Deploys** → arrastrá de nuevo la carpeta **`sitio`** al recuadro "Drag and drop
your project output folder here". La dirección no cambia. Cada vez = 15 créditos.

---

## 2. Conectar el dominio

> **Caso Pablo: tiene Hostinger.** Dos caminos, a decidir cuando se migre:
> - **Dejar el sitio en Netlify y apuntar el dominio de Hostinger** (pasos de abajo, cargando en
>   Hostinger → Dominios → DNS los registros que da Netlify). Sigue el límite de créditos de Netlify.
> - **Subir la carpeta `sitio` al hosting de Hostinger** (Administrador de archivos → `public_html`). Ya lo
>   paga, así que no hay créditos que cuidar. El archivo `_headers` es de Netlify y ahí no funciona: habría
>   que pasar esas reglas a un `.htaccess` (lo hago al migrar).

> ⚠️ **Antes que nada: Pablo tiene que tener su propio usuario y contraseña de la cuenta del
> dominio (NIC Argentina, GoDaddy, etc.) y de la de Netlify.** No alcanza con que "lo maneje
> alguien de confianza". En un caso anterior el dominio y el hosting los administraba un tercero:
> cuando no estuvo disponible, el sitio quedó congelado y nadie podía tocarlo. Si hoy lo maneja
> el padre, lo mínimo es que Pablo tenga acceso propio a esa cuenta, o que el dominio se pase a la
> cuenta de Pablo.

1. En Netlify: proyecto → **Domain management → Add a domain** → escribí el dominio.
2. Netlify ofrece dos caminos. Elegí uno y **copiá exactamente los valores que te muestra en pantalla**:
   - **Usar Netlify DNS (más simple):** Netlify te da 4 servidores (nombres tipo `dns1.p0x.nsone.net`).
     En la cuenta del dominio, reemplazá los servidores DNS por esos. En NIC Argentina esto se llama
     **"Delegar"** y está en la gestión del dominio. Es el único camino posible si ahí no se pueden
     cargar registros sueltos.
   - **Mantener el DNS donde está:** cargá los registros que indica Netlify (por lo general un `CNAME`
     para `www` y un registro para el dominio sin `www`).
3. El cambio tarda de minutos a 48 horas. **Salió bien si** en Domain management el dominio aparece
   con tilde verde y, en **HTTPS**, el certificado figura como activo (Netlify lo genera solo y gratis).

---

## 3. Pasarle todo a Pablo

Hoy todo está en la cuenta de Joaquín, como prueba. La idea es que **Pablo sea dueño de todo**:
planilla, script, Netlify y dominio.

1. **Planilla y script:** Joaquín comparte la planilla con Pablo. Pablo la abre con **su** cuenta →
   **Archivo → Hacer una copia**. El script viene adentro de la copia.
2. En la copia de Pablo:
   - **Pedidos:** borrar las filas de prueba (dejar la fila de títulos).
   - **Productos / Categorías / Financiación:** reemplazar los ejemplos por los datos reales.
   - **Configuración:** `nombre_negocio`, `whatsapp`, `mail_pedidos` y `direccion_sitio` de Pablo.
   - **Mayoristas:** borrar las filas de prueba. Por seguridad, en la copia ir a Apps Script →
     Configuración del proyecto (engranaje) → Propiedades del script y borrar `secreto_sesiones`, si
     aparece: el script crea una clave nueva sola, y las sesiones de prueba dejan de valer.
   - **Archivo → Configuración → Configuración regional: Argentina** (para que `25.000` sea 25 mil).
3. **Autorizar el script:** Extensiones → Apps Script → elegir la función `probarMail` → **Ejecutar**.
   Aparece la pantalla "Google no verificó esta app". Es normal, porque la app es suya:
   **Configuración avanzada → Ir a Catálogo (no seguro) → Permitir**. Tiene que llegar un mail de prueba.
4. **Publicar el script:** **Implementar → Nueva implementación** → engranaje → **Aplicación web** →
   Ejecutar como: **Yo** → Quién tiene acceso: **Cualquier persona**. Cuidado: NO "Cualquier persona
   con cuenta de Google", porque los visitantes sin sesión de Google no podrían pedir. Copiar la URL que
   termina en `/exec`.
5. **Prueba de vida:** abrir esa URL en el navegador → tiene que decir `{"ok":true,"productos":…}`.
6. **`sitio/config.js`:** pegar la URL nueva en `urlScript` y el WhatsApp de Pablo en `whatsappRespaldo`.
7. **Netlify:** crear la cuenta con el mail de Pablo y publicar (punto 1). Conectar el dominio (punto 2).
8. **Prueba de punta a punta:** hacer un pedido desde el sitio publicado. Tiene que llegar el mail y
   aparecer la fila en Pedidos. Después borrarla.
9. **Cerrar lo de Joaquín:** en la planilla de Joaquín, Implementar → Administrar implementaciones →
   **Archivar**, para que la URL vieja deje de responder. Y borrar el sitio de prueba de Netlify, si se creó.

---

## 4. Ponerle la marca

| Qué | Dónde |
|---|---|
| Colores | `sitio/estilos.css`, las primeras líneas (`--azul`, etc.). Si cambiás el azul, chequeá el contraste con el blanco en webaim.org/resources/contrastchecker (mínimo 4.5:1) |
| Logo | Archivo dentro de `sitio/` (SVG o PNG) y su nombre en `logo` de `sitio/config.js`. Con `logoEnBlanco: true` se muestra en blanco aunque el archivo sea negro (sirve para logos de un color); con `false`, con sus colores. El tamaño se cambia en `sitio/estilos.css`: `--alto-logo` (72px en celular, 88px en computadora) |
| Tipografía | Montserrat, guardada en `sitio/fuentes/montserrat.woff2` (licencia libre OFL, no depende de Google Fonts). Para cambiarla: reemplazar el archivo por otro `.woff2` y el nombre en `@font-face` y `--fuente` de `sitio/estilos.css` |
| Nombre, aviso, formas de pago, WhatsApp, mail | Pestaña **Configuración** de la planilla (sin publicar de nuevo) |
| Secciones del menú (Quiénes somos, Contacto…) | Pestaña **Páginas** de la planilla (sin publicar de nuevo; ver COMO-USARLO.md) |
| Descripción para Google y al compartir el enlace | `sitio/index.html`, la línea `<meta name="description" …>` |
| Google Tag Manager | `sitio/index.html`: dos comentarios marcan dónde pegar los dos fragmentos. El ID `GTM-…` sale de la cuenta de Pablo en tagmanager.google.com |

Después de tocar archivos de `sitio/`, se publica una vez (punto 1).

---

## 5. Pendientes y próximos pasos

### Para que esté listo

- [ ] **Datos del negocio:** nombre, rubro, WhatsApp y mail de Pablo (Configuración).
- [ ] **Productos reales:** códigos, nombres, descripciones, precios, stock, categorías y su orden.
- [ ] **Cuotas reales:** cantidades y recargos (Financiación), o desactivarlas todas si no ofrece.
- [ ] **Fotos:** una por producto, en WebP, nombradas con el código, con su "Texto de la foto".
- [ ] **Marca:** azul definitivo y logo.
- [ ] **Textos:** aviso de la franja, formas de pago y descripción para Google.
- [ ] **Secciones:** reemplazar los "[Completar]" de la pestaña Páginas (Quiénes somos, Envíos y pagos,
      Preguntas frecuentes, Contacto). Mientras tanto se ven tal cual en el sitio.
- [ ] **Dominio:** confirmar cuál es, quién lo administra, y que Pablo tenga acceso propio.
- [ ] **Migración a las cuentas de Pablo** (punto 3) y borrar los pedidos de prueba.
- [ ] **Fotos:** cuando esté la carpeta (unos 50 productos), convertirlas por lote a WebP en dos tamaños
      (miniatura para la grilla y grande para la página del producto).
- [ ] **Escalas reales:** reemplazar las filas de ejemplo de la pestaña Escalas y definir los mínimos
      mayoristas en Configuración.
- [ ] **`direccion_sitio`** en Configuración con la dirección pública definitiva (Netlify o el dominio
      de Pablo). Sin esto, el ingreso de mayoristas no funciona.

### Limitaciones de esta versión, para saber qué esperar

- **Sin variantes** (talle, color): cada variante va como producto con su propio código (`P010-S`, `P010-M`).
- **Vista previa de los enlaces:** al compartir `?p=P001` en WhatsApp o redes, la vista previa muestra
  el sitio en general, no la foto ni el nombre del producto. WhatsApp e Instagram leen esa vista previa
  sin ejecutar el código del sitio, así que necesitarían una página ya armada por producto: eso requiere
  un paso extra en el servidor (por ejemplo, una función de Netlify que gasta créditos). Se puede sumar
  más adelante si compartir productos sueltos se vuelve importante.
- **Pedidos por WhatsApp:** quedan anotados cuando el cliente abre WhatsApp, no cuando envía el mensaje.
  Se confirma buscando la Referencia en el chat (ver COMO-USARLO.md).
- **Tope de 100 mails por día** con Gmail gratuito (1.500 con Google Workspace). Pasado el tope, los
  pedidos igual quedan en la planilla, pero sin aviso por mail hasta el día siguiente.

### Con unos 200 productos

Probado con un catálogo simulado de 200 productos:
- **Los datos pesan poco:** unos 60 KB en total, se guardan en la memoria del script en pedazos y en
  el celular del visitante para la próxima visita.
- **La página no se pone lenta:** muestra 24 productos y un botón "Ver más". Las fotos cargan recién
  cuando se acercan a la pantalla. El buscador y los filtros recorren los 200 igual.
- **Lo que sí pesa son las fotos.** Con fotos de 800 × 800 px en WebP a unos 60–80 KB, las 200 suman
  unos 15 MB en la carpeta del sitio. Cada visitante descarga solo las que ve.
- **Cuenta de Netlify (estimación, no medición):** si un visitante ve unas 30 fotos, son unos 2–3 MB.
  Con 20 créditos por GB, 1.000 visitas al mes rondarían 2,5 GB = 50 créditos. Mirá el consumo real en
  Netlify → **Usage** el primer mes.
- **Sugerencia para cargar 200 fotos:** squoosh.app convierte de a una. Para muchas juntas sirve un
  conversor por lotes (por ejemplo, XnConvert, gratis): tamaño 800 × 800, formato WebP, calidad 75–80.
  Nombrá cada archivo con su código antes de convertir.

### Mejoras para más adelante

- **Google Analytics 4 (vía Tag Manager):** ver cuántas visitas hay, de dónde vienen y cuántas terminan
  en pedido. Conviene sumar eventos para "agregó al pedido", "envió por WhatsApp" y "envió el formulario",
  que son los números que importan. Requiere el ID de Tag Manager y un pequeño agregado al código.
- **Vista previa con la foto del producto** al compartir un enlace (ver limitaciones).
- **Mail de confirmación al cliente:** posible, pero gasta 2 mails por pedido del tope diario.

### Cuándo conviene pasar a una plataforma de tienda con pago online (Tiendanube, Shopify, etc.)

Este catálogo resuelve bien un negocio que vende con conversación: el cliente arma el pedido y el
cobro se cierra por WhatsApp. Conviene migrar cuando aparezca **alguna** de estas señales:

- Los clientes **piden pagar en el momento** (tarjeta o Mercado Pago dentro del sitio), o se pierden
  ventas por tener que esperar la respuesta.
- Llegan **más de 50–100 pedidos por día** por formulario, y el tope de mails y la planilla empiezan
  a quedar chicos.
- Hacen falta **variantes** (talle/color con stock por variante), **cálculo de envío** automático o
  **facturación** integrada.
- **Varias personas** atienden pedidos y la planilla se vuelve difícil de coordinar.
- **El tiempo que se va en cargar pedidos a mano** cuesta más que la cuota mensual de la plataforma.

Hasta entonces, esta solución no tiene costo fijo: sale gratis mientras no se pase de los límites
de Netlify y de Google, y Pablo controla sus datos.
