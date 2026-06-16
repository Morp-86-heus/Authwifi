/* eslint-disable @typescript-eslint/no-explicit-any */
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const NUMERIC_TO_ALPHA2: Record<string, string> = {
  '004':'AF','008':'AL','012':'DZ','024':'AO','032':'AR','036':'AU','040':'AT',
  '050':'BD','056':'BE','068':'BO','076':'BR','100':'BG','116':'KH','120':'CM',
  '124':'CA','152':'CL','156':'CN','170':'CO','188':'CR','191':'HR','192':'CU',
  '203':'CZ','208':'DK','218':'EC','818':'EG','231':'ET','246':'FI','250':'FR',
  '276':'DE','288':'GH','300':'GR','320':'GT','332':'HT','340':'HN','348':'HU',
  '356':'IN','360':'ID','364':'IR','368':'IQ','372':'IE','376':'IL','380':'IT',
  '388':'JM','392':'JP','400':'JO','404':'KE','410':'KR','414':'KW','422':'LB',
  '434':'LY','458':'MY','484':'MX','504':'MA','508':'MZ','524':'NP','528':'NL',
  '554':'NZ','566':'NG','578':'NO','586':'PK','591':'PA','604':'PE','608':'PH',
  '616':'PL','620':'PT','630':'PR','642':'RO','643':'RU','682':'SA','686':'SN',
  '694':'SL','706':'SO','710':'ZA','724':'ES','752':'SE','756':'CH','760':'SY',
  '158':'TW','764':'TH','788':'TN','792':'TR','800':'UG','804':'UA','784':'AE',
  '826':'GB','840':'US','858':'UY','862':'VE','704':'VN','887':'YE','894':'ZM',
  '716':'ZW','703':'SK','705':'SI','070':'BA',
};

interface Props {
  countries: { country: string; count: number }[];
}

export default function WorldMap({ countries }: Props) {
  const maxCount = Math.max(...countries.map((c) => c.count), 1);
  const colorScale = scaleLinear<string>()
    .domain([0, maxCount])
    .range(['#bfdbfe', '#1d4ed8']);

  const countByAlpha2 = new Map(countries.map((c) => [c.country, c.count]));

  return (
    <ComposableMap
      projection="geoMercator"
      projectionConfig={{ scale: 120, center: [10, 20] }}
      style={{ width: '100%', height: '100%' }}
    >
      <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={4}>
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo: any) => {
              const numericId = String(geo.id).padStart(3, '0');
              const alpha2 = NUMERIC_TO_ALPHA2[numericId];
              const count = alpha2 ? (countByAlpha2.get(alpha2) ?? 0) : 0;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={count > 0 ? colorScale(count) : '#e5e7eb'}
                  stroke="#fff"
                  strokeWidth={0.4}
                  style={{
                    default: { outline: 'none' },
                    hover: {
                      fill: count > 0 ? '#1e40af' : '#d1d5db',
                      outline: 'none',
                      cursor: count > 0 ? 'pointer' : 'default',
                    },
                    pressed: { outline: 'none' },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ZoomableGroup>
    </ComposableMap>
  );
}
