import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './style.css'
import { spracheAnwenden, sprachLocale, uebersetzen } from './i18n.js'
// ==================================================
// SPEICHER UND HILFSFUNKTIONEN
// ==================================================
const app = document.querySelector('#app')
function lesen(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}
function speichern(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ohne Browserspeicher funktioniert die aktuelle Sitzung weiter.
  }
}
function letzteAdresseLesen() {
  try {
    return localStorage.getItem('deliveryspot-adresse') || ''
  } catch {
    return ''
  }
}
function letzteAdresseSpeichern(adresse) {
  try {
    localStorage.setItem('deliveryspot-adresse', adresse)
  } catch {
    // Speichern ist optional.
  }
}
function sicher(value = '') {
  return String(value).replace(/[&<>"']/g, (zeichen) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[zeichen])
}
function ohneHTML(value) {
  return new DOMParser()
    .parseFromString(String(value), 'text/html')
    .body.textContent.trim()
}
function uhrzeit() {
  return new Date().toLocaleTimeString(sprachLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}
function zeitpunkt() {
  return new Date().toLocaleString(sprachLocale(), {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}
// ==================================================
// APP-ZUSTAND
// ==================================================
const gespeichertesFahrzeug = lesen('ds-fahrzeug', {}) || {}
const alteFavoriten = lesen('deliveryspot-favoriten', [])
const alteMerkliste = lesen('ds-merkliste', [])
let adressFavoriten = Array.isArray(alteFavoriten)
  ? [...new Set(alteFavoriten.filter(
      (adresse) => typeof adresse === 'string'
    ))]
  : []
let merkliste = Array.isArray(alteMerkliste)
  ? alteMerkliste.filter(e => e && typeof e.adresse === 'string' &&
      Array.isArray(e.position) && e.position.length === 2 &&
      e.position.every(Number.isFinite))
  : []
const zustand = {
  seite: 1,
  adresse: letzteAdresseLesen(),
  position: null,
  radius: 500,
  parkdauer: 0,
  entwurfRadius: 500,
  entwurfParkdauer: 0,
  zone: null,
  laedt: false,
  fehler: '',
  treffer: [],
  meldung: '',
  fahrzeug: {
    name: typeof gespeichertesFahrzeug.name === 'string'
      ? gespeichertesFahrzeug.name
      : 'IVECO eDaily',
    typ: ['Lieferwagen', 'Personenwagen', 'Lastwagen']
      .includes(gespeichertesFahrzeug.typ)
      ? gespeichertesFahrzeug.typ
      : 'Lieferwagen',
    gewicht: ['Bis 3,5 t', 'Über 3,5 t']
      .includes(gespeichertesFahrzeug.gewicht)
      ? gespeichertesFahrzeug.gewicht
      : 'Bis 3,5 t'
  }
}
let Ze = null
let verlauf = []
let suchController = null
let suchVersion = 0
// Verifizierbare Standortkoordinaten aus dem Geoportal Stadt Bern.
// Die tatsächliche Parkberechtigung und zulässige Dauer müssen vor Ort geprüft werden.
let standorte = []
let zonen = []
// Dynamische Detail-, Weg- und Ankunftsseiten für alle Standort-IDs.
const detailSeiten = new Proxy({}, { get: (_, id) => id ? 8 : undefined })
const wegSeiten = new Proxy({}, { get: (_, id) => id ? 9 : undefined })
const ankunftSeiten = new Proxy({}, { get: (_, id) => id ? 10 : undefined })
function aktuelleZone() {
  return zonen.find(zone => zone.id === zustand.zone) || null
}
function alternativeZone() {
  const kandidaten = passendeZonen()
  const index = kandidaten.findIndex(z => z.id === zustand.zone)
  return kandidaten.length > 1 ? kandidaten[(index + 1) % kandidaten.length] : null
}
function abstandMeter(a, b) {
  const rad = Math.PI / 180
  const dl = (b[0] - a[0]) * rad
  const dx = (b[1] - a[1]) * rad
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dx / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h))
}

function zonenAktualisieren() {
  if (!zustand.position) { zonen = []; return }
  // Jede originale Geoportal-ID bleibt über verschiedene Adresssuchen erhalten.
  zonen = standorte.map(ort => ({
    ...ort,
    id: String(ort.id),
    meter: Math.round(abstandMeter(zustand.position, [ort.lat, ort.lon])),
    minuten: 60,
    zeit: 'Beschilderung vor Ort prüfen',
    gesperrt: false,
    name: `${ort.typ} · ${ort.name}`
  })).sort((a,b) => a.meter - b.meter)
  zonen.forEach((ort, index) => { ort.nummer = index + 1 })
}
function alteMerklisteMigrieren() {
  let veraendert = false
  merkliste = merkliste.map(e => {
    if (e.standortId) return e
    // Ältere A/B-Einträge waren die zwei nächsten Standorte zur gespeicherten Adresse.
    if (!['A', 'B'].includes(e.zone)) return e
    const nummer = e.zone === 'A' ? 0 : 1
    const kandidaten = standorte.map(ort => ({
      ort, meter: abstandMeter(e.position, [ort.lat, ort.lon])
    })).sort((a,b) => a.meter - b.meter)
    if (!kandidaten[nummer]) return e
    veraendert = true
    return { ...e, standortId: String(kandidaten[nummer].ort.id),
      standortName: kandidaten[nummer].ort.name }
  })
  if (veraendert) speichern('ds-merkliste', merkliste)
}
function passendeZonen(
  radius = zustand.radius,
  parkdauer = zustand.parkdauer
) {
  return zonen.filter(zone => zone.meter <= radius)
}

function zonenPosition(zone) { return [zone.lat, zone.lon] }
async function standorteLaden() {
  try {
    const antwort = await fetch('/parkflaechen-bern.json')
    if (!antwort.ok) throw new Error('HTTP ' + antwort.status)
    const daten = await antwort.json()
    if (!Array.isArray(daten)) throw new Error('Ungültiges Datenformat')
    standorte = daten.filter(d => Number.isFinite(d.lat) && Number.isFinite(d.lon))
    zonenAktualisieren()
    alteMerklisteMigrieren()
    rendern()
  } catch (fehler) {
    console.error('Standorte konnten nicht geladen werden:', fehler)
    zustand.fehler = 'Standortdaten konnten nicht geladen werden. Prüfe die Datei public/parkflaechen-bern.json.'
    rendern()
  }
}
// ==================================================
// IN-APP-NAVIGATION (OSRM + BROWSER-GPS)
// ==================================================
const navigationLive = {
  position: null, route: null, watchId: null, meldung: '',
  laedt: false, stimme: false, letzterAbruf: 0, laufId: 0,
  letzterHinweis: -1, ziel: null, folgen: true
}
const routenSprache = () => sprachLocale().split('-')[0]
function navText(s) { return uebersetzen(s) }
// Fuenf Sprachen fuer die neuen Karten-Schaltflaechen.
function navKartenText(key) {
  const code = sprachLocale().split('-')[0]
  const texte = {
    folgen: { de: 'Meinem Standort folgen', fr: 'Suivre ma position', it: 'Segui la mia posizione', rm: 'Suandar mia posiziun', en: 'Follow my location' },
    uebersicht: { de: 'Gesamte Route anzeigen', fr: 'Afficher tout le trajet', it: 'Mostra tutto il percorso', rm: 'Mussar l’entira ruta', en: 'Show full route' },
    gps: { de: 'GPS-Standort noch nicht verfügbar', fr: 'Position GPS pas encore disponible', it: 'Posizione GPS non ancora disponibile', rm: 'Posiziun GPS anc betg disponibla', en: 'GPS location not yet available' }
  }
  return texte[key]?.[code] || texte[key]?.de || key
}
function navKarteAusrichten() {
  if (zustand.seite !== 21 || !karte) return

  const position = navigationLive.position
  const ziel = navigationLive.ziel
  const route = navigationLive.route

  karte.invalidateSize()

  if (navigationLive.folgen) {
    // Nahansicht des aktuellen GPS-Standorts
    if (position) {
      karte.flyTo(position, 17, {
        animate: true,
        duration: 0.8
      })
    } else {
      navMeldung('GPS-Standort noch nicht verfügbar')
    }
    return
  }

  // Gesamte Strassenroute anzeigen
  const koordinaten = route?.geometry?.coordinates

  if (Array.isArray(koordinaten) && koordinaten.length >= 2) {
    const punkte = koordinaten.map(([lon, lat]) => [lat, lon])
    const grenzen = L.latLngBounds(punkte)

    if (position) grenzen.extend(position)
    if (ziel) grenzen.extend(ziel)

    karte.flyToBounds(grenzen, {
      padding: [35, 35],
      maxZoom: 15,
      duration: 0.8
    })
  } else if (position && ziel) {
    karte.fitBounds([position, ziel], {
      padding: [35, 35],
      maxZoom: 15
    })
  }
}
function navKartenKnopfAktualisieren() {
  const btn = document.querySelector('[data-action="nav-follow"]')
  if (btn) btn.textContent = navKartenText('folgen')
  const overview = document.querySelector('[data-action="nav-overview"]')
  if (overview) overview.textContent = navKartenText('uebersicht')
}
function navMeldung(text) {
  navigationLive.meldung = text
  const element = document.querySelector('#nav-meldung')
  if (element) element.textContent = navText(text)
}
function navStoppen() {
  if (navigationLive.watchId !== null) {
    navigator.geolocation.clearWatch(navigationLive.watchId)
    navigationLive.watchId = null
  }
  navigationLive.laufId++
  navigationLive.laedt = false
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}
function navDistanz(m) {
  if (!Number.isFinite(m)) return '–'
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}
function navManoever(step) {
  const type = step?.maneuver?.type || ''
  const mod = step?.maneuver?.modifier || ''
  const strasse = step?.name ? ` · ${step.name}` : ''
  let richtung = 'Weiterfahren'
  if (type === 'arrive') return 'Ziel erreicht'
  if (type === 'depart') richtung = 'Losfahren'
  else if (type === 'roundabout' || type === 'rotary') richtung = 'In den Kreisverkehr fahren'
  else if (type === 'merge') richtung = 'Einfädeln'
  else if (type === 'on ramp' || type === 'off ramp') richtung = 'Auf die Abzweigung fahren'
  else if (mod.includes('left')) richtung = mod.includes('slight') ? 'Leicht links halten' : 'Links abbiegen'
  else if (mod.includes('right')) richtung = mod.includes('slight') ? 'Leicht rechts halten' : 'Rechts abbiegen'
  else if (mod === 'uturn') richtung = 'Wenden'
  else if (type === 'turn') richtung = 'Geradeaus weiterfahren'
  return richtung + strasse
}
function navNaechsterSchritt() {
  if (!navigationLive.route || !navigationLive.position) return null
  const steps = navigationLive.route.legs?.flatMap(leg => leg.steps || []) || []
  if (!steps.length) return null
  let index = 0
  let dist = Infinity
  // Das nächste Manöver approximieren; keine exakte Map-Matching-Engine.
  steps.forEach((step, i) => {
    const k = step.maneuver?.location
    if (!k) return
    const d = abstandMeter(navigationLive.position, [k[1], k[0]])
    if (d < dist && (i === 0 || d < 350)) { dist = d; index = i }
  })
  const next = steps[Math.min(index + 1, steps.length - 1)]
  return { text: navManoever(next), distanz: dist, index: index + 1 }
}
// Zeichnet die berechnete Strassenroute auch nach einem Karten-Neuaufbau erneut.
function navRouteZeichnen() {
  if (zustand.seite !== 21 || !karte) return
  const geometry = navigationLive.route?.geometry
  // OSRM GeoJSON hat [Laengengrad, Breitengrad].
  const koordinaten = geometry?.coordinates
  if (!Array.isArray(koordinaten) || koordinaten.length < 2) {
    if (navigationLive.route) navMeldung('Routendaten ohne Kartenlinie erhalten. Route neu berechnen.')
    return
  }
  const punkte = koordinaten
    .filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map(([lon, lat]) => [lat, lon])
  if (punkte.length < 2) return

  // Referenzen von einer frueheren Karte sind nicht mehr gueltig.
  if (navigationLive.linie && karte.hasLayer(navigationLive.linie)) return
  navigationLive.linie = L.polyline(punkte, {
    color: '#1765e8', weight: 7, opacity: 1,
    lineJoin: 'round', lineCap: 'round', interactive: false
  }).addTo(karte)
  navigationLive.linie.bringToFront()

  navKarteAusrichten()
}

function navAnsichtAktualisieren() {
  if (zustand.seite !== 21) return
  navRouteZeichnen()
  const p = navigationLive.position
  if (p && karte) {
    if (!navigationLive.marker) {
      navigationLive.marker = L.circleMarker(p, { radius: 9, color: '#fff', weight: 3, fillColor: '#2463db', fillOpacity: 1 }).addTo(karte)
    } else if (karte.hasLayer(navigationLive.marker)) navigationLive.marker.setLatLng(p)
    else navigationLive.marker = L.circleMarker(p, { radius: 9, color: '#fff', weight: 3, fillColor: '#2463db', fillOpacity: 1 }).addTo(karte)
    if (p && karte && navigationLive.folgen) karte.panTo(p, { animate: false })
}
  const route = navigationLive.route
  // Fahrinformationen aktualisieren
const reststrecke = document.querySelector('#nav-reststrecke')
const restzeit = document.querySelector('#nav-restzeit')
const ankunft = document.querySelector('#nav-ankunftszeit')

if (route) {
  const minuten = Math.max(1, Math.round(route.duration / 60))

  if (reststrecke) {
    reststrecke.textContent = navDistanz(route.distance)
  }

  if (restzeit) {
    restzeit.textContent = `${minuten} Min.`
  }

  if (ankunft) {
    const ankunftsdatum = new Date(
      Date.now() + route.duration * 1000
    )

    ankunft.textContent = ankunftsdatum.toLocaleTimeString(
      'de-CH',
      {
        hour: '2-digit',
        minute: '2-digit'
      }
    )
  }
}
  const info = document.querySelector('#nav-route-info')
  const hinweis = document.querySelector('#nav-hinweis')
  const naechste = navNaechsterSchritt()
  if (info) info.textContent = route ? `${navDistanz(route.distance)} · ca. ${Math.max(1, Math.round(route.duration / 60))} Min. (Routing-Schätzung)` : 'Route wird vorbereitet …'
  if (hinweis) hinweis.textContent = naechste ? `${navText(naechste.text)} · ${navDistanz(naechste.distanz)}` : navText('Warte auf GPS und Route …')
  if (navigationLive.stimme && naechste && navigationLive.letzterHinweis !== naechste.index && naechste.distanz < 250 && 'speechSynthesis' in window) {
    navigationLive.letzterHinweis = naechste.index
    const gesprochen = new SpeechSynthesisUtterance(navText(naechste.text))
    gesprochen.lang = sprachLocale()
    window.speechSynthesis.speak(gesprochen)
  }
}
async function navRouteBerechnen() {
  if (!navigationLive.position || !navigationLive.ziel || navigationLive.laedt) return
  const lauf = navigationLive.laufId
  navigationLive.laedt = true
  navMeldung('Strassenroute wird berechnet …')
  try {
    const [a, b] = navigationLive.position
    const [c, d] = navigationLive.ziel
    // Öffentlicher OSRM-Testserver: nur für MVP/Entwicklung, nicht produktiv.
    const url = `https://router.project-osrm.org/route/v1/driving/${b},${a};${d},${c}?overview=full&geometries=geojson&steps=true`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Routing HTTP ${response.status}`)
    const data = await response.json()
    if (lauf !== navigationLive.laufId || zustand.seite !== 21) return
    if (data.code !== 'Ok' || !data.routes?.length) throw new Error('Keine Strassenroute gefunden')
    navigationLive.route = data.routes[0]
    navigationLive.letzterAbruf = Date.now()
    navigationLive.letzterHinweis = -1
    navMeldung('Navigation bereit')
    if (karte && navigationLive.linie && karte.hasLayer(navigationLive.linie)) {
      karte.removeLayer(navigationLive.linie)
    }
    navigationLive.linie = null
    navAnsichtAktualisieren()
    requestAnimationFrame(() => {
      if (zustand.seite === 21 && karte) {
        karte.invalidateSize()
        navAnsichtAktualisieren()
      }
    })
  } catch (error) {
    if (lauf === navigationLive.laufId) {
      console.error('Routing:', error)
      navMeldung('Route nicht verfügbar. Internetverbindung prüfen und erneut versuchen.')
    }
  } finally { navigationLive.laedt = false }
}
function navStarten() {
  const zone = aktuelleZone()
  if (!zone) return
  navStoppen()
  navigationLive.ziel = zonenPosition(zone)
  navigationLive.folgen = true
  navigationLive.route = null
  navigationLive.position = null
  navigationLive.linie = null
  navigationLive.marker = null
  navigationLive.letzterAbruf = 0
  navigationLive.letzterHinweis = -1
  geheZu(21)
  if (!navigator.geolocation) {
    navMeldung('Dieses Gerät unterstützt keine GPS-Ortung.')
    return
  }
  navMeldung('GPS-Position wird ermittelt. Standortzugriff bitte erlauben.')
  navigationLive.watchId = navigator.geolocation.watchPosition(pos => {
    if (zustand.seite !== 21) return
    navigationLive.position = [pos.coords.latitude, pos.coords.longitude]
    const zoneDistanz = abstandMeter(navigationLive.position, navigationLive.ziel)
    if (zoneDistanz <= 25) navMeldung('Du befindest dich in der Nähe des Parkplatzes. Beschilderung prüfen.')
    else if (!navigationLive.route) navRouteBerechnen()
    else if (Date.now() - navigationLive.letzterAbruf > 25000 && navigationLive.linie) {
      const abweichung = Math.min(...navigationLive.linie.getLatLngs().filter((_, i) => i % 5 === 0).map(k => abstandMeter(navigationLive.position, [k.lat,k.lng])))
      if (abweichung > 80) navRouteBerechnen()
    }
    navAnsichtAktualisieren()
  }, error => {
    console.warn('GPS:', error)
    navMeldung(error.code === 1 ? 'Standortzugriff verweigert. Bitte GPS in den Browser-Einstellungen erlauben.' : 'GPS derzeit nicht verfügbar. Bitte Standortdienste prüfen.')
  }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 16000 })
}
function navSeite() {
  const zone = aktuelleZone()
  return `
    ${titel('Navigation zum Parkplatz', zone ? `Zone ${sicher(zone.id)} · ${sicher(zone.name)}` : '')}
    <section class="nav-anweisung" aria-live="polite">
      <strong id="nav-hinweis">Warte auf GPS und Route …</strong>
      <small id="nav-route-info">Route wird vorbereitet …</small>
    </section>
<div id="karte" class="karte nav-karte" aria-label="Navigationskarte"></div>

<p id="nav-meldung" class="klein" role="status">${sicher(navigationLive.meldung)}</p>

<div class="nav-fahrtkarte">
  <div class="nav-fahrtkopf">
    <strong>Deine Fahrt</strong>
    <span class="nav-live-badge">Route aktiv</span>
  </div>

  <div class="nav-fahrtwerte">
    <div>
      <span class="nav-wert-symbol">↗</span>
      <strong id="nav-reststrecke">–</strong>
      <small>Reststrecke</small>
    </div>

    <div>
      <span class="nav-wert-symbol">◷</span>
      <strong id="nav-restzeit">–</strong>
      <small>Fahrzeit</small>
    </div>

    <div>
      <span class="nav-wert-symbol">⚑</span>
      <strong id="nav-ankunftszeit">–</strong>
      <small>Ankunft</small>
    </div>
  </div>
</div>

<div class="nav-kartenaktionen">
  ${knopf('Meinem Standort folgen', 'nav-follow', 'secondary')}
  ${knopf('Gesamte Route anzeigen', 'nav-overview', 'secondary')}
</div>
    <div class="nav-hauptaktionen">
  <div class="nav-werkzeuge">
    ${knopf('↻ Route neu berechnen', 'nav-neu', 'secondary')}
    ${knopf(
      navigationLive.stimme
        ? '♫ Ton ausschalten'
        : '♫ Sprachausgabe',
      'nav-stimme',
      'secondary'
    )}
  </div>

  <div class="nav-abschluss">
    ${knopf('✓ Ich bin angekommen', 'angekommen')}
    ${knopf('Navigation beenden', 'nav-ende', 'secondary')}
  </div>
</div>
    <p class="klein">Verkehrsregeln, Beschilderung und Strassensituation vor Ort beachten. Nicht während der Fahrt bedienen.</p>
  `
}

// ==================================================
// PARKING TIMER (LOKAL GESPEICHERT)
// ==================================================

const timerGespeichert = lesen('ds-parking-timer', {}) || {}
// Einmalige Umstellung alter, nicht laufender 20-Minuten-Defaults auf 60 Minuten.
// Bereits laufende Timer und später bewusst gewählte Erinnerungsdauern bleiben erhalten.
const timer60Migriert = lesen('ds-timer-default-60-migriert', false)
if (!timer60Migriert) {
  if (!timerGespeichert.aktiv && (timerGespeichert.dauer === 20 * 60 || !Number.isFinite(timerGespeichert.dauer))) {
    timerGespeichert.dauer = 60 * 60
    timerGespeichert.rest = 60 * 60
    timerGespeichert.ende = null
  }
  speichern('ds-parking-timer', timerGespeichert)
  speichern('ds-timer-default-60-migriert', true)
}
let parkingTimer = {
  zone: typeof timerGespeichert.zone === 'string' ? timerGespeichert.zone : null,
  dauer: Number.isFinite(timerGespeichert.dauer) ? timerGespeichert.dauer : 60 * 60,
  rest: Number.isFinite(timerGespeichert.rest) ? timerGespeichert.rest : 60 * 60,
  ende: Number.isFinite(timerGespeichert.ende) ? timerGespeichert.ende : null,
  aktiv: Boolean(timerGespeichert.aktiv),
  gewarnt: Boolean(timerGespeichert.gewarnt)
}

function timerRest() {
  return parkingTimer.aktiv && parkingTimer.ende !== null
    ? Math.max(0, Math.ceil((parkingTimer.ende - Date.now()) / 1000))
    : parkingTimer.rest
}

function timerSpeichern() {
  speichern('ds-parking-timer', parkingTimer)
}

function timerZuruecksetzen(zoneId = zustand.zone) {
  const zone = zonen.find(z => z.id === zoneId) || { id: zoneId, minuten: 60 }

  parkingTimer = {
    zone: zone.id,
    dauer: 60 * 60,
    rest: 60 * 60,
    ende: null,
    aktiv: false,
    gewarnt: false
  }

  timerSpeichern()
}

function timerZeit(sekunden) {
  const wert = Math.max(0, sekunden)
  return `${String(Math.floor(wert / 60)).padStart(2, '0')}:${String(wert % 60).padStart(2, '0')}`
}

function timerStatus() {
  const rest = timerRest()
  if (rest === 0) return 'Zeit abgelaufen – Beschilderung prüfen.'
  if (parkingTimer.aktiv && rest <= 120) return 'Achtung: Weniger als 2 Minuten!'
  if (parkingTimer.aktiv) return 'Timer läuft'
  if (rest < parkingTimer.dauer) return 'Timer pausiert'
  return 'Bereit zum Starten'
}

function timerKarte() {
  if (parkingTimer.zone !== zustand.zone && parkingTimer.aktiv) {
    return `<section class="card parking-timer"><h2>Ein Timer läuft bereits</h2><p>Zone ${sicher(parkingTimer.zone)} · ${timerZeit(timerRest())} verbleibend</p>${knopf('Laufenden Timer anzeigen', 'timer-zeigen')}</section>`
  }
  if (parkingTimer.zone !== zustand.zone && !parkingTimer.aktiv) {
    timerZuruecksetzen(zustand.zone)
  }
  const zone = aktuelleZone()
  const rest = timerRest()
  const istAktiv = parkingTimer.aktiv
  return `
    <section class="card parking-timer" aria-label="Parking Timer">
      <div class="parking-timer-kopf">
        <h2>Parking Timer</h2>
        <span class="badge">Zone ${sicher(parkingTimer.zone)}</span>
      </div>
      <p class="klein">Erinnerungsdauer frei wählbar · Parkregeln vor Ort prüfen.</p>
      <div class="parking-timer-zeit" id="parking-timer-zeit" role="timer">${timerZeit(rest)}</div>
      <p id="parking-timer-status" class="parking-timer-status" role="status">${timerStatus()}</p>
      <div class="parking-timer-track"><div id="parking-timer-progress" style="width:${Math.max(0, Math.min(100, 100 * rest / parkingTimer.dauer))}%"></div></div>
      <label for="timer-dauer">Erinnerungsdauer</label>
      <select id="timer-dauer" ${istAktiv ? 'disabled' : ''}>
        ${[5, 10, 15, 20, 30, 45, 60].map(min => `
          <option value="${min}" ${parkingTimer.dauer === min * 60 ? 'selected' : ''}>${min} Minuten${min === 60 ? ' (Maximum)' : ''}</option>
        `).join('')}
      </select>
      <div class="parking-timer-buttons">
        ${knopf(istAktiv ? 'Pausieren' : (rest < parkingTimer.dauer ? 'Fortsetzen' : 'Timer starten'), istAktiv ? 'timer-pause' : 'timer-start')}
        ${knopf('Zurücksetzen', 'timer-reset', 'secondary')}
      </div>
      <p class="klein">Warnung 2 Minuten vor Ablauf, solange die App geöffnet ist. Der Timer ist keine Parkberechtigung.</p>
    </section>
  `
}

function timerAktualisieren() {
  if (parkingTimer.aktiv && timerRest() === 0) {
    parkingTimer.aktiv = false
    parkingTimer.rest = 0
    parkingTimer.ende = null
    timerSpeichern()
  }
  if (parkingTimer.aktiv && timerRest() <= 120 && !parkingTimer.gewarnt) {
    parkingTimer.gewarnt = true
    timerSpeichern()
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('DeliverySpot – Parking Timer', { body: uebersetzen('Noch 2 Minuten bis zum Ende deiner Erinnerung!') })
    }
  }
  const zeitElement = document.querySelector('#parking-timer-zeit')
  const statusElement = document.querySelector('#parking-timer-status')
  const progressElement = document.querySelector('#parking-timer-progress')
  if (zeitElement) zeitElement.textContent = timerZeit(timerRest())
  if (statusElement) statusElement.textContent = uebersetzen(timerStatus())
  if (progressElement) progressElement.style.width = `${Math.max(0, Math.min(100, 100 * timerRest() / parkingTimer.dauer))}%`
  const mini = document.querySelector('#parking-timer-mini-zeit')
  if (mini) mini.textContent = timerZeit(timerRest())
}

setInterval(timerAktualisieren, 1000)

// ==================================================
// KLEINE SYMBOLE
// ==================================================
function icon(name) {
  const formen = {
    suche: `
      <circle cx="10.5" cy="10.5" r="6.5"/>
      <path d="m16 16 5 5"/>
    `,
    herz: `
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5
      5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>
    `,
    fahrzeug: `
      <path d="M2 5h12v12H2zM14 9h4l4 4v4h-8"/>
      <circle cx="6" cy="18" r="2"/>
      <circle cx="18" cy="18" r="2"/>
    `,
    info: `
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 11v6M12 7h.01"/>
    `,
    pin: `
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/>
      <circle cx="12" cy="10" r="2.5"/>
    `,
    uhr: `
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 6v6l4 2"/>
    `,
    warnung: `
      <path d="m12 3 10 18H2Z"/>
      <path d="M12 9v5M12 17h.01"/>
    `,
    check: `<path d="m5 12 4 4L19 6"/>`
  }
  return `
    <svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      ${formen[name] || formen.info}
    </svg>
  `
}
// ==================================================
// WIEDERVERWENDBARE OBERFLÄCHE
// ==================================================
function knopf(label, aktion, stil = 'primary') {
  return `
    <button type="button" class="button ${stil}"
      data-action="${sicher(aktion)}">
      ${sicher(label)}
    </button>
  `
}
function titel(ueberschrift, untertitel = '') {
  return `
    <div class="seitentitel">
      <h1 tabindex="-1">${sicher(ueberschrift)}</h1>
      ${untertitel ? `<p>${sicher(untertitel)}</p>` : ''}
    </div>
  `
}
function hinweis(inhalt, warnung = false) {
  return `
    <div class="hinweis ${warnung ? 'warnung' : ''}">
      ${icon(warnung ? 'warnung' : 'info')}
      <p>${sicher(inhalt)}</p>
    </div>
  `
}
function kartenHTML(gross = false) {
  return `
    <div id="karte"
      class="karte ${gross ? 'karte-gross' : ''}"
      aria-label="Karte der Umgebung">
    </div>
  `
}
function googleMapsLink() {
  if (!zustand.position) return ''
  const parameter = new URLSearchParams({
    api: '1',
    destination: `${zustand.position[0]},${zustand.position[1]}`,
    travelmode: 'driving',
    dir_action: 'navigate'
  })
  return `
    <a class="button secondary"
      href="https://www.google.com/maps/dir/?${sicher(parameter.toString())}"
      target="_blank" rel="noopener noreferrer">
      Lieferziel in Google Maps öffnen →
    </a>
  `
}
function lieferdaten(radius = zustand.radius) {
  return `
    <div class="card">
      <h2>Deine Lieferung</h2>
      <dl class="daten">
        <div>
          <dt>Fahrzeugtyp</dt>
          <dd>${sicher(zustand.fahrzeug.typ)}</dd>
        </div>
        <div>
          <dt>Gesamtgewicht</dt>
          <dd>${sicher(zustand.fahrzeug.gewicht)}</dd>
        </div>
        <div>
          <dt>Zeitpunkt</dt>
          <dd>${sicher(zeitpunkt())}</dd>
        </div>
        <div>
          <dt>Suchradius</dt>
          <dd>${radius} m</dd>
        </div>
        <div>
          <dt>Entfernungen</dt>
          <dd>Luftlinie zum Ziel</dd>
        </div>
      </dl>
    </div>
  `
}
function zonenKarte(zone) {
  return `
    <button type="button" class="zonenkarte"
      data-action="zone:${zone.id}">
      <span class="zonenbuchstabe">${sicher(zone.nummer)}</span>
      <span class="zonentext">
        <strong>${sicher(zone.name)}</strong>
        <span>${zone.meter} m Luftlinie zum Lieferziel</span>
        <span>Parkdauer und Bedingungen vor Ort prüfen</span>
        <small>
          ${zone.gesperrt
            ? 'Sperrung · Details →'
            : 'Belegung unbekannt · Details →'}
        </small>
      </span>
      <span class="pfeil" aria-hidden="true">›</span>
    </button>
  `
}
function tabs(aktiv) {
  return `
    <div class="tabs" aria-label="Ergebnisansicht">
      ${knopf('Karte', 'karte',
        aktiv === 'karte' ? 'primary' : 'secondary')}
      ${knopf('Liste', 'liste',
        aktiv === 'liste' ? 'primary' : 'secondary')}
      ${knopf('Filter', 'filter', 'secondary')}
    </div>
  `
}
function parkdauerAuswahl(entwurf = false) {
  const wert = entwurf
    ? zustand.entwurfParkdauer
    : zustand.parkdauer
  return `
    <div class="parkdauer-bereich">
      <label for="parkdauer">Wie lange brauchst du?</label>
      <select id="parkdauer" data-filter="${entwurf ? 'entwurf' : 'direkt'}">
        ${[
          [0, 'Alle Parkzeiten'],
          [20, 'Mindestens 20 Minuten'],
          [30, 'Mindestens 30 Minuten'],
          [60, 'Mindestens 60 Minuten']
        ].map(([minuten, beschriftung]) => `
          <option value="${minuten}"
            ${wert === minuten ? 'selected' : ''}>
            ${beschriftung}
          </option>
        `).join('')}
      </select>
    </div>
  `
}
function adressFavoritenHTML() {
  return `
    <section class="adressfavoriten">
      <h2>Deine gespeicherten Adressen</h2>
      ${adressFavoriten.length
        ? adressFavoriten.map((adresse, index) => `
            <div class="adressfavorit-zeile">
              <button class="button secondary"
                data-action="adressfavorit:${index}"
                ${zustand.laedt ? 'disabled' : ''}>
                ${sicher(adresse)}
              </button>
              <button class="entfernen"
                data-action="adressfavorit-loeschen:${index}"
                aria-label="Adresse aus Favoriten entfernen">
                ×
              </button>
            </div>
          `).join('')
        : '<p class="klein">Speichere eine gefundene Lieferadresse als Favorit.</p>'}
    </section>
  `
}
// ==================================================
// SEITENWECHSEL
// ==================================================
function sucheAbbrechen() {
  suchVersion++
  suchController?.abort()
  zustand.laedt = false
}
function geheZu(seite, merken = true) {
  if (zustand.laedt) sucheAbbrechen()
  if (zustand.seite === 21 && seite !== 21) navStoppen()
  // Ansichten mit Lieferziel nur nach erfolgreicher Suche öffnen.
  if (seite >= 2 && seite <= 21 && seite !== 18 && seite !== 19 && seite !== 20 && !zustand.position) {
    seite = 1
  }
  if (merken && seite !== zustand.seite) {
    verlauf.push(zustand.seite)
  }
  zustand.seite = seite
  zustand.fehler = ''
  // Die Standortauswahl darf beim Seitenwechsel nicht überschrieben werden.
  rendern()
  window.scrollTo({ top: 0 })
  document.querySelector('h1')?.focus({
    preventScroll: true
  })
}
function ergebnisseOeffnen() {
  geheZu(zustand.radius === 150 ? 7 : 3)
}
function zoneOeffnen(id) {
  if (!zonen.some(zone => zone.id === id)) return
  zustand.zone = id
  geheZu(detailSeiten[id])
}
// ==================================================
// ADRESSSUCHE
// ==================================================
async function adresseSuchen(eingabe) {
  const adresse = eingabe.trim()
  if (adresse.length < 3) {
    zustand.fehler = 'Bitte gib eine Strasse mit Hausnummer ein.'
    rendern()
    return
  }
  suchController?.abort()
  const controller = new AbortController()
  suchController = controller
  const version = ++suchVersion
  zustand.adresse = adresse
  zustand.position = null
  zustand.laedt = true
  zustand.fehler = ''
  zustand.treffer = []
  rendern()
  const suchtext = /\bbern\b/i.test(adresse)
    ? adresse
    : `${adresse} Bern`
  const parameter = new URLSearchParams({
    searchText: suchtext,
    type: 'locations',
    origins: 'address',
    limit: '50'
  })
  const zeitlimit = setTimeout(() => controller.abort(), 15000)
  try {
    const antwort = await fetch(
      `https://api3.geo.admin.ch/rest/services/ech/SearchServer?${parameter}`,
      { signal: controller.signal }
    )
    if (!antwort.ok) throw new Error('Suche nicht erreichbar')
    const daten = await antwort.json()
    if (version !== suchVersion) return
    // Gemeinde Bern: BFS-Nummer 351.
    const treffer = (daten.results || []).filter((eintrag) => {
      const a = eintrag.attrs
      return (
        a?.origin === 'address' &&
        /\b351 bern ch be\s*$/i.test(a.detail || '') &&
        Number.isFinite(a.lat) &&
        Number.isFinite(a.lon)
      )
    })
    zustand.laedt = false
    if (!treffer.length) {
      zustand.fehler =
        'Keine passende Adresse in der Stadt Bern gefunden. ' +
        'Prüfe Strasse und Hausnummer oder ergänze die Postleitzahl.'
      rendern()
      return
    }
    zustand.treffer = treffer
    if (treffer.length === 1) {
      adresseUebernehmen(0)
    } else {
      rendern()
    }
  } catch {
    if (version !== suchVersion) return
    zustand.laedt = false
    zustand.fehler =
      'Die Adresssuche hat nicht funktioniert. ' +
      'Prüfe deine Internetverbindung und versuche es erneut.'
    rendern()
  } finally {
    clearTimeout(zeitlimit)
  }
}
function adresseUebernehmen(index) {
  const treffer = zustand.treffer[index]
  if (!treffer) return
  zustand.adresse = ohneHTML(treffer.attrs.label)
  zustand.position = [treffer.attrs.lat, treffer.attrs.lon]
  zustand.treffer = []
  letzteAdresseSpeichern(zustand.adresse)
  zonenAktualisieren()
  geheZu(2)
}
// ==================================================
// 20 ANSICHTEN NACH DEM FIGMA-ENTWURF
// ==================================================
function seitenInhalt() {
  if (zustand.seite === 21) return navSeite()
  const seite = zustand.seite
  const zone = aktuelleZone()
  // 01 – STARTSEITE
  if (seite === 1) {
    return `
      <section class="start-hero">
  <span class="start-eyebrow">
    INTELLIGENTE LIEFERUNG · BERN
  </span>

  <h1>Dein nächster Stopp.</h1>

  <p>
    Finde eine passende Parkmöglichkeit für deine
    Lieferung und navigiere direkt dorthin.
  </p>

  <div class="start-standort">
    ${icon('pin')}
    <span>Für Lieferungen in der Stadt Bern</span>
  </div>
</section>
      <form id="adressformular" class="card adressformular start-suche">
        <h2>Wo möchtest du liefern?</h2>
        <label class="sr-only" for="adresse">
          Lieferadresse in der Stadt Bern
        </label>
        <input id="adresse" name="adresse" type="text"
          placeholder="Strasse und Hausnummer, Bern"
          value="${sicher(zustand.adresse)}"
          maxlength="160" required
          autocomplete="street-address"
          ${zustand.laedt ? 'readonly' : ''}>
        <p class="klein">
          ${sicher(zustand.fahrzeug.typ)} ·
          ${sicher(zustand.fahrzeug.gewicht)}
        </p>
        <button class="button primary" type="submit"
          ${zustand.laedt ? 'disabled' : ''}>
          ${zustand.laedt
            ? 'Adresse wird gesucht …'
            : 'Ladezonen finden →'}
        </button>
        ${zustand.laedt
          ? '<p class="klein" role="status">Deine Lieferadresse wird geprüft.</p>'
          : ''}
        ${zustand.fehler
          ? `<p class="fehlermeldung" role="alert">
              ${sicher(zustand.fehler)}
            </p>`
          : ''}
      </form>
      ${zustand.treffer.length > 1 ? `
        <section class="treffer">
          <h2>Welche Adresse meinst du?</h2>
          ${zustand.treffer.map((eintrag, index) =>
            knopf(
              ohneHTML(eintrag.attrs.label),
              `adresse:${index}`,
              'secondary'
            )
          ).join('')}
        </section>
      ` : ''}
      ${kartenHTML()}
      ${adressFavoritenHTML()}
    `
  }
  // 02 – LIEFERADRESSE (Urban Redesign)
  if (seite === 2) {
    const gemerkt = adressFavoriten.includes(zustand.adresse)
    return `
      <section class="ds-lieferung-planen">
        <header class="ds-lieferung-kopf">
          <span class="ds-lieferung-eyebrow">LIEFERUNG PLANEN · BERN</span>
          <h1>Wohin geht die Lieferung?</h1>
          <p>Prüfe dein Lieferziel und starte danach die Parkplatzsuche.</p>
        </header>
        <section class="ds-lieferung-adresse">
          <span class="ds-lieferung-label">DEINE ADRESSE</span>
          <button type="button" class="ds-lieferung-adresskarte" data-action="bearbeiten">
            <span class="ds-lieferung-adressicon">${icon('pin')}</span>
            <span class="ds-lieferung-adresstext">
              <strong>${sicher(zustand.adresse)}</strong>
              <small>Lieferadresse ändern</small>
            </span>
            <span class="ds-lieferung-chevron" aria-hidden="true">›</span>
          </button>
        </section>
        <section class="ds-lieferung-details">
          <div class="ds-lieferung-detailskopf">
            <span class="ds-lieferung-detailsicon">${icon('fahrzeug')}</span>
            <h2>Deine Lieferung</h2>
          </div>
          <dl class="ds-lieferung-tabelle">
            <div><dt>Fahrzeugtyp</dt><dd>${sicher(zustand.fahrzeug.typ)}</dd></div>
            <div><dt>Gesamtgewicht</dt><dd>${sicher(zustand.fahrzeug.gewicht)}</dd></div>
            <div><dt>Zeitpunkt</dt><dd>${sicher(zeitpunkt())}</dd></div>
            <div><dt>Suchradius</dt><dd>${zustand.radius} m</dd></div>
            <div><dt>Entfernung</dt><dd>Luftlinie zum Ziel</dd></div>
          </dl>
        </section>
        <div class="ds-lieferung-aktionen">
          ${knopf('Ladezonen anzeigen →', 'ergebnisse')}
          ${knopf(
            gemerkt ? '♥ Adresse gespeichert' : '♡ Adresse als Favorit speichern',
            'adresse-merken', 'secondary'
          )}
          ${googleMapsLink()}
          ${knopf('Fahrzeug ansehen', 'seite:19', 'soft')}
        </div>
      </section>
    `
  }
  // 03 – KARTE
  // 04 – LISTE
  // 07 – GEFILTERTE ERGEBNISSE
  if ([3, 4, 7].includes(seite)) {
    const liste = passendeZonen()
    const nutzbare = liste.filter((eintrag) => !eintrag.gesperrt)
    return `
      ${titel(
        seite === 4
          ? 'Zonen vergleichen'
          : seite === 7
            ? 'Passende Zonen in deiner Nähe'
            : 'Ladezonen in der Nähe',
        `${zustand.adresse} · Suchradius ${zustand.radius} m`
      )}
      ${tabs(seite === 4 ? 'liste' : 'karte')}
      ${seite !== 4 ? kartenHTML(true) : ''}
      <h2>
        ${liste.length} ${liste.length === 1 ? 'Zone' : 'Zonen'}
        im Umkreis von ${zustand.radius} m
      </h2>
      <div class="zonenliste">
        ${liste.map(zonenKarte).join('')}
      </div>
      ${liste.length === 0
        ? hinweis(
            'Keine erfassten Kurzzeit- oder Lastwagenparkfelder im Suchradius gefunden. ' +
            'Erweitere den Suchradius oder suche eine andere Adresse.'
          )
        : nutzbare.length === 0
          ? hinweis(
              'Die passenden Standorte sind nicht verfügbar. ' +
              'Ändere deine Filter, um Alternativen zu sehen.',
              true
            )
          : hinweis(
              'Offizielle Standortkoordinaten, keine bestätigten Ladezonen. Nutzung und Beschilderung vor Ort prüfen.'
            )}
      ${zustand.radius === 150 ? knopf('Radius auf 500 m erweitern', 'erweitern') : ''}
      ${liste.length === 0
        ? knopf('Alle Filter zurücksetzen', 'alle-filter-reset', 'secondary')
        : ''}
    `
  }
  // 05 – FILTER 500 M
  // 06 – FILTER 150 M
  if ([5, 6].includes(seite)) {
    const anzahl = passendeZonen(
      zustand.entwurfRadius,
      zustand.entwurfParkdauer
    ).length
    return `
      ${titel('Suche eingrenzen', 'Wie weit darf die Zone entfernt sein?')}
      <h2>Suchradius</h2>
      <div class="tabs zwei">
        ${knopf(
          `${zustand.entwurfRadius === 150 ? '✓ ' : ''}150 m`,
          'radius:150',
          zustand.entwurfRadius === 150 ? 'primary' : 'secondary'
        )}
        ${knopf(
          `${zustand.entwurfRadius === 500 ? '✓ ' : ''}500 m`,
          'radius:500',
          zustand.entwurfRadius === 500 ? 'primary' : 'secondary'
        )}
      </div>
      ${parkdauerAuswahl(true)}
      ${lieferdaten(zustand.entwurfRadius)}
      ${hinweis(
        'Die offizielle maximale Parkdauer ist hier nicht bekannt. Schilder beachten.'
      )}
      <div class="aktionen unten">
        ${knopf(
          `${anzahl} ${anzahl === 1 ? 'Zone' : 'Zonen'} anzeigen`,
          'filter-anwenden'
        )}
        ${knopf('Filter zurücksetzen', 'filter-reset', 'secondary')}
      </div>
    `
  }
  // 08 / 11 – PARKFLAECHENDETAILS IM URBAN-DESIGN
  if ([8, 11].includes(seite)) {
    if (!zone) return `${titel('Parkfläche nicht gefunden', 'Bitte starte eine neue Suche.')}`
    return `
      <section class="ds-detail-header">
        <span class="ds-detail-eyebrow">STANDORTDETAILS · BERN</span>
        <h1>${sicher(zone.name)}</h1>
        <p>Erfasste Parkfläche in der Nähe deines Lieferziels.</p>
      </section>
      <section class="ds-detail-summary" aria-label="Entfernung zum Lieferziel">
        <div class="ds-detail-zoneid">${sicher(zone.nummer)}</div>
        <div class="ds-detail-summarytext">
          <span>ENTFERNUNG ZUM LIEFERZIEL</span>
          <strong>${sicher(zone.meter)} m <small>Luftlinie</small></strong>
          <p>${sicher(zustand.adresse)}</p>
        </div>
      </section>
      <section class="ds-detail-mapcard">
        <div class="ds-detail-sectiontop">
          <h2>Standort auf der Karte</h2>
          <span>Bern</span>
        </div>
        ${kartenHTML()}
      </section>
      <section class="ds-detail-infocard">
        <h2>Informationen zur Parkfläche</h2>
        <dl class="ds-detail-facts">
          <div><dt>Belegung</dt><dd>Unbekannt</dd></div>
          <div><dt>Erlaubte Parkdauer</dt><dd>Beschilderung vor Ort prüfen</dd></div>
          <div><dt>Parkgebühren</dt><dd>Kostenlos bis 60 min</dd></div>
          <div><dt>Gesamtgewicht</dt><dd>Bis 3,5 t</dd></div>
        </dl>
      </section>
      ${zustand.fahrzeug.gewicht === 'Über 3,5 t'
        ? hinweis('Dein Fahrzeugprofil liegt über der hier angegebenen Gewichtsgrenze.', true)
        : ''}
      <div class="ds-detail-sicherheit">
        ${icon('info')}
        <p>Beschilderung und örtliche Bedingungen vor dem Parkieren prüfen. Diese Auswahl reserviert keinen Platz.</p>
      </div>
      <div class="ds-detail-actions">
        ${knopf('Weg zur Parkfläche ansehen →', 'weg')}
        ${knopf(istGemerkt(zone.id) ? '♥ Aus Merkliste entfernen' : '♡ In Merkliste speichern', 'merken', 'secondary')}
        ${alternativeZone() ? knopf(`Alternative: ${alternativeZone().name}`, `zone:${alternativeZone().id}`, 'secondary') : ''}
      </div>
    `
  }
  // 09 – WEG ZUR PARKFLÄCHE (alle Standorte)
  if ([9, 12].includes(seite)) {
    return `
      <section class="ds-weg-page">
        <header class="ds-weg-heading">
          <span class="ds-weg-eyebrow">ROUTENPLANUNG · BERN</span>
          <h1>Dein Weg zur Parkfläche</h1>
          <p>Prüfe den Standort und starte danach die Navigation.</p>
        </header>
        <section class="ds-weg-hero">
          <div class="ds-weg-hero-top">
            <span class="ds-weg-symbol">${icon('pin')}</span>
            <div class="ds-weg-hero-name">
              <small>AUSGEWÄHLTE PARKFLÄCHE</small>
              <strong>${sicher(zone.name)}</strong>
            </div>
          </div>
          <div class="ds-weg-distance">
            <span>Entfernung zum Lieferziel</span>
            <strong>${zone.meter} m</strong>
          </div>
          <p>Luftlinie · Keine berechnete Fahrstrecke</p>
        </section>
        <section class="ds-weg-mapcard">
          <h2>Standort auf der Karte</h2>
          ${kartenHTML(true)}
          <p>Die gestrichelte Linie dient zur Orientierung und zeigt keine berechnete Strassenroute.</p>
        </section>
        <section class="ds-weg-facts">
          <h2>Parkinformationen</h2>
          <div><span>Parkgebühren</span><strong>Kostenlos bis 60 min</strong></div>
          <div><span>Erlaubte Parkdauer</span><strong>Vor Ort prüfen</strong></div>
        </section>
        <div class="ds-weg-actions">
          ${knopf('Zum Parkplatz navigieren →', 'nav-start')}
          ${googleMapsLink()}
          ${knopf('Ich bin angekommen', 'angekommen')}
          ${alternativeZone() ? knopf(`Alternative: ${alternativeZone().name}`, `zone:${alternativeZone().id}`, 'secondary') : ''}
          ${knopf('Stopp verwerfen', 'verwerfen', 'soft')}
        </div>
      </section>
    `
  }
  // 10 – ANKUNFT ZONE A
  // 13 – ANKUNFT ZONE B
  if ([10, 13].includes(seite)) {
    return `
      <section class="ds-ankunft">
        <header class="ds-ankunft-kopf">
          <span class="ds-ankunft-eyebrow">LIEFERSTOPP · BERN</span>
          <h1>Du bist angekommen.</h1>
          <p>Prüfe den Standort und starte bei Bedarf deine Parkerinnerung.</p>
        </header>

        <section class="ds-ankunft-hero">
          <div class="ds-ankunft-icon">${icon('pin')}</div>
          <div class="ds-ankunft-hero-text">
            <small>DEIN LIEFERSTOPP</small>
            <strong>${sicher(zone.name)}</strong>
            <span>Parkfläche ${sicher(zone.id)}</span>
          </div>
        </section>

        <section class="ds-ankunft-checkliste">
          <h2>Vor dem Entladen prüfen</h2>
          <div class="ds-ankunft-check">${icon('check')}<span>Ist die Parkfläche tatsächlich nutzbar?</span></div>
          <div class="ds-ankunft-check">${icon('check')}<span>Passt die Beschilderung zum Fahrzeug?</span></div>
          <div class="ds-ankunft-check">${icon('check')}<span>Bleiben Zufahrten und Wege frei?</span></div>
        </section>

        <section class="ds-ankunft-timer">${timerKarte()}</section>

        <div class="ds-ankunft-aktionen">
          ${knopf('Lieferung abschliessen ✓', 'abschliessen')}
          ${knopf('Problem melden', 'seite:15', 'secondary')}
          ${alternativeZone() ? knopf(`Andere Parkfläche: ${alternativeZone().name}`, `zone:${alternativeZone().id}`, 'secondary') : ''}
          ${knopf('Stopp verwerfen', 'verwerfen', 'secondary')}
        </div>
      </section>
    `
  }
  // 14 – GESPERRTE LADEZONE
  if (seite === 14) {
    if (!zone) return `${titel('Parkfläche nicht gefunden', 'Bitte starte eine neue Suche.')}`
    return `
      ${titel(
        zone.name,
        `${zone.meter} m zum Lieferziel · aktuell gesperrt`
      )}
      ${kartenHTML()}
      <span class="badge gesperrt">Gesperrt</span>
      <div class="card">
        <dl class="daten">
          <div><dt>Reguläre Parkdauer</dt><dd>Nicht in den Geodaten enthalten</dd></div>
          <div><dt>Preis</dt><dd>Vor Ort prüfen</dd></div>
          <div><dt>Aktuell nutzbar</dt><dd>Nein</dd></div>
        </dl>
      </div>
      ${hinweis(
        'Diese Zone ist wegen einer Baustelle nicht nutzbar. ' +
        'Wähle eine andere Ladezone für deinen Stopp.',
        true
      )}
      <div class="aktionen unten">
        ${knopf('Andere Parkflächen ansehen', 'liste', 'secondary')}
      </div>
    `
  }
  // 15 – PROBLEM MELDEN
  if (seite === 15) {
    const gruende = [
      [
        'Platz ist blockiert',
        'Ein Fahrzeug oder Hindernis versperrt die Zone.'
      ],
      [
        'Sperrung vor Ort',
        'Die Ladezone ist aktuell nicht zugänglich.'
      ],
      [
        'Angaben stimmen nicht',
        'Zeitfenster oder Beschilderung weichen ab.'
      ]
    ]
    return `
      ${titel('Was ist vor Ort los?', 'Wähle den passenden Meldegrund.')}
      <div class="zonenliste">
        ${gruende.map(([name, beschreibung], index) => `
          <button class="zonenkarte" data-action="melden:${index}">
            ${icon('warnung')}
            <span class="zonentext">
              <strong>${sicher(name)}</strong>
              <span>${sicher(beschreibung)}</span>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        `).join('')}
      </div>
      ${hinweis(
        'Wenn du hier nicht entladen kannst, wähle eine andere Zone.'
      )}
      <div class="aktionen unten">
        ${knopf('Abbrechen', 'zur-ankunft', 'secondary')}
      </div>
    `
  }
  // 16 – MELDUNG BESTÄTIGT
  if (seite === 16) {
    return `
      ${titel(
        'Danke für deinen Hinweis.',
        'Deine Meldung wurde auf diesem Gerät gespeichert.'
      )}
      <div class="bestaetigung">
        <div class="erfolgskreis neutral">${icon('check')}</div>
        <h2>Wie geht es weiter?</h2>
        <p>${sicher(zustand.meldung)}</p>
        <p>Prüfe eine andere Ladezone für deine aktuelle Lieferung.</p>
      </div>
      <div class="aktionen">
        ${knopf('Andere Ladezone finden', 'ergebnisse')}
        ${knopf('Zur Startseite', 'start', 'secondary')}
      </div>
    `
  }
  // 17 – LIEFERUNG ABGESCHLOSSEN – URBAN REDESIGN
  if (seite === 17) {
    return `
      <section class="ds-erfolg-seite">
        <header class="ds-erfolg-kopf">
          <span class="ds-erfolg-eyebrow">LIEFERSTOPP · ABGESCHLOSSEN</span>
          <h1>Lieferung abgeschlossen</h1>
          <p>Dein Lieferstopp ist beendet.</p>
        </header>

        <section class="ds-erfolg-hero" aria-label="Erfolgreich abgeschlossen">
          <span class="ds-erfolg-symbol">${icon('check')}</span>
          <div class="ds-erfolg-hero-text">
            <span>ERFOLGREICH ERLEDIGT</span>
            <h2>Geschafft!</h2>
            <p>Deine Lieferung ist abgeschlossen.</p>
          </div>
        </section>

        <section class="ds-erfolg-adresskarte">
          <div class="ds-erfolg-adresskopf">
            <span class="ds-erfolg-standorticon">${icon('pin')}</span>
            <div>
              <small>ABGESCHLOSSENER LIEFERSTOPP</small>
              <strong>${sicher(zustand.adresse || 'Lieferadresse')}</strong>
            </div>
          </div>
          <span class="ds-erfolg-status">${icon('check')} Lieferung abgeschlossen</span>
        </section>

        <div class="ds-erfolg-aktionen">
          ${knopf('Nächste Lieferung planen', 'neu')}
          ${knopf('Zur Startseite', 'start', 'secondary')}
        </div>
      </section>
    `
  }
  // 18 – MERKLISTE
  if (seite === 18) {
    return `
      <section class="ds-profil-head">
        <span class="ds-profil-eyebrow">DEINE GESPEICHERTEN PARKFLÄCHEN</span>
        <h1>Merkliste</h1>
        <p>Gespeicherte Parkflächen schnell wiederfinden.</p>
      </section>
      ${merkliste.length ? `
        <div class="ds-merk-counter">${merkliste.length} ${merkliste.length === 1 ? 'Eintrag' : 'Einträge'} gespeichert</div>
        <section class="ds-merk-liste" aria-label="Gespeicherte Parkflächen">
          ${merkliste.map((eintrag, index) => `
            <article class="ds-merk-item">
              <div class="ds-merk-marker" aria-hidden="true">${icon('pin')}</div>
              <div class="ds-merk-inhalt">
                <strong>${sicher(eintrag.standortName || eintrag.standortId || 'Ältere Parkfläche')}</strong>
                <p>${sicher(eintrag.adresse)}</p>
                <button class="ds-merk-link" type="button" data-action="merk-oeffnen:${index}">
                  Details ansehen →
                </button>
              </div>
              <button class="ds-merk-entfernen" type="button"
                data-action="merk-loeschen:${index}"
                aria-label="Parkfläche aus Merkliste entfernen"
                title="Aus Merkliste entfernen">×</button>
            </article>
          `).join('')}
        </section>
      ` : `
        <section class="ds-merk-leer">
          <div class="ds-merk-leericon">${icon('herz')}</div>
          <h2>Noch keine Parkflächen gespeichert</h2>
          <p>Wenn du eine Parkfläche öffnest, kannst du sie dort zur Merkliste hinzufügen.</p>
        </section>
      `}
      <p class="ds-merk-hinweis">Parkregeln und die aktuelle Nutzbarkeit immer vor Ort prüfen.</p>
    `
  }
  // 19 – FAHRZEUGPROFIL
  if (seite === 19) {
    return `
      <section class="ds-profil-head">
        <span class="ds-profil-eyebrow">DEIN LIEFERFAHRZEUG</span>
        <h1>Fahrzeugprofil</h1>
        <p>Verwalte deine Fahrzeugangaben für die Lieferplanung.</p>
      </section>
      <section class="ds-fahrzeug-hero">
        <div class="ds-fahrzeug-icon">${icon('fahrzeug')}</div>
        <div class="ds-fahrzeug-hero-text">
          <small>AKTUELLES FAHRZEUG</small>
          <strong>${sicher(zustand.fahrzeug.name)}</strong>
          <span>${sicher(zustand.fahrzeug.typ)} · ${sicher(zustand.fahrzeug.gewicht)}</span>
        </div>
      </section>
      <form id="fahrzeugformular" class="ds-fahrzeug-form">
        <h2>Fahrzeugangaben bearbeiten</h2>
        <div class="ds-fahrzeug-feld">
          <label for="fahrzeugname">Fahrzeugname</label>
          <input id="fahrzeugname" name="name" required maxlength="60"
            value="${sicher(zustand.fahrzeug.name)}">
        </div>
        <div class="ds-fahrzeug-feld">
          <label for="fahrzeugtyp">Fahrzeugtyp</label>
          <select id="fahrzeugtyp" name="typ">
            ${['Lieferwagen', 'Personenwagen', 'Lastwagen'].map((typ) => `
              <option value="${typ}" ${zustand.fahrzeug.typ === typ ? 'selected' : ''}>${typ}</option>
            `).join('')}
          </select>
        </div>
        <div class="ds-fahrzeug-feld">
          <label for="fahrzeuggewicht">Gesamtgewicht</label>
          <select id="fahrzeuggewicht" name="gewicht">
            ${['Bis 3,5 t', 'Über 3,5 t'].map((gewicht) => `
              <option value="${gewicht}" ${zustand.fahrzeug.gewicht === gewicht ? 'selected' : ''}>${gewicht}</option>
            `).join('')}
          </select>
        </div>
        <p class="ds-fahrzeug-hinweis">Zulässiges Gewicht und örtliche Parkbedingungen vor dem Halten prüfen.</p>
        <button class="button primary ds-fahrzeug-speichern" type="submit">Speichern und Lieferung planen →</button>
      </form>
    `
  }
  // 20 – INFO UND HILFE
  return `
    <div class="ds-info-page">
      <header class="ds-info-hero">
        <div class="ds-info-eyebrow">DELIVERYSPOT · HILFE</div>
        <h1>Gut zu wissen</h1>
        <p>Dein Begleiter für eine übersichtliche Lieferplanung in Bern.</p>
        <div class="ds-info-hero-bottom">${icon('info')} <span>Einfach planen. Sicher vor Ort prüfen.</span></div>
      </header>

      <section class="ds-info-section" aria-labelledby="ds-info-ablauf">
        <h2 id="ds-info-ablauf" class="ds-info-section-title">So funktioniert DeliverySpot</h2>
        <div class="ds-info-steps">
          <article class="ds-info-step">
            <span class="ds-info-step-number">01</span>
            <div><h3>Lieferziel auswählen</h3><p>Gib Strasse und Hausnummer in der Stadt Bern ein.</p></div>
          </article>
          <article class="ds-info-step">
            <span class="ds-info-step-number">02</span>
            <div><h3>Ladezonen vergleichen</h3><p>Prüfe Entfernung, bekannte Angaben und die Beschilderung.</p></div>
          </article>
          <article class="ds-info-step">
            <span class="ds-info-step-number">03</span>
            <div><h3>Stopp planen und liefern</h3><p>Wähle eine Parkfläche und prüfe sie bei deiner Ankunft.</p></div>
          </article>
        </div>
      </section>

      <section class="ds-info-section" aria-labelledby="ds-info-fragen">
        <h2 id="ds-info-fragen" class="ds-info-section-title">Häufige Fragen</h2>
        <div class="ds-info-faq-list">
          <article class="ds-info-faq"><h3>Ist eine Zone automatisch frei?</h3><p>Nein. Die Belegung prüfst du vor Ort.</p></article>
          <article class="ds-info-faq"><h3>Kann ich einen Platz reservieren?</h3><p>Nein. Deine Auswahl plant nur den Stopp.</p></article>
          <article class="ds-info-faq"><h3>Was öffnet der Google-Maps-Button?</h3><p>Die Routenplanung zu deiner gefundenen Lieferadresse.</p></article>
        </div>
      </section>
      <div class="ds-info-actions">${knopf('Lieferung planen', 'start')}</div>
    </div>
  `
}
// ==================================================
// NAVIGATION UND DARSTELLUNG
// ==================================================
function navigation() {
  const aktiv = zustand.seite === 18
    ? 'merkliste'
    : zustand.seite === 19
      ? 'fahrzeug'
      : zustand.seite === 20
        ? 'info'
        : 'suche'
  const eintraege = [
    ['suche', 'suche', 'Suche', 'start'],
    ['merkliste', 'herz', 'Merkliste', 'seite:18'],
    ['fahrzeug', 'fahrzeug', 'Fahrzeug', 'seite:19'],
    ['info', 'info', 'Info', 'seite:20']
  ]
  return `
    <nav class="navigation" aria-label="Hauptnavigation">
      ${eintraege.map(([id, symbol, label, aktion]) => `
        <button class="${aktiv === id ? 'aktiv' : ''}"
          data-action="${aktion}"
          ${aktiv === id ? 'aria-current="page"' : ''}>
          ${icon(symbol)}
          <small>${label}</small>
        </button>
      `).join('')}
    </nav>
  `
}
let karte = null
function rendern() {
  if (karte) {
    karte.remove()
    karte = null
  }
  const ohneNavigation = [5, 6, 9, 10, 12, 13, 15, 16, 17, 21]
    .includes(zustand.seite)
  app.innerHTML = `
    <div class="app">
      <div class="statuszeile">
        <span>LIEFERN. EINFACHER.</span>
        <span>${uhrzeit()}</span>
      </div>
      <header class="kopf">
        ${zustand.seite === 1
          ? '<span class="logo">D</span>'
          : `
            <button class="zurueck" data-action="zurueck"
              aria-label="Zurück">←</button>
          `}
        <strong>DeliverySpot</strong>
        <span class="stadt">Bern</span>
      </header>
      <main>
        ${parkingTimer.aktiv && ![10, 13].includes(zustand.seite) ? `
          <button class="parking-timer-mini" data-action="timer-zeigen">
            ⏱ Parking Timer · Zone ${parkingTimer.zone} · <strong id="parking-timer-mini-zeit">${timerZeit(timerRest())}</strong> →
          </button>
        ` : ''}
        ${seitenInhalt()}
      </main>
      ${ohneNavigation ? '' : navigation()}
      <div class="home-indikator" aria-hidden="true"></div>
    </div>
  `
  karteZeichnen()
  if (zustand.seite === 21) {
    navAnsichtAktualisieren()
    requestAnimationFrame(() => {
      if (zustand.seite === 21 && karte) {
        karte.invalidateSize()
        navAnsichtAktualisieren()
      }
    })
  }
  spracheAnwenden(zustand.seite === 1, rendern)

  // Bestehende Sprachauswahl aus i18n.js rechts neben dem Logo anzeigen.
  // Die Original-Events und das Speichern der Sprache bleiben erhalten.
  if (zustand.seite === 1) {
    const auswahlBereich = app.querySelector('.sprachwahl')
    const ziel = app.querySelector('.kopf')
    const auswahl = auswahlBereich?.querySelector('#app-sprache')
    if (auswahlBereich && ziel && auswahl) {
      const kuerzel = { de: 'DE', fr: 'FR', it: 'IT', rm: 'RM', en: 'EN' }
      Array.from(auswahl.options).forEach(option => {
        option.textContent = kuerzel[option.value] || option.value.toUpperCase()
      })
      // Label komplett aus dem DOM entfernen, nicht nur visuell ausblenden.
      auswahlBereich.querySelector('label')?.remove()
      auswahl.setAttribute('aria-label', 'Sprache auswählen')
      auswahlBereich.classList.add('ds-header-language')
      ziel.appendChild(auswahlBereich)
    }
  }
}
function karteZeichnen() {
  const element = document.querySelector('#karte')
  if (!element) return
  const istNavigation = zustand.seite === 21
  const position = zustand.position || [46.948, 7.4474]
  karte = L.map(element, {
    scrollWheelZoom: false,
    zoomControl: zustand.seite !== 1
  }).setView(position, 15)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(karte)
  if (istNavigation) {
    const punkt = navigationLive.ziel
    if (punkt) L.marker(punkt).addTo(karte).bindTooltip('Parkplatz', { permanent: true })
    if (punkt) karte.setView(punkt, 15)
    navigationLive.marker = null
    navigationLive.linie = null
    navRouteZeichnen()
    karte.on('dragstart', () => { navigationLive.folgen = false })
    navKarteAusrichten()
    return
  }
  if (!zustand.position) return
  const ziel = L.circleMarker(position, {
    radius: 8,
    color: '#111',
    weight: 2,
    fillColor: '#fff',
    fillOpacity: 1
  }).addTo(karte)
  ziel.bindTooltip('Lieferziel', {
    permanent: true,
    direction: 'top'
  })
  const grenzen = L.latLngBounds([position])
  const sichtbar = [3, 4, 7].includes(zustand.seite)
    ? passendeZonen()
    : aktuelleZone() ? [aktuelleZone()] : []
  sichtbar.forEach((zone) => {
    const punkt = zonenPosition(zone)
    grenzen.extend(punkt)
    const ausgewaehlt =
      [8, 9, 10, 11, 12, 13, 14].includes(zustand.seite) &&
      zustand.zone === zone.id
    const marker = L.marker(punkt, {
      keyboard: true,
      title: zone.name,
      alt: zone.name,
      icon: L.divIcon({
        className: 'zonen-marker',
        html: `
          <span class="
            ${zone.gesperrt ? 'marker-gesperrt' : ''}
            ${ausgewaehlt ? 'marker-ausgewaehlt' : ''}
          ">${sicher(zone.nummer)}</span>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      })
    }).addTo(karte)
    marker.on('click', () => zoneOeffnen(zone.id))
  })
  if ([9, 12].includes(zustand.seite) && aktuelleZone()) {
    L.polyline(
      [zonenPosition(aktuelleZone()), position],
      {
        color: '#111',
        weight: 4,
        dashArray: '7 7'
      }
    ).addTo(karte)
  }
  karte.fitBounds(grenzen, {
    padding: [34, 34],
    maxZoom: 17
  })
}
// ==================================================
// FAVORITEN UND MERKLISTE
// ==================================================
function istGemerkt(standortId) {
  return merkliste.some(e => e.standortId === standortId)
}
function merklisteUmschalten() {
  const zone = aktuelleZone()
  if (!zustand.position || !zone) return
  if (istGemerkt(zone.id)) {
    merkliste = merkliste.filter(e => e.standortId !== zone.id)
  } else {
    merkliste.push({
      standortId: zone.id,
      standortName: zone.name,
      adresse: zustand.adresse,
      position: [...zustand.position]
    })
  }
  speichern('ds-merkliste', merkliste)
  rendern()
}

function adresseMerken() {
  if (!zustand.adresse || !zustand.position) return

  if (adressFavoriten.includes(zustand.adresse)) {
    // Adresse aus Favoriten entfernen
    adressFavoriten = adressFavoriten.filter(
      adresse => adresse !== zustand.adresse
    )
  } else {
    // Adresse als Favorit speichern
    adressFavoriten.push(zustand.adresse)
  }

  speichern('deliveryspot-favoriten', adressFavoriten)
  rendern()
}
// ==================================================
// BUTTON-AKTIONEN
// ==================================================
app.addEventListener('click', (event) => {
  const element = event.target.closest('[data-action]')
  if (!element || element.disabled) return
  const [aktion, wert] = element.dataset.action.split(':')
  switch (aktion) {
    case 'nav-start':
      navStarten()
      break
    case 'nav-ende':
      geheZu(wegSeiten[zustand.zone] || 9)
      break
    case 'nav-follow':
      navigationLive.folgen = true
      if (!navigationLive.position) navMeldung(navKartenText('gps'))
      navKarteAusrichten()
      break
    case 'nav-overview':
      navigationLive.folgen = false
      navKarteAusrichten()
      break
    case 'nav-neu':
      navigationLive.route = null
      navRouteBerechnen()
      break
    case 'nav-stimme':
      navigationLive.stimme = !navigationLive.stimme
      if (!navigationLive.stimme && 'speechSynthesis' in window) window.speechSynthesis.cancel()
      rendern()
      break
    case 'timer-start':
        if (parkingTimer.zone !== zustand.zone) timerZuruecksetzen(zustand.zone)
        if (timerRest() <= 0) timerZuruecksetzen(zustand.zone)
        parkingTimer.ende = Date.now() + timerRest() * 1000
        parkingTimer.aktiv = true
        timerSpeichern()
        rendern()
        break

    case 'timer-pause':
        parkingTimer.rest = timerRest()
        parkingTimer.aktiv = false
        parkingTimer.ende = null
        timerSpeichern()
        rendern()
        break

    case 'timer-reset':
        timerZuruecksetzen(zustand.zone)
        rendern()
        break

    case 'timer-zeigen':
        zustand.zone = parkingTimer.zone
        geheZu(ankunftSeiten[parkingTimer.zone] || 10)
        break


    case 'seite':
      geheZu(Number(wert))
      break
    case 'start':
      verlauf = []
      geheZu(1, false)
      break
    case 'zurueck':
      geheZu(verlauf.pop() || 1, false)
      break
    case 'bearbeiten':
      zustand.treffer = []
      geheZu(1)
      document.querySelector('#adresse')?.focus()
      break
    case 'adresse':
      adresseUebernehmen(Number(wert))
      break
    case 'adresse-merken':
      adresseMerken()
      break
    case 'adressfavorit': {
      const adresse = adressFavoriten[Number(wert)]
      if (adresse) adresseSuchen(adresse)
      break
    }
    case 'adressfavorit-loeschen':
      adressFavoriten.splice(Number(wert), 1)
      speichern('deliveryspot-favoriten', adressFavoriten)
      rendern()
      break
    case 'ergebnisse':
    case 'karte':
      ergebnisseOeffnen()
      break
    case 'liste':
      geheZu(4)
      break
    case 'zone':
      zoneOeffnen(wert)
      break
    case 'filter':
      zustand.entwurfRadius = zustand.radius
      zustand.entwurfParkdauer = zustand.parkdauer
      geheZu(zustand.radius === 150 ? 6 : 5)
      break
    case 'radius':
      zustand.entwurfRadius = Number(wert)
      geheZu(Number(wert) === 150 ? 6 : 5, false)
      break
    case 'filter-reset':
      zustand.entwurfRadius = 500
      zustand.entwurfParkdauer = 0
      geheZu(5, false)
      break
    case 'filter-anwenden':
      zustand.radius = zustand.entwurfRadius
      zustand.parkdauer = zustand.entwurfParkdauer
      ergebnisseOeffnen()
      break
    case 'alle-filter-reset':
      zustand.radius = 500
      zustand.parkdauer = 0
      ergebnisseOeffnen()
      break
    case 'erweitern':
      zustand.radius = 500
      ergebnisseOeffnen()
      break
    case 'weg':
      if (!aktuelleZone().gesperrt) {
        geheZu(wegSeiten[zustand.zone])
      }
      break
    case 'angekommen':
    case 'zur-ankunft':
      if (!parkingTimer.aktiv && parkingTimer.zone !== zustand.zone) timerZuruecksetzen(zustand.zone)
      geheZu(ankunftSeiten[zustand.zone] || 3)
      break
    case 'verwerfen':
      verlauf = []
      ergebnisseOeffnen()
      break
    case 'abschliessen':
      timerZuruecksetzen(zustand.zone)
      geheZu(17)
      break
    case 'neu':
      zustand.adresse = ''
      zustand.position = null
      zustand.treffer = []
      zustand.radius = 500
      zustand.parkdauer = 0
      zustand.zone = null
      verlauf = []
      geheZu(1, false)
      break
    case 'merken':
      merklisteUmschalten()
      break
    case 'merk-oeffnen': {
      const eintrag = merkliste[Number(wert)]
      if (!eintrag) break
      zustand.adresse = eintrag.adresse
      zustand.position = [...eintrag.position]
      zustand.treffer = []
      letzteAdresseSpeichern(zustand.adresse)
      zonenAktualisieren()
      if (eintrag.standortId && zonen.some(z => z.id === eintrag.standortId)) {
        zoneOeffnen(eintrag.standortId)
      } else {
        geheZu(18)
        window.alert('Dieser gespeicherte Standort ist in den aktuellen Standortdaten nicht mehr vorhanden.')
      }
      break
    }
    case 'merk-loeschen':
      merkliste.splice(Number(wert), 1)
      speichern('ds-merkliste', merkliste)
      rendern()
      break
    case 'melden': {
      const gruende = [
        'Platz ist blockiert',
        'Sperrung vor Ort',
        'Angaben stimmen nicht'
      ]
      const grund = gruende[Number(wert)]
      if (!grund) break
      zustand.meldung = grund
      const bisher = lesen('ds-meldungen', [])
      const meldungen = Array.isArray(bisher) ? bisher : []
      meldungen.push({
        grund,
        zone: zustand.zone,
        adresse: zustand.adresse,
        zeit: new Date().toISOString()
      })
      speichern('ds-meldungen', meldungen)
      geheZu(16)
      break
    }
  }
})

// ==================================================
// EINGABEN UND FORMULARE
// ==================================================

app.addEventListener('input', (event) => {
  if (event.target.id !== 'adresse') return

  zustand.adresse = event.target.value
  zustand.position = null
  zustand.treffer = []

  // Alte Suchvorschläge entfernen
  document.querySelector('.treffer')?.remove()
})

// PARKING TIMER UND PARKDAUER-FILTER
app.addEventListener('change', (e) => {

  // Parking Timer
  if (e.target.id === 'timer-dauer') {
    const minuten = Number(e.target.value)

    if (
      !parkingTimer.aktiv &&
      [5, 10, 15, 20, 30, 45, 60].includes(minuten)
    ) {
      parkingTimer.dauer = minuten * 60
      parkingTimer.rest = minuten * 60
      parkingTimer.ende = null
      parkingTimer.gewarnt = false

      timerSpeichern()
      rendern()
    }
    return
  }

  // Parkdauer-Filter
  if (e.target.id !== 'parkdauer') return

  const wert = Number(e.target.value)

  if (e.target.dataset.filter === 'entwurf') {
    zustand.entwurfParkdauer = wert
  } else {
    zustand.parkdauer = wert
  }

  rendern()

  document.querySelector('#parkdauer')?.focus({
    preventScroll: true
  })
})

app.addEventListener('submit', (event) => {
  if (event.target.id === 'adressformular') {
    event.preventDefault()
    const daten = new FormData(event.target)
    adresseSuchen(String(daten.get('adresse') || ''))
  }
  if (event.target.id === 'fahrzeugformular') {
    event.preventDefault()
    const daten = new FormData(event.target)
    zustand.fahrzeug = {
      name: String(daten.get('name')).trim() || 'Mein Fahrzeug',
      typ: String(daten.get('typ')),
      gewicht: String(daten.get('gewicht'))
    }
    speichern('ds-fahrzeug', zustand.fahrzeug)
    geheZu(zustand.position ? 2 : 1)
  }
})
rendern()
standorteLaden()
