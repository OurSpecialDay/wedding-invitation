var RsvpValidation = (function () {
  var LIMITS = { maxGuests: 20, name: 100, dietary: 500, song: 120, message: 1000 };
  function isToken(token) { return typeof token === 'string' && /^[A-Za-z0-9_-]{32}$/.test(token); }
  function validate(invitation, rsvp) {
    var errors = [];
    if (!invitation || invitation.active !== true) return ['invitation'];
    if (!Number.isInteger(invitation.maxGuests) || invitation.maxGuests < 1 || invitation.maxGuests > LIMITS.maxGuests) errors.push('limit');
    var listedGuests = invitation.invitedGuestNames || [];
    var participants = listedGuests.length ? listedGuests : [invitation.primaryGuestName];
    if ([invitation.primaryGuestName].concat(listedGuests).some(function (name) { return typeof name !== 'string' || !name.trim() || name.length > LIMITS.name; })) errors.push('invitationNames');
    if (participants.length > invitation.maxGuests) errors.push('invitationLimit');
    if (!rsvp || typeof rsvp.attending !== 'boolean' || !Array.isArray(rsvp.guests)) errors.push('structure');
    else if (rsvp.attending) {
      if (!rsvp.guests.length || rsvp.guests.length > invitation.maxGuests) errors.push('guests');
      var seen = {};
      var additional = 0;
      rsvp.guests.forEach(function (guest) {
        var name = guest && typeof guest.name === 'string' ? guest.name.trim() : '';
        if (!name || name.length > LIMITS.name) errors.push('name');
        var key = name.toLocaleLowerCase();
        if (seen[key]) errors.push('duplicate');
        seen[key] = true;
        if (participants.every(function (entry) { return entry.trim().toLocaleLowerCase() !== key; })) additional += 1;
      });
      if (additional > invitation.maxGuests - participants.length) errors.push('extraGuests');
    } else if (rsvp.guests.length) errors.push('declineGuests');
    [['dietaryRequirements', LIMITS.dietary], ['songRequest', LIMITS.song], ['message', LIMITS.message]].forEach(function (pair) {
      if (typeof rsvp[pair[0]] !== 'string' || rsvp[pair[0]].length > pair[1]) errors.push(pair[0]);
    });
    if (rsvp.honeypot) errors.push('spam');
    return errors;
  }
  return { LIMITS: LIMITS, isToken: isToken, validate: validate };
}());
