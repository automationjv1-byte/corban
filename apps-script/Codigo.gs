/**
 * @OnlyCurrentDoc
 *
 * CATÁLOGO CONECTADO A GOOGLE SHEETS — script de la planilla
 * ------------------------------------------------------------------
 * Este archivo vive dentro de la planilla (Extensiones → Apps Script).
 * Hace cuatro cosas:
 *
 *   1. configurarPlanilla()  Arma las hojas la primera vez (botón del menú "Catálogo").
 *   2. doGet()               Le entrega el catálogo al sitio, SOLO con columnas públicas.
 *                            Abierto sin parámetros es la "prueba de vida": {"ok":true,"productos":N}
 *   3. doPost()              Recibe un pedido del formulario: manda el mail y lo anota en Pedidos.
 *   4. onEdit()              Borra la caché cuando editás la planilla y, si está activado,
 *                            descuenta el stock al marcar un pedido como "Confirmado".
 *
 * ⚠️ Cambiar este código NO alcanza con guardar. Hay que ir a
 *    Implementar → Administrar implementaciones → lápiz → Versión: "Nueva versión" → Implementar.
 *    Así la URL no cambia. Si creás una implementación NUEVA, sale otra URL y hay que
 *    pegarla otra vez en sitio/config.js.
 */

// ===================================================================
// Ajustes
// ===================================================================

const HOJA = {
  productos: 'Productos',
  categorias: 'Categorías',
  financiacion: 'Financiación',
  cuotas: 'Cuotas (calculado)',
  pedidos: 'Pedidos',
  config: 'Configuración',
  paginas: 'Páginas',
  escalas: 'Escalas',
  mayoristas: 'Mayoristas',
  reportes: 'Reportes',
};

// Minutos que el catálogo queda guardado en memoria (caché) para que el sitio cargue rápido.
// Editar la planilla borra la caché sola; este número es el tope si eso falla.
const MINUTOS_CACHE = 5;

// LAS ÚNICAS COLUMNAS DE "Productos" QUE PUEDEN SALIR HACIA EL SITIO.
// Se buscan por el título de la columna (sin importar mayúsculas ni tildes), así que
// podés moverlas de lugar. Si agregás columnas privadas (costo, margen, proveedor…),
// NO las agregues acá: lo que no está en esta lista nunca sale de la planilla.
const COLUMNAS_PUBLICAS = {
  codigo: 'codigo',
  nombre: 'nombre',
  categoria: 'categoria',
  descripcion: 'descripcion corta',
  descripcion_larga: 'descripcion larga', // opcional: se ve en la página individual del producto
  precio: 'precio contado',
  stock: 'stock', // se usa para calcular el estado; el número solo sale si Configuración lo permite
  foto: 'foto',
  alt: 'texto de la foto',
  activo: 'activo',
  destacado: 'destacado',
  // Opciones: filas con el mismo Grupo se muestran como un solo producto con opciones a elegir.
  grupo: 'grupo',
  car1: 'caracteristica 1',
  car2: 'caracteristica 2',
  car3: 'caracteristica 3',
};

// Datos de Configuración que el sitio necesita. El resto (por ejemplo,
// descontar_stock_al_confirmar) se queda en la planilla.
const CONFIG_PUBLICA = [
  'nombre_negocio', 'whatsapp', 'mail_pedidos', 'texto_aviso', 'formas_de_pago',
];

const ESTADOS_PEDIDO = ['Nuevo', 'Confirmado', 'Entregado', 'Cancelado'];

// Columnas de cada hoja. Si una versión nueva del script suma columnas, el botón
// "Configurar / actualizar la planilla" las agrega al final de una planilla que ya existe.
const TITULOS_PRODUCTOS = ['Código', 'Nombre', 'Categoría', 'Descripción corta', 'Precio contado',
  'Stock', 'Foto', 'Texto de la foto', 'Activo', 'Destacado', 'Descripción larga',
  'Grupo', 'Característica 1', 'Característica 2', 'Característica 3',
  'Costo', 'Proveedor', 'Notas internas'];
const TITULOS_PEDIDOS = ['Fecha', 'N° pedido', 'Canal', 'Cliente', 'Referencia', 'Nombre', 'Teléfono', 'Mail',
  'Detalle', 'Códigos', 'Total contado', 'Forma de pago', 'Comentarios', 'Origen', 'Estado', 'Stock descontado'];
const TITULOS_ESCALAS = ['Código', 'Para', 'Desde (unidades)', 'Descuento'];
// Una fila por subcategoría, con su categoría grande al lado. El orden de las filas es el del sitio.
const TITULOS_CATEGORIAS = ['Categoría', 'Subcategoría'];
const TITULOS_MAYORISTAS = ['Alta', 'Nombre', 'Teléfono', 'Mail', 'Consentimiento', 'Último ingreso', 'Activo'];

// Datos de la hoja Configuración: [dato, valor inicial, para qué sirve].
// Si una versión nueva suma datos, "Configurar / actualizar la planilla" los agrega al final.
const FILAS_CONFIG = [
  ['nombre_negocio', 'Mi Negocio', 'Aparece arriba en el sitio y en los mails de pedido.'],
  ['whatsapp', '5491169484851', 'Número que recibe los pedidos. Con código de país, sin + ni espacios. Argentina, celular: 549 + área sin 0 + número sin 15.'],
  ['mail_pedidos', 'automation.jv1@gmail.com', 'Mail al que llegan los pedidos del formulario. También se muestra en el aviso de privacidad.'],
  ['mostrar_precios', 'sí', 'no = el sitio muestra "Consultar precio" y no muestra cuotas.'],
  ['mostrar_stock_exacto', 'no', 'sí = además de "Disponible", muestra cuántas unidades quedan.'],
  ['umbral_ultimas_unidades', 3, 'Con esta cantidad o menos, el producto muestra "Últimas unidades".'],
  ['mostrar_sin_stock', 'sí', 'no = los productos sin stock desaparecen del sitio.'],
  ['texto_aviso', 'Armá tu pedido y te confirmamos disponibilidad, precio final y entrega.', 'Franja de avisos arriba del catálogo. Varios mensajes separados por | van rotando solos. Vacío = no se muestra.'],
  ['formas_de_pago', 'Efectivo, Transferencia, Tarjeta en cuotas', 'Opciones que el cliente elige en el formulario, separadas por coma.'],
  ['descontar_stock_al_confirmar', 'no', 'sí = al poner un pedido en "Confirmado", el stock se descuenta solo (y vuelve si lo pasás a "Cancelado").'],
  ['mayoristas_activo', 'sí', 'sí = el sitio muestra "¿Sos mayorista? Ingresá". Las escalas de precio se cargan en la hoja Escalas. no = nadie ve precios mayoristas.'],
  ['mayorista_monto_minimo', '', 'Monto mínimo del pedido para que valgan los precios mayoristas (ej. 100000). Si no llega, se calcula como minorista. Vacío = sin mínimo.'],
  ['mayorista_unidades_minimas', '', 'Unidades mínimas de CADA producto para que ese producto vaya a precio mayorista (ej. 6). Vacío = sin mínimo.'],
  ['direccion_sitio', '', 'Dirección pública del sitio, ej. https://minegocio.netlify.app/ — es adonde lleva el enlace que reciben los mayoristas por mail. Sin esto, el ingreso de mayoristas no funciona.'],
];
const CONFIG_SI_NO = ['mostrar_precios', 'mostrar_stock_exacto', 'mostrar_sin_stock', 'descontar_stock_al_confirmar', 'mayoristas_activo'];

// Tope de pedidos por WhatsApp que se anotan por minuto (freno contra abusos).
const MAX_WHATSAPP_POR_MINUTO = 30;

// Ingreso de mayoristas
const MINUTOS_ENLACE_ACCESO = 30;   // cuánto dura el enlace que llega por mail (es de un solo uso)
const DIAS_SESION_MAYORISTA = 90;   // cuánto tiempo queda habilitado ese celular o compu
const MAX_ENLACES_POR_MAIL_HORA = 3; // freno: pedidos de enlace por mail por hora
const MAX_ENLACES_POR_HORA = 15;     // freno general: cuida la cuota de 100 mails por día de Gmail

// ===================================================================
// 1. Menú y armado de la planilla
// ===================================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Catálogo')
    .addItem('Cargar o editar producto', 'abrirFormularioProducto')
    .addSeparator()
    .addItem('Actualizar el sitio ahora', 'actualizarSitioAhora')
    .addItem('Probar el envío de mails', 'probarMail')
    .addSeparator()
    .addItem('Configurar / actualizar la planilla', 'configurarPlanilla')
    .addToUi();
}

// La primera vez arma todas las hojas. Después, con una versión nueva del script,
// solo agrega al final las columnas nuevas que falten. Nunca borra ni pisa datos.
function configurarPlanilla() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const creadas = [];
  const crear = (nombre, armar) => {
    if (ss.getSheetByName(nombre)) return; // nunca pisa una hoja que ya existe
    armar(ss.insertSheet(nombre));
    creadas.push(nombre);
  };
  const agregadas = []
    .concat(asegurarColumnas_(ss.getSheetByName(HOJA.productos), TITULOS_PRODUCTOS))
    .concat(asegurarColumnas_(ss.getSheetByName(HOJA.pedidos), TITULOS_PEDIDOS))
    .concat(migrarCategorias_(ss.getSheetByName(HOJA.categorias)))
    .concat(asegurarConfig_(ss.getSheetByName(HOJA.config)));

  crear(HOJA.productos, armarProductos_);
  crear(HOJA.categorias, armarCategorias_);
  crear(HOJA.financiacion, armarFinanciacion_);
  crear(HOJA.cuotas, armarCuotas_); // va después de Productos y Financiación: los usa en fórmulas
  crear(HOJA.pedidos, armarPedidos_);
  crear(HOJA.config, armarConfig_);
  crear(HOJA.paginas, armarPaginas_);
  crear(HOJA.escalas, armarEscalas_);
  crear(HOJA.mayoristas, armarMayoristas_);
  crear(HOJA.reportes, armarReportes_);
  ponerDesplegables_(ss);

  // Toda planilla nueva trae una hoja vacía; si sigue vacía, la saco.
  ['Hoja 1', 'Hoja1', 'Sheet1'].forEach(n => {
    const h = ss.getSheetByName(n);
    if (h && h.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(h);
  });

  ss.setActiveSheet(ss.getSheetByName(HOJA.productos));
  borrarCache_();
  const partes = [];
  if (creadas.length) partes.push('Hojas creadas: ' + creadas.join(', ') + '.');
  if (agregadas.length) partes.push('Agregado: ' + agregadas.join(', ') + '.');
  const msg = partes.length ? 'Listo. ' + partes.join(' ') : 'No hice cambios: la planilla ya estaba al día.';
  ss.toast(msg, 'Catálogo', 10);
  console.log(msg);
}

const AZUL = '#1747a6';
const GRIS = '#5f6673';

function encabezado_(hoja, titulos, privadas) {
  hoja.getRange(1, 1, 1, titulos.length).setValues([titulos])
    .setFontWeight('bold').setFontColor('#ffffff').setBackground(AZUL)
    .setVerticalAlignment('middle').setWrap(true);
  (privadas || []).forEach(i => hoja.getRange(1, i + 1).setBackground(GRIS)
    .setNote('Columna PRIVADA: nunca sale hacia el sitio.'));
  hoja.setFrozenRows(1);
  hoja.setRowHeight(1, 36);
  hoja.getRange(1, 1, 1, titulos.length).protect()
    .setDescription('Títulos: el script busca las columnas por este nombre')
    .setWarningOnly(true);
}

// Agrega al final de la hoja los títulos que falten. Devuelve los que agregó.
function asegurarColumnas_(hoja, titulos) {
  if (!hoja) return [];
  const ultima = Math.max(1, hoja.getLastColumn());
  const actuales = hoja.getRange(1, 1, 1, ultima).getValues()[0].map(normalizar_);
  const faltan = titulos.filter(t => !actuales.includes(normalizar_(t)));
  faltan.forEach((t, i) => {
    hoja.getRange(1, ultima + 1 + i).setValue(t)
      .setFontWeight('bold').setFontColor('#ffffff').setBackground(AZUL).setWrap(true);
  });
  return faltan.map(t => `${hoja.getName()} → ${t}`);
}

// Número de columna (1, 2, …) de un título, o 0 si no está.
function columna_(titulos, titulo) {
  return titulos.map(normalizar_).indexOf(normalizar_(titulo)) + 1;
}

function listaSiNo_(rango) {
  rango.setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['sí', 'no'], true).setAllowInvalid(true).build());
}

