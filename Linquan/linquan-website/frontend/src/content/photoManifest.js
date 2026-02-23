const PHOTO_ROOT = '/photos';

export const dashboardHeroPhoto = {
  src: `${PHOTO_ROOT}/hero/home-hero.jpg`,
  fallback:
    'https://images.unsplash.com/photo-1514119412350-e174d90d280e?auto=format&fit=crop&w=1800&q=80'
};

export const linquanGalleryCards = [
  {
    id: 'club-room-324',
    src: `${PHOTO_ROOT}/club/room-324.jpg`,
    fallback:
      'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=1400&q=80',
    titleKey: 'dashboard.photoRoom324Title',
    descriptionKey: 'dashboard.photoRoom324Description',
    altKey: 'dashboard.photoRoom324Alt'
  },
  {
    id: 'club-room-325',
    src: `${PHOTO_ROOT}/club/room-325.jpg`,
    fallback:
      'https://images.unsplash.com/photo-1507838153414-b4b713384a76?auto=format&fit=crop&w=1400&q=80',
    titleKey: 'dashboard.photoRoom325Title',
    descriptionKey: 'dashboard.photoRoom325Description',
    altKey: 'dashboard.photoRoom325Alt'
  },
  {
    id: 'events-rehearsal',
    src: `${PHOTO_ROOT}/events/rehearsal.jpg`,
    fallback:
      'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1400&q=80',
    titleKey: 'dashboard.photoRehearsalTitle',
    descriptionKey: 'dashboard.photoRehearsalDescription',
    altKey: 'dashboard.photoRehearsalAlt'
  },
  {
    id: 'events-workshop',
    src: `${PHOTO_ROOT}/events/workshop.jpg`,
    fallback:
      'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=1400&q=80',
    titleKey: 'dashboard.photoWorkshopTitle',
    descriptionKey: 'dashboard.photoWorkshopDescription',
    altKey: 'dashboard.photoWorkshopAlt'
  },
  {
    id: 'concert-stage',
    src: `${PHOTO_ROOT}/concerts/stage.jpg`,
    fallback:
      'https://images.unsplash.com/photo-1464375117522-1311d6a5b81f?auto=format&fit=crop&w=1400&q=80',
    titleKey: 'dashboard.photoStageTitle',
    descriptionKey: 'dashboard.photoStageDescription',
    altKey: 'dashboard.photoStageAlt'
  },
  {
    id: 'concert-group',
    src: `${PHOTO_ROOT}/concerts/group-photo.jpg`,
    fallback:
      'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1400&q=80',
    titleKey: 'dashboard.photoGroupTitle',
    descriptionKey: 'dashboard.photoGroupDescription',
    altKey: 'dashboard.photoGroupAlt'
  }
];

export const dashboardPhotoCards = linquanGalleryCards;
