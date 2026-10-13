import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './style.css'
import { spracheAnwenden, sprachLocale } from './i18n.js'
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
  ? alteMerkliste.filter((eintrag) =>
      eintrag &&
      typeof eintrag.adresse === 'string' &&
      Array.isArray(eintrag.position) &&
      eintrag.position.length === 2 &&
      eintrag.position.every(Number.isFinite) &&
      ['A', 'B', 'C'].includes(eintrag.zone)
    )
  : []
const zustand = {
  seite: 1,
  adresse: letzteAdresseLesen(),
  position: null,
  radius: 500,
  parkdauer: 0,
  entwurfRadius: 500,
  entwurfParkdauer: 0,
  zone: 'A',
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
const detailSeiten = { A: 8, B: 11 }
const wegSeiten = { A: 9, B: 12 }
const ankunftSeiten = { A: 10, B: 13 }
function aktuelleZone() {
  return zonen.find(zone => zone.id === zustand.zone) || zonen[0]
}
function abstandMeter(a, b) {
  const rad = Math.PI / 180
  const dl = (b[0] - a[0]) * rad
  const dx = (b[1] - a[1]) * rad
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dx / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h))
}

function zonenAktualisieren() {
  if (!zustand.position) {
    zonen = []
    return
  }

  const alleStandorte = standorte
    .map(ort => ({
      ...ort,
      meter: Math.round(
        abstandMeter(zustand.position, [ort.lat, ort.lon])
      ),
      minuten: 20,
      zeit: 'Beschilderung vor Ort prüfen',
      gesperrt: false
    }))
    .filter(ort => ort.meter <= 1500)
    .sort((a, b) => a.meter - b.meter)

  const imRadius = alleStandorte.filter(
    ort => ort.meter <= zustand.radius
  )

  const auswahl = imRadius.length > 0
    ? imRadius
    : alleStandorte

  zonen = auswahl.slice(0, 2).map((ort, i) => ({
    ...ort,
    id: i === 0 ? 'A' : 'B',
    name: `${ort.typ} · ${ort.name}`
  }))
}


function passendeZonen(
  radius = zustand.radius,
  parkdauer = zustand.parkdauer
) {
  const innerhalb = zonen.filter(
    zone => zone.meter <= radius
  )

  if (innerhalb.length > 0) {
    return innerhalb
  }

  if (radius >= 500) {
    return zonen
  }

  return []
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
    rendern()
  } catch (fehler) {
    console.error('Standorte konnten nicht geladen werden:', fehler)
    zustand.fehler = 'Standortdaten konnten nicht geladen werden. Prüfe die Datei public/parkflaechen-bern.json.'
    rendern()
  }
}
// ==================================================
// PARKING TIMER (LOKAL GESPEICHERT)
// ==================================================