function armarProductos_(h) {
  const t = TITULOS_PRODUCTOS;
  const c = titulo => columna_(t, titulo);
  // Las columnas de Precio contado (E) y Código (A) las usa la hoja Cuotas (calculado): no cambiar su orden acá.
  encabezado_(h, t, ['Costo', 'Proveedor', 'Notas internas'].map(x => c(x) - 1));
  const larga = 'Texto más largo que se ve solo en la página del producto. Puede tener varios párrafos.';
  // Cada ejemplo por nombre de columna, para que no se corra si cambia el orden.
  const ejemplos = [
    { 'Código': 'P001', 'Nombre': 'Producto de ejemplo 1', 'Categoría': 'Categoría A', 'Descripción corta': 'Descripción corta del producto, una o dos líneas.', 'Precio contado': 25000, 'Stock': 12, 'Foto': 'P001.webp', 'Texto de la foto': 'Foto del producto de ejemplo 1', 'Activo': 'sí', 'Destacado': 'sí', 'Descripción larga': larga, 'Costo': 15000, 'Proveedor': 'Proveedor X' },
    { 'Código': 'P002', 'Nombre': 'Producto de ejemplo 2', 'Categoría': 'Categoría A', 'Descripción corta': 'Otro producto de la misma categoría.', 'Precio contado': 18500, 'Stock': 2, 'Foto': 'P002.webp', 'Texto de la foto': 'Foto del producto de ejemplo 2', 'Activo': 'sí', 'Destacado': 'no', 'Costo': 10000, 'Proveedor': 'Proveedor X', 'Notas internas': 'Quedan pocas: aparece "Últimas unidades"' },
    { 'Código': 'P003', 'Nombre': 'Producto de ejemplo 3', 'Categoría': 'Categoría B', 'Descripción corta': 'Este no tiene stock: aparece "Sin stock".', 'Precio contado': 42000, 'Stock': 0, 'Foto': 'P003.webp', 'Texto de la foto': 'Foto del producto de ejemplo 3', 'Activo': 'sí', 'Destacado': 'no', 'Costo': 30000, 'Proveedor': 'Proveedor Y' },
    { 'Código': 'P004', 'Nombre': 'Producto de ejemplo 4', 'Categoría': 'Categoría B', 'Descripción corta': 'Producto con nombre más largo para probar cómo se ve en el celular.', 'Precio contado': 9900, 'Stock': 30, 'Foto': 'P004.webp', 'Texto de la foto': 'Foto del producto de ejemplo 4', 'Activo': 'sí', 'Destacado': 'sí', 'Costo': 5000, 'Proveedor': 'Proveedor Y' },
    { 'Código': 'P005', 'Nombre': 'Producto de ejemplo 5', 'Categoría': 'Categoría C', 'Descripción corta': 'Sin texto de foto: el sitio lo avisa en la consola.', 'Precio contado': 63000, 'Stock': 5, 'Foto': 'P005.webp', 'Activo': 'sí', 'Destacado': 'no', 'Costo': 40000, 'Proveedor': 'Proveedor Z' },
    { 'Código': 'P006', 'Nombre': 'Producto de ejemplo 6', 'Categoría': 'Categoría C', 'Descripción corta': 'Producto inactivo: no aparece en el sitio.', 'Precio contado': 12000, 'Stock': 8, 'Foto': 'P006.webp', 'Texto de la foto': 'Foto del producto de ejemplo 6', 'Activo': 'no', 'Destacado': 'no', 'Costo': 7000, 'Proveedor': 'Proveedor Z', 'Notas internas': 'Activo = no' },
    // Un producto con opciones: 4 filas con el mismo Grupo = una sola tarjeta con "Elegir opciones".
    ...[['P007', '1/2"', 'PPR', 3000, 20], ['P008', '3/4"', 'PPR', 4200, 15], ['P009', '3/4"', 'PP', 3500, 10], ['P010', '1"', 'PPR', 5500, 0]]
      .map(([cod, medida, material, precio, stock]) => ({
        'Código': cod, 'Categoría': 'Categoría A', 'Descripción corta': 'Ejemplo de producto con opciones: cada medida y material es una fila con su propio código.',
        'Precio contado': precio, 'Stock': stock, 'Foto': 'P007.webp', 'Texto de la foto': 'Foto del producto de ejemplo con opciones',
        'Activo': 'sí', 'Destacado': 'no', 'Grupo': 'Producto de ejemplo con opciones',
        'Característica 1': 'Medida: ' + medida, 'Característica 2': 'Material: ' + material,
      })),
  ];
  h.getRange(2, 1, ejemplos.length, t.length).setValues(ejemplos.map(e => t.map(titulo => (titulo in e ? e[titulo] : ''))));
  h.getRange(2, c('Precio contado'), 999, 1).setNumberFormat('$ #,##0');
  h.getRange(2, c('Costo'), 999, 1).setNumberFormat('$ #,##0');
  h.getRange(2, c('Stock'), 999, 1).setNumberFormat('0');
  listaSiNo_(h.getRange(2, c('Activo'), 999, 2));
  h.getRange(2, c('Descripción larga'), 999, 1).setWrap(true);
  h.getRange(1, c('Código')).setNote('Código único. La foto se llama igual: P001 → P001.webp');
  h.getRange(1, c('Stock')).setNote('Unidades disponibles. Vacío = no llevo stock de este producto (se muestra como disponible).');
  h.getRange(1, c('Foto')).setNote('Nombre del archivo en la carpeta sitio/fotos. Vacío = se usa CÓDIGO.webp');
  h.getRange(1, c('Texto de la foto')).setNote('Describe la foto para quien no la ve (lectores de pantalla). Ej.: "Maceta de cerámica blanca de 20 cm".');
  h.getRange(1, c('Activo')).setNote('no = el producto no aparece en el sitio.');
  h.getRange(1, c('Destacado')).setNote('sí = aparece primero, con la etiqueta "Destacado".');
  h.getRange(1, c('Descripción larga')).setNote('Opcional. Se ve en la página individual del producto. Vacío = se usa la descripción corta.');
  h.getRange(1, c('Grupo')).setNote('Para productos con opciones (medidas, materiales…): las filas con el mismo Grupo se muestran como UN producto y el cliente elige la opción. Cada fila tiene su propio código, precio y stock. Vacío = producto común.');
  h.getRange(1, c('Característica 1')).setNote('Escribí "Nombre: valor". Ej.: Medida: 1/2"   Material: PPR   Presión: PN10. Usá el mismo nombre en todas las filas del grupo.');
  [80, 220, 130, 320, 110, 70, 110, 240, 70, 85, 320, 200, 140, 140, 140, 100, 120, 220].forEach((w, i) => h.setColumnWidth(i + 1, w));
}

function armarCategorias_(h) {
  encabezado_(h, TITULOS_CATEGORIAS);
  h.getRange(2, 1, 3, 2).setValues([['Categoría A', ''], ['Categoría B', ''], ['Categoría C', '']]);
  notasCategorias_(h);
}

function notasCategorias_(h) {
  h.getRange('A1').setNote('La categoría grande. Se repite en cada fila de sus subcategorías. Las filas se muestran en el sitio en este mismo orden (para reordenar, arrastrá las filas).');
  h.getRange('B1').setNote('La subcategoría (vacío = la categoría grande no tiene subcategorías). En Productos, la columna Categoría lleva la subcategoría, o la categoría grande si no tiene. Una categoría sin productos activos no se muestra.');
  h.setColumnWidth(1, 260);
  h.setColumnWidth(2, 260);
}

// Pasa la hoja Categorías del formato viejo (Nombre | Orden | Dentro de) al nuevo
// (Categoría | Subcategoría), respetando el orden. Devuelve lo que hizo, para el aviso.
function migrarCategorias_(hoja) {
  if (!hoja) return [];
  const titulos = hoja.getRange(1, 1, 1, Math.max(1, hoja.getLastColumn())).getValues()[0].map(normalizar_);
  if (titulos.includes('subcategoria') || !titulos.includes('nombre')) return [];
  const filas = leerCategoriasViejas_(hoja).map(c => [c.padre || c.nombre, c.padre ? c.nombre : '']);
  hoja.clear();
  hoja.clearNotes();
  encabezado_(hoja, TITULOS_CATEGORIAS);
  if (filas.length) hoja.getRange(2, 1, filas.length, 2).setValues(filas.map(f => f.map(sinFormula_)));
  notasCategorias_(hoja);
  return ['Categorías → ahora en dos columnas: Categoría | Subcategoría'];
}

// Formato viejo, en orden: cada grande (por su Orden) seguida de sus subcategorías (por su Orden).
function leerCategoriasViejas_(hoja) {
  const { filas, col } = leerTabla_(hoja);
  const t = (f, k) => (col[k] === undefined ? '' : String(f[col[k]] || '').trim());
  const todas = filas.map((f, i) => ({ nombre: t(f, 'nombre'), padre: t(f, 'dentro de'), orden: numero_(t(f, 'orden')), i }));
  const porOrden = (a, b) => ((a.orden === null ? 9999 : a.orden) - (b.orden === null ? 9999 : b.orden)) || a.i - b.i;
  const hijas = todas.filter(c => c.nombre && c.padre && c.padre !== c.nombre).sort(porOrden);
  const grandes = todas.filter(c => c.nombre && (!c.padre || c.padre === c.nombre)).sort(porOrden).map(c => c.nombre);
  // Una fila con solo "Dentro de" (o una subcategoría cuyo padre no está listado) igual define una grande.
  todas.forEach(c => { if (c.padre && c.padre !== c.nombre && !grandes.includes(c.padre)) grandes.push(c.padre); });
  const salida = [];
  grandes.forEach(g => {
    const suyas = hijas.filter(h => h.padre === g);
    if (!suyas.length) salida.push({ nombre: g, padre: '' });
    suyas.forEach(h => salida.push({ nombre: h.nombre, padre: g }));
  });
  return salida;
}

// Desplegables: en Categorías, la columna Categoría ofrece las grandes ya escritas; en Productos,
// la columna Categoría ofrece las subcategorías (y las grandes que no tienen). Se puede escribir
// otra cosa igual: Sheets solo la marca con un triángulo rojo.
function ponerDesplegables_(ss) {
  const hojaCat = ss.getSheetByName(HOJA.categorias);
  const prod = ss.getSheetByName(HOJA.productos);
  if (!hojaCat || !prod) return;
  const tc = hojaCat.getRange(1, 1, 1, Math.max(1, hojaCat.getLastColumn())).getValues()[0].map(normalizar_);
  const colGrande = tc.indexOf('categoria') + 1;
  if (colGrande && tc.includes('subcategoria')) {
    const letra = String.fromCharCode(64 + colGrande);
    hojaCat.getRange(2, colGrande, 999, 1).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInRange(hojaCat.getRange(`${letra}2:${letra}`), true).setAllowInvalid(true).build());
  }
  const cats = leerCategorias_(ss);
  const conHijas = new Set(cats.filter(c => c.padre).map(c => normalizar_(c.padre)));
  const opciones = cats.filter(c => c.padre || !conHijas.has(normalizar_(c.nombre))).map(c => c.nombre).slice(0, 500);
  const tp = prod.getRange(1, 1, 1, Math.max(1, prod.getLastColumn())).getValues()[0].map(normalizar_);
  const colCat = tp.indexOf('categoria') + 1;
  if (!colCat || !opciones.length) return;
  prod.getRange(2, colCat, Math.max(999, prod.getLastRow()), 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(opciones, true).setAllowInvalid(true)
    .setHelpText('Elegí la subcategoría (o la categoría, si no tiene subcategorías). Se cargan en la hoja Categorías.').build());
}

function armarFinanciacion_(h) {
  encabezado_(h, ['Cuotas', 'Recargo', 'Activa', 'Ejemplo: cuota de un producto de $100.000']);
  h.getRange(2, 1, 3, 3).setValues([[3, 0, 'sí'], [6, 0.15, 'sí'], [12, 0.35, 'no']]);
  h.getRange('B2:B').setNumberFormat('0%');
  listaSiNo_(h.getRange('C2:C'));
  h.getRange('D2').setFormula('=ARRAYFORMULA(IF(A2:A="","",ROUND(100000*(1+B2:B)/A2:A,0)))');
  h.getRange('D2:D').setNumberFormat('$ #,##0').setFontColor(GRIS);
  h.getRange('B1').setNote('Porcentaje que se suma al precio de contado. 0% = sin interés.');
  h.getRange('C1').setNote('no = esta opción no se muestra en el sitio. Si ninguna está activa, el sitio no muestra cuotas.');
  h.getRange('D1').setNote('Calculado solo, para que controles el recargo. No se escribe.');
  h.setColumnWidth(4, 300);
}

function armarCuotas_(h) {
  const fin = "'" + HOJA.financiacion + "'";
  const prod = "'" + HOJA.productos + "'";
  const activas = `${fin}!A2:A<>"", REGEXMATCH(LOWER(${fin}!C2:C), "^s")`;
  h.getRange('A1').setValue('Código');
  // Fila 1: una columna por cada opción de cuotas activa.
  h.getRange('B1').setFormula(`=IFERROR(TRANSPOSE(FILTER(${fin}!A2:A, ${activas})),)`);
  // Lista de códigos de Productos.
  h.getRange('A2').setFormula(`=IFERROR(FILTER(${prod}!A2:A, ${prod}!A2:A<>""),)`);
  // Valor de cada cuota = precio contado × (1 + recargo) ÷ cuotas
  h.getRange('B2').setFormula(
    `=IFERROR(LET(precio, FILTER(${prod}!E2:E, ${prod}!A2:A<>""),` +
    ` n, FILTER(${fin}!A2:A, ${activas}),` +
    ` recargo, FILTER(${fin}!B2:B, ${activas}),` +
    ` ARRAYFORMULA(ROUND(precio * TRANSPOSE(1 + recargo) / TRANSPOSE(n), 2))),)`);
  h.getRange('A1:Z1').setFontWeight('bold').setFontColor('#ffffff').setBackground(AZUL);
  h.getRange('B1:Z1').setNumberFormat('0" cuotas"');
  h.getRange('B2:Z').setNumberFormat('$ #,##0');
  h.setFrozenRows(1);
  h.getRange('A1').setNote('Hoja CALCULADA: se llena sola con Productos y Financiación. No se escribe nada acá.');
  h.protect().setDescription('Hoja calculada').setWarningOnly(true);
  h.setTabColor(GRIS);
}

function armarPedidos_(h) {
  const titulos = TITULOS_PEDIDOS;
  const c = titulo => columna_(titulos, titulo);
  encabezado_(h, titulos);
  const estado = c('Estado');
  h.getRange(2, estado, 999, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(ESTADOS_PEDIDO, true).setAllowInvalid(false).build());
  const rangoEstado = h.getRange(2, estado, 999, 1);
  h.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Nuevo').setBackground('#fff4c2').setRanges([rangoEstado]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Confirmado').setBackground('#d6ecd8').setRanges([rangoEstado]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Cancelado').setFontColor('#8a8f99').setRanges([rangoEstado]).build(),
  ]);
  h.getRange(2, c('Fecha'), 999, 1).setNumberFormat('dd/mm/yyyy hh:mm');
  h.getRange(2, c('Total contado'), 999, 1).setNumberFormat('$ #,##0');
  h.getRange(2, c('Detalle'), 999, 1).setWrap(true);
  h.getRange(1, estado).setNote('Nuevo → Confirmado → Entregado. Si en Configuración está activado, al pasar a Confirmado se descuenta el stock solo, y al pasar a Cancelado se devuelve.');
  h.getRange(1, c('Canal')).setNote('Formulario = llegó por mail y el cliente dejó sus datos. WhatsApp = el cliente abrió WhatsApp con este pedido: confirmá en el chat que lo haya enviado (buscá la Referencia).');
  h.getRange(1, c('Referencia')).setNote('Código que también aparece en el mensaje de WhatsApp, para encontrar el chat.');
  h.getRange(1, c('Códigos')).setNote('Lo usa el script para descontar stock. No lo edites.');
  h.getRange(1, c('Stock descontado')).setNote('Lo completa el script cuando descuenta el stock. No lo edites.');
  h.getRange(1, c('Cliente')).setNote('Minorista o Mayorista (ingresó con el enlace del mail). "Mayorista sin mínimo" = no llegó al mínimo y se calculó como minorista.');
  [120, 80, 95, 110, 95, 160, 130, 200, 340, 140, 110, 140, 240, 120, 110, 130].forEach((w, i) => h.setColumnWidth(i + 1, w));
}

function armarConfig_(h) {
  encabezado_(h, ['Dato', 'Valor', 'Para qué sirve']);
  const filas = FILAS_CONFIG;
  h.getRange('B3').setNumberFormat('@'); // el WhatsApp como texto, para que no lo convierta en número raro
  h.getRange(2, 1, filas.length, 3).setValues(filas);
  CONFIG_SI_NO.forEach(clave => listaSiNo_(h.getRange(2 + filas.findIndex(f => f[0] === clave), 2)));
  h.getRange('A2:A').setFontColor(GRIS);
  h.getRange('C2:C').setFontColor(GRIS).setWrap(true);
  h.getRange('B2:B').setWrap(true);
  h.setColumnWidth(1, 220); h.setColumnWidth(2, 320); h.setColumnWidth(3, 420);
  h.getRange('A2:A').protect().setDescription('El script busca estos nombres').setWarningOnly(true);
}

// Agrega al final de Configuración los datos nuevos que falten. Devuelve los que agregó.
function asegurarConfig_(hoja) {
  if (!hoja) return [];
  const actuales = hoja.getRange(1, 1, Math.max(1, hoja.getLastRow()), 1).getValues().map(f => normalizar_(f[0]));
  const faltan = FILAS_CONFIG.filter(f => !actuales.includes(normalizar_(f[0])));
  faltan.forEach(f => {
    const fila = hoja.getLastRow() + 1;
    hoja.getRange(fila, 1, 1, 3).setValues([f]);
    hoja.getRange(fila, 1).setFontColor(GRIS);
    hoja.getRange(fila, 3).setFontColor(GRIS).setWrap(true);
    if (CONFIG_SI_NO.includes(f[0])) listaSiNo_(hoja.getRange(fila, 2));
  });
  return faltan.map(f => `Configuración → ${f[0]}`);
}

// Escalas de precio por cantidad, por producto. "todos" = cualquier visitante; "mayoristas" = solo
// quien ingresó con el enlace del mail. Se aplica el mayor descuento al que llega la cantidad pedida.
function armarEscalas_(h) {
  encabezado_(h, TITULOS_ESCALAS);
  h.getRange(2, 1, 4, 4).setValues([
    ['P001', 'todos', 6, 0.05],
    ['P001', 'mayoristas', 6, 0.15],
    ['P001', 'mayoristas', 24, 0.25],
    ['P004', 'mayoristas', 12, 0.2],
  ]);
  h.getRange('B2:B').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['todos', 'mayoristas'], true).setAllowInvalid(false).build());
  h.getRange('C2:C').setNumberFormat('0');
  h.getRange('D2:D').setNumberFormat('0%');
  h.getRange('A1').setNote('Código del producto (igual que en Productos). Una fila por cada tramo de descuento.');
  h.getRange('B1').setNote('todos = lo ve cualquier visitante. mayoristas = solo quien ingresó con el enlace del mail (y cumple los mínimos de Configuración).');
  h.getRange('C1').setNote('Desde cuántas unidades de ESE producto vale el descuento.');
  h.getRange('D1').setNote('Porcentaje sobre el precio de contado. Ej.: 15%. Para cada producto se usa el mayor descuento al que llega la cantidad pedida.');
  [100, 120, 140, 110].forEach((w, i) => h.setColumnWidth(i + 1, w));
}

