const STREETS_RESOURCE_ID = '9ad3862c-8391-4b2f-84a4-2d4c68625f4b';
const GOV_DATA_API = '/gov-data-api/api/3/action/datastore_search';

interface GovStreetRecord {
  שם_ישוב: string;
  סמל_ישוב: number;
  שם_רחוב: string;
  סמל_רחוב: number;
}

export interface AddressSuggestion {
  streetName: string;
  cityName: string;
  cityCode: number;
  streetCode: number;
  displayText: string; // "שם_רחוב, שם_ישוב"
}

interface GovDataResponse {
  success: boolean;
  result: {
    records: GovStreetRecord[];
    total: number;
  };
}

// data.gov.il uses different spellings than the food prices DB delivery coverage table.
// Normalize to match the DB convention.
const CITY_NAME_NORMALIZATIONS: Record<string, string> = {
  // קרית (single yod) → קריית (double yod)
  'קרית אונו': 'קריית אונו',
  'קרית גת': 'קריית גת',
  'קרית טבעון': 'קריית טבעון',
  'קרית יערים': 'קריית יערים',
  'קרית ספר': 'קריית ספר',
  'קרית אתא': 'קריית אתא',
  'קרית ביאליק': 'קריית ביאליק',
  'קרית חיים': 'קריית חיים',
  'קרית ים': 'קריית ים',
  'קרית מוצקין': 'קריית מוצקין',
  'קרית מלאכי': 'קריית מלאכי',
  'קרית שמונה': 'קריית שמונה',
  'קרית עקרון': 'קריית עקרון',
  // נהריה (single yod) → נהרייה (double yod)
  'נהריה': 'נהרייה',
};

function normalizeCityName(city: string): string {
  return CITY_NAME_NORMALIZATIONS[city] || city;
}

export async function searchAddresses(query: string, limit = 10): Promise<AddressSuggestion[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({
    resource_id: STREETS_RESOURCE_ID,
    q: query.trim(),
    limit: String(limit),
  });

  const res = await fetch(`${GOV_DATA_API}?${params}`);
  if (!res.ok) throw new Error(`Gov data API error: ${res.status}`);

  const data: GovDataResponse = await res.json();
  if (!data.success || !data.result?.records) return [];

  // Deduplicate by street+city pair
  const seen = new Set<string>();
  const suggestions: AddressSuggestion[] = [];

  for (const record of data.result.records) {
    const rawCity = record.שם_ישוב?.trim();
    const street = record.שם_רחוב?.trim();
    if (!rawCity) continue;
    const city = normalizeCityName(rawCity);

    const key = `${street || ''}|${city}`;
    if (seen.has(key)) continue;
    seen.add(key);

    suggestions.push({
      streetName: street || '',
      cityName: city,
      cityCode: record.סמל_ישוב,
      streetCode: record.סמל_רחוב || 0,
      displayText: street ? `${street}, ${city}` : city,
    });
  }

  return suggestions;
}
