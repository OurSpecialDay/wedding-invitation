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
    label: 'Date',
    iso: '2026-12-28',
    display: '28 December 2026',
  },
  detailsTitle: 'Wedding details',
  schedule: {
    ceremony: {
      label: 'Guest Arrival',
      time: '9.00am',
    },
    reception: {
      label: 'Poruwa Ceremony',
      time: '9.45am',
    },
  },
  venue: {
    label: 'Location',
    room: 'The Oak Room',
    hotel: 'Cinnamon Grand Colombo',
    website: 'https://www.cinnamonhotels.com/cinnamon-grand-colombo/weddings-and-events/the-oak-room',
    map: 'https://maps.app.goo.gl/t4U2fRi4BbbqfoXp7',
  },
} as const

export const coupleDisplayName = `${wedding.couple.bride.displayName} & ${wedding.couple.groom.displayName}`
export const coupleFullNames = `${wedding.couple.bride.fullName} & ${wedding.couple.groom.fullName}`