// Mayoristas que ingresaron. Se llena sola; Pablo solo toca "Activo" para bloquear a alguien.
function armarMayoristas_(h) {
  encabezado_(h, TITULOS_MAYORISTAS);
  h.getRange('A2:A').setNumberFormat('dd/mm/yyyy hh:mm');
  h.getRange('F2:F').setNumberFormat('dd/mm/yyyy hh:mm');
  listaSiNo_(h.getRange('G2:G'));
  h.getRange('A1').setNote('Se completa sola cuando alguien pide su acceso mayorista en el sitio.');
  h.getRange('G1').setNote('no = bloquea a esa persona: deja de ver precios mayoristas al instante, aunque ya haya ingresado.');
  [130, 180, 130, 220, 160, 130, 70].forEach((w, i) => h.setColumnWidth(i + 1, w));
}

// Reportes: se calculan solos con fórmulas sobre la hoja Pedidos. Venta = Estado Confirmado o Entregado.
// Las columnas de Pedidos se buscan por su título, así que no importa en qué orden estén.
// Si alguien rompe esta hoja: borrarla y correr "Configurar / actualizar la planilla" la vuelve a crear.
function armarReportes_(h) {
  const P = "'" + HOJA.pedidos + "'";
  const PR = "'" + HOJA.productos + "'";
  const col = `h,${P}!A1:Z1,c,LAMBDA(n,INDEX(${P}!A:Z,0,XMATCH(n,h)))`;    // columna entera (para SUMIFS)
  const colD = `h,${P}!A1:Z1,c,LAMBDA(n,INDEX(${P}!A2:Z,0,XMATCH(n,h))),est,c("Estado")`; // solo datos
  const vendido = 'REGEXMATCH(est,"^(Confirmado|Entregado)$")';
  const sinVentas = '"Todavía no hay ventas confirmadas"';
  const tabla = (columna, etiqueta) =>
    `=IFERROR(LET(${colD},QUERY(FILTER(HSTACK(ARRAYFORMULA(IF(c("${columna}")="","(sin dato)",c("${columna}"))),c("Total contado")),${vendido}),` +
    `"select Col1, sum(Col2), count(Col2) group by Col1 order by sum(Col2) desc label Col1 '${etiqueta}', sum(Col2) 'Ventas', count(Col2) 'Pedidos'",0)),${sinVentas})`;
  const productos = (filtro, etiqueta) =>
    `=IFERROR(LET(${colD},items,TOCOL(ARRAYFORMULA(SPLIT(FILTER(c("Códigos"),${filtro}),", ",FALSE)),1),` +
    `cod,ARRAYFORMULA(REGEXEXTRACT(items,"^(.+)×\\d+$")),cant,ARRAYFORMULA(VALUE(REGEXEXTRACT(items,"×(\\d+)$"))),` +
    `QUERY(HSTACK(cod,cant),"select Col1, sum(Col2) group by Col1 order by sum(Col2) desc limit 15 label Col1 'Código', sum(Col2) '${etiqueta}'",0)),"Todavía no hay datos")`;
  // Nombre de cada código (o el Grupo, si la fila no tiene Nombre).
  const nombres = rango =>
    `=ARRAYFORMULA(IF(${rango}="","",LET(hp,${PR}!A1:Z1,pc,INDEX(${PR}!A2:Z,0,XMATCH("Código",hp)),` +
    `pn,INDEX(${PR}!A2:Z,0,XMATCH("Nombre",hp)),pg,IFERROR(INDEX(${PR}!A2:Z,0,XMATCH("Grupo",hp)),pn),` +
    `n,XLOOKUP(${rango},pc,pn,""),g,XLOOKUP(${rango},pc,pg,""),IF(n<>"",n,g))))`;

  h.getRange('A1').setValue('Reportes').setFontSize(18).setFontWeight('bold').setFontColor(AZUL);
  h.getRange('A2').setValue('Se actualiza solo con la hoja Pedidos. Cuenta como venta solo lo que está en Confirmado o Entregado. No escribas en esta hoja.')
    .setFontColor(GRIS);
  const titulo = (celda, texto) => h.getRange(celda).setValue(texto).setFontWeight('bold').setFontColor(AZUL);
  titulo('A4', 'Resumen');
  const filas = [
    ['Ventas (Confirmado + Entregado)', `=LET(${col},SUMIFS(c("Total contado"),c("Estado"),"Confirmado")+SUMIFS(c("Total contado"),c("Estado"),"Entregado"))`],
    ['Pedidos vendidos', `=LET(${col},COUNTIFS(c("Estado"),"Confirmado")+COUNTIFS(c("Estado"),"Entregado"))`],
    ['Ticket promedio', '=IFERROR(B5/B6,0)'],
    ['Pedidos recibidos (todos)', `=LET(${col},COUNT(c("N° pedido")))`],
    ['Cancelados', `=LET(${col},COUNTIFS(c("Estado"),"Cancelado"))`],
    ['Por confirmar (Nuevo)', `=LET(${col},COUNTIFS(c("Estado"),"Nuevo"))`],
    ['Tasa de confirmación (vendidos ÷ vendidos + cancelados)', '=IFERROR(B6/(B6+B9),"")'],
  ];
  filas.forEach(([etiqueta, formula], i) => {
    h.getRange(5 + i, 1).setValue(etiqueta);
    ponerFormula_(h.getRange(5 + i, 2), formula);
  });
  h.getRange('B5').setNumberFormat('$ #,##0');
  h.getRange('B7').setNumberFormat('$ #,##0');
  h.getRange('B11').setNumberFormat('0%');

  titulo('D4', 'Ventas por mes');
  ponerFormula_(h.getRange('D5'),
    `=IFERROR(LET(${colD},QUERY(FILTER(HSTACK(ARRAYFORMULA(TEXT(c("Fecha"),"yyyy-mm")),c("Total contado")),${vendido}),` +
    `"select Col1, sum(Col2), count(Col2) group by Col1 order by Col1 label Col1 'Mes', sum(Col2) 'Ventas', count(Col2) 'Pedidos'",0)),${sinVentas})`);
  titulo('H4', 'Por canal');
  ponerFormula_(h.getRange('H5'), tabla('Canal', 'Canal'));
  titulo('L4', 'Mayorista / minorista');
  ponerFormula_(h.getRange('L5'), tabla('Cliente', 'Cliente'));
  titulo('P4', 'Forma de pago elegida (pedidos vendidos)');
  ponerFormula_(h.getRange('P5'),
    `=IFERROR(LET(${colD},QUERY(FILTER(HSTACK(ARRAYFORMULA(IF(c("Forma de pago")="","(sin dato)",c("Forma de pago"))),c("Total contado")),${vendido}),` +
    `"select Col1, count(Col2) group by Col1 order by count(Col2) desc label Col1 'Forma de pago', count(Col2) 'Pedidos'",0)),${sinVentas})`);
  ['E5:E40', 'I5:I40', 'M5:M40'].forEach(r => h.getRange(r).setNumberFormat('$ #,##0'));

  titulo('A14', 'Productos más vendidos (Confirmado o Entregado)');
  ponerFormula_(h.getRange('A15'), productos(vendido, 'Unidades vendidas'));
  h.getRange('C15').setValue('Producto').setFontWeight('bold');
  ponerFormula_(h.getRange('C16'), nombres('A16:A30'));
  titulo('E14', 'Productos más pedidos (todos los pedidos: muestra qué se consulta)');
  ponerFormula_(h.getRange('E15'), productos('c("Códigos")<>""', 'Unidades pedidas'));
  h.getRange('G15').setValue('Producto').setFontWeight('bold');
  ponerFormula_(h.getRange('G16'), nombres('E16:E30'));

  h.insertChart(h.newChart().setChartType(Charts.ChartType.COLUMN).addRange(h.getRange('D5:E40'))
    .setPosition(33, 1, 0, 0).setOption('title', 'Ventas por mes').setOption('legend', { position: 'none' })
    .setOption('colors', [AZUL]).build());
  h.insertChart(h.newChart().setChartType(Charts.ChartType.BAR).addRange(h.getRange('A15:B30'))
    .setPosition(33, 8, 0, 0).setOption('title', 'Productos más vendidos (unidades)').setOption('legend', { position: 'none' })
    .setOption('colors', [AZUL]).build());

  [300, 140, 30, 110, 120, 90, 260, 140, 120, 90, 30, 180, 120, 90, 30, 200, 90].forEach((w, i) => h.setColumnWidth(i + 1, w));
  h.setTabColor(AZUL);
  h.protect().setDescription('Reportes: se calculan solos').setWarningOnly(true);
}

// Escribe una fórmula. Apps Script usa comas; si la planilla la rechaza (formato de otro país), la
// reescribe con punto y coma, sin tocar las comas que van dentro de textos.
function ponerFormula_(rango, formula) {
  rango.setFormula(formula);
  SpreadsheetApp.flush();
  const v = String(rango.getDisplayValue());
  if (v === '#ERROR!' || v === '#NAME?') {
    let dentro = false;
    const conPuntoYComa = formula.split('').map(ch => {
      if (ch === '"') dentro = !dentro;
      return ch === ',' && !dentro ? ';' : ch;
    }).join('');
    rango.setFormula(conPuntoYComa);
  }
}

// Secciones del menú (Quiénes somos, Contacto…). Toda esta hoja es pública: sale entera hacia el sitio.
function armarPaginas_(h) {
  encabezado_(h, ['Página', 'Título en el menú', 'Título', 'Texto', 'Orden', 'Activa']);
  const filas = [
    ['quienes-somos', 'Quiénes somos', 'Quiénes somos',
      '[Completar] Contá en dos o tres párrafos quiénes son, desde cuándo trabajan y qué los diferencia.\n\n' +
      '[Completar] Zona donde atienden y cómo trabajan.', 1, 'sí'],
    ['envios-y-pagos', 'Envíos y pagos', 'Envíos y pagos',
      '## Envíos\n[Completar] Zonas, costos y plazos de entrega.\n\n' +
      '## Pagos\n[Completar] Medios de pago que aceptan y si hay cuotas.\n\n' +
      'El pago se coordina al confirmar el pedido: este sitio no cobra nada.', 2, 'sí'],
    ['preguntas-frecuentes', 'Preguntas frecuentes', 'Preguntas frecuentes',
      '## ¿Cómo hago un pedido?\nArmá tu pedido en el catálogo y envialo por WhatsApp o por mail. ' +
      'Te respondemos para confirmar precio, disponibilidad y entrega.\n\n' +
      '## ¿El precio del sitio es el final?\n[Completar]\n\n' +
      '## ¿Hacen envíos?\n[Completar]', 3, 'sí'],
    ['contacto', 'Contacto', 'Contacto', '[Completar] Dirección y horarios de atención.', 4, 'sí'],
  ];
  h.getRange(2, 1, filas.length, 6).setValues(filas);
  listaSiNo_(h.getRange('F2:F'));
  h.getRange('D2:D').setWrap(true).setVerticalAlignment('top');
  h.getRange('A1').setNote('Nombre corto para la dirección: minúsculas, sin espacios ni tildes (ej. "quienes-somos" → sitio/?pagina=quienes-somos).');
  h.getRange('D1').setNote(
    'Cómo se escribe:\n' +
    '• Línea en blanco = párrafo nuevo.\n' +
    '• Línea que empieza con ## = subtítulo. En "preguntas-frecuentes", cada ## es una pregunta desplegable.\n' +
    '• Línea que empieza con - = punto de una lista.\n' +
    '• Los enlaces https://… se vuelven clicables.\n' +
    'Para escribir varias líneas en una celda: Ctrl+Enter (en Mac, Cmd+Enter).\n' +
    'En "contacto", los botones de WhatsApp y mail se agregan solos, con los datos de Configuración.');
  h.getRange('F1').setNote('no = la sección no aparece en el menú.');
  h.getRange('A2:A').setFontColor(GRIS);
  [170, 170, 200, 520, 70, 70].forEach((w, i) => h.setColumnWidth(i + 1, w));
}

// ===================================================================
// 2. Lectura: el catálogo que ve el sitio
// ===================================================================

function doGet(e) {
  try {
    const catalogo = catalogoConCache_();
    if (e && e.parameter && e.parameter.accion === 'catalogo') return json_(catalogo);
    // Prueba de vida: abrir la URL del script en el navegador muestra esto.
    return json_({
      ok: true,
      productos: catalogo.productos.length,
      categorias: catalogo.categorias.length,
      actualizado: catalogo.actualizado,
      mails_restantes_hoy: MailApp.getRemainingDailyQuota(),
    });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'No se pudo leer la planilla: ' + err.message });
  }
}

function construirCatalogo_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = leerConfig_(ss);
  const mostrarPrecios = cfgSi_(cfg, 'mostrar_precios', true);
  const stockExacto = cfgSi_(cfg, 'mostrar_stock_exacto', false);
  const mostrarSinStock = cfgSi_(cfg, 'mostrar_sin_stock', true);
  const umbral = numero_(cfg.umbral_ultimas_unidades);
  const limite = umbral === null ? 3 : umbral;

  const cuotasPorCodigo = mostrarPrecios ? leerCuotas_(ss) : {};
  // Solo las escalas "todos": las de mayoristas NUNCA van en el catálogo público.
  const escalasTodos = mostrarPrecios ? leerEscalas_(ss).todos : {};
  const { filas, col } = leerTabla_(ss.getSheetByName(HOJA.productos));
  const dato = (fila, campo) => {
    const i = col[COLUMNAS_PUBLICAS[campo]];
    return i === undefined ? '' : fila[i];
  };

  const productos = [];
  filas.forEach(f => {
    const codigo = String(dato(f, 'codigo')).trim();
    const grupo = String(dato(f, 'grupo')).trim().slice(0, 120);
    // Características "Nombre: valor" (ej. "Medida: 1/2""). Sin "Nombre:", se llama "Opción".
    // Cada característica recuerda su columna (1, 2 o 3): sin "Nombre:" se llama "Opción 1/2/3",
    // o toma el nombre que esa columna tenga en otra fila del mismo grupo (ver más abajo).
    const opciones = ['car1', 'car2', 'car3'].map((k, n) => {
      const c = partirCaracteristica_(dato(f, k));
      return { columna: n, nombre: c.nombre.slice(0, 40), valor: c.valor.slice(0, 60) };
    }).filter(o => o.valor);
    // Con Grupo, el nombre lleva siempre los valores elegidos, así el pedido dice cuál es:
    // "Válvula de drenaje (1/2" · PPR)". El Nombre puede quedar vacío (se usa el Grupo).
    // Solo se omiten si la fila tiene su propio Nombre que ya los dice (comparando palabras enteras:
    // "20" no cuenta como dicho en "PN20").
    const propio = String(dato(f, 'nombre')).trim();
    const base = propio || grupo;
    const valores = opciones.map(o => o.valor);
    const palabras = ` ${normalizar_(propio).replace(/[^a-z0-9/".,]+/g, ' ')} `;
    const yaLosDice = propio && valores.every(v => palabras.includes(` ${normalizar_(v).replace(/[^a-z0-9/".,]+/g, ' ').trim()} `));
    const nombre = grupo && valores.length && !yaLosDice ? `${base} (${valores.join(' · ')})` : base;
    if (!codigo || !nombre || !esSi_(dato(f, 'activo'))) return;

    const stock = numero_(dato(f, 'stock'));
    let estado = 'disponible';
    if (stock !== null && stock <= 0) estado = 'sin_stock';
    else if (stock !== null && stock <= limite) estado = 'ultimas';
    if (estado === 'sin_stock' && !mostrarSinStock) return;

    const p = {
      codigo,
      nombre,
      categoria: String(dato(f, 'categoria')).trim() || 'Otros',
      descripcion: String(dato(f, 'descripcion')).trim(),
      foto: nombreDeArchivo_(dato(f, 'foto')) || nombreDeArchivo_(codigo + '.webp'),
      alt: String(dato(f, 'alt')).trim(),
      destacado: esSi_(dato(f, 'destacado')),
      estado,
    };
    const larga = String(dato(f, 'descripcion_larga')).trim();
    if (larga) p.descripcion_larga = larga;
    if (grupo) {
      p.grupo = grupo;
      p.opciones = opciones;
    }
    if (stockExacto && stock !== null) p.cantidad = Math.max(0, stock);
    if (mostrarPrecios) {
      p.precio = numero_(dato(f, 'precio'));
      p.cuotas = p.precio ? (cuotasPorCodigo[codigo] || []) : [];
      if (p.precio && escalasTodos[codigo]) p.escalas = escalasTodos[codigo];
    }
    productos.push(p);
  });
  nombrarCaracteristicas_(productos);

  const negocio = {};
  CONFIG_PUBLICA.forEach(k => { negocio[k] = String(cfg[k] === undefined ? '' : cfg[k]).trim(); });
  negocio.whatsapp = negocio.whatsapp.replace(/\D/g, '');
  negocio.mostrar_precios = mostrarPrecios;
  negocio.mayoristas = mostrarPrecios && cfgSi_(cfg, 'mayoristas_activo', false);

  return {
    ok: true,
    actualizado: new Date().toISOString(),
    negocio,
    // categorias: lista plana en orden (grandes y sus subcategorías); arbol: grandes con sus subcategorías.
    ...categoriasDelCatalogo_(ss, productos),
    financiacion: mostrarPrecios ? leerFinanciacion_(ss) : [],
    paginas: leerPaginas_(ss),
    productos,
  };
}

