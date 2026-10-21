var INVITATION_HEADERS = ['Invitation Token', 'Primary Guest Name', 'Email', 'Invited Guest Names', 'Max Guests', 'Active', 'Created At', 'Revoked At'];
var RESPONSE_HEADERS = ['Invitation Token', 'RSVP ID', 'Submitted At', 'Updated At', 'Attending', 'Guest Count', 'Guest Names', 'Dietary Requirements', 'Song Request', 'Message'];
var OAUTH_SCOPE = 'https://www.googleapis.com/auth/drive.file';
var GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
var GOOGLE_SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets/';
var GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
var OAUTH_PROPERTY_KEYS = ['GOOGLE_REFRESH_TOKEN', 'GOOGLE_ACCESS_TOKEN', 'GOOGLE_ACCESS_TOKEN_EXPIRES_AT', 'SPREADSHEET_ID', 'SPREADSHEET_NAME'];

function doGet(e) {
  console.info('RSVP_DIAG: doGet reached');
  var properties = PropertiesService.getScriptProperties();
  if (e && e.parameter && e.parameter.admin === '1') {
    return HtmlService.createHtmlOutputFromFile('Admin').setTitle('RSVP Sheet setup');
  }
  if (e && e.parameter && e.parameter.admin === 'console') {
    var parentOrigin = properties.getProperty('ALLOWED_PARENT_ORIGIN');
    var requestedOrigin = e.parameter.parentOrigin;
    var nonce = e.parameter.bridgeNonce;
    if (!parentOrigin || requestedOrigin !== parentOrigin || !nonce || !/^[A-Za-z0-9-]{20,80}$/.test(nonce)) {
      return HtmlService.createHtmlOutput('Invalid admin console request.');
    }
    var adminBridge = HtmlService.createTemplateFromFile('AdminBridge');
    adminBridge.allowedParentOrigin = parentOrigin;
    adminBridge.bridgeNonce = nonce;
    return adminBridge.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  var parentOrigin = properties.getProperty('ALLOWED_PARENT_ORIGIN');
  if (!parentOrigin) return HtmlService.createHtmlOutput('RSVP service is not configured.');
  if (!e || !e.parameter || e.parameter.parentOrigin !== parentOrigin) return HtmlService.createHtmlOutput('RSVP parent origin is not allowed.');
  var bridgeNonce = e && e.parameter && e.parameter.bridgeNonce;
  if (!bridgeNonce || !/^[A-Za-z0-9-]{20,80}$/.test(bridgeNonce)) return HtmlService.createHtmlOutput('Invalid RSVP bridge request.');
  var bridge = HtmlService.createTemplateFromFile('Bridge');
  bridge.allowedParentOrigin = parentOrigin;
  bridge.bridgeNonce = bridgeNonce;
  return bridge.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) { return HtmlService.createHtmlOutputFromFile(filename).getContent(); }

function rsvpBridgeGetInvitation(token) {
  console.info('RSVP_DIAG: Guest lookup started');
  if (!RsvpValidation.isToken(token)) return { status: 'not-found' };
  var ranges = readSheetRanges_(['Invitations!A:H', 'Responses!A:J']);
  console.info('RSVP_DIAG: Guest lookup Sheets read succeeded');
  var invitation = null;
  for (var i = 1; i < ranges[0].length; i++) {
    if (String(ranges[0][i][0]) === token) { invitation = invitationFromRow_(ranges[0][i]); break; }
  }
  if (!invitation) return { status: 'not-found' };
  if (!invitation.active) return { status: 'revoked' };
  var rsvp = null;
  for (var j = 1; j < ranges[1].length; j++) {
    if (String(ranges[1][j][0]) === token) { rsvp = responseFromRow_(ranges[1][j]); break; }
  }
  return { status: 'active', invitation: {
    primaryGuestName: invitation.primaryGuestName,
    invitedGuestNames: invitation.invitedGuestNames,
    maxGuests: invitation.maxGuests
  }, rsvp: rsvp };
}

function rsvpBridgeGetRsvp(token) {
  var invitation = findInvitation_(token);
  if (!invitation) return { status: 'not-found' };
  if (!invitation.active) return { status: 'revoked' };
  var values = readSheetRange_('Responses!A:J');
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === token) return { status: 'active', rsvp: responseFromRow_(values[i]) };
  }
  return { status: 'active', rsvp: null };
}

