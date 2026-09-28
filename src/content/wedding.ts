export const wedding = {
  couple: {
    bride: {
      fullName: 'Thushara Ediriweera',
      displayName: 'Thushara',
    },
    groom: {
      fullName: 'Dakshin Abeykoon',
      displayName: 'Dakshin',
    },
  },
  date: {
    iso: '2026-12-28',
    display: '28 December 2026',
  },
  ceremonyTime: 'Time to be confirmed',
  receptionTime: 'Time to be confirmed',
  venue: {
    room: 'The Oak Room',
    hotel: 'Cinnamon Grand Colombo',
    website: 'https://www.cinnamonhotels.com/cinnamon-grand-colombo/weddings-and-events/the-oak-room',
    map: 'https://maps.app.goo.gl/t4U2fRi4BbbqfoXp7',
  },
} as const

export const coupleDisplayName = `${wedding.couple.bride.displayName} & ${wedding.couple.groom.displayName}`
export const coupleFullNames = `${wedding.couple.bride.fullName} & ${wedding.couple.groom.fullName}`
