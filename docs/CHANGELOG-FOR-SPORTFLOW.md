# Endringer i Lisensserver - Oppsummering for SportFlow Booking

## 🎯 Hovedendringer

### 1. Modulbasert lisenssystem
- **Booking er ikke lenger en modul** - det er kjernefunksjonalitet som alltid er inkludert (unntatt inaktiv lisens)
- Tilleggsmoduler kan aktiveres per organisasjon (f.eks. "Pris & Betaling")
- Moduler har egne priser som legges til base-prisen

### 2. Prising
- Alle lisens-typer har nå en månedspris
- Tilleggsmoduler har egne priser
- Total månedspris = base-pris (lisens-type) + sum av aktive moduler

---

## 🔄 Endringer i API-responser

### POST `/api/license/validate`

**Nye felter i responsen:**

```json
{
  "valid": true,
  "status": "active",
  "licenseType": "standard",
  "licenseTypeName": "Standard",  // ✨ NYTT
  "modules": {                    // ✨ NYTT
    "booking": true,              // Alltid true (unntatt inaktiv)
    "pricing": true               // Hvis aktivert
  },
  "pricing": {                    // ✨ NYTT
    "basePrice": 299,
    "totalMonthlyPrice": 398,
    "moduleCount": 1
  },
  // ... eksisterende felter
}
```

---

## 🆕 Nytt API-endpoint

### GET `/api/license/pricing?licenseKey=xxx`

Henter detaljert prisinformasjon for visning i admin-dashboard.

**Eksempel:**
```typescript
const response = await fetch(
  `${LICENSE_SERVER_URL}/api/license/pricing?licenseKey=${LICENSE_KEY}`
);
const data = await response.json();

// data.pricing.totalMonthlyPrice = 398 kr/mnd
// data.pricing.modules = [{ key: "booking", name: "Booking", price: 0 }, ...]
```

---

## 📝 Hva må oppdateres i SportFlow Booking?

### 1. Håndter moduler i koden

```typescript
// Sjekk om pricing-modulen er aktivert
if (licenseData.modules?.pricing) {
  // Vis pris & betalings-funksjonalitet
  enablePricingFeatures();
}

// Booking er alltid tilgjengelig (unntatt inaktiv)
// licenseData.modules.booking vil alltid være true for aktive lisenser
```

### 2. Vis prisinformasjon i admin-dashboard

```typescript
// Hent prisinformasjon
const pricing = await fetch(
  `${LICENSE_SERVER_URL}/api/license/pricing?licenseKey=${LICENSE_KEY}`
).then(r => r.json());

// Vis i UI
console.log(`Månedspris: ${pricing.pricing.totalMonthlyPrice} kr`);
console.log(`Lisens-type: ${pricing.pricing.licenseTypeName}`);
```

### 3. Oppdater TypeScript-typer

```typescript
type LicenseResponse = {
  valid: boolean;
  status: "active" | "grace" | "expired" | "suspended" | "invalid";
  organization: string;
  licenseType: string;
  licenseTypeName: string;  // ✨ NYTT
  modules?: {               // ✨ NYTT
    booking: boolean;
    pricing?: boolean;
    [key: string]: boolean;
  };
  pricing?: {               // ✨ NYTT
    basePrice: number;
    totalMonthlyPrice: number;
    moduleCount: number;
  };
  // ... eksisterende felter
};
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
- **Handling:** Oppdater koden til å håndtere `pricing`-objektet (valgfritt, men anbefalt)

---

## 📚 Full dokumentasjon

Se `docs/SPORTFLOW-INTEGRATION.md` for komplett dokumentasjon med eksempler.

---

## 🔗 Test-endpoint

Test med din lisensnøkkel:
```
GET https://sportflow-lisence-server.vercel.app/api/license/pricing?licenseKey=DIN_LICENSE_KEY
```