function rsvpBridgeSubmitRsvp(token, rsvp) {
  if (!RsvpValidation.isToken(token)) return { status: 'not-found' };
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var invitation = findInvitation_(token);
    if (!invitation) return { status: 'not-found' };
    if (!invitation.active) return { status: 'revoked' };
    if (RsvpValidation.validate(invitation, rsvp).length) throw new Error('invalid');
    var values = readSheetRange_('Responses!A:J');
    var existingRow = -1;
    for (var i = 1; i < values.length; i++) if (String(values[i][0]) === token) { existingRow = i + 1; break; }
    var now = new Date().toISOString();
    var previous = existingRow > 0 ? values[existingRow - 1] : null;
    var record = {
      invitationToken: token,
      rsvpId: previous ? String(previous[1]) : Utilities.getUuid(),
      submittedAt: previous ? String(previous[2]) : now,
      updatedAt: now,
      attending: rsvp.attending,
      guests: rsvp.attending ? rsvp.guests.map(function (guest) { return { name: String(guest.name).trim() }; }) : [{ name: invitation.primaryGuestName }],
      dietaryRequirements: rsvp.dietaryRequirements.trim(), songRequest: rsvp.songRequest.trim(), message: rsvp.message.trim()
    };
    var row = [token, record.rsvpId, record.submittedAt, now, record.attending, record.attending ? record.guests.length : 0, JSON.stringify(record.guests), record.dietaryRequirements, record.songRequest, record.message];
    if (existingRow > 0) writeSheetRow_('Responses!A' + existingRow + ':J' + existingRow, row);
    else appendSheetRow_('Responses!A:J', row);
    return { status: 'saved', rsvp: record };
  } catch (error) {
    console.error('RSVP submission failed:', error);
    throw new Error('Unable to save RSVP.');
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

// Private admin read. This method is only dispatched by AdminBridge.html and
// independently checks the signed-in Apps Script execution identity.
function rsvpAdminGetConsoleData() {
  requireAdminViewer_();
  var ranges = readSheetRanges_(['Invitations!A:H', 'Responses!A:J']);
  var tokenKeys = Object.create(null);
  var invitations = ranges[0].slice(1).map(function (row) {
    var token = String(row[0] || '');
    var invitationKey = adminInvitationKey_(token);
    if (invitationKey) tokenKeys[token] = invitationKey;
    return adminInvitationFromRow_(row, invitationKey);
  });
  var seenTokens = Object.create(null);
  var duplicateResponseCount = 0;
  var orphanResponseCount = 0;
  var responses = ranges[1].slice(1).map(function (row) {
    var token = String(row[0] || '');
    if (seenTokens[token]) duplicateResponseCount++;
    seenTokens[token] = true;
    var response = adminResponseFromRow_(row, tokenKeys[token] || null);
    if (!response.invitationKey) orphanResponseCount++;
    return response;
  });
  return { invitations: invitations, responses: responses, duplicateResponseCount: duplicateResponseCount, orphanResponseCount: orphanResponseCount };
}

function rsvpAdminGetAuthorizationUrl() {
  return ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL).getAuthorizationUrl() || '';
}

function requireAdminViewer_() {
  var email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!email) throw new Error('ADMIN_IDENTITY_UNAVAILABLE');
  var allowed = String(PropertiesService.getScriptProperties().getProperty('ADMIN_ALLOWED_EMAILS') || '')
    .split(',').map(function (value) { return value.trim().toLowerCase(); }).filter(Boolean);
  if (!allowed.length || allowed.indexOf(email) < 0) throw new Error('ADMIN_ACCOUNT_NOT_ALLOWED');
}

function adminInvitationKey_(token) {
  if (!RsvpValidation.isToken(token)) return '';
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8)).replace(/=+$/, '');
}

