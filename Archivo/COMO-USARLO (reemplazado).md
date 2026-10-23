# Cómo usarlo — el día a día

Todo se maneja desde **la planilla de Google**. El sitio la lee sola: no hace falta tocar
código ni volver a publicar para cambiar productos, precios, stock o cuotas.

## Qué se actualiza solo y qué hay que publicar

| Cambio | ¿Hay que publicar en Netlify? | Cuándo se ve |
|---|---|---|
| Productos, precios, stock, categorías, cuotas, Configuración, textos de las secciones (pestaña Páginas) | **No.** Se edita la planilla de Google y listo. (Un archivo de Excel en la compu no está conectado: hay que copiar los datos a la planilla de Google) | En la próxima vez que alguien abra o recargue la página. Si no aparece: menú **Catálogo → Actualizar el sitio ahora**. Como mucho, 5 minutos |
| Fotos nuevas o reemplazadas, logo, colores, `config.js` | **Sí**: arrastrar la carpeta `sitio` de nuevo (15 créditos) | Al terminar la publicación |
| Código del script (`Codigo.gs`) | No es Netlify: **Implementar → Administrar implementaciones → lápiz → Nueva versión** | Al implementar |

Juntá los cambios que requieren publicar (por ejemplo, todas las fotos de la semana) y publicá una vez.

> Regla de oro: **no cambies los títulos de las columnas** ni los nombres de las pestañas.
> El script busca las columnas por su título. Sí podés moverlas de lugar o agregar columnas nuevas.

---

## Cargar un producto

1. Pestaña **Productos** → escribí en la primera fila libre:

| Columna | Qué poner |
|---|---|
| Código | Único, sin espacios. Ej.: `P007` |
| Nombre | Como querés que se lea en el sitio |
| Categoría | Igual que en la pestaña **Categorías** (si es nueva, agregala ahí con su orden) |
| Descripción corta | Una o dos líneas |
| Precio contado | Solo el número: `25000` |
| Stock | Unidades. Vacío = no llevás stock de ese producto (se muestra "Disponible") |
| Foto | Vacío = se usa `CÓDIGO.webp`. Solo si la foto tiene otro nombre |
| Texto de la foto | Qué se ve en la foto, para personas que no ven la imagen. Ej.: "Maceta blanca de 20 cm" |
| Activo | **sí** para que aparezca |
| Destacado | **sí** para que aparezca primero, con la etiqueta "Destacado" |
| Descripción larga | Opcional. Se ve en la página del producto (medidas, materiales, cuidados). Cada salto de línea es un párrafo. Vacío = se usa la corta |

2. **La foto** (esta parte sí requiere publicar el sitio):
   - Formato **WebP**, cuadrada, unos 800 × 800 px. Para convertir: squoosh.app (gratis, en el navegador).
   - Nombre = el código exacto, respetando mayúsculas: `P007.webp`.
   - Va en la carpeta `sitio/fotos/`. Después hay que **volver a publicar** el sitio (ver INSTALACION.md).
   - Cada publicación gasta créditos de Netlify: **juntá varias fotos y publicá una sola vez**.
   - Mientras la foto no esté publicada, el producto se ve con una imagen de "Foto no disponible".

Las columnas **Costo**, **Proveedor** y **Notas internas** (títulos grises) son privadas: nunca
salen hacia el sitio. Podés agregar más columnas privadas, también nunca salen.

## Cambiar un precio

Pestaña **Productos** → columna **Precio contado** → escribí el número nuevo (`27500`, sin `$`).
Las cuotas se recalculan solas.

## Cambiar las cuotas

Pestaña **Financiación**: una fila por opción.
- **Cuotas**: cantidad (3, 6, 12…). **Recargo**: porcentaje sobre el contado (`0%` = sin interés).
- **Activa**: **no** para ocultar una opción sin borrarla.
- La columna gris de ejemplo se calcula sola para que controles el recargo.
- La pestaña **Cuotas (calculado)** se llena sola. **No escribas nada ahí.**

## Actualizar el stock