// Pone nombre a cada característica de un grupo. Si en alguna fila del grupo la columna dice
// "Color: gris", "Color" vale para todas las filas de ese grupo; si ninguna lo dice, "Opción 1/2/3".
// Así dos columnas nunca quedan con el mismo nombre y el sitio muestra un selector por cada una.
function nombrarCaracteristicas_(productos) {
  const etiquetas = {};
  productos.filter(p => p.grupo).forEach(p => p.opciones.forEach(o => {
    const clave = normalizar_(p.grupo) + '|' + o.columna;
    if (o.nombre && !etiquetas[clave]) etiquetas[clave] = o.nombre;
  }));
  productos.filter(p => p.grupo).forEach(p => {
    const usados = new Set();
    p.opciones = p.opciones.map(o => {
      let nombre = o.nombre || etiquetas[normalizar_(p.grupo) + '|' + o.columna] || `Opción ${o.columna + 1}`;
      if (usados.has(nombre)) nombre = `${nombre} ${o.columna + 1}`; // dos columnas con el mismo nombre
      usados.add(nombre);
      return { nombre, valor: o.valor };
    });
  });
}

// Escalas por cantidad: { todos: {CÓDIGO: [{desde, descuento}]}, mayoristas: {…} }, de menor a mayor.
function leerEscalas_(ss) {
  const res = { todos: {}, mayoristas: {} };
  const hoja = ss.getSheetByName(HOJA.escalas);
  if (!hoja) return res;
  const { filas, col } = leerTabla_(hoja);
  const dato = (f, t) => (col[t] === undefined ? '' : f[col[t]]);
  filas.forEach(f => {
    const codigo = String(dato(f, 'codigo')).trim();
    const para = normalizar_(dato(f, 'para')).startsWith('mayor') ? 'mayoristas' : 'todos';
    const desde = Math.floor(numero_(dato(f, 'desde (unidades)')) || 0);
    let descuento = numero_(dato(f, 'descuento'));
    // Si alguien escribió 15 en vez de 15%, se entiende 15%.
    if (descuento !== null && descuento >= 1) descuento = descuento / 100;
    if (!codigo || desde < 1 || descuento === null || descuento <= 0 || descuento >= 0.95) return;
    (res[para][codigo] = res[para][codigo] || []).push({ desde, descuento: Math.round(descuento * 10000) / 10000 });
  });
  ['todos', 'mayoristas'].forEach(t => Object.values(res[t]).forEach(l => l.sort((a, b) => a.desde - b.desde)));
  return res;
}

function leerPaginas_(ss) {
  const hoja = ss.getSheetByName(HOJA.paginas);
  if (!hoja) return [];
  const { filas, col } = leerTabla_(hoja);
  const dato = (f, t) => (col[t] === undefined ? '' : f[col[t]]);
  return filas
    .map(f => ({
      clave: normalizar_(dato(f, 'pagina')).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      menu: String(dato(f, 'titulo en el menu')).trim(),
      titulo: String(dato(f, 'titulo')).trim(),
      texto: String(dato(f, 'texto')).trim().slice(0, 20000),
      orden: numero_(dato(f, 'orden')),
      activa: esSi_(dato(f, 'activa')),
    }))
    .filter(p => p.activa && p.clave && p.texto && (p.menu || p.titulo))
    .sort((a, b) => (a.orden === null ? 9999 : a.orden) - (b.orden === null ? 9999 : b.orden))
    .map(p => ({ clave: p.clave, menu: p.menu || p.titulo, titulo: p.titulo || p.menu, texto: p.texto }));
}

// Lee la hoja Categorías, en el orden de las filas: [{ nombre, padre, i }] (padre vacío = categoría grande).
// Entiende también el formato viejo (Nombre | Orden | Dentro de), por si todavía no se migró.
function leerCategorias_(ss) {
  const hoja = ss.getSheetByName(HOJA.categorias);
  if (!hoja) return [];
  const { filas, col } = leerTabla_(hoja);
  const lista = [];
  if (col.subcategoria === undefined) {
    leerCategoriasViejas_(hoja).forEach(c => lista.push(c));
  } else {
    filas.forEach(f => {
      const grande = String(f[col.categoria] === undefined ? '' : f[col.categoria]).trim();
      const sub = String(f[col.subcategoria] || '').trim();
      if (grande) lista.push({ nombre: grande, padre: '' });
      if (sub && sub !== grande) lista.push({ nombre: sub, padre: grande });
    });
  }
  const vistas = new Set();
  return lista
    .filter(c => c.nombre && !vistas.has(normalizar_(c.nombre)) && vistas.add(normalizar_(c.nombre)))
    .map((c, i) => ({ nombre: c.nombre, padre: c.padre, orden: null, i }));
}

// Categorías para el sitio: un nivel de subcategorías. Solo las que tienen productos activos
// (una grande se muestra si tiene productos propios o en alguna subcategoría).
function categoriasDelCatalogo_(ss, productos) {
  const filas = leerCategorias_(ss);
  // "Termofusion" o "termofusión " en Productos valen como "Termofusión" (sin mirar tildes, mayúsculas ni espacios).
  const canonica = {};
  filas.forEach(c => { canonica[normalizar_(c.nombre)] = c.nombre; });
  filas.forEach(c => { if (c.padre) c.padre = canonica[normalizar_(c.padre)] || c.padre; });
  productos.forEach(p => { p.categoria = canonica[normalizar_(p.categoria)] || p.categoria; });
  const usadas = new Set(productos.map(p => p.categoria));
  const porOrden = (a, b) => ((a.orden === null ? 9999 : a.orden) - (b.orden === null ? 9999 : b.orden)) || a.i - b.i;
  const listadas = new Set(filas.map(c => c.nombre));
  // Padre de cada subcategoría. Si el padre a su vez tiene padre, se usa el de más arriba (un solo nivel).
  const padreDe = {};
  filas.forEach(c => { if (c.padre && c.padre !== c.nombre) padreDe[c.nombre] = c.padre; });
  Object.keys(padreDe).forEach(h => {
    let p = padreDe[h];
    for (let vueltas = 0; padreDe[p] && vueltas < 5; vueltas++) p = padreDe[p];
    if (p === h) delete padreDe[h]; else padreDe[h] = p;
  });
  const grandes = filas.filter(c => !padreDe[c.nombre]).sort(porOrden).map(c => c.nombre);
  Object.values(padreDe).forEach(p => { if (!grandes.includes(p)) grandes.push(p); }); // padre no listado
  // Categorías que aparecen en Productos pero no en la hoja Categorías: grandes, al final.
  [...usadas].filter(c => !listadas.has(c) && !grandes.includes(c)).sort().forEach(c => grandes.push(c));
  const arbol = grandes
    .map(g => ({ nombre: g, hijas: filas.filter(c => padreDe[c.nombre] === g && usadas.has(c.nombre)).sort(porOrden).map(c => c.nombre) }))
    .filter(n => usadas.has(n.nombre) || n.hijas.length);
  const categorias = [];
  arbol.forEach(n => { categorias.push(n.nombre); n.hijas.forEach(h => categorias.push(h)); });
  return { categorias, arbol };
}

function leerFinanciacion_(ss) {
  const hoja = ss.getSheetByName(HOJA.financiacion);
  if (!hoja) return [];
  const { filas, col } = leerTabla_(hoja);
  return filas
    .map(f => ({ cuotas: numero_(f[col.cuotas]), recargo: numero_(f[col.recargo]) || 0, activa: esSi_(f[col.activa]) }))
    .filter(o => o.activa && o.cuotas && o.cuotas > 0)
    .map(o => ({ cuotas: o.cuotas, recargo: o.recargo }))
    .sort((a, b) => a.cuotas - b.cuotas);
}

// Lee la hoja calculada: fila 1 = cantidad de cuotas; filas siguientes = código y valor de cada cuota.
function leerCuotas_(ss) {
  const hoja = ss.getSheetByName(HOJA.cuotas);
  const mapa = {};
  if (!hoja) return mapa;
  const valores = hoja.getDataRange().getValues();
  if (valores.length < 2) return mapa;
  const cabecera = valores[0];
  valores.slice(1).forEach(f => {
    const codigo = String(f[0]).trim();
    if (!codigo) return;
    const opciones = [];
    for (let j = 1; j < cabecera.length; j++) {
      const n = numero_(cabecera[j]);
      const valor = numero_(f[j]);
      if (n && valor) opciones.push({ cuotas: n, valor });
    }
    mapa[codigo] = opciones;
  });
  return mapa;
}

// ===================================================================
// 3. Pedidos
// ===================================================================

function doPost(e) {
  let datos;
  try {
    // ⚠️ El sitio manda el pedido como TEXTO PLANO, sin cabecera Content-Type.
    // Es a propósito: con "Content-Type: application/json" el navegador hace una
    // verificación previa (preflight CORS) que Apps Script no responde, y el pedido
    // se pierde sin mostrar error. Acá se interpreta el texto como JSON.
    datos = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'El pedido llegó con un formato que no se pudo leer.' });
  }

  // Campo trampa contra robots: una persona no lo ve, un robot lo llena. Se descarta en silencio.
  if (datos.sitio_web) return json_({ ok: true, pedido: 0 });

  // Mayoristas: pedir el enlace por mail, validarlo, y pedir los precios mayoristas.
  if (datos.tipo === 'mayorista_acceso') return json_(pedirAccesoMayorista_(datos));
  if (datos.tipo === 'mayorista_validar') return json_(validarAccesoMayorista_(datos));
  if (datos.tipo === 'mayorista_datos') return json_(datosMayorista_(datos));

  // El cliente tocó "Enviar por WhatsApp": se anota el pedido, sin mail (no gasta la cuota diaria).
  if (datos.tipo === 'whatsapp') return json_(registrarWhatsapp_(datos));

  const cliente = {
    nombre: texto_(datos.nombre, 80),
    telefono: texto_(datos.telefono, 30),
    mail: texto_(datos.mail, 120),
    pago: texto_(datos.pago, 60),
    comentarios: texto_(datos.comentarios, 1000),
    origen: texto_(datos.origen, 120),
  };
  if (!cliente.nombre) return json_({ ok: false, error: 'Falta el nombre.' });
  if (!cliente.telefono && !cliente.mail) return json_({ ok: false, error: 'Falta un teléfono o un mail de contacto.' });
  if (cliente.mail && !esMail_(cliente.mail)) return json_({ ok: false, error: 'El mail no parece válido.' });

  const items = leerItems_(datos.items);
  if (!items.length) return json_({ ok: false, error: 'El pedido está vacío.' });

  // Los precios se toman del catálogo y de las escalas, no de lo que manda el navegador.
  // Un mayorista se reconoce solo por su sesión firmada (ver verificarSesion_).
  const mayorista = contextoMayorista_(datos.sesion);
  if (mayorista && !cliente.mail) cliente.mail = mayorista.mail;
  let catalogo;
  try { catalogo = catalogoConCache_(); } catch (err) { catalogo = { productos: [], negocio: {} }; }
  const pedido = armarDetalle_(items, catalogo, mayorista);
  pedido.numero = siguienteNumero_();
  pedido.fecha = new Date();

  const cfg = leerConfig_(SpreadsheetApp.getActiveSpreadsheet());

  // ⚠️ Primero el mail, después la planilla: si la planilla falla, el pedido igual te llega.
  let mailOk = false;
  let planillaOk = false;
  try {
    enviarMailPedido_(pedido, cliente, cfg);
    mailOk = true;
  } catch (err) {
    console.error('Pedido ' + pedido.numero + ': no se pudo mandar el mail. ' + err.message);
  }
  try {
    anotarPedido_(pedido, cliente, { canal: 'Formulario' });
    planillaOk = true;
  } catch (err) {
    console.error('Pedido ' + pedido.numero + ': no se pudo anotar en la planilla. ' + err.message);
  }

  if (!mailOk && !planillaOk) return json_({ ok: false, error: 'No pudimos registrar el pedido.' });
  return json_({ ok: true, pedido: pedido.numero, total: pedido.total, mayorista: pedido.mayorista });
}

function leerItems_(lista) {
  return (Array.isArray(lista) ? lista : []).slice(0, 100)
    .map(it => ({ codigo: texto_(it && it.codigo, 40), cantidad: Math.floor(Number(it && it.cantidad)) }))
    .filter(it => it.codigo && it.cantidad > 0 && it.cantidad < 1000);
}

// Freno contra abusos: cuenta cuántas veces pasó algo en una ventana de tiempo.
function dentroDelLimite_(clave, maximo, segundos) {
  const cache = CacheService.getScriptCache();
  const k = 'lim_' + clave + '_' + Math.floor(Date.now() / (segundos * 1000));
  const cuenta = Number(cache.get(k) || 0);
  if (cuenta >= maximo) return false;
  cache.put(k, String(cuenta + 1), segundos + 60);
  return true;
}