function adminInvitationFromRow_(row, invitationKey) {
  var invitedGuestNames;
  try { invitedGuestNames = JSON.parse(String(row[3] || '[]')); } catch (e) { invitedGuestNames = null; }
  if (!Array.isArray(invitedGuestNames) || !invitedGuestNames.every(function (name) { return typeof name === 'string'; })) invitedGuestNames = null;
  return {
    invitationKey: invitationKey, primaryGuestName: String(row[1] || ''), invitedGuestNames: invitedGuestNames,
    maxGuests: row[4] === '' || row[4] == null || isNaN(Number(row[4])) ? null : Number(row[4]), active: row[5] === true || String(row[5]).toLowerCase() === 'true',
    createdAt: String(row[6] || ''), revokedAt: String(row[7] || '')
  };
}

function adminResponseFromRow_(row, invitationKey) {
  var guests;
  try { guests = JSON.parse(String(row[6] || '[]')); } catch (e) { guests = null; }
  if (!Array.isArray(guests)) guests = [];
  var attending = row[4] === true || String(row[4]).toLowerCase() === 'true' ? true
    : row[4] === false || String(row[4]).toLowerCase() === 'false' ? false : null;
  return {
    invitationKey: invitationKey, submittedAt: String(row[2] || ''), updatedAt: String(row[3] || ''),
    attending: attending, guests: guests.filter(function (guest) { return guest && typeof guest === 'object' && typeof guest.name === 'string'; }).map(function (guest) { return { name: guest.name }; }),
    dietaryRequirements: String(row[7] || ''), songRequest: String(row[8] || ''), message: String(row[9] || '')
  };
}

function findInvitation_(token) {
  if (!RsvpValidation.isToken(token)) return null;
  var rows = readSheetRange_('Invitations!A:H');
  for (var i = 1; i < rows.length; i++) if (String(rows[i][0]) === token) {
    return invitationFromRow_(rows[i]);
  }
  return null;
}

function invitationFromRow_(row) {
  var guests;
  try { guests = JSON.parse(String(row[3] || '[]')); } catch (e) { return null; }
  if (!Array.isArray(guests)) return null;
  return { invitationToken: String(row[0]), primaryGuestName: String(row[1]), email: String(row[2]), invitedGuestNames: guests, maxGuests: Number(row[4]), active: row[5] === true || String(row[5]).toLowerCase() === 'true' };
}

function responseFromRow_(row) {
  var guests;
  try { guests = JSON.parse(String(row[6] || '[]')); } catch (e) { guests = []; }
  if (!(row[4] === true || String(row[4]).toLowerCase() === 'true')) guests = [];
  return { invitationToken: String(row[0]), rsvpId: String(row[1]), submittedAt: String(row[2]), updatedAt: String(row[3]), attending: row[4] === true || String(row[4]).toLowerCase() === 'true', guests: guests, dietaryRequirements: String(row[7] || ''), songRequest: String(row[8] || ''), message: String(row[9] || '') };
}

function readSheetRange_(range) {
  var response = sheetsRequest_('get', 'values/' + encodeURIComponent(range));
  return response.values || [];
}

function readSheetRanges_(ranges) {
  var query = 'values:batchGet?' + ranges.map(function (range) { return 'ranges=' + encodeURIComponent(range); }).join('&');
  var response = sheetsRequest_('get', query);
  return (response.valueRanges || []).map(function (range) { return range.values || []; });
}

function writeSheetRow_(range, row) {
  sheetsRequest_('put', 'values/' + encodeURIComponent(range) + '?valueInputOption=RAW', { range: range, majorDimension: 'ROWS', values: [row] });
}

function appendSheetRow_(range, row) {
  sheetsRequest_('post', 'values/' + encodeURIComponent(range) + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { majorDimension: 'ROWS', values: [row] });
}

