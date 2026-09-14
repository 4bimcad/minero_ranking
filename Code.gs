/**
 * MINERO RANKING — lógica de backend (Google Apps Script)
 * ---------------------------------------------------------
 * Modelo: RankingAmount es de por vida (no hay periodos ni vencimientos).
 * El orden se recalcula por RankingAmount DESC, y en empate por RankingSince ASC.
 *
 * CONFIGURACIÓN REQUERIDA (Project Settings → Script Properties):
 *   GITHUB_TOKEN      -> Personal Access Token con permiso "repo" (contents: write)
 *   GITHUB_OWNER      -> usuario u organización de GitHub (ej: "stanislav")
 *   GITHUB_REPO       -> nombre del repositorio (ej: "mineroranking")
 *   GITHUB_BRANCH     -> rama, normalmente "main"
 *   GITHUB_FILE_PATH  -> ruta del archivo en el repo (ej: "data/ranking.json")
 *
 * ESTRUCTURA DE HOJAS ESPERADA:
 *
 * Hoja "EMPRESAS" (columnas, en este orden):
 *   ID | Empresa | Slug | Pais | PaisCodigo | Ciudad | Categoria | Descripcion
 *   | Productos | Logo | Website | WhatsApp | Email | Estado | RankingAmount | RankingSince
 *
 *   - PaisCodigo: código ISO de 2 letras (PE, CL, CO, AR, BO, EC, MX, BR, PA, US...)
 *     usado para mostrar la bandera vía flagsapi.com. Si se deja vacío, el sitio
 *     intenta adivinarlo por el nombre del país, pero es mejor completarlo siempre.
 *   - Descripcion: OBLIGATORIA, una o dos frases — se muestra directamente
 *     en la fila del ranking, no solo en el detalle.
 *   - Productos: separar varios valores con punto y coma ";"
 *   - Logo: URL pública de la imagen (recomendado 256x256 o 128x128, cuadrada,
 *     fondo transparente o blanco). Si está vacío, el sitio muestra un ícono
 *     genérico de la categoría en su lugar — no rompe nada dejarlo en blanco.
 *   - Estado: PENDIENTE | PUBLICADO
 *   - RankingSince: fecha/hora en que se alcanzó el RankingAmount actual
 *
 * Hoja "PAGOS" (columnas, en este orden):
 *   ID | Empresa_ID | Fecha | Monto | RankingAnterior | RankingNuevo
 *   | Diferencia | Estado
 *
 *   - Estado: PENDIENTE | CONFIRMADO
 *   - El admin cambia manualmente Estado a CONFIRMADO cuando verifica el pago
 *     en Mercado Pago. Eso dispara automáticamente el recálculo (ver onEdit).
 */

const SHEET_EMPRESAS = 'EMPRESAS';
const SHEET_PAGOS = 'PAGOS';

const COL_EMPRESAS = {
  ID: 1, EMPRESA: 2, SLUG: 3, PAIS: 4, PAIS_CODIGO: 5, CIUDAD: 6, CATEGORIA: 7,
  DESCRIPCION: 8, PRODUCTOS: 9, LOGO: 10, WEBSITE: 11, WHATSAPP: 12, EMAIL: 13,
  ESTADO: 14, RANKING_AMOUNT: 15, RANKING_SINCE: 16
};

const COL_PAGOS = {
  ID: 1, EMPRESA_ID: 2, FECHA: 3, MONTO: 4, RANKING_ANTERIOR: 5,
  RANKING_NUEVO: 6, DIFERENCIA: 7, ESTADO: 8
};

/**
 * Trigger instalable: se ejecuta cuando el admin edita la hoja PAGOS.
 * Si detecta que Estado pasó a CONFIRMADO, procesa ese pago.
 * (Instalar manualmente: Extensiones → Apps Script → Triggers → Add Trigger
 *  → onEditPagos → From spreadsheet → On edit)
 */
function onEditPagos(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_PAGOS) return;
  if (e.range.getColumn() !== COL_PAGOS.ESTADO) return;

  const value = e.range.getValue();
  if (value !== 'CONFIRMADO') return;

  const row = e.range.getRow();
  if (row === 1) return; // encabezado

  procesarPago(sheet, row);
}

/**
 * Procesa un pago confirmado: actualiza RankingAmount y RankingSince
 * de la empresa correspondiente, y dispara el recálculo global.
 */
function procesarPago(pagosSheet, row) {
  const empresaId = pagosSheet.getRange(row, COL_PAGOS.EMPRESA_ID).getValue();
  const rankingNuevo = Number(pagosSheet.getRange(row, COL_PAGOS.RANKING_NUEVO).getValue());

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const empresasSheet = ss.getSheetByName(SHEET_EMPRESAS);
  const data = empresasSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL_EMPRESAS.ID - 1]) === String(empresaId)) {
      const targetRow = i + 1;
      empresasSheet.getRange(targetRow, COL_EMPRESAS.RANKING_AMOUNT).setValue(rankingNuevo);
      empresasSheet.getRange(targetRow, COL_EMPRESAS.RANKING_SINCE).setValue(new Date());
      break;
    }
  }

  recalcularYPublicar();
}

/**
 * Recalcula el orden de todas las empresas PUBLICADAS y publica el JSON.
 * Se puede ejecutar manualmente desde el editor para forzar una publicación.
 */