// Pedido por WhatsApp: el sitio lo avisa en el momento en que el cliente toca el botón.
// Queda anotado con su Referencia (la misma que va en el mensaje) para encontrar el chat.
// No confirma que el cliente haya enviado el mensaje: eso se ve en el WhatsApp.
function registrarWhatsapp_(datos) {
  const ref = texto_(datos.ref, 20).toUpperCase();
  if (!/^W-[A-Z0-9]{4,10}$/.test(ref)) return { ok: false, error: 'Referencia inválida.' };
  const items = leerItems_(datos.items);
  if (!items.length) return { ok: false, error: 'El pedido está vacío.' };

  // Como este registro no pide datos, se limita cuántos entran por minuto.
  if (!dentroDelLimite_('wa', MAX_WHATSAPP_POR_MINUTO, 60)) return { ok: false, error: 'Demasiados registros seguidos.' };

  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA.pedidos);
  if (!hoja) return { ok: false, error: 'No existe la hoja ' + HOJA.pedidos };
  asegurarColumnas_(hoja, TITULOS_PEDIDOS);

  // Si el cliente toca el botón dos veces con el mismo pedido, se anota una sola vez.
  const titulos = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  const colRef = columna_(titulos, 'Referencia');
  const desde = Math.max(2, hoja.getLastRow() - 300);
  if (colRef && hoja.getLastRow() >= 2) {
    const refs = hoja.getRange(desde, colRef, hoja.getLastRow() - desde + 1, 1).getValues().map(f => String(f[0]));
    if (refs.includes(ref)) return { ok: true, repetido: true };
  }

  const mayorista = contextoMayorista_(datos.sesion);
  let catalogo;
  try { catalogo = catalogoConCache_(); } catch (err) { catalogo = { productos: [] }; }
  const pedido = armarDetalle_(items, catalogo, mayorista);
  pedido.numero = siguienteNumero_();
  pedido.fecha = new Date();
  anotarPedido_(pedido, {
    nombre: texto_(datos.nombre, 80) || (mayorista && mayorista.nombre) || '(por WhatsApp)',
    telefono: '', mail: mayorista ? mayorista.mail : '', pago: '',
    comentarios: 'Abrió WhatsApp con este pedido. Confirmá en el chat que lo haya enviado (Ref. ' + ref + ').',
    origen: texto_(datos.origen, 120),
  }, { canal: 'WhatsApp', referencia: ref });
  return { ok: true, pedido: pedido.numero };
}

// ===================================================================
// Precios por cantidad (escalas) y mínimos mayoristas
// ⚠️ app.js hace la misma cuenta para mostrarla; la que vale es esta.
// ===================================================================

// Precio por unidad de un producto según la cantidad: el mayor descuento al que llega.
function precioConEscalas_(precio, cantidad, tramosTodos, tramosMayoristas) {
  let descuento = 0;
  let mayorista = false;
  (tramosTodos || []).forEach(t => { if (cantidad >= t.desde && t.descuento > descuento) descuento = t.descuento; });
  (tramosMayoristas || []).forEach(t => {
    if (cantidad >= t.desde && t.descuento > descuento) { descuento = t.descuento; mayorista = true; }
  });
  return { unitario: Math.round(precio * (1 - descuento)), descuento, mayorista };
}

// mayorista = null (minorista) o { escalas, monto_minimo, unidades_minimas, … }
function armarDetalle_(items, catalogo, mayorista) {
  const porCodigo = {};
  catalogo.productos.forEach(p => { porCodigo[p.codigo] = p; });

  const calcular = usarMayorista => {
    const lineas = items.map(it => {
      const p = porCodigo[it.codigo];
      const precio = p && typeof p.precio === 'number' ? p.precio : null;
      const linea = {
        codigo: it.codigo,
        nombre: p ? p.nombre : '(ya no figura en el catálogo)',
        cantidad: it.cantidad,
        precio, unitario: precio, descuento: 0, mayorista: false,
        subtotal: precio === null ? null : precio * it.cantidad,
        sinStock: !!(p && p.estado === 'sin_stock'),
      };
      if (precio === null) return linea;
      // Escalas mayoristas: solo si ese producto llega a las unidades mínimas.
      const tramosMay = usarMayorista && it.cantidad >= (mayorista.unidades_minimas || 0)
        ? mayorista.escalas[it.codigo] : null;
      const r = precioConEscalas_(precio, it.cantidad, p.escalas, tramosMay);
      return Object.assign(linea, r, { subtotal: r.unitario * it.cantidad });
    });
    const conocidos = lineas.every(l => l.subtotal !== null);
    return { lineas, total: conocidos ? lineas.reduce((s, l) => s + l.subtotal, 0) : null };
  };

  let r = calcular(!!mayorista);
  r.faltante = 0;
  // Monto mínimo: si el pedido mayorista no llega, todo se calcula como minorista.
  if (mayorista && mayorista.monto_minimo && r.total !== null && r.total < mayorista.monto_minimo) {
    const faltante = mayorista.monto_minimo - r.total;
    r = calcular(false);
    r.faltante = faltante;
  }
  r.clienteMayorista = !!mayorista;
  r.mayorista = !!mayorista && !r.faltante && r.lineas.some(l => l.mayorista);
  return r;
}

function textoLinea_(l) {
  let t = `${l.cantidad} × ${l.nombre} (${l.codigo})`;
  if (l.subtotal !== null && l.descuento) {
    t += ` — ${pesos_(l.unitario)} c/u (−${Math.round(l.descuento * 100)}%${l.mayorista ? ' mayorista' : ''}) = ${pesos_(l.subtotal)}`;
  } else if (l.subtotal !== null) {
    t += ' — ' + pesos_(l.subtotal);
  }
  if (l.sinStock) t += ' [figuraba SIN STOCK]';
  return t;
}

function tipoCliente_(pedido) {
  if (!pedido.clienteMayorista) return 'Minorista';
  return pedido.faltante ? 'Mayorista sin mínimo' : 'Mayorista';
}

function enviarMailPedido_(pedido, cliente, cfg) {
  const destino = String(cfg.mail_pedidos || '').trim();
  if (!esMail_(destino)) throw new Error('Configuración → mail_pedidos está vacío o no es un mail.');
  const negocio = String(cfg.nombre_negocio || 'Catálogo').trim();
  const total = pedido.total === null ? 'a confirmar' : pesos_(pedido.total);
  const tipo = tipoCliente_(pedido);
  const notaMinimo = pedido.faltante
    ? `No llegó al mínimo mayorista (faltaban ${pesos_(pedido.faltante)}): se calculó con precios minoristas.` : '';

  const texto = [
    `Pedido N° ${pedido.numero} — ${tipo}`,
    '',
    ...pedido.lineas.map(l => '• ' + textoLinea_(l)),
    '',
    `Total contado: ${total}`,
    notaMinimo,
    '',
    `Cliente: ${tipo}`,
    `Nombre: ${cliente.nombre}`,
    `Teléfono: ${cliente.telefono || '—'}`,
    `Mail: ${cliente.mail || '—'}`,
    `Forma de pago: ${cliente.pago || '—'}`,
    `Comentarios: ${cliente.comentarios || '—'}`,
    `Origen: ${cliente.origen || '—'}`,
    '',
    cliente.mail ? 'Para contestarle, respondé este mail.' : 'El cliente no dejó mail: contactalo por teléfono.',
  ].join('\n');

  const fila = (k, v) => `<tr><td style="padding:4px 12px 4px 0;color:#5f6673">${k}</td><td style="padding:4px 0">${escapar_(v)}</td></tr>`;
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1b1f27">` +
    `<h2 style="color:${AZUL};margin:0 0 12px">Pedido N° ${pedido.numero}${pedido.clienteMayorista ? ' — ' + escapar_(tipo) : ''}</h2>` +
    `<ul style="padding-left:18px">${pedido.lineas.map(l => `<li>${escapar_(textoLinea_(l))}</li>`).join('')}</ul>` +
    `<p><strong>Total contado: ${escapar_(total)}</strong></p>` +
    (notaMinimo ? `<p style="color:#8a4b00">${escapar_(notaMinimo)}</p>` : '') +
    `<table style="border-collapse:collapse">` +
    fila('Cliente', tipo) + fila('Nombre', cliente.nombre) + fila('Teléfono', cliente.telefono || '—') + fila('Mail', cliente.mail || '—') +
    fila('Forma de pago', cliente.pago || '—') + fila('Comentarios', cliente.comentarios || '—') + fila('Origen', cliente.origen || '—') +
    `</table>` +
    `<p style="color:#5f6673">${cliente.mail ? 'Para contestarle, respondé este mail: la respuesta le llega al cliente.' : 'El cliente no dejó mail: contactalo por teléfono.'}</p>` +
    `</div>`;

  const asunto = `Nuevo pedido${pedido.mayorista ? ' MAYORISTA' : ''} N° ${pedido.numero} — ${cliente.nombre}`;
  const opciones = { to: destino, subject: asunto, body: texto, htmlBody: html, name: negocio + ' (web)' };
  // "Responder" le contesta directamente al cliente.
  if (cliente.mail) opciones.replyTo = cliente.mail;
  MailApp.sendEmail(opciones);
}

function anotarPedido_(pedido, cliente, extra) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA.pedidos);
  if (!hoja) throw new Error('No existe la hoja ' + HOJA.pedidos);
  asegurarColumnas_(hoja, TITULOS_PEDIDOS);
  const titulos = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(normalizar_);
  const valores = {
    'fecha': pedido.fecha,
    'n° pedido': pedido.numero,
    'canal': (extra && extra.canal) || 'Formulario',
    'cliente': tipoCliente_(pedido),
    'referencia': (extra && extra.referencia) || '',
    'nombre': cliente.nombre,
    'telefono': cliente.telefono,
    'mail': cliente.mail,
    'detalle': pedido.lineas.map(textoLinea_).join('\n') +
      (pedido.faltante ? `\n(No llegó al mínimo mayorista: faltaban ${pesos_(pedido.faltante)})` : ''),
    'codigos': pedido.lineas.map(l => `${l.codigo}×${l.cantidad}`).join(', '),
    'total contado': pedido.total === null ? '' : pedido.total,
    'forma de pago': cliente.pago,
    'comentarios': cliente.comentarios,
    'origen': cliente.origen,
    'estado': 'Nuevo',
    'stock descontado': '',
  };
  // Las columnas se buscan por título: si Pablo las mueve, cada dato cae igual en su lugar.
  hoja.appendRow(titulos.map(t => (t in valores ? sinFormula_(valores[t]) : '')));
}

// ===================================================================
// Ingreso de mayoristas
//  1. La persona deja nombre, teléfono y mail → le llega un enlace de un solo uso (vence en 30 min).
//  2. Al abrirlo, el sitio canjea el enlace por una "sesión": un texto firmado con una clave secreta
//     que solo conoce este script. No se puede inventar ni modificar sin esa clave.
//  3. Con esa sesión, el script entrega las escalas mayoristas y calcula los pedidos a precio mayorista.
//  Pablo puede bloquear a cualquiera poniendo Activo = no en la hoja Mayoristas.
// ===================================================================

function pedirAccesoMayorista_(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = leerConfig_(ss);
  if (!cfgSi_(cfg, 'mayoristas_activo', false)) return { ok: false, error: 'El ingreso de mayoristas no está habilitado.' };
  const sitio = String(cfg.direccion_sitio || '').trim();
  if (!/^https?:\/\/[^\s<>"]+$/i.test(sitio)) {
    console.error('Falta Configuración → direccion_sitio: sin eso no se puede armar el enlace de ingreso.');
    return { ok: false, error: 'El ingreso de mayoristas todavía no está configurado. Escribinos por WhatsApp.' };
  }

  const nombre = texto_(datos.nombre, 80);
  const telefono = texto_(datos.telefono, 30);
  const mail = texto_(datos.mail, 120).toLowerCase();
  if (!nombre) return { ok: false, error: 'Falta el nombre.' };
  if (!esMail_(mail)) return { ok: false, error: 'El mail no parece válido.' };
  if (datos.consentimiento !== true) return { ok: false, error: 'Falta aceptar el aviso de privacidad.' };

  if (!dentroDelLimite_('acceso_' + resumen_(mail), MAX_ENLACES_POR_MAIL_HORA, 3600) ||
      !dentroDelLimite_('acceso_todos', MAX_ENLACES_POR_HORA, 3600)) {
    return { ok: false, error: 'Se pidieron demasiados ingresos seguidos. Probá de nuevo en un rato.' };
  }

  const hoja = hojaMayoristas_(ss);
  const existente = buscarMayorista_(mail);
  // Bloqueado: misma respuesta que siempre (no se revela quién está registrado), pero sin mail.
  if (existente && !existente.activo) return { ok: true };
  if (!existente) {
    const titulos = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(normalizar_);
    const valores = {
      'alta': new Date(), 'nombre': nombre, 'telefono': telefono, 'mail': mail,
      'consentimiento': 'sí — ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'),
      'ultimo ingreso': '', 'activo': 'sí',
    };
    hoja.appendRow(titulos.map(t => (t in valores ? sinFormula_(valores[t]) : '')));
  }

  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  CacheService.getScriptCache().put('acceso_' + resumen_(token), mail, MINUTOS_ENLACE_ACCESO * 60);
  const enlace = sitio + (sitio.includes('?') ? '&' : '?') + 'acceso=' + token;
  const negocio = String(cfg.nombre_negocio || 'Catálogo').trim();
  MailApp.sendEmail({
    to: mail,
    subject: `Tu acceso a precios mayoristas — ${negocio}`,
    name: negocio,
    body: `Hola ${nombre}:\n\nPara ver los precios mayoristas, abrí este enlace (vence en ${MINUTOS_ENLACE_ACCESO} minutos y sirve una sola vez):\n${enlace}\n\nSi no lo pediste vos, ignorá este mail.`,
    htmlBody:
      `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1b1f27">` +
      `<p>Hola ${escapar_(nombre)}:</p>` +
      `<p>Para ver los precios mayoristas de ${escapar_(negocio)}, tocá el botón. Vence en ${MINUTOS_ENLACE_ACCESO} minutos y sirve una sola vez.</p>` +
      `<p><a href="${escapar_(enlace)}" style="display:inline-block;background:${AZUL};color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Ver precios mayoristas</a></p>` +
      `<p style="color:#5f6673;font-size:13px">Si no lo pediste vos, ignorá este mail.</p></div>`,
  });
  return { ok: true };
}

function validarAccesoMayorista_(datos) {
  const token = texto_(datos.token, 100);
  if (!/^[a-f0-9]{32,80}$/i.test(token)) return { ok: false, error: 'El enlace no es válido.' };
  const cache = CacheService.getScriptCache();
  const clave = 'acceso_' + resumen_(token);
  const mail = cache.get(clave);
  if (!mail) return { ok: false, error: 'El enlace venció o ya se usó. Pedí uno nuevo.' };
  cache.remove(clave); // un solo uso
  const may = buscarMayorista_(mail);
  if (!may || !may.activo) return { ok: false, error: 'Este acceso no está habilitado.' };
  const hoja = hojaMayoristas_(SpreadsheetApp.getActiveSpreadsheet());
  const col = columna_(hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0], 'Último ingreso');
  if (col) hoja.getRange(may.fila, col).setValue(new Date());
  return { ok: true, sesion: crearSesion_(mail), nombre: may.nombre };
}

function datosMayorista_(datos) {
  const ctx = contextoMayorista_(datos.sesion);
  if (!ctx) return { ok: false, sesion_invalida: true };
  return { ok: true, nombre: ctx.nombre, monto_minimo: ctx.monto_minimo, unidades_minimas: ctx.unidades_minimas, escalas: ctx.escalas };
}

// Lo que hace falta para calcular precios mayoristas, o null si la sesión no vale.
function contextoMayorista_(sesion) {
  if (!sesion) return null;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = leerConfig_(ss);
  if (!cfgSi_(cfg, 'mayoristas_activo', false) || !cfgSi_(cfg, 'mostrar_precios', true)) return null;
  const s = verificarSesion_(sesion);
  if (!s) return null;
  return {
    mail: s.mail,
    nombre: s.nombre,
    monto_minimo: Math.max(0, numero_(cfg.mayorista_monto_minimo) || 0),
    unidades_minimas: Math.max(0, Math.floor(numero_(cfg.mayorista_unidades_minimas) || 0)),
    escalas: leerEscalas_(ss).mayoristas,
  };
}

