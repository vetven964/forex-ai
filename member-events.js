// Member event helpers are kept separate so notification formatting can evolve
// without exposing authentication secrets or password hashes.
function newMemberTelegramText(user) {
  return [
    '🆕 *V TRADE AI — NEW MEMBER*',
    '',
    '👤 Name: *' + String(user.name || '—') + '*',
    '📧 Email: *' + String(user.email || '—') + '*',
    '📦 Plan: *' + String(user.plan || 'FREE') + '*',
    '🟢 Status: *ACTIVE*',
    '🕒 Created: *' + String(user.createdAt || new Date().toISOString()) + '*'
  ].join('\n');
}
module.exports = { newMemberTelegramText };