function recalcularYPublicar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_EMPRESAS);
  const data = sheet.getDataRange().getValues();

  const empresas = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[COL_EMPRESAS.ID - 1]) continue;
    if (row[COL_EMPRESAS.ESTADO - 1] !== 'PUBLICADO') continue;

    empresas.push({
      id: row[COL_EMPRESAS.ID - 1],
      empresa: row[COL_EMPRESAS.EMPRESA - 1],
      slug: row[COL_EMPRESAS.SLUG - 1],
      pais: row[COL_EMPRESAS.PAIS - 1],
      paisCodigo: row[COL_EMPRESAS.PAIS_CODIGO - 1] || '',
      ciudad: row[COL_EMPRESAS.CIUDAD - 1],
      categoria: row[COL_EMPRESAS.CATEGORIA - 1],
      descripcion: row[COL_EMPRESAS.DESCRIPCION - 1],
      productos: String(row[COL_EMPRESAS.PRODUCTOS - 1] || '')
        .split(';').map(s => s.trim()).filter(Boolean),
      logo: row[COL_EMPRESAS.LOGO - 1] || '',
      website: row[COL_EMPRESAS.WEBSITE - 1],
      whatsapp: row[COL_EMPRESAS.WHATSAPP - 1],
      email: row[COL_EMPRESAS.EMAIL - 1],
      estado: row[COL_EMPRESAS.ESTADO - 1],
      rankingAmount: Number(row[COL_EMPRESAS.RANKING_AMOUNT - 1]) || 0,
      rankingSince: row[COL_EMPRESAS.RANKING_SINCE - 1]
        ? new Date(row[COL_EMPRESAS.RANKING_SINCE - 1]).toISOString()
        : new Date().toISOString()
    });
  }

  // Orden: RankingAmount DESC, en empate RankingSince ASC (quien llegó primero)
  empresas.sort((a, b) => {
    if (b.rankingAmount !== a.rankingAmount) return b.rankingAmount - a.rankingAmount;
    return new Date(a.rankingSince) - new Date(b.rankingSince);
  });

  const payload = {
    updatedAt: new Date().toISOString(),
    empresas: empresas
  };

  publicarEnGitHub(JSON.stringify(payload, null, 2));
}

/**
 * Sube (crea o actualiza) el archivo ranking.json en GitHub vía la API de Contents.
 */
function publicarEnGitHub(jsonString) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('GITHUB_TOKEN');
  const owner = props.getProperty('GITHUB_OWNER');
  const repo = props.getProperty('GITHUB_REPO');
  const branch = props.getProperty('GITHUB_BRANCH') || 'main';
  const path = props.getProperty('GITHUB_FILE_PATH') || 'data/ranking.json';

  if (!token || !owner || !repo) {
    throw new Error('Faltan Script Properties: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO');
  }

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  // 1. Obtener el sha actual del archivo (si existe), necesario para actualizarlo
  let sha = null;
  try {
    const getResp = UrlFetchApp.fetch(`${apiUrl}?ref=${branch}`, {
      method: 'get',
      headers: { Authorization: `token ${token}` },
      muteHttpExceptions: true
    });
    if (getResp.getResponseCode() === 200) {
      sha = JSON.parse(getResp.getContentText()).sha;
    }
  } catch (err) {
    // archivo no existe todavía, se creará
  }

  const base64Content = Utilities.base64Encode(jsonString, Utilities.Charset.UTF_8);

  const body = {
    message: `Actualizar ranking — ${new Date().toISOString()}`,
    content: base64Content,
    branch: branch
  };
  if (sha) body.sha = sha;

  const putResp = UrlFetchApp.fetch(apiUrl, {
    method: 'put',
    contentType: 'application/json',
    headers: { Authorization: `token ${token}` },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  const code = putResp.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error(`Error publicando en GitHub (${code}): ${putResp.getContentText()}`);
  }

  Logger.log('ranking.json publicado correctamente en GitHub.');
}

/**
 * Trigger instalable: se ejecuta cuando llega una nueva respuesta del
 * Google Form vinculado a la hoja EMPRESAS. Fuerza Estado = PENDIENTE
 * para que quede claro que falta revisión manual antes de publicar.
 * (Instalar: Triggers → Add Trigger → onFormSubmitEmpresas → On form submit)
 */
function onFormSubmitEmpresas(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EMPRESAS);
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, COL_EMPRESAS.ESTADO).setValue('PENDIENTE');
  sheet.getRange(lastRow, COL_EMPRESAS.RANKING_AMOUNT).setValue(0);
  sheet.getRange(lastRow, COL_EMPRESAS.RANKING_SINCE).setValue(new Date());
}

/**
 * Utilidad manual: marcar una empresa como PUBLICADO después de revisarla.
 * Ejecutar seleccionando la fila en la hoja y corriendo esta función,
 * o simplemente cambiar el valor de Estado a mano en la hoja — ambas
 * formas funcionan, esta función es solo un atajo opcional.
 */
function publicarEmpresaEnFilaSeleccionada() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EMPRESAS);
  const row = sheet.getActiveCell().getRow();
  if (row === 1) return;
  sheet.getRange(row, COL_EMPRESAS.ESTADO).setValue('PUBLICADO');
}