function ensureSpreadsheetReady_() {
  var properties = PropertiesService.getScriptProperties();
  var id = properties.getProperty('SPREADSHEET_ID');
  if (!id || !/^[A-Za-z0-9_-]{20,}$/.test(id)) throw new Error('RSVP sheet is not connected.');
  var cache = CacheService.getScriptCache();
  var cacheKey = 'RSVP_SHEET_READY_' + id;
  if (cache.get(cacheKey) === '1') return { id: id, name: properties.getProperty('SPREADSHEET_NAME') || '' };
  var token = googleAccessToken_();
  var metadata = googleApiRequest_(token, 'get', encodeURIComponent(id) + '?fields=spreadsheetId,properties(title),sheets(properties(title))');
  var names = (metadata.sheets || []).map(function (sheet) { return sheet.properties && sheet.properties.title; });
  if (names.indexOf('Invitations') < 0 || names.indexOf('Responses') < 0) throw new Error('Required RSVP tabs are missing.');
  var headers = googleApiRequest_(token, 'get', encodeURIComponent(id) + '/values:batchGet?ranges=' + encodeURIComponent('Invitations!A1:H1') + '&ranges=' + encodeURIComponent('Responses!A1:J1'));
  var ranges = headers.valueRanges || [];
  if (!sameHeaders_(ranges[0] && ranges[0].values && ranges[0].values[0], INVITATION_HEADERS) ||
      !sameHeaders_(ranges[1] && ranges[1].values && ranges[1].values[0], RESPONSE_HEADERS)) throw new Error('RSVP sheet headers do not match.');
  properties.setProperty('SPREADSHEET_NAME', String(metadata.properties && metadata.properties.title || ''));
  cache.put(cacheKey, '1', 300);
  return { id: id, name: String(metadata.properties && metadata.properties.title || '') };
}

function sameHeaders_(actual, expected) {
  return Array.isArray(actual) && expected.length === actual.length && expected.every(function (name, index) { return actual[index] === name; });
}

function sheetsRequest_(method, path, payload) {
  ensureSpreadsheetReady_();
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return googleApiRequest_(googleAccessToken_(), method, encodeURIComponent(id) + '/' + path, payload);
}

function googleApiRequest_(token, method, path, payload) {
  var response = UrlFetchApp.fetch(GOOGLE_SHEETS_API + path, {
    method: method,
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: payload ? JSON.stringify(payload) : undefined,
    muteHttpExceptions: true
  });
  var status = response.getResponseCode();
  var body = response.getContentText();
  if (status < 200 || status >= 300) throw new Error(mapGoogleError_(status, body));
  return body ? JSON.parse(body) : {};
}

function googleAccessToken_() {
  var properties = PropertiesService.getScriptProperties();
  var refreshToken = properties.getProperty('GOOGLE_REFRESH_TOKEN');
  if (!refreshToken) throw new Error('Google Sheet is not connected.');
  var expiresAt = Number(properties.getProperty('GOOGLE_ACCESS_TOKEN_EXPIRES_AT') || 0);
  var cached = properties.getProperty('GOOGLE_ACCESS_TOKEN');
  if (cached && Date.now() < expiresAt - 60000) return cached;
  console.info('RSVP_DIAG: Sheets token refresh started');
  var response = UrlFetchApp.fetch(GOOGLE_TOKEN_URL, {
    method: 'post',
    payload: {
      client_id: requiredProperty_('GOOGLE_CLIENT_ID'),
      client_secret: requiredProperty_('GOOGLE_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    },
    muteHttpExceptions: true
  });
  var status = response.getResponseCode();
  var body = response.getContentText();
  var result = parseJson_(body);
  if (status < 200 || status >= 300 || !result.access_token) {
    console.error(JSON.stringify({
      event: 'RSVP_SHEETS_OAUTH_REFRESH_FAILED',
      httpStatus: status,
      googleError: String(result.error || 'unknown')
    }));
  } else {
    console.info('RSVP_DIAG: Sheets token refresh succeeded');
  }

  if (status < 200 || status >= 300 || !result.access_token) {
    if (result.error === 'invalid_grant') {
      properties.deleteProperty('GOOGLE_REFRESH_TOKEN');
      properties.deleteProperty('GOOGLE_ACCESS_TOKEN');
      properties.deleteProperty('GOOGLE_ACCESS_TOKEN_EXPIRES_AT');
      throw new Error('Google authorization expired. Reconnect the RSVP Sheet.');
    }
    throw new Error('Unable to refresh Google authorization.');
  }
  properties.setProperty('GOOGLE_ACCESS_TOKEN', result.access_token);
  properties.setProperty('GOOGLE_ACCESS_TOKEN_EXPIRES_AT', String(Date.now() + Number(result.expires_in || 3600) * 1000));
  return result.access_token;
}

function mapGoogleError_(status, body) {
  var data = parseJson_(body);
  var reason = data.error && (data.error.status || data.error.message || data.error);
  if (status === 404) return 'The configured RSVP spreadsheet was not found or is not authorized.';
  if (status === 401 || status === 403) return 'The Google account no longer has access to the RSVP spreadsheet. Reconnect it.';
  if (status === 429 || status >= 500) return 'Google Sheets is temporarily unavailable. Try again later.';
  return 'Google Sheets request failed (' + status + (reason ? ': ' + String(reason).slice(0, 120) : '') + ').';
}

function parseJson_(text) {
  try { return JSON.parse(text || '{}'); } catch (e) { return {}; }
}

function requiredProperty_(key) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) throw new Error('Missing Script Property: ' + key);
  return value;
}

