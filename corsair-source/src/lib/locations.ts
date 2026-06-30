export interface CityLocation {
  city:        string;
  slug:        string;
  state:       string;
  county:      string;
  description: string;
  nearbyAreas: string[];
}

export const TX_LOCATIONS: CityLocation[] = [
  { city: 'Dallas',       slug: 'dallas',       state: 'TX', county: 'Dallas County',           description: "North Texas's largest city and commercial hub",             nearbyAreas: ['Addison', 'Farmers Branch', 'University Park', 'Highland Park'] },
  { city: 'Fort Worth',   slug: 'fort-worth',   state: 'TX', county: 'Tarrant County',          description: "the cultural heart of Cowtown and Tarrant County",          nearbyAreas: ['Haltom City', 'Richland Hills', 'White Settlement', 'Benbrook'] },
  { city: 'Plano',        slug: 'plano',        state: 'TX', county: 'Collin County',           description: "one of the fastest-growing cities in North Texas",          nearbyAreas: ['Allen', 'Murphy', 'Wylie', 'Parker'] },
  { city: 'Arlington',    slug: 'arlington',    state: 'TX', county: 'Tarrant County',          description: "DFW's entertainment and business center",                   nearbyAreas: ['Mansfield', 'Grand Prairie', 'Kennedale', 'Pantego'] },
  { city: 'Garland',      slug: 'garland',      state: 'TX', county: 'Dallas County',           description: "a major Dallas suburb with diverse communities",            nearbyAreas: ['Rowlett', 'Sachse', 'Sunnyvale', 'Mesquite'] },
  { city: 'Irving',       slug: 'irving',       state: 'TX', county: 'Dallas County',           description: "home to DFW Airport and Las Colinas business district",     nearbyAreas: ['Coppell', 'Carrollton', 'Euless', 'Grand Prairie'] },
  { city: 'McKinney',     slug: 'mckinney',     state: 'TX', county: 'Collin County',           description: "one of the fastest-growing cities in the United States",   nearbyAreas: ['Prosper', 'Celina', 'Frisco', 'Princeton'] },
  { city: 'Frisco',       slug: 'frisco',       state: 'TX', county: 'Collin County',           description: "North Texas's premiere sports and corporate destination",   nearbyAreas: ['Little Elm', 'The Colony', 'Prosper', 'Allen'] },
  { city: 'Denton',       slug: 'denton',       state: 'TX', county: 'Denton County',           description: "home to UNT and TWU — a growing university city",           nearbyAreas: ['Lewisville', 'Flower Mound', 'Highland Village', 'Corinth'] },
  { city: 'Grand Prairie',slug: 'grand-prairie',state: 'TX', county: 'Dallas/Tarrant County',   description: "centrally located between Dallas and Fort Worth",            nearbyAreas: ['Duncanville', 'Cedar Hill', 'DeSoto', 'Lancaster'] },
];

export function getLocation(slug: string): CityLocation | undefined {
  return TX_LOCATIONS.find((l) => l.slug === slug);
}