const timerGespeichert = lesen('ds-parking-timer', {}) || {}
let parkingTimer = {
  zone: ['A', 'B'].includes(timerGespeichert.zone) ? timerGespeichert.zone : 'A',
  dauer: Number.isFinite(timerGespeichert.dauer) ? timerGespeichert.dauer : 20 * 60,
  rest: Number.isFinite(timerGespeichert.rest) ? timerGespeichert.rest : 20 * 60,
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
  const zone = zonen.find(z => z.id === zoneId) || zonen[0] || { id: zoneId, minuten: 20 }

  parkingTimer = {
    zone: zone.id,
    dauer: zone.minuten * 60,
    rest: zone.minuten * 60,
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
      new Notification('DeliverySpot – Parking Timer', { body: 'Noch 2 Minuten bis zum Ende deiner Erinnerung!' })
    }
  }
  const zeitElement = document.querySelector('#parking-timer-zeit')
  const statusElement = document.querySelector('#parking-timer-status')
  const progressElement = document.querySelector('#parking-timer-progress')
  if (zeitElement) zeitElement.textContent = timerZeit(timerRest())
  if (statusElement) statusElement.textContent = timerStatus()
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
          <dt>Fahrzeug</dt>
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
      <span class="zonenbuchstabe">${zone.id}</span>
      <span class="zonentext">
        <strong>${sicher(zone.name)}</strong>
        <span>${zone.meter} m Luftlinie zum Lieferziel</span>
        <span>
          ${zone.gesperrt
            ? 'Aktuell gesperrt'
            : `Kostenlos · Parkdauer vor Ort prüfen`}
        </span>
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
  // Ansichten mit Lieferziel nur nach erfolgreicher Suche öffnen.
  if (seite >= 2 && seite <= 17 && !zustand.position) {
    seite = 1
  }
  if (merken && seite !== zustand.seite) {
    verlauf.push(zustand.seite)
  }
  zustand.seite = seite
  zustand.fehler = ''
  if ([8, 9, 10].includes(seite)) zustand.zone = 'A'
  if ([11, 12, 13].includes(seite)) zustand.zone = 'B'
  if (seite === 14) zustand.zone = 'C'
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
  if (!detailSeiten[id] || !zonen.some(zone => zone.id === id)) return
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
  const seite = zustand.seite
  const zone = aktuelleZone()
  // 01 – STARTSEITE
  if (seite === 1) {
    return `
      ${titel(
        'Dein nächster Stopp.',
        'Ladezonen finden. Bedingungen prüfen. Liefern.'
      )}
      <form id="adressformular" class="card adressformular">
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
      ${knopf('So funktioniert DeliverySpot', 'seite:20', 'secondary')}
      ${adressFavoritenHTML()}
    `
  }
  // 02 – LIEFERADRESSE
  if (seite === 2) {
    const gemerkt = adressFavoriten.includes(zustand.adresse)
    return `
      ${titel('Wohin geht die Lieferung?', 'Prüfe dein Lieferziel.')}
      <p class="eyebrow">DEINE ADRESSE</p>
      <button class="card adressauswahl" data-action="bearbeiten">
        ${icon('pin')}
        <span>
          <strong>${sicher(zustand.adresse)}</strong>
          <small>Lieferadresse ändern</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>
      ${lieferdaten()}
      <div class="aktionen unten">
        ${knopf('Ladezonen anzeigen', 'ergebnisse')}
        ${knopf(
          gemerkt ? '♥ Adresse gespeichert' : '♡ Adresse als Favorit speichern',
          'adresse-merken',
          'secondary'
        )}
        ${googleMapsLink()}
        ${knopf('Fahrzeug ansehen', 'seite:19', 'secondary')}
      </div>
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
      ${parkdauerAuswahl()}
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
      ${zustand.radius === 150
        ? knopf('Radius auf 500 m erweitern', 'erweitern')
        : seite === 3
          ? knopf('Alle Zonen als Liste ansehen', 'liste', 'secondary')
          : ''}
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
  // 08 – DETAILS ZONE A
  // 11 – DETAILS ZONE B
  if ([8, 11].includes(seite)) {
    return `
      ${titel(zone.name, `${zone.meter} m Luftlinie zum Lieferziel`)}
      ${kartenHTML()}
      <span class="badge">Belegung unbekannt</span>
      <div class="card">
        <dl class="daten">
          <div>
            <dt>Lieferzeit</dt>
            <dd>${sicher(zone.zeit)}</dd>
          </div>
          <div>
            <dt>Max. Parkdauer</dt>
            <dd>Beschilderung vor Ort prüfen</dd>
          </div>
          <div>
            <dt>Preis</dt>
            <dd>Kostenlos bis zu 60 min</dd>
          </div>
          <div>
            <dt>Gesamtgewicht</dt>
            <dd>bis 3,5 t</dd>
          </div>
          <div>
            <dt>Nutzung</dt>
            <dd>${sicher(zone.typ)} – Nutzbarkeit prüfen</dd>
          </div>
        </dl>
      </div>
      ${zustand.fahrzeug.gewicht === 'Über 3,5 t'
        ? hinweis(
            'Dein Fahrzeugprofil liegt über dem für diese Zone angegebenen Gewicht.',
            true
          )
        : ''}
      <p class="klein">
        Beschilderung vor Ort beachten.
        Die Auswahl reserviert keinen Platz.
      </p>
      <div class="aktionen unten">
        ${knopf('Diese Zone wählen · Weg ansehen', 'weg')}
        ${knopf(
          istGemerkt(zone.id)
            ? '♥ Aus Merkliste entfernen'
            : '♡ In Merkliste speichern',
          'merken',
          'secondary'
        )}
        ${zonen.length > 1 ? knopf(
          `Zone ${zone.id === 'A' ? 'B' : 'A'} vergleichen`,
          `zone:${zone.id === 'A' ? 'B' : 'A'}`,
          'secondary'
        ) : ''}
      </div>
    `
  }
  // 09 – WEG ZU ZONE A
  // 12 – WEG ZU ZONE B
  if ([9, 12].includes(seite)) {
    return `
      ${titel(
        'Dein Weg zur Ladezone',
        `${zone.name} · ${zustand.adresse}`
      )}
      ${kartenHTML(true)}
      <div class="card">
        <h2>${sicher(zone.name)}</h2>
        <p>${zone.meter} m Luftlinie zum Lieferziel</p>
        <p>Parkdauer vor Ort prüfen · Kostenlos</p>
        <p class="klein">
          Die gestrichelte Linie dient zur Orientierung
          und ist keine berechnete Strassenroute.
        </p>
      </div>
      <div class="aktionen unten">
        <a class="button primary" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/dir/?api=1&destination=${zone.lat}%2C${zone.lon}&travelmode=driving">Zum Parkplatz navigieren →</a>
        ${googleMapsLink()}
        ${knopf('Ich bin angekommen', 'angekommen')}
        ${zonen.length > 1 ? knopf(
          `Alternative: Zone ${zone.id === 'A' ? 'B' : 'A'} prüfen`,
          `zone:${zone.id === 'A' ? 'B' : 'A'}`,
          'secondary'
        ) : ''}
        ${knopf('Stopp verwerfen', 'verwerfen', 'soft')}
      </div>
    `
  }
  // 10 – ANKUNFT ZONE A
  // 13 – ANKUNFT ZONE B
  if ([10, 13].includes(seite)) {
    return `
      ${titel('An der Ladezone', `${zone.name} · dein Lieferstopp`)}
      <div class="card">
        <h2 class="titel-mit-icon">
          ${icon('fahrzeug')}
          Vor dem Entladen prüfen
        </h2>
        <ul class="pruefliste">
          <li>Ist die Fläche tatsächlich nutzbar?</li>
          <li>Passt die Beschilderung zum Fahrzeug?</li>
          <li>Bleiben Zufahrten und Wege frei?</li>
        </ul>
      </div>
      <div class="zeitkarte">
        ${icon('uhr')}
        <div>
          <h2>Parkdauer vor Ort prüfen</h2>
          <p>Standortdaten der Stadt Bern · keine Belegungsdaten</p>
        </div>
      </div>
      ${timerKarte()}

      <div class="aktionen unten">
        ${knopf('Lieferung abgeschlossen', 'abschliessen')}
        ${knopf('Problem melden', 'seite:15', 'secondary')}
        ${knopf(
  `Andere Zone: ${zone.id === 'A' ? 'B' : 'A'} prüfen`,
  `zone:${zone.id === 'A' ? 'B' : 'A'}`,
  'secondary'
)}
        ${knopf('Stopp verwerfen', 'verwerfen', 'soft')}
      </div>
    `
  }
  // 14 – GESPERRTE LADEZONE
  if (seite === 14) {
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
        ${knopf('Zone A prüfen · 120 m', 'zone:A')}
        ${knopf('Zone B prüfen · 180 m', 'zone:B', 'secondary')}
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
  // 17 – LIEFERUNG ABGESCHLOSSEN
  if (seite === 17) {
    return `
      ${titel('Lieferung abgeschlossen', 'Dein Lieferstopp ist beendet.')}
      <div class="bestaetigung">
        <div class="erfolgskreis">${icon('check')}</div>
        <h2>Geschafft!</h2>
      </div>
      <div class="card">
        <h2>${sicher(zustand.adresse)}</h2>
        <span class="badge erledigt">Lieferung abgeschlossen</span>
      </div>
      <div class="aktionen unten">
        ${knopf('Nächste Lieferung planen', 'neu')}
        ${knopf('Zur Startseite', 'start', 'secondary')}
      </div>
    `
  }
  // 18 – MERKLISTE
  if (seite === 18) {
    return `
      ${titel(
        'Deine Merkliste',
        'Deine gespeicherten Ladezonen auf einen Blick.'
      )}
      ${merkliste.length
        ? merkliste.map((eintrag, index) => `
            <div class="card merkkarte">
              <button class="merk-oeffnen"
                data-action="merk-oeffnen:${index}">
                <strong>Zone ${sicher(eintrag.zone)}</strong>
                <span>${sicher(eintrag.adresse)}</span>
                <small>Details ansehen →</small>
              </button>
              <button class="entfernen"
                data-action="merk-loeschen:${index}"
                aria-label="Zone aus Merkliste entfernen">
                ×
              </button>
            </div>
          `).join('')
        : `
          <div class="card">
            <h2>Noch keine gespeicherten Zonen</h2>
            <p>
              Öffne eine Zone und tippe auf
              „In Merkliste speichern“.
            </p>
          </div>
        `}
      ${hinweis(
        'Vor jedem Stopp prüfen: Zeitfenster und Einschränkungen können sich ändern.'
      )}
      <div class="aktionen unten">
        ${knopf('Weitere Ladezonen suchen', 'start')}
      </div>
    `
  }
  // 19 – FAHRZEUGPROFIL
  if (seite === 19) {
    return `
      ${titel(
        'Dein Fahrzeug',
        'Die wichtigsten Angaben für deine Lieferung.'
      )}
      <div class="fahrzeugkarte">
        ${icon('fahrzeug')}
        <h2>${sicher(zustand.fahrzeug.name)}</h2>
        <p>Für kurze Stopps in der Stadt</p>
      </div>
      <form id="fahrzeugformular" class="fahrzeugformular">
        <div class="card">
          <label for="fahrzeugname">Fahrzeugname</label>
          <input id="fahrzeugname" name="name"
            required maxlength="60"
            value="${sicher(zustand.fahrzeug.name)}">
          <label for="fahrzeugtyp">Fahrzeugtyp</label>
          <select id="fahrzeugtyp" name="typ">
            ${['Lieferwagen', 'Personenwagen', 'Lastwagen']
              .map((typ) => `
                <option value="${typ}"
                  ${zustand.fahrzeug.typ === typ ? 'selected' : ''}>
                  ${typ}
                </option>
              `).join('')}
          </select>
          <label for="fahrzeuggewicht">Gesamtgewicht</label>
          <select id="fahrzeuggewicht" name="gewicht">
            ${['Bis 3,5 t', 'Über 3,5 t']
              .map((gewicht) => `
                <option value="${gewicht}"
                  ${zustand.fahrzeug.gewicht === gewicht ? 'selected' : ''}>
                  ${gewicht}
                </option>
              `).join('')}
          </select>
        </div>
        ${hinweis(
          'Vergleiche das zulässige Gewicht und die Nutzungszeiten mit deinem Fahrzeug.'
        )}
        <button class="button primary" type="submit">
          Speichern und Lieferung planen
        </button>
      </form>
    `
  }
  // 20 – INFO UND HILFE
  return `
    ${titel(
      'Gut zu wissen',
      'So begleitet dich DeliverySpot im Lieferalltag.'
    )}
    <div class="card">
      <h2>1. Lieferziel auswählen</h2>
      <p>Gib Strasse und Hausnummer in der Stadt Bern ein.</p>
    </div>
    <div class="card">
      <h2>2. Ladezonen vergleichen</h2>
      <p>Prüfe Entfernung, bekannte Angaben und die Beschilderung.</p>
    </div>
    <div class="card">
      <h2>3. Stopp planen und liefern</h2>
      <p>Wähle eine Zone und prüfe sie bei deiner Ankunft.</p>
    </div>
    <div class="card">
      <h2>Ist eine Zone automatisch frei?</h2>
      <p>Nein. Die Belegung prüfst du vor Ort.</p>
    </div>
    <div class="card">
      <h2>Kann ich einen Platz reservieren?</h2>
      <p>Nein. Deine Auswahl plant nur den Stopp.</p>
    </div>
    <div class="card">
      <h2>Was öffnet der Google-Maps-Button?</h2>
      <p>Die Routenplanung zu deiner gefundenen Lieferadresse.</p>
    </div>
    ${knopf('Lieferung planen', 'start')}
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
  const ohneNavigation = [5, 6, 9, 10, 12, 13, 15, 16, 17]
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
  spracheAnwenden(zustand.seite === 1, rendern)
}
function karteZeichnen() {
  const element = document.querySelector('#karte')
  if (!element) return
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
  const sichtbar = [3, 7].includes(zustand.seite)
    ? passendeZonen()
    : zonen
  sichtbar.forEach((zone) => {
    const punkt = zonenPosition(zone)
    grenzen.extend(punkt)
    const ausgewaehlt =
      [8, 9, 11, 12, 14].includes(zustand.seite) &&
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
          ">${zone.id}</span>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      })
    }).addTo(karte)
    marker.on('click', () => zoneOeffnen(zone.id))
  })
  if ([9, 12].includes(zustand.seite)) {
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
function istGemerkt(zone) {
  return merkliste.some((eintrag) =>
    eintrag.zone === zone &&
    eintrag.adresse === zustand.adresse
  )
}
function merklisteUmschalten() {
  if (!zustand.position) return
  if (istGemerkt(zustand.zone)) {
    merkliste = merkliste.filter((eintrag) =>
      !(eintrag.zone === zustand.zone &&
        eintrag.adresse === zustand.adresse)
    )
  } else {
    merkliste.push({
      zone: zustand.zone,
      adresse: zustand.adresse,
      position: [...zustand.position]
    })
  }
  speichern('ds-merkliste', merkliste)
  rendern()
}
function adresseMerken() {
  if (!zustand.position) return
  if (!adressFavoriten.includes(zustand.adresse)) {
    adressFavoriten.push(zustand.adresse)
    speichern('deliveryspot-favoriten', adressFavoriten)
  }
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
      zustand.zone = 'A'
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
      zoneOeffnen(eintrag.zone)
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