**A mano (solo si el automático de abajo está apagado, o para ventas que no pasaron por el sitio):**
en **Productos**, restale las unidades a la columna **Stock**. El sitio muestra:
- **Disponible**: más unidades que el umbral.
- **Últimas unidades**: el umbral o menos (3 por defecto; se cambia en Configuración).
- **Sin stock**: 0. El producto se sigue viendo, pero no se puede agregar al pedido. Para ocultarlo,
  poné `mostrar_sin_stock` en **no**.

**Automático (activado):** con `descontar_stock_al_confirmar` = **sí** en **Configuración**, cuando en
**Pedidos** pasás un pedido a **Confirmado** (de cualquier canal: formulario o WhatsApp), el stock se
descuenta solo y aparece un aviso abajo a la derecha. Si después lo pasás a **Cancelado**, el stock
vuelve. Confirmar dos veces no descuenta dos veces. Con el automático activo, **no restes el stock a
mano** de los pedidos que confirmás, porque se descontaría dos veces.

## Precios por cantidad y mayoristas

**Escalas (pestaña Escalas):** una fila por cada tramo de descuento de cada producto.

| Código | Para | Desde (unidades) | Descuento |
|---|---|---|---|
| P001 | todos | 6 | 5% |
| P001 | mayoristas | 6 | 15% |
| P001 | mayoristas | 24 | 25% |

- **todos:** lo ve cualquier visitante. En el ejemplo, quien lleva 6 o más de P001 paga 5% menos.
- **mayoristas:** solo lo ve quien ingresó como mayorista.
- Para cada producto se aplica **el mayor descuento al que llega la cantidad pedida de ese producto**.
- El descuento se escribe como porcentaje (`15%`). Si se escribe `15`, también se entiende 15%.
- Un producto sin filas en Escalas se vende siempre a precio de lista.
- ⚠️ La pestaña viene con filas de ejemplo (P001, P004): reemplazalas por las reales o borralas.

**Mínimos (en Configuración):**
- `mayorista_unidades_minimas`: de cada producto hay que llevar al menos esa cantidad para que vaya a
  precio mayorista. Si se lleva menos, ese producto va con las escalas de `todos`.
- `mayorista_monto_minimo`: si el pedido mayorista no llega a ese monto, **todo el pedido** se calcula
  a precio minorista, y el sitio le avisa al cliente cuánto le falta.
- Vacío = sin mínimo.

**Cómo ingresa un mayorista (Pablo no tiene que hacer nada):**
1. En el sitio toca **"¿Sos mayorista? Ingresá"**, deja nombre, teléfono y mail, y acepta el aviso de privacidad.
2. Le llega un mail con un botón **"Ver precios mayoristas"**. Vence en 30 minutos y sirve una sola vez.
3. Al tocarlo, ese celular o esa compu quedan habilitados **90 días**. Arriba del catálogo ve
   "Precios mayoristas activos", sus condiciones y un botón **Salir**.
4. Sus pedidos llegan marcados: en Pedidos, columna **Cliente** = `Mayorista`, y el asunto del mail dice **MAYORISTA**.
   Si no llegó al monto mínimo, dice `Mayorista sin mínimo` y se calculó como minorista.

**Pestaña Mayoristas:** se llena sola con cada persona que pide acceso (con fecha de consentimiento).
- Para **bloquear** a alguien: **Activo = no**. Deja de ver precios mayoristas al instante, aunque ya
  haya ingresado.
- Para cerrar la sesión de **todos** los mayoristas a la vez: en Apps Script → Configuración del
  proyecto (engranaje) → Propiedades del script → borrar `secreto_sesiones`.
- Cada mail de acceso gasta 1 de los 100 mails diarios. Hay un tope de 3 por persona por hora y 15 en
  total por hora.
- Para apagar todo lo de mayoristas: `mayoristas_activo` = **no**.

**Qué es seguro y qué no:** los precios mayoristas los entrega y los calcula el script, nunca el
sitio. Sin un enlace válido no se pueden ver, y la sesión no se puede falsificar. Pero como no hay
aprobación manual, **cualquiera que tenga un mail puede registrarse como mayorista**. Lo que protege
los precios son los mínimos de compra.

## Las secciones del menú (Quiénes somos, Contacto…)