function oauthCallback(request) {
  var parameters = request && request.parameter || {};
  var properties = PropertiesService.getScriptProperties();
  var expectedNonce = properties.getProperty('OAUTH_PENDING_NONCE');
  if (!expectedNonce || !parameters.oauthNonce || parameters.oauthNonce !== expectedNonce) return oauthResultPage_('OAuth state could not be verified. Start the connection again.');
  properties.deleteProperty('OAUTH_PENDING_NONCE');
  if (parameters.error) return oauthResultPage_('Google authorization was denied. No connection was changed.');
  if (!parameters.code || !parameters.picked_file_ids) return oauthResultPage_('No spreadsheet was selected. No connection was changed.');
  var ids = String(parameters.picked_file_ids).split(',').filter(Boolean);
  if (ids.length !== 1 || !/^[A-Za-z0-9_-]{20,}$/.test(ids[0])) return oauthResultPage_('Select exactly one Google spreadsheet.');

  var tokenResponse = UrlFetchApp.fetch(GOOGLE_TOKEN_URL, {
    method: 'post',
    payload: {
      code: parameters.code,
      client_id: requiredProperty_('GOOGLE_CLIENT_ID'),
      client_secret: requiredProperty_('GOOGLE_CLIENT_SECRET'),
      redirect_uri: oauthRedirectUri_(),
      grant_type: 'authorization_code'
    },
    muteHttpExceptions: true
  });
  var token = parseJson_(tokenResponse.getContentText());
  if (tokenResponse.getResponseCode() < 200 || tokenResponse.getResponseCode() >= 300 || !token.access_token) return oauthResultPage_('Google authorization could not be completed. No connection was changed.');
  if (!token.refresh_token) return oauthResultPage_('Google did not return offline access. Reconnect and approve the requested access.');

  var sheet;
  try {
    sheet = verifySelectedSpreadsheet_(token.access_token, ids[0]);
  } catch (error) {
    revokeToken_(token.refresh_token);
    return oauthResultPage_(safeAdminError_(error));
  }
  properties.setProperty('GOOGLE_REFRESH_TOKEN', token.refresh_token);
  properties.setProperty('GOOGLE_ACCESS_TOKEN', token.access_token);
  properties.setProperty('GOOGLE_ACCESS_TOKEN_EXPIRES_AT', String(Date.now() + Number(token.expires_in || 3600) * 1000));
  properties.setProperty('SPREADSHEET_ID', ids[0]);
  properties.setProperty('SPREADSHEET_NAME', sheet.name);
  return oauthResultPage_('Connected to “' + escapeHtml_(sheet.name) + '”. You can close this tab and return to setup.');
}

function verifySelectedSpreadsheet_(accessToken, spreadsheetId) {
  var metadata = googleApiRequest_(accessToken, 'get', encodeURIComponent(spreadsheetId) + '?fields=spreadsheetId,properties(title),sheets(properties(title))');
  var names = (metadata.sheets || []).map(function (sheet) { return sheet.properties && sheet.properties.title; });
  if (names.indexOf('Invitations') < 0 || names.indexOf('Responses') < 0) throw new Error('The selected spreadsheet must contain Invitations and Responses tabs.');
  var headers = googleApiRequest_(accessToken, 'get', encodeURIComponent(spreadsheetId) + '/values:batchGet?ranges=' + encodeURIComponent('Invitations!A1:H1') + '&ranges=' + encodeURIComponent('Responses!A1:J1'));
  var ranges = headers.valueRanges || [];
  if (!sameHeaders_(ranges[0] && ranges[0].values && ranges[0].values[0], INVITATION_HEADERS) ||
      !sameHeaders_(ranges[1] && ranges[1].values && ranges[1].values[0], RESPONSE_HEADERS)) throw new Error('The selected spreadsheet headers do not match the RSVP format.');
  return { name: String(metadata.properties && metadata.properties.title || 'RSVP spreadsheet') };
}