function crearSesion_(mail) {
  const vence = Date.now() + DIAS_SESION_MAYORISTA * 24 * 3600 * 1000;
  const datos = base64Url_(Utilities.base64EncodeWebSafe(mail + '|' + vence, Utilities.Charset.UTF_8));
  return datos + '.' + firmar_(datos);
}

function verificarSesion_(sesion) {
  const partes = String(sesion || '').split('.');
  if (partes.length !== 2 || !partes[0] || firmar_(partes[0]) !== partes[1]) return null; // firma falsa o modificada
  let texto;
  try {
    const conRelleno = partes[0] + '='.repeat((4 - partes[0].length % 4) % 4);
    texto = Utilities.newBlob(Utilities.base64DecodeWebSafe(conRelleno, Utilities.Charset.UTF_8)).getDataAsString();
  } catch (err) {
    return null;
  }
  const [mail, vence] = texto.split('|');
  if (!mail || !(Number(vence) > Date.now())) return null; // vencida
  const may = buscarMayorista_(mail);
  if (!may || !may.activo) return null; // bloqueado por Pablo
  return { mail, nombre: may.nombre };
}

// Firma con una clave secreta guardada en el script (no está en la planilla ni en el sitio).
// Borrar la propiedad "secreto_sesiones" cierra la sesión de todos los mayoristas.
function firmar_(texto) {
  const props = PropertiesService.getScriptProperties();
  let secreto = props.getProperty('secreto_sesiones');
  if (!secreto) {
    secreto = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    props.setProperty('secreto_sesiones', secreto);
  }
  return base64Url_(Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(texto, secreto)));
}

function base64Url_(t) {
  return String(t).replace(/=+$/, '');
}

// Resumen (SHA-256) de un texto: para no guardar enlaces ni mails tal cual en la caché.
function resumen_(texto) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(texto), Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function hojaMayoristas_(ss) {
  let hoja = ss.getSheetByName(HOJA.mayoristas);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA.mayoristas);
    armarMayoristas_(hoja);
  }
  return hoja;
}

function buscarMayorista_(mail) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA.mayoristas);
  if (!hoja) return null;
  const valores = hoja.getDataRange().getValues();
  const titulos = (valores[0] || []).map(normalizar_);
  const iMail = titulos.indexOf('mail');
  const iNombre = titulos.indexOf('nombre');
  const iActivo = titulos.indexOf('activo');
  const buscado = String(mail).trim().toLowerCase();
  for (let i = 1; i < valores.length; i++) {
    if (String(valores[i][iMail]).trim().toLowerCase() === buscado) {
      return {
        fila: i + 1,
        nombre: iNombre >= 0 ? String(valores[i][iNombre]).trim() : '',
        // Activo vacío cuenta como sí: solo "no" bloquea.
        activo: iActivo < 0 || String(valores[i][iActivo]).trim() === '' || esSi_(valores[i][iActivo]),
      };
    }
  }
  return null;
}

function siguienteNumero_() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const props = PropertiesService.getScriptProperties();
    const n = Number(props.getProperty('ultimo_pedido') || 0) + 1;
    props.setProperty('ultimo_pedido', String(n));
    return n;
  } catch (err) {
    return Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMddHHmmss'));
  } finally {
    lock.releaseLock();
  }
}

// ===================================================================
// 4. Al editar la planilla
// ===================================================================

function onEdit(e) {
  if (!e || !e.range) return;
  const hoja = e.range.getSheet().getName();
  if (hoja === HOJA.pedidos) {
    cambioDeEstado_(e);
    return;
  }
  // Cualquier cambio en los datos del catálogo borra la caché: el sitio lo ve en la próxima carga.
  if ([HOJA.productos, HOJA.categorias, HOJA.financiacion, HOJA.config, HOJA.paginas, HOJA.escalas].includes(hoja)) borrarCache_();
  // Una subcategoría nueva aparece enseguida en el desplegable de Productos.
  if (hoja === HOJA.categorias) ponerDesplegables_(e.source || SpreadsheetApp.getActiveSpreadsheet());
}

// Mejora opcional: descontar el stock al confirmar un pedido (y devolverlo si se cancela).
function cambioDeEstado_(e) {
  if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1 || e.range.getRow() < 2) return;
  const ss = e.source;
  const pedidos = e.range.getSheet();
  const titulos = pedidos.getRange(1, 1, 1, pedidos.getLastColumn()).getValues()[0].map(normalizar_);
  const colEstado = titulos.indexOf('estado') + 1;
  const colCodigos = titulos.indexOf('codigos') + 1;
  const colMarca = titulos.indexOf('stock descontado') + 1;
  if (e.range.getColumn() !== colEstado || !colCodigos || !colMarca) return;
  if (!cfgSi_(leerConfig_(ss), 'descontar_stock_al_confirmar', false)) return;

  const fila = e.range.getRow();
  const nuevo = normalizar_(e.value);
  const marca = pedidos.getRange(fila, colMarca);
  const yaDescontado = String(marca.getValue()).trim() !== '';
  let signo = 0;
  if (nuevo === 'confirmado' && !yaDescontado) signo = -1;
  if (nuevo === 'cancelado' && yaDescontado) signo = +1;
  if (!signo) return;

  const items = String(pedidos.getRange(fila, colCodigos).getValue()).split(',')
    .map(s => s.trim().match(/^(.+?)\s*[×x]\s*(\d+)$/))
    .filter(Boolean)
    .map(m => ({ codigo: m[1].trim(), cantidad: Number(m[2]) }));

  const prod = ss.getSheetByName(HOJA.productos);
  const { filas, col } = leerTabla_(prod);
  const iCod = col[COLUMNAS_PUBLICAS.codigo];
  const iStock = col[COLUMNAS_PUBLICAS.stock];
  const cambios = [];
  items.forEach(it => {
    const i = filas.findIndex(f => String(f[iCod]).trim() === it.codigo);
    if (i < 0) return;
    const actual = numero_(filas[i][iStock]);
    if (actual === null) return; // producto sin control de stock
    const nuevoStock = actual + signo * it.cantidad;
    prod.getRange(i + 2, iStock + 1).setValue(nuevoStock);
    cambios.push(`${it.codigo}: ${actual} → ${nuevoStock}`);
  });

  if (signo < 0) marca.setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'));
  else marca.clearContent();
  borrarCache_();
  ss.toast(cambios.join('\n') || 'No había productos con stock para ajustar.',
    signo < 0 ? 'Stock descontado' : 'Stock devuelto', 8);
}

// ===================================================================
// 5. Formulario para cargar o editar productos (barra lateral)
//    Menú Catálogo → Cargar o editar producto. Escribe en Productos y Escalas por título de
//    columna, así que funciona aunque las columnas estén en otro orden.
// ===================================================================

function abrirFormularioProducto() {
  const html = HtmlService.createHtmlOutput(HTML_FORMULARIO_).setTitle('Cargar o editar producto');
  SpreadsheetApp.getUi().showSidebar(html);
}

// Lo que el formulario necesita para arrancar: categorías, productos existentes y un código sugerido.
function formularioDatos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJA.productos);
  asegurarColumnas_(hoja, TITULOS_PRODUCTOS);
  const { filas, col } = leerTabla_(hoja);
  const dato = (f, t) => (col[t] === undefined ? '' : String(f[col[t]]).trim());
  const productos = [];
  const grupos = new Set();
  const codigos = [];
  filas.forEach(f => {
    const codigo = dato(f, 'codigo');
    if (!codigo) return;
    codigos.push(codigo);
    const grupo = dato(f, 'grupo');
    if (grupo) {
      if (grupos.has(grupo)) return;
      grupos.add(grupo);
      productos.push({ codigo, texto: grupo + ' (con opciones)' });
    } else {
      productos.push({ codigo, texto: (dato(f, 'nombre') || codigo) + ' · ' + codigo });
    }
  });
  productos.sort((a, b) => a.texto.localeCompare(b.texto, 'es'));
  // Categorías con su categoría grande ("padre"), para mostrar las subcategorías debajo de su grande.
  const categorias = leerCategorias_(ss).map(c => ({ nombre: c.nombre, padre: c.padre }));
  return { categorias, productos, siguiente: siguienteCodigo_(codigos) };
}

function nombresDeCategorias_(ss) {
  return leerCategorias_(ss).map(c => c.nombre);
}

// P001, P002… → P003. Si los códigos tienen otra forma, igual sugiere el siguiente P.
function siguienteCodigo_(codigos) {
  let max = 0;
  codigos.forEach(c => { const m = /^P(\d+)$/i.exec(c); if (m) max = Math.max(max, Number(m[1])); });
  let n = max + 1;
  while (codigos.includes('P' + String(n).padStart(3, '0'))) n++;
  return 'P' + String(n).padStart(3, '0');
}

// Todo lo de un producto para editarlo. Si tiene Grupo, trae todas sus opciones.
function formularioProducto(codigo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const { filas, col } = leerTabla_(ss.getSheetByName(HOJA.productos));
  const dato = (f, t) => (col[t] === undefined ? '' : f[col[t]]);
  const txt = (f, t) => String(dato(f, t)).trim();
  const fila = filas.find(f => txt(f, 'codigo') === codigo);
  if (!fila) throw new Error('No encontré el producto ' + codigo + '.');
  const grupo = txt(fila, 'grupo');
  const delProducto = grupo ? filas.filter(f => txt(f, 'grupo') === grupo) : [fila];
  const base = delProducto[0];
  const codigos = delProducto.map(f => txt(f, 'codigo'));

  // Escalas del producto (las de la primera opción) y si las opciones las tienen distintas.
  const { filas: fe, col: ce } = leerTabla_(ss.getSheetByName(HOJA.escalas));
  const tramosDe = c => fe.filter(f => String(f[ce.codigo]).trim() === c).map(f => {
    let d = numero_(f[ce.descuento]) || 0;
    if (d >= 1) d = d / 100;
    return { para: normalizar_(f[ce.para]).startsWith('mayor') ? 'mayoristas' : 'todos', desde: numero_(f[ce['desde (unidades)']]) || '', descuento: Math.round(d * 1000) / 10 };
  });
  const escalas = tramosDe(codigos[0]);
  const escalasDistintas = codigos.some(c => JSON.stringify(tramosDe(c)) !== JSON.stringify(escalas));

  const r = {
    nombre: grupo || txt(base, 'nombre'),
    categoria: txt(base, 'categoria'),
    descripcion: txt(base, 'descripcion corta'),
    larga: txt(base, 'descripcion larga'),
    foto: txt(base, 'foto'),
    alt: txt(base, 'texto de la foto'),
    activo: delProducto.some(f => esSi_(dato(f, 'activo'))),
    destacado: esSi_(dato(base, 'destacado')),
    costo: numero_(dato(base, 'costo')),
    proveedor: txt(base, 'proveedor'),
    notas: txt(base, 'notas internas'),
    originales: codigos,
    escalas,
    escalasDistintas,
    conOpciones: !!grupo,
  };
  if (!grupo) {
    return Object.assign(r, { codigo, precio: numero_(dato(fila, 'precio contado')), stock: numero_(dato(fila, 'stock')) });
  }
  // Opciones: hasta 3 características ("Medida: 1/2"" o solo "1/2"").
  const nombres = ['', '', ''];
  const variantes = delProducto.map(f => {
    const valores = ['caracteristica 1', 'caracteristica 2', 'caracteristica 3'].map((t, i) => {
      const c = partirCaracteristica_(txt(f, t));
      if (c.nombre && !nombres[i]) nombres[i] = c.nombre;
      return c.valor;
    });
    return { codigo: txt(f, 'codigo'), valores, precio: numero_(dato(f, 'precio contado')), stock: numero_(dato(f, 'stock')), activo: esSi_(dato(f, 'activo')) };
  });
  const caracteristicas = nombres.map((nombre, i) => ({
    nombre,
    valores: variantes.map(v => v.valores[i]).filter((v, j, todos) => v && todos.indexOf(v) === j),
  }));
  return Object.assign(r, { caracteristicas, variantes });
}