Pestaña **Páginas**: una fila por sección. Lo que se escribe ahí se ve en el sitio sin publicar nada.

| Columna | Qué poner |
|---|---|
| Página | Nombre corto para la dirección, sin espacios ni tildes: `quienes-somos` → `sitio/?pagina=quienes-somos` |
| Título en el menú | Cómo se lee en el menú (puede ser más corto: "Preguntas") |
| Título | El título grande de la sección |
| Texto | El contenido (ver abajo cómo se escribe) |
| Orden | Posición en el menú (1 = primero, después de "Catálogo") |
| Activa | **no** para sacarla del menú sin borrarla |

**Cómo se escribe el texto** (en una celda; para pasar de línea: **Ctrl+Enter**):
- Línea en blanco = párrafo nuevo.
- Línea que empieza con `## ` = subtítulo. En **preguntas-frecuentes**, cada `## ` es una pregunta que se despliega.
- Línea que empieza con `- ` = punto de una lista.
- Una dirección `https://…` se vuelve un enlace (por ejemplo, el Instagram del negocio).
- En **contacto**, los botones de WhatsApp y mail se agregan solos, con los datos de Configuración.

Los textos con **[Completar]** son guías: reemplazalos por la información real del negocio.
Para sumar una sección nueva, agregá una fila con su propio nombre corto.

## Compartir un producto

Cada producto tiene su propia página y su propio enlace: la dirección del sitio + `?p=` + el código.
Ej.: `https://tu-sitio.netlify.app/?p=P001`. Se consigue de tres maneras:
- Abrí el producto en el sitio (tocando su foto o su nombre) y copiá la dirección del navegador.
- En la página del producto, botón **Compartir**: en el celular abre el menú para mandarlo por WhatsApp,
  Instagram, etc.; en la computadora copia el enlace.
- Escribilo a mano con el código.

Quien abre el enlace ve ese producto directamente, y al cerrarlo queda en el catálogo. Si el producto
se desactivó, ve el catálogo con un aviso.

Al pegar el enlace en WhatsApp, la vista previa muestra el sitio en general, no la foto del producto
(eso necesitaría un servidor; ver INSTALACION.md).

## Ver y atender pedidos

Los pedidos llegan por **dos canales**, y los dos quedan en la pestaña **Pedidos** (columna **Canal**):

**Formulario (por mail)**
1. Te llega un **mail** a `mail_pedidos` con el asunto "Nuevo pedido N° … — Nombre".
   **Respondé ese mail y la respuesta le llega directo al cliente.**
2. Se anota una **fila nueva** con Canal = **Formulario**, Estado "Nuevo" (amarillo) y los datos del cliente.

**WhatsApp**
1. Cuando el cliente toca **Enviar por WhatsApp**, se anota una fila con Canal = **WhatsApp** y una
   **Referencia** (ej. `W-K7P2Q`). La misma referencia va al final del mensaje que le llega a tu WhatsApp.
2. Ojo: la fila se anota cuando el cliente **abre** WhatsApp, no cuando **envía** el mensaje. Buscá la
   referencia en tus chats: si el mensaje llegó, seguí con el pedido; si nunca llegó, pasalo a **Cancelado**.
3. No gasta mails (no hay aviso por correo: el aviso es el propio WhatsApp).

Para seguir cada pedido, cambiá la columna **Estado**: Nuevo → **Confirmado** → **Entregado**
(o **Cancelado**). El cobro se arregla por fuera: el sitio no cobra nada.

## Lo que se cambia en Configuración

