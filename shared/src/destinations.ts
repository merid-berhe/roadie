export type RoadTheme = 'desert' | 'coast' | 'mountain' | 'city';

export type Destination = {
  id: string;
  name: string;
  country: string;
  region: string;
  lat: number;
  lon: number;
  theme: RoadTheme;
  tags: string[];
  fact: string;
  factSourceTitle: string;
  factSourceUrl: string;
  promptFlavor: string;
};

export const DESTINATIONS: Destination[] = [
  {
    id: 'big-sur-ca',
    name: 'Big Sur',
    country: 'United States',
    region: 'California',
    lat: 36.2704,
    lon: -121.8081,
    theme: 'coast',
    tags: ['cliffs', 'pacific', 'highway'],
    fact: 'Big Sur is a rugged stretch of California coast where the Santa Lucia Mountains rise directly from the Pacific.',
    factSourceTitle: 'California State Parks - Big Sur',
    factSourceUrl: 'https://www.parks.ca.gov/?page_id=570',
    promptFlavor: 'a cliffside Pacific road with salt air, wide turns, and late sun',
  },
  {
    id: 'chefchaouen-ma',
    name: 'Chefchaouen',
    country: 'Morocco',
    region: 'Tangier-Tetouan-Al Hoceima',
    lat: 35.1688,
    lon: -5.2636,
    theme: 'mountain',
    tags: ['rif-mountains', 'blue-city', 'medina'],
    fact: 'Chefchaouen sits in the Rif Mountains and is known for the blue-painted lanes of its old medina.',
    factSourceTitle: 'UNESCO World Heritage Centre - Chefchaouen Medina',
    factSourceUrl: 'https://whc.unesco.org/en/tentativelists/6063/',
    promptFlavor: 'a blue mountain medina road with soft echoes and close stone alleys',
  },
  {
    id: 'seligman-route-66-us',
    name: 'Route 66 near Seligman',
    country: 'United States',
    region: 'Arizona',
    lat: 35.3256,
    lon: -112.8741,
    theme: 'desert',
    tags: ['desert', 'route-66', 'americana'],
    fact: 'Seligman helped preserve historic Route 66 culture after interstate traffic bypassed many Arizona main streets.',
    factSourceTitle: 'National Park Service - Route 66 Corridor Preservation',
    factSourceUrl: 'https://www.nps.gov/subjects/travelroute66/index.htm',
    promptFlavor: 'a dusty Route 66 desert cruise with neon motel signs and open horizon',
  },
  {
    id: 'lofoten-no',
    name: 'Lofoten',
    country: 'Norway',
    region: 'Nordland',
    lat: 68.2096,
    lon: 13.9578,
    theme: 'coast',
    tags: ['islands', 'arctic', 'fishing-villages'],
    fact: 'Lofoten is an Arctic island chain known for sharp mountains, sheltered bays, and fishing villages.',
    factSourceTitle: 'Visit Norway - Lofoten',
    factSourceUrl: 'https://www.visitnorway.com/places-to-go/northern-norway/the-lofoten-islands/',
    promptFlavor: 'an Arctic island road beside cold water, red cabins, and jagged peaks',
  },
  {
    id: 'kyoto-jp',
    name: 'Kyoto',
    country: 'Japan',
    region: 'Kansai',
    lat: 35.0116,
    lon: 135.7681,
    theme: 'city',
    tags: ['temples', 'lanterns', 'old-streets'],
    fact: "Kyoto was Japan's imperial capital for more than a thousand years and is known for historic temples and gardens.",
    factSourceTitle: 'UNESCO World Heritage Centre - Historic Monuments of Ancient Kyoto',
    factSourceUrl: 'https://whc.unesco.org/en/list/688/',
    promptFlavor: 'a quiet lantern-lit city ride past old wooden streets and garden walls',
  },
  {
    id: 'atacama-cl',
    name: 'Atacama Desert',
    country: 'Chile',
    region: 'Antofagasta',
    lat: -23.8634,
    lon: -69.1328,
    theme: 'desert',
    tags: ['desert', 'salt-flats', 'stars'],
    fact: 'The Atacama is one of the driest non-polar deserts on Earth and a major site for astronomy observatories.',
    factSourceTitle: 'European Southern Observatory - Atacama Desert',
    factSourceUrl: 'https://www.eso.org/public/teles-instr/sites/atacama/',
    promptFlavor: 'a high desert night drive under huge stars and pale salt flats',
  },
  {
    id: 'amalfi-it',
    name: 'Amalfi Coast',
    country: 'Italy',
    region: 'Campania',
    lat: 40.6333,
    lon: 14.6029,
    theme: 'coast',
    tags: ['coast', 'villages', 'switchbacks'],
    fact: 'The Amalfi Coast is a UNESCO-listed cultural landscape of steep coastal towns, terraces, and winding roads.',
    factSourceTitle: 'UNESCO World Heritage Centre - Costiera Amalfitana',
    factSourceUrl: 'https://whc.unesco.org/en/list/830/',
    promptFlavor: 'a bright Mediterranean switchback road above terraced towns and blue water',
  },
  {
    id: 'banff-ca',
    name: 'Banff National Park',
    country: 'Canada',
    region: 'Alberta',
    lat: 51.4968,
    lon: -115.9281,
    theme: 'mountain',
    tags: ['rockies', 'lakes', 'forests'],
    fact: "Banff is Canada's first national park and protects mountain landscapes in the Canadian Rockies.",
    factSourceTitle: 'Parks Canada - Banff National Park',
    factSourceUrl: 'https://parks.canada.ca/pn-np/ab/banff',
    promptFlavor: 'a Rockies mountain road with blue lakes, dark pines, and clean cold air',
  },
];

// v7.0 — destinations are now BARS on the world map. A room code carries the
// chosen bar as a prefix: `<barId>__<random>` (the map / invite link encodes it).
// We resolve that bar; if the code has no valid bar prefix, we fall back to a
// stable hash so legacy/standalone codes still get a bar.
export function destinationById(id: string | null | undefined): Destination | undefined {
  return DESTINATIONS.find((d) => d.id === id);
}

export function barIdFromRoom(roomCode: string): string | null {
  const prefix = roomCode.split('__')[0];
  return destinationById(prefix) ? prefix : null;
}

export function pickDestinationForRoom(roomCode: string): Destination {
  const barId = barIdFromRoom(roomCode);
  if (barId) return destinationById(barId)!;
  let hash = 2166136261;
  for (let i = 0; i < roomCode.length; i++) {
    hash ^= roomCode.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return DESTINATIONS[(hash >>> 0) % DESTINATIONS.length];
}

/** Bars are the map locations. (Alias of DESTINATIONS during the v7 refactor.) */
export const BARS = DESTINATIONS;