function oauthResultPage_(message) {
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><title>RSVP Sheet connection</title><p>' + escapeHtml_(message) + '</p>');
}

function escapeHtml_(value) {
  return String(value).replace(/[&<>"']/g, function (character) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
  });
}

function oauthRedirectUri_() {
  var scriptId = ScriptApp.getScriptId();
  if (!scriptId) throw new Error('Apps Script ID is unavailable.');
  return 'https://script.google.com/macros/d/' + encodeURIComponent(scriptId) + '/usercallback';
}

function rsvpAdminGetStatus(passphrase) {
  requireAdmin_(passphrase);
  var properties = PropertiesService.getScriptProperties();
  var id = properties.getProperty('SPREADSHEET_ID');
  if (!id || !properties.getProperty('GOOGLE_REFRESH_TOKEN')) return { connected: false };
  try {
    var sheet = ensureSpreadsheetReady_();
    return { connected: true, spreadsheetName: sheet.name };
  } catch (error) {
    return { connected: false, spreadsheetName: properties.getProperty('SPREADSHEET_NAME') || '', error: safeAdminError_(error) };
  }
}

function rsvpAdminStartConnect(passphrase) {
  requireAdmin_(passphrase);
  var properties = PropertiesService.getScriptProperties();
  var clientId = requiredProperty_('GOOGLE_CLIENT_ID');
  requiredProperty_('GOOGLE_CLIENT_SECRET');
  var redirectUri = oauthRedirectUri_();
  var nonce = Utilities.getUuid();
  properties.setProperty('OAUTH_PENDING_NONCE', nonce);
  var state = ScriptApp.newStateToken().withMethod('oauthCallback').withArgument('oauthNonce', nonce).withTimeout(900).createToken();
  var params = {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: OAUTH_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    trigger_onepick: 'true',
    state: state
  };
  return { authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?' + Object.keys(params).map(function (key) { return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]); }).join('&') };
}

function rsvpAdminDisconnect(passphrase) {
  requireAdmin_(passphrase);
  var properties = PropertiesService.getScriptProperties();
  var refreshToken = properties.getProperty('GOOGLE_REFRESH_TOKEN');
  var authorizationRevoked = !refreshToken || revokeToken_(refreshToken);
  OAUTH_PROPERTY_KEYS.forEach(function (key) { properties.deleteProperty(key); });
  properties.deleteProperty('OAUTH_PENDING_NONCE');
  return { disconnected: true, authorizationRevoked: authorizationRevoked };
}

function requireAdmin_(passphrase) {
  var expected = requiredProperty_('ADMIN_SETUP_PASSPHRASE');
  if (typeof passphrase !== 'string' || !passphrase || passphrase !== expected) throw new Error('Admin authorization failed.');
}

function revokeToken_(token) {
  try {
    var response = UrlFetchApp.fetch(GOOGLE_REVOKE_URL, { method: 'post', payload: { token: token }, muteHttpExceptions: true });
    return response.getResponseCode() >= 200 && response.getResponseCode() < 300;
  } catch (e) {
    return false;
  }
}

function safeAdminError_(error) {
  var message = String(error && error.message || '');
  if (/headers do not match|tabs are missing|must contain Invitations/.test(message)) return message;
  if (/expired|Reconnect|not connected/i.test(message)) return 'Google authorization expired or is unavailable. Reconnect the Sheet.';
  if (/not found|not authorized|permission|forbidden|access/i.test(message)) return 'The selected spreadsheet could not be accessed by this application.';
  return 'The spreadsheet could not be verified. Check the selected file and required RSVP tabs and headers.';
}
