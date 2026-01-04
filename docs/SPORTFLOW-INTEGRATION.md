# SportFlow Booking - Lisensserver Integrasjon

Dette dokumentet beskriver endringene i lisensserveren som påvirker SportFlow Booking-appen.

## 📋 Oversikt over endringer

### 1. Modulbasert lisenssystem
- Booking er **ikke lenger en modul** - det er kjernefunksjonalitet som alltid er inkludert (unntatt inaktiv lisens)
- Tilleggsmoduler kan aktiveres per organisasjon (f.eks. "Pris & Betaling")
- Moduler har egne priser som legges til base-prisen

### 2. Prising
- Alle lisens-typer har nå en månedspris
- Tilleggsmoduler har egne priser
- Total månedspris = base-pris (lisens-type) + sum av aktive moduler

### 3. Nye API-endpoints
- `/api/license/pricing` - Hent prisinformasjon for en organisasjon

### 4. Oppdaterte API-responser
- `/api/license/validate` inkluderer nå prisinformasjon og moduler

---

## 🔌 API Endpoints

### POST `/api/license/validate`

Validerer lisens og returnerer informasjon om tilgjengelige moduler og priser.

**Request:**
```json
{
  "licenseKey": "clxxxxxxxxxxxx",
  "appVersion": "1.0.0",
  "stats": {
    "userCount": 45,
    "bookingCount": 1230
  }
}
```

**Response (Aktiv lisens):**
```json
{
  "valid": true,
  "status": "active",
  "organization": "Haugesund IL",
  "licenseType": "standard",
  "licenseTypeName": "Standard",
  "expiresAt": "2025-12-31T23:59:59.000Z",
  "daysUntilExpiry": 380,
  "limits": {
    "maxUsers": 50,
    "maxResources": 10
  },
  "features": {
    "emailNotifications": true,
    "customBranding": true,
    "prioritySupport": false
  },
  "modules": {
    "booking": true,        // Alltid true (unntatt inaktiv)
    "pricing": true         // Hvis aktivert
  },
  "pricing": {
    "basePrice": 299,       // Pris for lisens-type
    "totalMonthlyPrice": 398, // Total (base + moduler)
    "moduleCount": 1        // Antall aktive moduler (ekskluderer booking)
  },
  "showRenewalWarning": false
}
```

**Response (Grace period):**
```json
{
  "valid": true,
  "status": "grace",
  "organization": "Haugesund IL",
  "licenseType": "standard",
  "licenseTypeName": "Standard",
  "graceMode": true,
  "daysLeft": 7,
  "message": "Abonnementet har utløpt. 7 dager igjen av grace period.",
  "modules": {
    "booking": true,
    "pricing": true
  },
  "pricing": {
    "basePrice": 299,
    "totalMonthlyPrice": 398,
    "moduleCount": 1
  },
  "restrictions": {
    "readOnly": false,
    "showWarning": true,
    "canCreateBookings": true,
    "canCreateUsers": false
  }
}
```

---

### GET `/api/license/pricing?licenseKey=xxx`

Henter detaljert prisinformasjon for en organisasjon. Brukes for å vise priser i admin-dashboard.

**Request:**
```
GET /api/license/pricing?licenseKey=clxxxxxxxxxxxx
```

**Response:**
```json
{
  "licenseKey": "clxxxxxxxxxxxx",
  "organization": "Haugesund IL",
  "pricing": {
    "licenseType": "standard",
    "licenseTypeName": "Standard",
    "basePrice": 299,
    "modules": [
      {
        "key": "booking",
        "name": "Booking",
        "price": 0,
        "isStandard": true
      },
      {
        "key": "pricing",
        "name": "Pris & Betaling",
        "price": 99,
        "isStandard": false
      }
    ],
    "modulePrice": 99,
    "totalMonthlyPrice": 398
  }
}
```

---

## 📦 Moduler

### Booking (Kjernefunksjonalitet)
- **Key:** `booking`
- **Status:** Alltid inkludert (unntatt inaktiv lisens)
- **Pris:** 0 kr (inkludert i base-prisen)
- **Ikke en modul:** Booking er kjernefunksjonalitet, ikke en tilleggsmodul

### Tilleggsmoduler
Disse kan aktiveres/deaktiveres per organisasjon:

#### Pris & Betaling
- **Key:** `pricing`
- **Beskrivelse:** Pris og betalingshåndtering for bookingene
- **Standard pris:** 99 kr/mnd (kan endres i admin-panel)

---

## 💰 Lisens-typer og priser

| Lisens-type | Navn | Base-pris | Beskrivelse |
|------------|------|-----------|-------------|
| `inactive` | Inaktiv | 0 kr/mnd | Ingen tilgang |
| `pilot` | Pilotkunde | 0 kr/mnd | Full funksjonalitet, gratis for testing |
| `free` | Prøveperiode | 0 kr/mnd | Begrenset funksjonalitet, evig gratis |
| `standard` | Standard | 299 kr/mnd | Full booking-funksjonalitet |

**Merk:** Priser kan endres i admin-panelet på lisensserveren.

---

## 🔧 Implementasjonsguide for SportFlow Booking

### 1. Sjekk tilgjengelige moduler

Etter å ha validert lisensen, sjekk `modules`-objektet for å se hvilke funksjoner som er tilgjengelige:

```typescript
const response = await fetch(`${LICENSE_SERVER_URL}/api/license/validate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    licenseKey: process.env.LICENSE_KEY,
    appVersion: APP_VERSION,
    stats: {
      userCount: currentUserCount,
      bookingCount: currentBookingCount
    }
  })
});

const data = await response.json();

