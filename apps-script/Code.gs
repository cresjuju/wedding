/**
 * 모바일 청첩장 방명록 - Google Apps Script
 *
 * 방명록용 구글 스프레드시트 > 확장 프로그램 > Apps Script 에 이 코드를 붙여넣고
 * "웹 앱"으로 배포하세요. 배포 방법은 apps-script/README.md 참고.
 *
 * (선택) 관리자 비밀번호: 프로젝트 설정 > 스크립트 속성 에 ADMIN_PASSWORD 를 추가하면
 * 그 비밀번호로 모든 글을 삭제할 수 있습니다. 코드에 직접 적지 마세요(저장소가 공개됨).
 */

const SHEET_NAME = 'guestbook';
const HEADERS = ['id', 'createdAt', 'name', 'message', 'pwHash', 'deleted'];
const LIMITS = { name: 20, message: 300, passwordMin: 4, passwordMax: 20 };
const MAX_ITEMS = 300;

function doGet() {
  const rows = getRows_(getSheet_());
  const items = rows
    .filter(r => r[5] !== true)
    .slice(-MAX_ITEMS)
    .reverse()
    .map(r => ({
      id: String(r[0]),
      createdAt: new Date(r[1]).toISOString(),
      name: String(r[2]),
      message: String(r[3]),
    }));
  return json_({ ok: true, items: items });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'INVALID' });
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json_({ ok: false, error: 'BUSY' });
  try {
    if (body.action === 'create') return json_(create_(body));
    if (body.action === 'delete') return json_(remove_(body));
    return json_({ ok: false, error: 'INVALID' });
  } finally {
    lock.releaseLock();
  }
}

function create_(body) {
  // 스팸봇이 숨김 필드를 채운 경우: 성공한 척하고 저장하지 않음
  if (body.website) return { ok: true };

  const name = String(body.name || '').trim();
  const message = String(body.message || '').trim();
  const password = String(body.password || '');
  if (!name || name.length > LIMITS.name) return { ok: false, error: 'INVALID' };
  if (!message || message.length > LIMITS.message) return { ok: false, error: 'INVALID' };
  if (password.length < LIMITS.passwordMin || password.length > LIMITS.passwordMax) return { ok: false, error: 'INVALID' };

  const id = Utilities.getUuid();
  getSheet_().appendRow([id, new Date(), safeCell_(name), safeCell_(message), hash_(id, password), false]);
  return { ok: true, id: id };
}

function remove_(body) {
  const id = String(body.id || '');
  const password = String(body.password || '');
  const sheet = getSheet_();
  const rows = getRows_(sheet);
  const idx = rows.findIndex(r => String(r[0]) === id && r[5] !== true);
  if (idx < 0) return { ok: false, error: 'NOT_FOUND' };

  const admin = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  const isOwner = rows[idx][4] === hash_(id, password);
  const isAdmin = admin && password === admin;
  if (!isOwner && !isAdmin) return { ok: false, error: 'WRONG_PASSWORD' };

  // 실제로 지우지 않고 deleted 표시만 (시트에서 기록 확인 가능)
  sheet.getRange(idx + 2, 6).setValue(true);
  return { ok: true };
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getRows_(sheet) {
  const n = sheet.getLastRow() - 1;
  return n > 0 ? sheet.getRange(2, 1, n, HEADERS.length).getValues() : [];
}

// 비밀번호는 원문 대신 해시로 저장
function hash_(id, password) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, id + ':' + password, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}

// =, +, -, @ 로 시작하면 시트가 수식으로 해석하므로 앞에 ' 를 붙여 글자로 저장
function safeCell_(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