// Guarda lo del formulario. Devuelve { ok:true, mensaje } o { ok:false, errores:[…] }.
function formularioGuardar(d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJA.productos);
  asegurarColumnas_(hoja, TITULOS_PRODUCTOS);
  const errores = [];
  const num = v => (v === '' || v === null || v === undefined ? null : numero_(v));
  const nombre = texto_(d.nombre, 120);
  const categoria = texto_(d.categoria, 60);
  if (!nombre) errores.push('Falta el nombre.');
  if (!categoria) errores.push('Falta la categoría.');

  // Sin dos puntos sobrantes: si escriben "Medidas:" el nombre queda "Medidas" (el script ya pone el ": ").
  const sinDosPuntos = s => s.replace(/^[:\s]+|[:\s]+$/g, '');
  const slots = [0, 1, 2].map(i => sinDosPuntos(texto_((d.caracteristicas || [])[i], 40)));
  let items;
  if (d.conOpciones) {
    items = (Array.isArray(d.variantes) ? d.variantes : []).slice(0, 200).map(v => ({
      codigo: texto_(v.codigo, 40),
      valores: [0, 1, 2].map(i => texto_((v.valores || [])[i], 60).replace(/^[:\s]+/, '')),
      precio: num(v.precio), stock: num(v.stock),
    }));
    if (!items.length) errores.push('Agregá al menos una opción (botón "Armar combinaciones").');
    items.forEach(it => { if (!it.valores.some(Boolean)) errores.push(`La opción ${it.codigo || '(sin código)'} no tiene ningún valor.`); });
  } else {
    items = [{ codigo: texto_(d.codigo, 40), valores: ['', '', ''], precio: num(d.precio), stock: num(d.stock) }];
  }

  // Códigos: válidos, sin repetir, y sin pisar otros productos.
  const originales = (d.originales || []).map(c => texto_(c, 40));
  const { filas, col } = leerTabla_(hoja);
  const usados = new Set(filas.map(f => String(f[col.codigo]).trim()).filter(c => c && !originales.includes(c)));
  const vistos = new Set();
  items.forEach(it => {
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(it.codigo)) errores.push(`El código "${it.codigo}" no sirve: solo letras, números, punto o guion, sin espacios.`);
    else if (vistos.has(it.codigo)) errores.push(`El código ${it.codigo} está repetido.`);
    else if (usados.has(it.codigo)) errores.push(`El código ${it.codigo} ya lo usa otro producto.`);
    vistos.add(it.codigo);
    if (it.precio === null || it.precio < 0) errores.push(`Falta el precio${d.conOpciones ? ' de ' + it.codigo : ''}.`);
    if (it.stock !== null && it.stock < 0) errores.push(`El stock de ${it.codigo} no puede ser negativo.`);
  });
  const escalas = (Array.isArray(d.escalas) ? d.escalas : []).slice(0, 20).map(e => ({
    para: e.para === 'mayoristas' ? 'mayoristas' : 'todos', desde: Math.floor(num(e.desde) || 0), descuento: num(e.descuento),
  })).filter(e => e.desde || e.descuento);
  escalas.forEach(e => {
    if (e.desde < 1) errores.push('En los descuentos, "Desde" tiene que ser 1 o más.');
    if (!(e.descuento > 0 && e.descuento < 95)) errores.push('En los descuentos, el porcentaje tiene que estar entre 1 y 94.');
  });
  if (errores.length) return { ok: false, errores: [...new Set(errores)] };

  // Categoría nueva → se agrega a Categorías: debajo de la última fila de su grande, o al final si es grande.
  const hojaCat = ss.getSheetByName(HOJA.categorias);
  if (hojaCat && !nombresDeCategorias_(ss).some(c => normalizar_(c) === normalizar_(categoria))) {
    migrarCategorias_(hojaCat);
    const padre = texto_(d.categoriaPadre, 60);
    const tc = hojaCat.getRange(1, 1, 1, hojaCat.getLastColumn()).getValues()[0].map(normalizar_);
    const valores = { 'categoria': padre || categoria, 'subcategoria': padre ? categoria : '' };
    const fila = tc.map(t => (t in valores ? sinFormula_(valores[t]) : ''));
    const iGrande = tc.indexOf('categoria');
    const datos = hojaCat.getDataRange().getValues();
    let ultima = 0;
    if (padre) datos.forEach((f, i) => { if (i && normalizar_(f[iGrande]) === normalizar_(padre)) ultima = i + 1; });
    if (ultima && ultima < datos.length) {
      hojaCat.insertRowAfter(ultima);
      hojaCat.getRange(ultima + 1, 1, 1, fila.length).setValues([fila]);
    } else {
      hojaCat.appendRow(fila);
    }
    // Si la grande estaba sola en una fila (sin subcategorías), esa fila ya no hace falta: se completa.
    if (padre) {
      const sola = hojaCat.getDataRange().getValues().findIndex((f, i) => i && normalizar_(f[iGrande]) === normalizar_(padre) && !String(f[tc.indexOf('subcategoria')]).trim());
      if (sola > 0) hojaCat.deleteRow(sola + 1);
    }
    ponerDesplegables_(ss);
  }

  // Escribir cada fila (actualiza la existente o agrega una nueva).
  const titulos = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(normalizar_);
  const fotoGrupo = texto_(d.foto, 80) || (d.conOpciones ? items[0].codigo + '.webp' : '');
  const valorCaracteristica = (it, i) => (it.valores[i] ? (slots[i] ? `${slots[i]}: ${it.valores[i]}` : it.valores[i]) : '');
  items.forEach(it => {
    const valores = {
      'codigo': it.codigo,
      'nombre': d.conOpciones ? '' : nombre, // con opciones, el sitio arma el nombre con el Grupo
      'categoria': categoria,
      'descripcion corta': texto_(d.descripcion, 500),
      'descripcion larga': texto_(d.larga, 5000),
      'precio contado': it.precio,
      'stock': it.stock === null ? '' : it.stock,
      'foto': fotoGrupo,
      'texto de la foto': texto_(d.alt, 200),
      'activo': d.activo === false ? 'no' : 'sí',
      'destacado': d.destacado ? 'sí' : 'no',
      'grupo': d.conOpciones ? nombre : '',
      'caracteristica 1': valorCaracteristica(it, 0),
      'caracteristica 2': valorCaracteristica(it, 1),
      'caracteristica 3': valorCaracteristica(it, 2),
      'costo': num(d.costo) === null ? '' : num(d.costo),
      'proveedor': texto_(d.proveedor, 120),
      'notas internas': texto_(d.notas, 1000),
    };
    const filaExistente = filaDeCodigo_(hoja, it.codigo);
    if (filaExistente) {
      const rango = hoja.getRange(filaExistente, 1, 1, titulos.length);
      const actual = rango.getValues()[0];
      rango.setValues([titulos.map((t, i) => (t in valores ? sinFormula_(valores[t]) : actual[i]))]);
    } else {
      hoja.appendRow(titulos.map(t => (t in valores ? sinFormula_(valores[t]) : '')));
    }
  });

  // Opciones que estaban y se sacaron del formulario: no se borran, se desactivan (queda el historial).
  const quitadas = originales.filter(c => !vistos.has(c));
  quitadas.forEach(c => {
    const f = filaDeCodigo_(hoja, c);
    const colActivo = titulos.indexOf('activo') + 1;
    if (f && colActivo) hoja.getRange(f, colActivo).setValue('no');
  });

  // Escalas: solo si se tocaron (o es un producto nuevo), para no pisar escalas cargadas a mano.
  if (d.escalasModificadas || !originales.length) guardarEscalasDe_(ss, [...vistos, ...quitadas], [...vistos], escalas);

  borrarCache_();
  const n = items.length;
  return {
    ok: true,
    codigo: items[0].codigo,
    mensaje: `Guardado: ${nombre}${d.conOpciones ? ` (${n} ${n === 1 ? 'opción' : 'opciones'})` : ''}.` +
      (quitadas.length ? ` Se desactivaron: ${quitadas.join(', ')}.` : '') + ' Ya se ve en el sitio.',
  };
}

function filaDeCodigo_(hoja, codigo) {
  const { filas, col } = leerTabla_(hoja);
  const valores = hoja.getDataRange().getValues();
  for (let i = 1; i < valores.length; i++) if (String(valores[i][col.codigo]).trim() === codigo) return i + 1;
  return 0;
}

// Reemplaza las escalas de esos códigos por las nuevas (las mismas para todas las opciones).
function guardarEscalasDe_(ss, borrarDe, codigos, escalas) {
  let hoja = ss.getSheetByName(HOJA.escalas);
  if (!hoja) {
    if (!escalas.length) return;
    hoja = ss.insertSheet(HOJA.escalas);
    encabezado_(hoja, TITULOS_ESCALAS);
  }
  const titulos = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(normalizar_);
  const iCod = titulos.indexOf('codigo');
  const valores = hoja.getDataRange().getValues();
  for (let i = valores.length - 1; i >= 1; i--) {
    if (borrarDe.includes(String(valores[i][iCod]).trim())) hoja.deleteRow(i + 1);
  }
  codigos.forEach(c => escalas.forEach(e => {
    const fila = { 'codigo': c, 'para': e.para, 'desde (unidades)': e.desde, 'descuento': e.descuento / 100 };
    hoja.appendRow(titulos.map(t => (t in fila ? fila[t] : '')));
  }));
}

// ===================================================================
// Botones del menú
// ===================================================================

function actualizarSitioAhora() {
  borrarCache_();
  SpreadsheetApp.getActiveSpreadsheet().toast('Listo: la próxima vez que se abra el sitio, lee la planilla de nuevo.', 'Catálogo', 6);
}

function probarMail() {
  const cfg = leerConfig_(SpreadsheetApp.getActiveSpreadsheet());
  const destino = String(cfg.mail_pedidos || '').trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!esMail_(destino)) {
    ss.toast('Completá mail_pedidos en la hoja Configuración.', 'Catálogo', 8);
    return;
  }
  MailApp.sendEmail(destino, 'Prueba del catálogo', 'Si te llegó este mail, el envío de pedidos funciona.');
  ss.toast(`Mail de prueba enviado a ${destino}. Te quedan ${MailApp.getRemainingDailyQuota()} envíos hoy.`, 'Catálogo', 8);
}

// ===================================================================
// Herramientas
// ===================================================================

const CLAVE_CACHE = 'catalogo';

function catalogoConCache_() {
  const cache = CacheService.getScriptCache();
  const guardado = leerCacheGrande_(cache, CLAVE_CACHE);
  if (guardado) return JSON.parse(guardado);
  const catalogo = construirCatalogo_();
  guardarCacheGrande_(cache, CLAVE_CACHE, JSON.stringify(catalogo), MINUTOS_CACHE * 60);
  return catalogo;
}

// La caché acepta hasta 100 KB por dato: un catálogo grande se guarda en pedazos.
function guardarCacheGrande_(cache, clave, texto, segundos) {
  const TAMANO = 40000;
  const partes = {};
  const n = Math.ceil(texto.length / TAMANO);
  for (let i = 0; i < n; i++) partes[`${clave}_${i}`] = texto.slice(i * TAMANO, (i + 1) * TAMANO);
  partes[`${clave}_n`] = String(n);
  try { cache.putAll(partes, segundos); } catch (err) { console.warn('Catálogo sin caché: ' + err.message); }
}

function leerCacheGrande_(cache, clave) {
  const n = Number(cache.get(`${clave}_n`));
  if (!n) return null;
  const claves = [];
  for (let i = 0; i < n; i++) claves.push(`${clave}_${i}`);
  const partes = cache.getAll(claves);
  if (claves.some(k => partes[k] === undefined || partes[k] === null)) return null;
  return claves.map(k => partes[k]).join('');
}

function borrarCache_() {
  CacheService.getScriptCache().remove(`${CLAVE_CACHE}_n`);
}

function leerTabla_(hoja) {
  if (!hoja) return { filas: [], col: {} };
  const valores = hoja.getDataRange().getValues();
  const col = {};
  (valores[0] || []).forEach((t, i) => {
    const k = normalizar_(t);
    if (k && !(k in col)) col[k] = i;
  });
  const filas = valores.slice(1).filter(f => f.some(v => v !== '' && v !== null));
  return { filas, col };
}

function leerConfig_(ss) {
  const cfg = {};
  const hoja = ss.getSheetByName(HOJA.config);
  if (!hoja) return cfg;
  hoja.getDataRange().getValues().slice(1).forEach(f => {
    const clave = normalizar_(f[0]).replace(/ /g, '_');
    if (clave) cfg[clave] = f[1];
  });
  return cfg;
}

function cfgSi_(cfg, clave, porDefecto) {
  const v = cfg[clave];
  return v === undefined || v === '' ? porDefecto : esSi_(v);
}

function normalizar_(v) {
  return String(v === null || v === undefined ? '' : v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function esSi_(v) {
  if (v === true) return true;
  return ['si', 's', 'yes', 'x', 'true', 'verdadero', '1'].includes(normalizar_(v));
}

// Acepta 25000, "25.000", "$ 25.000,50" → número. Vacío o texto → null.
function numero_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const t = String(v === null || v === undefined ? '' : v).replace(/[$\s]/g, '');
  if (!t) return null;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return isFinite(n) ? n : null;
}

// "Medida: 1/2"" → { nombre: 'Medida', valor: '1/2"' }. Sin "Nombre:", el nombre queda vacío.
// Tolera dos puntos de más ("Medida:: 1/2"" o "Medida: : 1/2"").
function partirCaracteristica_(v) {
  const t = String(v === null || v === undefined ? '' : v).trim();
  const i = t.indexOf(':');
  if (i <= 0) return { nombre: '', valor: t.replace(/^[:\s]+/, '') };
  return { nombre: t.slice(0, i).trim(), valor: t.slice(i + 1).replace(/^[:\s]+/, '').trim() };
}

function texto_(v, max) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim().slice(0, max);
}

function esMail_(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));
}

// Solo letras, números, punto, guion y guion bajo: un nombre de archivo, no una ruta.
function nombreDeArchivo_(v) {
  const t = String(v || '').trim();
  return /^[A-Za-z0-9._-]+$/.test(t) && !t.startsWith('.') ? t : '';
}