if (data.valid && data.status === "active") {
  // Sjekk om pricing-modulen er aktivert
  if (data.modules.pricing) {
    // Vis pris & betalings-funksjonalitet
    enablePricingFeatures();
  }
  
  // Booking er alltid tilgjengelig (unntatt inaktiv)
  // data.modules.booking vil alltid være true for aktive lisenser
}
```

### 2. Vis prisinformasjon i admin-dashboard

```typescript
// Hent prisinformasjon
const pricingResponse = await fetch(
  `${LICENSE_SERVER_URL}/api/license/pricing?licenseKey=${process.env.LICENSE_KEY}`
);
const pricingData = await pricingResponse.json();

// Vis i admin-dashboard
console.log(`Lisens-type: ${pricingData.pricing.licenseTypeName}`);
console.log(`Base-pris: ${pricingData.pricing.basePrice} kr/mnd`);
console.log(`Total månedspris: ${pricingData.pricing.totalMonthlyPrice} kr/mnd`);

// Vis moduler
pricingData.pricing.modules.forEach(module => {
  console.log(`${module.name}: ${module.price} kr/mnd`);
});
```

### 3. Håndter modul-tilgjengelighet

```typescript
// Eksempel: Sjekk om pricing-modulen er aktivert
function canUsePricing(): boolean {
  const licenseData = getLicenseData(); // Din funksjon for å hente lisensdata
  return licenseData?.modules?.pricing === true;
}

// Bruk i komponenter
{canUsePricing() && (
  <PricingModule />
)}
```

### 4. Vis prisoversikt

```typescript
// Eksempel: Vis månedspris i admin-dashboard
function PricingOverview() {
  const [pricing, setPricing] = useState(null);
  
  useEffect(() => {
    fetch(`${LICENSE_SERVER_URL}/api/license/pricing?licenseKey=${LICENSE_KEY}`)
      .then(res => res.json())
      .then(data => setPricing(data.pricing));
  }, []);
  
  if (!pricing) return <div>Laster...</div>;
  
  return (
    <div>
      <h3>Abonnement</h3>
      <p>{pricing.licenseTypeName}</p>
      <p>Base-pris: {pricing.basePrice} kr/mnd</p>
      {pricing.modules.filter(m => m.price > 0).map(module => (
        <p key={module.key}>
          {module.name}: +{module.price} kr/mnd
        </p>
      ))}
      <p><strong>Total: {pricing.totalMonthlyPrice} kr/mnd</strong></p>
    </div>
  );
}
```

---

## ⚠️ Breaking Changes

### Booking er ikke lenger en modul
- **Før:** Booking var en modul som måtte aktiveres
- **Nå:** Booking er alltid tilgjengelig (unntatt inaktiv lisens)
- **Handling:** Sjekk `modules.booking` i API-responsen, men forvent at den alltid er `true` for aktive lisenser

### Prising er nå inkludert
- **Før:** Ingen prisinformasjon i API-responser
- **Nå:** `pricing`-objekt inkludert i validate-responsen
- **Handling:** Oppdater koden til å håndtere `pricing`-objektet

---

## 📝 Eksempel på komplett integrasjon

```typescript
// lib/license.ts
const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL;

export async function validateLicense() {
  const response = await fetch(`${LICENSE_SERVER_URL}/api/license/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      licenseKey: process.env.LICENSE_KEY,
      appVersion: process.env.APP_VERSION,
      stats: {
        userCount: await getUserCount(),
        bookingCount: await getBookingCount()
      }
    })
  });
  
  return await response.json();
}

export async function getPricing() {
  const response = await fetch(
    `${LICENSE_SERVER_URL}/api/license/pricing?licenseKey=${process.env.LICENSE_KEY}`
  );
  return await response.json();
}

// app/admin/dashboard/page.tsx
export default function AdminDashboard() {
  const [license, setLicense] = useState(null);
  const [pricing, setPricing] = useState(null);
  
  useEffect(() => {
    validateLicense().then(setLicense);
    getPricing().then(data => setPricing(data.pricing));
  }, []);
  
  if (!license || !pricing) return <div>Laster...</div>;
  
  return (
    <div>
      <h1>Admin Dashboard</h1>
      
      {/* Lisens-info */}
      <div>
        <h2>Lisens</h2>
        <p>Type: {license.licenseTypeName}</p>
        <p>Status: {license.status}</p>
        <p>Utløper: {new Date(license.expiresAt).toLocaleDateString()}</p>
      </div>
      
      {/* Prisoversikt */}
      <div>
        <h2>Abonnement</h2>
        <p>Base-pris: {pricing.basePrice} kr/mnd</p>
        {pricing.modules
          .filter(m => m.price > 0)
          .map(module => (
            <p key={module.key}>
              {module.name}: +{module.price} kr/mnd
            </p>
          ))}
        <p><strong>Total: {pricing.totalMonthlyPrice} kr/mnd</strong></p>
      </div>
      
      {/* Moduler */}
      <div>
        <h2>Tilgjengelige funksjoner</h2>
        <p>✅ Booking (alltid inkludert)</p>
        {license.modules.pricing && (
          <p>✅ Pris & Betaling</p>
        )}
      </div>
    </div>
  );
}
```

---

## 🔗 Miljøvariabler

Legg til i `.env` for SportFlow Booking:

```env
# Lisensserver
LICENSE_SERVER_URL="https://sportflow-lisence-server.vercel.app"
LICENSE_KEY="clxxxxxxxxxxxx"  # Fra lisensserveren
```

---

## 📞 Support

Hvis du har spørsmål om integrasjonen, kontakt lisensserver-administratoren.