| Dato | Para qué |
|---|---|
| `nombre_negocio` | Arriba del sitio y en los mails |
| `whatsapp` | El número que recibe los pedidos. Código de país, sin `+` ni espacios: `5491122334455` |
| `mail_pedidos` | Adónde llegan los pedidos del formulario. También aparece en el aviso de privacidad |
| `mostrar_precios` | **no** = el sitio muestra "Consultar precio" |
| `mostrar_stock_exacto` | **sí** = además del estado, muestra cuántas unidades quedan |
| `umbral_ultimas_unidades` | Desde cuántas unidades se muestra "Últimas unidades" |
| `mostrar_sin_stock` | **no** = los productos sin stock desaparecen del sitio |
| `texto_aviso` | La franja celeste de arriba. Para varios mensajes que roten solos, separalos con `\|` (ej.: `Envíos a todo el país \| 3 cuotas sin interés`). Vacío = no se muestra. Cuántos segundos queda cada uno: `segundosPorAviso` en `sitio/config.js` |
| `formas_de_pago` | Las opciones del formulario, separadas por coma |
| `descontar_stock_al_confirmar` | Descuento automático de stock (ver arriba) |
| `mayoristas_activo` | **no** = no se ofrece el ingreso de mayoristas y nadie ve sus precios |
| `mayorista_monto_minimo` / `mayorista_unidades_minimas` | Mínimos para precio mayorista (ver "Precios por cantidad y mayoristas") |
| `direccion_sitio` | La dirección pública del sitio (ej. `https://minegocio.netlify.app/`). Es adonde lleva el enlace que reciben los mayoristas. **Si cambia el dominio, actualizarla** |

---

## Si algo deja de andar

**Primer paso siempre: la prueba de vida.** Abrí en el navegador la URL del script (la que termina
en `/exec`, está en `sitio/config.js`).

| Lo que ves | Qué pasa | Qué hacer |
|---|---|---|
| `{"ok":true,"productos":N,…}` | El script anda | El problema está en el sitio o en el celular. Recargá; probá desde otro celular |
| `{"ok":false,"error":"…"}` | El script no pudo leer la planilla | Leé el error. Casi siempre es una pestaña o un título de columna renombrado: volvé al nombre original |
| Una pantalla de inicio de sesión de Google | La publicación del script quedó con el acceso equivocado | Apps Script → Implementar → Administrar implementaciones → lápiz → **Quién tiene acceso: Cualquier persona** (no "con cuenta de Google") → Implementar |
| Una página de error de Google ("no se encontró", "no se puede abrir el archivo") | La URL ya no existe: se archivó la implementación o se creó una nueva | Copiá la URL actual de Implementar → Administrar implementaciones, pegala en `sitio/config.js` y volvé a publicar el sitio |

**Otros casos:**

- **Cambié algo y el sitio no lo muestra:** menú **Catálogo → Actualizar el sitio ahora**, y recargá la página.
- **Un producto no aparece:** revisá que tenga Código y Nombre, que **Activo** diga **sí**, y que no
  esté en 0 con `mostrar_sin_stock` en **no**.
- **Una foto no aparece:** el nombre tiene que coincidir exacto, con mayúsculas y `.webp`, y el sitio
  tiene que estar **publicado de nuevo** después de agregarla.
- **No llegan los mails de pedidos:**
  - Mirá la carpeta de spam.
  - Revisá `mail_pedidos` en Configuración.
  - Mirá `mails_restantes_hoy` en la prueba de vida. Una cuenta gratuita de Gmail puede mandar
    **100 mails por día** desde el script (cada pedido gasta 1). Si se agotan, los pedidos **igual
    quedan en la pestaña Pedidos**, y al día siguiente vuelve a andar.
  - Para probar el envío: menú **Catálogo → Probar el envío de mails**.
- **Cambiaste el código del script:** guardar no alcanza. **Implementar → Administrar implementaciones →
  lápiz → Versión: Nueva versión → Implementar.** Así la URL no cambia. **Nunca** "Nueva implementación":
  esa crea otra URL y el sitio deja de encontrar el catálogo.
- **A un mayorista no le llega el mail de acceso:** que revise spam. En la planilla, `direccion_sitio`
  tiene que estar completa. Si pidió muchas veces seguidas, tiene que esperar una hora (el tope evita
  gastar los 100 mails diarios).
- **Un mayorista dice que el enlace "venció o ya se usó":** vence a los 30 minutos y sirve una sola vez.
  Que pida otro desde "¿Sos mayorista? Ingresá".
- **El sitio muestra "Site not available":** se terminaron los créditos del mes de Netlify. Vuelve solo
  al empezar el ciclo siguiente, o se pasa a un plan pago. Ver INSTALACION.md.