function escapar_(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Un texto que empieza con = + - @ la planilla lo tomaría como fórmula. Se guarda como texto.
function sinFormula_(v) {
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
}

function pesos_(n) {
  return '$ ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ===================================================================
// La barra lateral del formulario (HTML). Se arma acá para que todo sea un solo archivo.
// ⚠️ No usar comillas invertidas ni signo pesos seguido de llave adentro: cortan este texto.
// ===================================================================

const HTML_FORMULARIO_ = `<!DOCTYPE html>
<html>
<head>
<base target="_top">
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1b1f27; margin: 0; padding: 12px; }
  h1 { font-size: 16px; color: #1747a6; margin: 0 0 8px; }
  h2 { font-size: 13px; color: #1747a6; margin: 16px 0 4px; padding-top: 12px; border-top: 1px solid #d9dee7; }
  label { display: block; font-weight: bold; margin: 8px 0 3px; }
  input, select, textarea { width: 100%; box-sizing: border-box; padding: 6px; border: 1px solid #b9c0cc; border-radius: 4px; font: inherit; background: #fff; }
  input:focus, select:focus, textarea:focus, button:focus-visible { outline: 2px solid #1747a6; outline-offset: 1px; }
  textarea { resize: vertical; }
  .fila { display: flex; gap: 6px; }
  .fila > * { flex: 1; min-width: 0; }
  .check { display: flex; align-items: center; gap: 6px; font-weight: normal; margin: 6px 0; }
  .check input { width: auto; margin: 0; }
  .ayuda { color: #5f6673; font-size: 12px; margin: 4px 0; }
  button { font: inherit; cursor: pointer; border-radius: 4px; padding: 7px 10px; border: 1px solid #1747a6; background: #fff; color: #1747a6; }
  button.primario { background: #1747a6; color: #fff; width: 100%; padding: 10px; font-weight: bold; margin-top: 12px; }
  button:disabled { opacity: .6; cursor: default; }
  .ancho { width: 100%; margin-top: 6px; }
  .tarjeta { border: 1px solid #d9dee7; border-radius: 6px; padding: 6px 8px; margin: 6px 0; }
  .tarjeta-titulo { display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
  .tarjeta label { font-weight: normal; font-size: 11px; color: #5f6673; margin: 4px 0 2px; }
  .quitar { border: 0; color: #b3261e; padding: 2px 6px; background: none; }
  .msj { padding: 8px; border-radius: 4px; margin: 12px 0 0; }
  .ok { background: #e6f4ea; color: #13703a; }
  .mal { background: #fdecea; color: #b3261e; }
  .aviso { background: #fff3df; color: #8a4b00; }
  .msj ul { margin: 4px 0 0; padding-left: 18px; }
  .privado { background: #f4f5f7; padding: 2px 8px 8px; border-radius: 4px; }
  .oculto { display: none !important; }
</style>
</head>
<body>
<h1>Cargar o editar producto</h1>
<label for="elegir">¿Qué producto?</label>
<select id="elegir"><option value="">+ Producto nuevo</option></select>
<p class="ayuda" id="cargando" role="status">Cargando…</p>

<form id="form" novalidate>
  <h2>Datos del producto</h2>
  <label for="nombre">Nombre *</label>
  <input id="nombre" maxlength="120" placeholder="Ej.: Válvula de drenaje">
  <label for="categoria">Categoría *</label>
  <select id="categoria"></select>
  <div id="nuevaCategoria" class="oculto">
    <input id="categoriaNueva" maxlength="60" placeholder="Nombre de la categoría nueva" aria-label="Nombre de la categoría nueva">
    <label for="categoriaPadre">Va dentro de</label>
    <select id="categoriaPadre"></select>
  </div>
  <label for="descripcion">Descripción corta</label>
  <textarea id="descripcion" rows="2" maxlength="500" placeholder="Una o dos líneas"></textarea>
  <label for="larga">Descripción larga</label>
  <textarea id="larga" rows="3" maxlength="5000" placeholder="Se ve en la página del producto: medidas, materiales, cuidados"></textarea>
  <label class="check"><input type="checkbox" id="activo" checked> Se ve en el sitio</label>
  <label class="check"><input type="checkbox" id="destacado"> Destacado (aparece primero)</label>

  <h2>Foto</h2>
  <label for="foto">Archivo de la foto</label>
  <input id="foto" maxlength="80" placeholder="Vacío = el código + .webp">
  <label for="alt">Qué se ve en la foto</label>
  <input id="alt" maxlength="200" placeholder="Ej.: Válvula de bronce, vista de frente">

  <h2>Precio y stock</h2>
  <label class="check"><input type="checkbox" id="conOpciones"> Tiene opciones (medidas, colores…)</label>

  <div id="simple">
    <div class="fila">
      <div><label for="codigo">Código *</label><input id="codigo" maxlength="40"></div>
      <div><label for="precio">Precio contado *</label><input id="precio" inputmode="numeric" placeholder="25000"></div>
    </div>
    <label for="stock">Stock</label>
    <input id="stock" inputmode="numeric" placeholder="Vacío = no llevo stock">
  </div>

  <div id="opciones" class="oculto">
    <p class="ayuda"><b>1.</b> Escribí cada característica y sus valores, separados por coma.</p>
    <div class="fila"><input class="carNombre" maxlength="40" placeholder="Ej.: Medida" aria-label="Característica 1"><input class="carValores" placeholder="Ej.: 1/2&quot;, 3/4&quot;, 1&quot;" aria-label="Valores de la característica 1"></div>
    <div class="fila" style="margin-top:6px"><input class="carNombre" maxlength="40" placeholder="Ej.: Material" aria-label="Característica 2"><input class="carValores" placeholder="Ej.: PPR, PP" aria-label="Valores de la característica 2"></div>
    <div class="fila" style="margin-top:6px"><input class="carNombre" maxlength="40" placeholder="(opcional)" aria-label="Característica 3"><input class="carValores" placeholder="(opcional)" aria-label="Valores de la característica 3"></div>
    <div class="fila">
      <div><label for="codigoBase">Código base</label><input id="codigoBase" maxlength="30"></div>
      <div><label for="precioBase">Precio base</label><input id="precioBase" inputmode="numeric" placeholder="25000"></div>
    </div>
    <button type="button" id="armar" class="ancho"><b>2.</b> Armar combinaciones</button>
    <p class="ayuda"><b>3.</b> Revisá código, precio y stock de cada opción. Con ✕ sacás las que no vendés.</p>
    <div id="variantes"></div>
  </div>

  <h2>Descuentos por cantidad (opcional)</h2>
  <p class="ayuda" id="ayudaEscalas">Valen para todas las opciones del producto. Ej.: desde 6 u., 5%.</p>
  <div id="escalas"></div>
  <button type="button" id="agregarEscala" class="ancho">+ Agregar descuento</button>

  <h2>Privado (no se ve en el sitio)</h2>
  <div class="privado">
    <div class="fila">
      <div><label for="costo">Costo</label><input id="costo" inputmode="numeric"></div>
      <div><label for="proveedor">Proveedor</label><input id="proveedor" maxlength="120"></div>
    </div>
    <label for="notas">Notas internas</label>
    <textarea id="notas" rows="2" maxlength="1000"></textarea>
  </div>

  <div id="mensaje" class="msj oculto" role="status" aria-live="polite"></div>
  <button type="submit" class="primario" id="guardar">Guardar</button>
</form>

<script>
  var estado = { originales: [], escalasModificadas: false, siguiente: 'P001', categorias: [] };
  var OTRA = '__otra__';

  function $(id) { return document.getElementById(id); }
  function el(tag, props, hijos) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'texto') n.textContent = props[k];
      else if (k === 'clase') n.className = props[k];
      else if (k === 'onclick') n.addEventListener('click', props[k]);
      else if (k === 'oninput') n.addEventListener('input', props[k]);
      else n.setAttribute(k, props[k]);
    });
    (hijos || []).forEach(function (h) { if (h) n.appendChild(typeof h === 'string' ? document.createTextNode(h) : h); });
    return n;
  }
  function valor(id) { return $(id).value.trim(); }
  function servidor(funcion, args, ok) {
    var llamada = google.script.run.withSuccessHandler(ok).withFailureHandler(function (e) {
      mostrar('mal', ['Algo salió mal: ' + (e && e.message ? e.message : e)]);
      $('guardar').disabled = false;
      $('guardar').textContent = 'Guardar';
    });
    llamada[funcion].apply(llamada, args);
  }
  function mostrar(tipo, lineas) {
    var m = $('mensaje');
    m.className = 'msj ' + tipo;
    m.textContent = '';
    if (lineas.length === 1) m.textContent = lineas[0];
    else m.appendChild(el('ul', {}, lineas.map(function (l) { return el('li', { texto: l }); })));
    m.scrollIntoView({ block: 'nearest' });
  }
  function ocultarMensaje() { $('mensaje').className = 'msj oculto'; }

  // ---------- Arranque ----------
  function cargarLista(despues) {
    $('cargando').textContent = 'Cargando…';
    servidor('formularioDatos', [], function (d) {
      estado.siguiente = d.siguiente;
      estado.categorias = d.categorias;
      var elegir = $('elegir');
      var actual = elegir.value;
      elegir.textContent = '';
      elegir.appendChild(el('option', { value: '', texto: '+ Producto nuevo' }));
      d.productos.forEach(function (p) { elegir.appendChild(el('option', { value: p.codigo, texto: p.texto })); });
      elegir.value = actual;
      pintarCategorias('');
      $('cargando').textContent = d.productos.length + ' productos cargados. Elegí uno para editarlo.';
      if (despues) despues();
    });
  }

  // Categorías grandes y, debajo de cada una, sus subcategorías ("— Válvulas").
  function pintarCategorias(elegida) {
    var sel = $('categoria');
    sel.textContent = '';
    sel.appendChild(el('option', { value: '', texto: 'Elegí una categoría' }));
    var todas = estado.categorias.slice();
    var nombres = todas.map(function (c) { return c.nombre; });
    if (elegida && nombres.indexOf(elegida) < 0) { todas.push({ nombre: elegida, padre: '' }); nombres.push(elegida); }
    var grandes = todas.filter(function (c) { return !c.padre || nombres.indexOf(c.padre) < 0; });
    grandes.forEach(function (g) {
      sel.appendChild(el('option', { value: g.nombre, texto: g.nombre }));
      todas.filter(function (c) { return c.padre === g.nombre; }).forEach(function (h) {
        sel.appendChild(el('option', { value: h.nombre, texto: '— ' + h.nombre }));
      });
    });
    sel.appendChild(el('option', { value: OTRA, texto: 'Otra categoría…' }));
    sel.value = elegida || '';
    $('nuevaCategoria').classList.add('oculto');
    var padre = $('categoriaPadre');
    padre.textContent = '';
    padre.appendChild(el('option', { value: '', texto: '(ninguna: es una categoría grande)' }));
    grandes.forEach(function (g) { padre.appendChild(el('option', { value: g.nombre, texto: g.nombre })); });
  }

  // ---------- Producto nuevo / editar ----------
  function limpiar() {
    $('form').reset();
    estado.originales = [];
    estado.escalasModificadas = false;
    $('activo').checked = true;
    $('codigo').value = estado.siguiente;
    $('codigoBase').value = estado.siguiente;
    $('variantes').textContent = '';
    $('escalas').textContent = '';
    $('ayudaEscalas').textContent = 'Valen para todas las opciones del producto. Ej.: desde 6 u., 5%.';
    pintarCategorias('');
    alternarOpciones();
  }

  function llenar(p) {
    limpiar();
    estado.originales = p.originales;
    $('nombre').value = p.nombre;
    pintarCategorias(p.categoria);
    $('descripcion').value = p.descripcion;
    $('larga').value = p.larga;
    $('foto').value = p.foto;
    $('alt').value = p.alt;
    $('activo').checked = p.activo;
    $('destacado').checked = p.destacado;
    $('costo').value = p.costo === null ? '' : p.costo;
    $('proveedor').value = p.proveedor;
    $('notas').value = p.notas;
    $('conOpciones').checked = p.conOpciones;
    if (p.conOpciones) {
      var nombres = document.querySelectorAll('.carNombre');
      var valores = document.querySelectorAll('.carValores');
      p.caracteristicas.forEach(function (c, i) {
        nombres[i].value = c.nombre;
        valores[i].value = c.valores.join(', ');
      });
      $('codigoBase').value = p.originales[0];
      p.variantes.forEach(function (v) { agregarVariante(v); });
    } else {
      $('codigo').value = p.codigo;
      $('precio').value = p.precio === null ? '' : p.precio;
      $('stock').value = p.stock === null ? '' : p.stock;
    }
    p.escalas.forEach(function (e) { agregarEscala(e); });
    if (p.escalasDistintas) {
      $('ayudaEscalas').textContent = 'Ojo: las opciones de este producto tienen descuentos distintos en la planilla. Si cambiás algo acá, todas pasan a tener estos.';
    }
    alternarOpciones();
  }

  function alternarOpciones() {
    var con = $('conOpciones').checked;
    $('simple').classList.toggle('oculto', con);
    $('opciones').classList.toggle('oculto', !con);
  }

  // ---------- Opciones ----------
  function caracteristicas() {
    var nombres = document.querySelectorAll('.carNombre');
    var valores = document.querySelectorAll('.carValores');
    var res = [];
    for (var i = 0; i < 3; i++) {
      res.push({
        nombre: nombres[i].value.trim(),
        valores: valores[i].value.split(',').map(function (v) { return v.trim(); }).filter(function (v, j, todos) { return v && todos.indexOf(v) === j; }),
      });
    }
    return res;
  }

  function variantesActuales() {
    return Array.prototype.map.call(document.querySelectorAll('#variantes .tarjeta'), function (t) {
      return {
        codigo: t.querySelector('.vCodigo').value.trim(),
        precio: t.querySelector('.vPrecio').value.trim(),
        stock: t.querySelector('.vStock').value.trim(),
        valores: JSON.parse(t.getAttribute('data-valores')),
      };
    });
  }

  function agregarVariante(v) {
    var titulo = v.valores.filter(Boolean).join(' · ') || '(sin valores)';
    var tarjeta = el('div', { clase: 'tarjeta', 'data-valores': JSON.stringify(v.valores) }, [
      el('div', { clase: 'tarjeta-titulo' }, [
        el('span', { texto: titulo }),
        el('button', { type: 'button', clase: 'quitar', texto: '✕', 'aria-label': 'Sacar la opción ' + titulo, onclick: function () { tarjeta.remove(); } }),
      ]),
      el('div', { clase: 'fila' }, [
        el('div', {}, [el('label', { texto: 'Código' }), el('input', { clase: 'vCodigo', value: v.codigo || '', 'aria-label': 'Código de ' + titulo })]),
        el('div', {}, [el('label', { texto: 'Precio' }), el('input', { clase: 'vPrecio', value: v.precio === null || v.precio === undefined ? '' : v.precio, inputmode: 'numeric', 'aria-label': 'Precio de ' + titulo })]),
        el('div', {}, [el('label', { texto: 'Stock' }), el('input', { clase: 'vStock', value: v.stock === null || v.stock === undefined ? '' : v.stock, inputmode: 'numeric', 'aria-label': 'Stock de ' + titulo })]),
      ]),
    ]);
    $('variantes').appendChild(tarjeta);
  }

  // Todas las combinaciones de los valores. Las que ya estaban conservan su código, precio y stock.
  function armarCombinaciones() {
    ocultarMensaje();
    var cars = caracteristicas();
    var usadas = [];
    cars.forEach(function (c, i) { if (c.valores.length) usadas.push(i); });
    if (!usadas.length) { mostrar('mal', ['Escribí al menos una característica con sus valores (ej.: Medida y 1/2", 3/4").']); return; }
    var combos = [['', '', '']];
    usadas.forEach(function (i) {
      var nuevos = [];
      combos.forEach(function (c) {
        cars[i].valores.forEach(function (v) { var copia = c.slice(); copia[i] = v; nuevos.push(copia); });
      });
      combos = nuevos;
    });
    var previas = {};
    variantesActuales().forEach(function (v) { previas[v.valores.join('|')] = v; });
    var base = valor('codigoBase') || estado.siguiente;
    var precioBase = valor('precioBase');
    var codigosUsados = Object.keys(previas).map(function (k) { return previas[k].codigo; });
    var n = 1;
    function siguienteCodigo() {
      while (codigosUsados.indexOf(base + '-' + n) >= 0) n++;
      var c = base + '-' + n;
      codigosUsados.push(c);
      return c;
    }
    $('variantes').textContent = '';
    combos.forEach(function (valores) {
      var previa = previas[valores.join('|')];
      agregarVariante(previa ? previa : { codigo: siguienteCodigo(), precio: precioBase, stock: '', valores: valores });
    });
    if (combos.length > 30) mostrar('aviso', ['Son ' + combos.length + ' combinaciones. Sacá con ✕ las que no vendés.']);
  }

  // ---------- Descuentos ----------
  function agregarEscala(e) {
    e = e || { para: 'todos', desde: '', descuento: '' };
    var marcar = function () { estado.escalasModificadas = true; };
    var para = el('select', { clase: 'ePara', 'aria-label': 'Para quién' }, [
      el('option', { value: 'todos', texto: 'Todos' }), el('option', { value: 'mayoristas', texto: 'Mayoristas' })]);
    para.value = e.para;
    para.addEventListener('change', marcar);
    var fila = el('div', { clase: 'tarjeta' }, [
      el('div', { clase: 'fila' }, [
        el('div', {}, [el('label', { texto: 'Para' }), para]),
        el('div', {}, [el('label', { texto: 'Desde (u.)' }), el('input', { clase: 'eDesde', value: e.desde, inputmode: 'numeric', 'aria-label': 'Desde cuántas unidades', oninput: marcar })]),
        el('div', {}, [el('label', { texto: 'Desc. %' }), el('input', { clase: 'eDesc', value: e.descuento, inputmode: 'numeric', 'aria-label': 'Porcentaje de descuento', oninput: marcar })]),
        el('button', { type: 'button', clase: 'quitar', texto: '✕', 'aria-label': 'Sacar este descuento', onclick: function () { fila.remove(); marcar(); } }),
      ]),
    ]);
    $('escalas').appendChild(fila);
  }

  // ---------- Guardar ----------
  function guardar(ev) {
    ev.preventDefault();
    ocultarMensaje();
    var nueva = $('categoria').value === OTRA;
    var categoria = nueva ? valor('categoriaNueva') : $('categoria').value;
    var datos = {
      originales: estado.originales,
      nombre: valor('nombre'), categoria: categoria, categoriaPadre: nueva ? $('categoriaPadre').value : '',
      descripcion: valor('descripcion'), larga: valor('larga'),
      foto: valor('foto'), alt: valor('alt'),
      activo: $('activo').checked, destacado: $('destacado').checked,
      conOpciones: $('conOpciones').checked,
      codigo: valor('codigo'), precio: valor('precio'), stock: valor('stock'),
      caracteristicas: caracteristicas().map(function (c) { return c.nombre; }),
      variantes: variantesActuales(),
      escalas: Array.prototype.map.call(document.querySelectorAll('#escalas .tarjeta'), function (t) {
        return { para: t.querySelector('.ePara').value, desde: t.querySelector('.eDesde').value.trim(), descuento: t.querySelector('.eDesc').value.trim() };
      }),
      escalasModificadas: estado.escalasModificadas,
      costo: valor('costo'), proveedor: valor('proveedor'), notas: valor('notas'),
    };
    $('guardar').disabled = true;
    $('guardar').textContent = 'Guardando…';
    servidor('formularioGuardar', [datos], function (r) {
      $('guardar').disabled = false;
      $('guardar').textContent = 'Guardar';
      if (!r.ok) { mostrar('mal', r.errores); return; }
      var eraNuevo = !estado.originales.length;
      cargarLista(function () {
        if (eraNuevo) {
          limpiar();
          $('elegir').value = '';
          mostrar('ok', [r.mensaje + ' Podés cargar otro.']);
        } else {
          $('elegir').value = r.codigo;
          servidor('formularioProducto', [r.codigo], function (p) { llenar(p); mostrar('ok', [r.mensaje]); });
        }
      });
    });
  }

  // ---------- Eventos ----------
  $('elegir').addEventListener('change', function () {
    ocultarMensaje();
    var codigo = $('elegir').value;
    if (!codigo) { limpiar(); return; }
    $('cargando').textContent = 'Cargando el producto…';
    servidor('formularioProducto', [codigo], function (p) {
      llenar(p);
      $('cargando').textContent = 'Editando. Los cambios se ven en el sitio al guardar.';
    });
  });
  $('categoria').addEventListener('change', function () {
    var otra = $('categoria').value === OTRA;
    $('nuevaCategoria').classList.toggle('oculto', !otra);
    if (otra) $('categoriaNueva').focus();
  });
  $('conOpciones').addEventListener('change', alternarOpciones);
  $('armar').addEventListener('click', armarCombinaciones);
  $('agregarEscala').addEventListener('click', function () { agregarEscala(); estado.escalasModificadas = true; });
  $('form').addEventListener('submit', guardar);

  cargarLista(limpiar);
</script>
</body>
</html>`;
