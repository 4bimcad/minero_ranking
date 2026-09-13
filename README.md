# MINERO RANKING — guía de puesta en marcha

## 1. Repositorio en GitHub
1. Crea un repo (ej. `mineroranking`), sube `index.html` y la carpeta `data/` (con `ranking.json`) tal como están.
2. Activa GitHub Pages: Settings → Pages → Deploy from branch → `main` / raíz.
3. Apunta el subdominio `mineroranking.infoset.org.pe` a GitHub Pages:
   - En tu DNS (donde administras infoset.org.pe), agrega un registro CNAME:
     `mineroranking` → `<tu-usuario>.github.io`
   - En el repo, agrega un archivo `CNAME` con el contenido: `mineroranking.infoset.org.pe`

## 2. Google Sheet
Crea un Sheet con dos hojas: `EMPRESAS` y `PAGOS`, con las columnas exactas descritas al inicio de `Code.gs`. Vincula un Google Form a la hoja `EMPRESAS` (Respuestas → vincular a Sheets) para la carga gratuita de nuevas empresas.

## 3. Apps Script
1. En el Sheet: Extensiones → Apps Script. Pega el contenido de `Code.gs`.
2. Project Settings → Script Properties, agrega:
   - `GITHUB_TOKEN` (Personal Access Token con permiso `repo`)
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_BRANCH` (ej. `main`)
   - `GITHUB_FILE_PATH` (ej. `data/ranking.json`)
3. Triggers (reloj a la izquierda) → Add Trigger:
   - Función `onEditPagos` → From spreadsheet → On edit
   - Función `onFormSubmitEmpresas` → From spreadsheet → On form submit

## 4. Flujo de trabajo diario
1. Empresa llena el Form → aparece en `EMPRESAS` con Estado=PENDIENTE.
2. Revisas los datos → cambias Estado a `PUBLICADO` (a mano, o corriendo `publicarEmpresaEnFilaSeleccionada`).
3. Empresa quiere subir posición → WhatsApp → acuerdan el monto → paga por Mercado Pago.
4. Registras el pago en `PAGOS` (Empresa_ID, Monto, RankingAnterior, RankingNuevo, Diferencia) y pones Estado=`CONFIRMADO`.
5. El script se dispara solo, actualiza `RankingAmount`/`RankingSince` en `EMPRESAS`, recalcula el orden y publica `ranking.json` en GitHub.
6. La página ya está actualizada — no hay que tocar el HTML.

## 5. Antes de publicar
- Reemplazar `WHATSAPP_ADMIN` en `index.html` (línea con `const WHATSAPP_ADMIN`) por tu número real.
- Reemplazar los `website`/`whatsapp` de ejemplo en `ranking.json` por datos reales o borrar las filas de ejemplo.
