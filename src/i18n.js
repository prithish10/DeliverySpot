// SPRACHEN: Deutsch, Französisch, Italienisch,
// Rumantsch Grischun und Englisch.

const sprachen = [
  { code: 'de', name: 'Deutsch', locale: 'de-CH' },
  { code: 'fr', name: 'Français', locale: 'fr-CH' },
  { code: 'it', name: 'Italiano', locale: 'it-CH' },
  { code: 'rm', name: 'Rumantsch', locale: 'rm-CH' },
  { code: 'en', name: 'English', locale: 'en-GB' }
]

let aktuelleSprache = 'de'

try {
  const gespeichert = localStorage.getItem('deliveryspot-sprache')

  if (sprachen.some((sprache) => sprache.code === gespeichert)) {
    aktuelleSprache = gespeichert
  }
} catch {
  // Die Sprache funktioniert auch ohne Browserspeicher.
}

// Reihenfolge pro Zeile:
// Deutsch | Französisch | Italienisch | Rätoromanisch | Englisch

const texte = `
LIEFERN. EINFACHER. | LIVRER. PLUS SIMPLEMENT. | CONSEGNARE. PIÙ FACILE. | LIVRAR. PLI SIMPEL. | DELIVER. MORE EASILY.
Dein nächster Stopp. | Votre prochain arrêt. | La tua prossima sosta. | Tes proxim stop. | Your next stop.
Ladezonen finden. Bedingungen prüfen. Liefern. | Trouver une zone de livraison. Vérifier les conditions. Livrer. | Trova una zona di carico. Verifica le condizioni. Consegna. | Chattar zonas da chargiar. Examinar las cundiziuns. Livrar. | Find loading zones. Check conditions. Deliver.
Wo möchtest du liefern? | Où souhaitez-vous livrer ? | Dove vuoi consegnare? | Nua vuls ti livrar? | Where are you delivering?
Lieferadresse in der Stadt Bern | Adresse de livraison en ville de Berne | Indirizzo di consegna nella città di Berna | Adressa da consegna en la citad da Berna | Delivery address in the city of Bern
Strasse und Hausnummer, Bern | Rue et numéro, Berne | Via e numero civico, Berna | Via e numer da chasa, Berna | Street and house number, Bern
Adresse wird gesucht … | Recherche de l’adresse… | Ricerca dell’indirizzo… | Tschertgar l’adressa… | Searching for address…
Ladezonen finden → | Trouver des zones de livraison → | Trova zone di carico → | Chattar zonas da chargiar → | Find loading zones →
Deine Lieferadresse wird geprüft. | Vérification de votre adresse de livraison. | Verifica dell’indirizzo di consegna. | Tia adressa da consegna vegn examinada. | Checking your delivery address.
Welche Adresse meinst du? | Quelle adresse recherchez-vous ? | Quale indirizzo intendi? | Tge adressa manegias ti? | Which address do you mean?
In drei Schritten zum Stopp | Votre arrêt en trois étapes | La tua sosta in tre passaggi | En trais pass al stop | Your stop in three steps
Adresse | Adresse | Indirizzo | Adressa | Address
wählen | choisir | scegli | tscherner | choose
Ladezonen | Zones de livraison | Zone di carico | Zonas da chargiar | Loading zones
vergleichen | comparer | confronta | cumparegliar | compare
Stopp | Arrêt | Sosta | Stop | Stop
abschliessen | terminer | concludi | terminar | complete
So funktioniert DeliverySpot | Comment fonctionne DeliverySpot | Come funziona DeliverySpot | Uschia funcziuna DeliverySpot | How DeliverySpot works
Deine gespeicherten Adressen | Vos adresses enregistrées | I tuoi indirizzi salvati | Tias adressas memorisadas | Your saved addresses
Speichere eine gefundene Lieferadresse als Favorit. | Enregistrez une adresse de livraison dans vos favoris. | Salva un indirizzo di consegna tra i preferiti. | Memorisescha ina adressa da consegna sco favurit. | Save a delivery address as a favourite.
Adresse aus Favoriten entfernen | Retirer l’adresse des favoris | Rimuovi l’indirizzo dai preferiti | Allontanar l’adressa dals favurits | Remove address from favourites
Wohin geht die Lieferung? | Quelle est la destination ? | Dove va la consegna? | Nua va la consegna? | Where is the delivery going?
Prüfe dein Lieferziel. | Vérifiez votre destination. | Verifica la destinazione. | Controllescha tia destinaziun. | Check your delivery destination.
DEINE ADRESSE | VOTRE ADRESSE | IL TUO INDIRIZZO | TIA ADRESSA | YOUR ADDRESS
Lieferadresse ändern | Modifier l’adresse de livraison | Modifica l’indirizzo di consegna | Midar l’adressa da consegna | Change delivery address
Deine Lieferung | Votre livraison | La tua consegna | Tia consegna | Your delivery
Fahrzeug | Véhicule | Veicolo | Vehichel | Vehicle
Gesamtgewicht | Poids total | Peso totale | Pais total | Total weight
Zeitpunkt | Date et heure | Data e ora | Data ed ura | Date and time
Suchradius | Rayon de recherche | Raggio di ricerca | Radius da tschertga | Search radius
Entfernungen | Distances | Distanze | Distan­zas | Distances
Luftlinie zum Ziel | À vol d’oiseau jusqu’à la destination | In linea d’aria dalla destinazione | En lingia directa fin a la destinaziun | Straight-line distance to destination
Ladezonen anzeigen | Afficher les zones de livraison | Mostra le zone di carico | Mussar las zonas da chargiar | Show loading zones
♥ Adresse gespeichert | ♥ Adresse enregistrée | ♥ Indirizzo salvato | ♥ Adressa memorisada | ♥ Address saved
♡ Adresse als Favorit speichern | ♡ Ajouter l’adresse aux favoris | ♡ Salva l’indirizzo nei preferiti | ♡ Memorисar l’adressa sco favurit | ♡ Save address as a favourite
Lieferziel in Google Maps öffnen → | Ouvrir la destination dans Google Maps → | Apri la destinazione in Google Maps → | Avrir la destinaziun en Google Maps → | Open destination in Google Maps →
Fahrzeug ansehen | Voir le véhicule | Visualizza il veicolo | Guardar il vehichel | View vehicle
Zonen vergleichen | Comparer les zones | Confronta le zone | Cumparegliar las zonas | Compare zones
Passende Zonen in deiner Nähe | Zones adaptées à proximité | Zone adatte nelle vicinanze | Zonas adattadas en tia vischinanza | Suitable zones nearby
Ladezonen in der Nähe | Zones de livraison à proximité | Zone di carico nelle vicinanze | Zonas da chargiar en la vischinanza | Nearby loading zones
Karte | Carte | Mappa | Charta | Map
Liste | Liste | Lista | Glista | List
Filter | Filtres | Filtri | Filters | Filters
Wie lange brauchst du? | De combien de temps avez-vous besoin ? | Quanto tempo ti serve? | Quant temp dovras ti? | How long do you need?
Alle Parkzeiten | Toutes les durées | Tutte le durate | Tut las duradas | All parking durations
Mindestens {zahl} Minuten | Au moins {zahl} minutes | Almeno {zahl} minuti | Almain {zahl} minutas | At least {zahl} minutes
{zahl} Zonen im Umkreis von {radius} m | {zahl} zones dans un rayon de {radius} m | {zahl} zone entro {radius} m | {zahl} zonas en in radius da {radius} m | {zahl} zones within {radius} m
{zahl} Zone im Umkreis von {radius} m | {zahl} zone dans un rayon de {radius} m | {zahl} zona entro {radius} m | {zahl} zona en in radius da {radius} m | {zahl} zone within {radius} m
Keine Zone passt zu deinen Filtern. Erweitere den Suchradius oder wähle eine kürzere Parkdauer. | Aucune zone ne correspond aux filtres. Augmentez le rayon ou choisissez une durée plus courte. | Nessuna zona corrisponde ai filtri. Aumenta il raggio o scegli una durata più breve. | Nagina zona na correspunda als filters. Engrondescha il radius u tscherna ina durada pli curta. | No zones match your filters. Increase the radius or choose a shorter parking duration.
Die passenden Zonen sind aktuell gesperrt. Ändere deine Filter, um Alternativen zu sehen. | Les zones correspondantes sont actuellement fermées. Modifiez les filtres pour voir les alternatives. | Le zone corrispondenti sono attualmente chiuse. Modifica i filtri per vedere le alternative. | Las zonas adattadas èn actualmain serradas. Mida ils filters per vesair alternativas. | The matching zones are currently closed. Change your filters to see alternatives.
Belegung vor Ort prüfen. Eine angezeigte Zone ist nicht automatisch frei. | Vérifiez la disponibilité sur place. Une zone affichée n’est pas forcément libre. | Verifica la disponibilità sul posto. Una zona visualizzata non è necessariamente libera. | Controllescha la disponibilitad al lieu. Ina zona mussada n’è betg automaticamain libra. | Check availability on arrival. A displayed zone is not necessarily free.
Radius auf 500 m erweitern | Étendre le rayon à 500 m | Aumenta il raggio a 500 m | Engrondir il radius a 500 m | Increase radius to 500 m
Alle Zonen als Liste ansehen | Voir toutes les zones en liste | Visualizza tutte le zone in elenco | Guardar tut las zonas sco glista | View all zones as a list
Alle Filter zurücksetzen | Réinitialiser tous les filtres | Reimposta tutti i filtri | Redefinir tut ils filters | Reset all filters
Suche eingrenzen | Affiner la recherche | Affina la ricerca | Restrenscher la tschertga | Refine your search
Wie weit darf die Zone entfernt sein? | À quelle distance la zone peut-elle se trouver ? | Quanto può essere distante la zona? | Quant lunsch dastga esser la zona? | How far away can the zone be?
Gesperrte Zonen bleiben sichtbar. Sie sind nicht als Stopp auswählbar. | Les zones fermées restent visibles, mais ne peuvent pas être choisies comme arrêt. | Le zone chiuse restano visibili, ma non possono essere scelte per la sosta. | Zonas serradas restan visiblas, ma na pon betg vegnir tschernidas sco stop. | Closed zones remain visible but cannot be selected as a stop.
{zahl} Zonen anzeigen | Afficher {zahl} zones | Mostra {zahl} zone | Mussar {zahl} zonas | Show {zahl} zones
{zahl} Zone anzeigen | Afficher {zahl} zone | Mostra {zahl} zona | Mussar {zahl} zona | Show {zahl} zone
Filter zurücksetzen | Réinitialiser les filtres | Reimposta i filtri | Redefinir ils filters | Reset filters
Belegung unbekannt | Disponibilité inconnue | Disponibilità sconosciuta | Disponibilitad nunenconuschenta | Availability unknown
Lieferzeit | Horaires de livraison | Orari di consegna | Urari da consegna | Delivery hours
Max. Parkdauer | Durée maximale | Durata massima | Durada maximala | Maximum parking duration
Preis | Prix | Prezzo | Pretsch | Price
Kostenlos | Gratuit | Gratuito | Gratuit | Free of charge
Nutzung | Utilisation | Utilizzo | Utilisaziun | Use
Be- und Entladen | Chargement et déchargement | Carico e scarico | Chargiar e stgargiar | Loading and unloading
Dein Fahrzeugprofil liegt über dem für diese Zone angegebenen Gewicht. | Le poids de votre véhicule dépasse la limite indiquée pour cette zone. | Il peso del tuo veicolo supera il limite indicato per questa zona. | Il pais da tes vehichel surpassa la limita inditgada per questa zona. | Your vehicle exceeds the weight limit shown for this zone.
Beschilderung vor Ort beachten. Die Auswahl reserviert keinen Platz. | Respectez la signalisation sur place. La sélection ne réserve aucune place. | Rispetta la segnaletica sul posto. La selezione non riserva un posto. | Resguarda la signalisaziun al lieu. La tscherna na reservescha nagin plaz. | Follow the signs on site. Selecting a zone does not reserve a space.
Diese Zone wählen · Weg ansehen | Choisir cette zone · Voir le trajet | Scegli questa zona · Visualizza il percorso | Tscherner questa zona · Guardar la via | Choose this zone · View directions
♥ Aus Merkliste entfernen | ♥ Retirer de la liste | ♥ Rimuovi dai salvati | ♥ Allontanar da la glista | ♥ Remove from saved zones
♡ In Merkliste speichern | ♡ Ajouter à la liste | ♡ Salva nei preferiti | ♡ Memorисar en la glista | ♡ Save zone
Zone {id} vergleichen | Comparer la zone {id} | Confronta la zona {id} | Cumparegliar la zona {id} | Compare zone {id}
Dein Weg zur Ladezone | Votre trajet vers la zone | Il percorso verso la zona di carico | Tia via a la zona da chargiar | Your way to the loading zone
Die gestrichelte Linie dient zur Orientierung und ist keine berechnete Strassenroute. | La ligne pointillée sert de repère et ne représente pas un itinéraire routier calculé. | La linea tratteggiata serve per orientarsi e non è un percorso stradale calcolato. | La lingia interrutta serva a l’orientaziun e n’è betg ina ruta stradala calculada. | The dashed line is a guide, not a calculated road route.
Ich bin angekommen | Je suis arrivé | Sono arrivato | Jau sun arrivà | I have arrived
Alternative: Zone {id} prüfen | Alternative : vérifier la zone {id} | Alternativa: verifica la zona {id} | Alternativa: examinar la zona {id} | Alternative: check zone {id}
Stopp verwerfen | Annuler cet arrêt | Annulla la sosta | Annullar il stop | Cancel stop
An der Ladezone | À la zone de livraison | Alla zona di carico | A la zona da chargiar | At the loading zone
dein Lieferstopp | votre arrêt de livraison | la tua sosta di consegna | tes stop da consegna | your delivery stop
Vor dem Entladen prüfen | À vérifier avant de décharger | Verifica prima di scaricare | Examinar avant da stgargiar | Check before unloading
Ist die Fläche tatsächlich nutzbar? | La zone est-elle réellement utilisable ? | Lo spazio è effettivamente utilizzabile? | È la surfatscha propi utilisabla? | Is the space actually usable?
Passt die Beschilderung zum Fahrzeug? | La signalisation autorise-t-elle votre véhicule ? | La segnaletica consente il tuo veicolo? | Permetta la signalisaziun tes vehichel? | Do the signs permit your vehicle?
Bleiben Zufahrten und Wege frei? | Les accès et passages restent-ils libres ? | Gli accessi e i passaggi restano liberi? | Restan ils access e las vias libers? | Are access routes and paths kept clear?
Maximal {zahl} Min. | Maximum {zahl} min | Massimo {zahl} min | Maximalmain {zahl} min. | Maximum {zahl} min
Zum Be- und Entladen | Pour charger et décharger | Per carico e scarico | Per chargiar e stgargiar | For loading and unloading
Lieferung abgeschlossen | Livraison terminée | Consegna completata | Consegna terminada | Delivery completed
Problem melden | Signaler un problème | Segnala un problema | Annunziar in problem | Report a problem
Andere Zone: {id} prüfen | Autre zone : vérifier {id} | Altra zona: verifica {id} | Autra zona: examinar {id} | Other zone: check {id}
aktuell gesperrt | actuellement fermée | attualmente chiusa | actualmain serrada | currently closed
Aktuell gesperrt | Actuellement fermée | Attualmente chiusa | Actualmain serrada | Currently closed
Gesperrt | Fermée | Chiusa | Serrada | Closed
Reguläre Parkdauer | Durée habituelle | Durata abituale | Durada regulara | Standard parking duration
Aktuell nutzbar | Utilisable actuellement | Attualmente utilizzabile | Actualmain utilisabla | Currently usable
Nein | Non | No | Na | No
Diese Zone ist wegen einer Baustelle nicht nutzbar. Wähle eine andere Ladezone für deinen Stopp. | Cette zone est inutilisable en raison de travaux. Choisissez une autre zone pour votre arrêt. | Questa zona non è utilizzabile a causa di un cantiere. Scegli un’altra zona per la sosta. | Questa zona n’è betg utilisabla pervia d’in plazzal. Tscherna in’autra zona per tes stop. | This zone is unavailable due to construction work. Choose another loading zone for your stop.
Zone {id} prüfen | Vérifier la zone {id} | Verifica la zona {id} | Examinar la zona {id} | Check zone {id}
Was ist vor Ort los? | Que se passe-t-il sur place ? | Cosa succede sul posto? | Tge capita al lieu? | What is happening on site?
Wähle den passenden Meldegrund. | Choisissez le motif approprié. | Scegli il motivo appropriato. | Tscherna il motiv adattà. | Choose the appropriate reason.
Platz ist blockiert | Place bloquée | Posto bloccato | Plaz bloccà | Space is blocked
Ein Fahrzeug oder Hindernis versperrt die Zone. | Un véhicule ou un obstacle bloque la zone. | Un veicolo o un ostacolo blocca la zona. | In vehichel u in impediment blochescha la zona. | A vehicle or obstacle is blocking the zone.
Sperrung vor Ort | Fermeture sur place | Chiusura sul posto | Zona serrada al lieu | Closure on site
Die Ladezone ist aktuell nicht zugänglich. | La zone est actuellement inaccessible. | La zona di carico non è attualmente accessibile. | La zona da chargiar n’è actualmain betg accessibla. | The loading zone is currently inaccessible.
Angaben stimmen nicht | Informations incorrectes | Informazioni errate | Indicaziuns incorrectas | Incorrect information
Zeitfenster oder Beschilderung weichen ab. | Les horaires ou la signalisation sont différents. | Gli orari o la segnaletica sono diversi. | L’urari u la signalisaziun divergeschan. | The hours or signs differ from the information shown.
Wenn du hier nicht entladen kannst, wähle eine andere Zone. | Si vous ne pouvez pas décharger ici, choisissez une autre zone. | Se non puoi scaricare qui, scegli un’altra zona. | Sche ti na pos betg stgargiar qua, tscherna in’autra zona. | If you cannot unload here, choose another zone.
Abbrechen | Annuler | Annulla | Annullar | Cancel
Danke für deinen Hinweis. | Merci pour votre signalement. | Grazie per la segnalazione. | Grazia per tia annunzia. | Thank you for your report.
Deine Meldung wurde auf diesem Gerät gespeichert. | Votre signalement a été enregistré sur cet appareil. | La segnalazione è stata salvata su questo dispositivo. | Tia annunzia è vegnida memorisada sin quest apparat. | Your report has been saved on this device.
Wie geht es weiter? | Et maintenant ? | Come proseguire? | Co vai vinavant? | What happens next?
Prüfe eine andere Ladezone für deine aktuelle Lieferung. | Vérifiez une autre zone pour votre livraison. | Verifica un’altra zona per la consegna attuale. | Examinescha in’autra zona per tia consegna actuala. | Check another loading zone for your current delivery.
Andere Ladezone finden | Trouver une autre zone | Trova un’altra zona | Chattar in’autra zona | Find another loading zone
Zur Startseite | Retour à l’accueil | Torna alla pagina iniziale | A la pagina iniziala | Back to home
Dein Lieferstopp ist beendet. | Votre arrêt de livraison est terminé. | La tua sosta di consegna è terminata. | Tes stop da consegna è terminà. | Your delivery stop is complete.
Geschafft! | C’est fait ! | Fatto! | Fatg! | Done!
Nächste Lieferung planen | Préparer la prochaine livraison | Pianifica la prossima consegna | Planisar la proxima consegna | Plan next delivery
Deine Merkliste | Votre liste de favoris | Le tue zone salvate | Tia glista da favurits | Your saved zones
Deine gespeicherten Ladezonen auf einen Blick. | Vos zones enregistrées en un coup d’œil. | Le tue zone salvate a colpo d’occhio. | Tias zonas memorisadas en ina survista. | Your saved loading zones at a glance.
Details ansehen → | Voir les détails → | Visualizza i dettagli → | Guardar ils detagls → | View details →
Zone aus Merkliste entfernen | Retirer la zone de la liste | Rimuovi la zona dai salvati | Allontanar la zona da la glista | Remove zone from saved zones
Noch keine gespeicherten Zonen | Aucune zone enregistrée | Nessuna zona salvata | Anc naginas zonas memorisadas | No saved zones yet
Öffne eine Zone und tippe auf „In Merkliste speichern“. | Ouvrez une zone et appuyez sur « Ajouter à la liste ». | Apri una zona e premi « Salva nei preferiti ». | Avra ina zona e smatga sin « Memorисar en la glista ». | Open a zone and select “Save zone”.
Vor jedem Stopp prüfen: Zeitfenster und Einschränkungen können sich ändern. | Vérifiez avant chaque arrêt : les horaires et restrictions peuvent changer. | Verifica prima di ogni sosta: orari e restrizioni possono cambiare. | Controllescha avant mintga stop: uraris e restricziuns pon sa midar. | Check before every stop: hours and restrictions can change.
Weitere Ladezonen suchen | Rechercher d’autres zones | Cerca altre zone di carico | Tschertgar ulteriuras zonas | Find more loading zones
Dein Fahrzeug | Votre véhicule | Il tuo veicolo | Tes vehichel | Your vehicle
Die wichtigsten Angaben für deine Lieferung. | Les informations essentielles pour votre livraison. | Le informazioni principali per la consegna. | Las indicaziuns principalas per tia consegna. | The key details for your delivery.
Für kurze Stopps in der Stadt | Pour les arrêts courts en ville | Per brevi soste in città | Per curts stops en la citad | For short stops in the city
Fahrzeugname | Nom du véhicule | Nome del veicolo | Num dal vehichel | Vehicle name
Fahrzeugtyp | Type de véhicule | Tipo di veicolo | Tip da vehichel | Vehicle type
Lieferwagen | Utilitaire | Furgone | Camionetta | Delivery van
Personenwagen | Voiture | Automobile | Auto da persunas | Car
Lastwagen | Camion | Autocarro | Camion | Lorry
Bis 3,5 t | Jusqu’à 3,5 t | Fino a 3,5 t | Fin 3,5 t | Up to 3.5 t
Über 3,5 t | Plus de 3,5 t | Oltre 3,5 t | Sur 3,5 t | Over 3.5 t
Vergleiche das zulässige Gewicht und die Nutzungszeiten mit deinem Fahrzeug. | Comparez le poids autorisé et les horaires avec votre véhicule. | Confronta il peso consentito e gli orari con il tuo veicolo. | Cumpareglia il pais permess e l’urari cun tes vehichel. | Check the permitted weight and hours against your vehicle.
Speichern und Lieferung planen | Enregistrer et préparer la livraison | Salva e pianifica la consegna | Memorисar e planisar la consegna | Save and plan delivery
Gut zu wissen | Bon à savoir | Buono a sapersi | Bun da savair | Good to know
So begleitet dich DeliverySpot im Lieferalltag. | DeliverySpot vous accompagne au quotidien. | DeliverySpot ti accompagna nelle consegne quotidiane. | DeliverySpot accumpogna tai en il mintgadi da consegna. | How DeliverySpot helps with everyday deliveries.
1. Lieferziel auswählen | 1. Choisir la destination | 1. Scegli la destinazione | 1. Tscherner la destinaziun | 1. Choose your destination
Gib Strasse und Hausnummer in der Stadt Bern ein. | Saisissez la rue et le numéro en ville de Berne. | Inserisci via e numero civico nella città di Berna. | Endatescha via e numer da chasa en la citad da Berna. | Enter a street and house number in the city of Bern.
2. Ladezonen vergleichen | 2. Comparer les zones | 2. Confronta le zone di carico | 2. Cumparegliar las zonas | 2. Compare loading zones
Prüfe Entfernung, Zeitfenster und maximale Parkdauer. | Vérifiez la distance, les horaires et la durée maximale. | Verifica distanza, orari e durata massima. | Controllescha la distanza, l’urari e la durada maximala. | Check distance, hours and maximum parking duration.
3. Stopp planen und liefern | 3. Préparer l’arrêt et livrer | 3. Pianifica la sosta e consegna | 3. Planisar il stop e livrar | 3. Plan your stop and deliver
Wähle eine Zone und prüfe sie bei deiner Ankunft. | Choisissez une zone et vérifiez-la à votre arrivée. | Scegli una zona e verificala all’arrivo. | Tscherna ina zona e controllescha ella tar l’arrivada. | Choose a zone and check it on arrival.
Ist eine Zone automatisch frei? | Une zone est-elle forcément libre ? | Una zona è automaticamente libera? | È ina zona automaticamain libra? | Is a zone automatically free?
Nein. Die Belegung prüfst du vor Ort. | Non. Vérifiez la disponibilité sur place. | No. Verifica la disponibilità sul posto. | Na. Ti controlleschas la disponibilitad al lieu. | No. Check availability on site.
Kann ich einen Platz reservieren? | Puis-je réserver une place ? | Posso prenotare un posto? | Poss jau reservar in plaz? | Can I reserve a space?
Nein. Deine Auswahl plant nur den Stopp. | Non. Votre sélection sert uniquement à préparer l’arrêt. | No. La selezione serve solo a pianificare la sosta. | Na. Tia tscherna serva mo a planisar il stop. | No. Your selection only plans the stop.
Was öffnet der Google-Maps-Button? | Que fait le bouton Google Maps ? | Cosa apre il pulsante Google Maps? | Tge avra il buttun Google Maps? | What does the Google Maps button open?
Die Routenplanung zu deiner gefundenen Lieferadresse. | L’itinéraire vers votre adresse de livraison. | La pianificazione del percorso verso l’indirizzo trovato. | La planisaziun da la ruta a tia adressa da consegna chattada. | Route planning to your delivery address.
Über diesen Prototyp | À propos de ce prototype | Informazioni sul prototipo | Davart quest prototip | About this prototype
Die Adresssuche verwendet geo.admin.ch. Die Ladezonen und ihre Parkregeln sind simuliert. Favoriten, Fahrzeugprofil und Meldungen werden in diesem Browser gespeichert. | La recherche d’adresses utilise geo.admin.ch. Les zones et leurs règles sont simulées. Les favoris, le véhicule et les signalements sont enregistrés dans ce navigateur. | La ricerca usa geo.admin.ch. Le zone e le regole sono simulate. Preferiti, veicolo e segnalazioni vengono salvati in questo browser. | La tschertga d’adressas utilisescha geo.admin.ch. Las zonas e lur reglas èn simuladas. Favurits, vehichel ed annunzias vegnan memorisads en quest navigatur. | Address search uses geo.admin.ch. Loading zones and their rules are simulated. Favourites, vehicle details and reports are stored in this browser.
Lieferung planen | Préparer une livraison | Pianifica una consegna | Planisar ina consegna | Plan a delivery
Suche | Recherche | Cerca | Tschertga | Search
Merkliste | Favoris | Salvati | Favurits | Saved
Info | Infos | Info | Info | Info
Zurück | Retour | Indietro | Enavos | Back
Hauptnavigation | Navigation principale | Navigazione principale | Navigaziun principala | Main navigation
Ergebnisansicht | Vue des résultats | Vista dei risultati | Vista dals resultats | Results view
Karte der Umgebung | Carte des environs | Mappa dei dintorni | Charta da la vischinanza | Map of the area
Lieferziel | Destination | Destinazione | Destinaziun | Delivery destination
Bitte gib eine Strasse mit Hausnummer ein. | Saisissez une rue et un numéro. | Inserisci una via e un numero civico. | Endatescha ina via ed in numer da chasa. | Please enter a street and house number.
Keine passende Adresse in der Stadt Bern gefunden. Prüfe Strasse und Hausnummer oder ergänze die Postleitzahl. | Aucune adresse correspondante trouvée en ville de Berne. Vérifiez la rue et le numéro ou ajoutez le code postal. | Nessun indirizzo corrispondente trovato nella città di Berna. Verifica via e numero o aggiungi il codice postale. | Nagina adressa adattada chattada en la citad da Berna. Controllescha via e numer u agiunta il numer postal. | No matching address found in the city of Bern. Check the street and house number or add the postcode.
Die Adresssuche hat nicht funktioniert. Prüfe deine Internetverbindung und versuche es erneut. | La recherche a échoué. Vérifiez votre connexion Internet et réessayez. | La ricerca non è riuscita. Verifica la connessione Internet e riprova. | La tschertga n’ha betg funcziunà. Controllescha la colliaziun cun l’internet ed emprova anc ina giada. | Address search failed. Check your internet connection and try again.
Kurzzeit | Courte durée | Sosta breve | Curta durada | Short stay
Ladeplatz | Emplacement de livraison | Piazzola di carico | Plaz da chargiar | Loading space
Sperrung | Fermeture | Chiusura | Serrada | Closure
Details → | Détails → | Dettagli → | Detagls → | Details →
{zahl} m Luftlinie zum Lieferziel | {zahl} m à vol d’oiseau de la destination | {zahl} m in linea d’aria dalla destinazione | {zahl} m en lingia directa da la destinaziun | {zahl} m straight-line distance to destination
{zahl} m zum Lieferziel | {zahl} m de la destination | {zahl} m dalla destinazione | {zahl} m da la destinaziun | {zahl} m to destination
Suchradius {zahl} m | Rayon de recherche {zahl} m | Raggio di ricerca {zahl} m | Radius da tschertga {zahl} m | Search radius {zahl} m
Max. {zahl} Min. | Max. {zahl} min | Max. {zahl} min | Max. {zahl} min. | Max. {zahl} min
{zahl} Min. | {zahl} min | {zahl} min | {zahl} min. | {zahl} min
Mo–Fr, {zeit} Uhr | Lun–ven, {zeit} | Lun–ven, {zeit} | Gli–ve, {zeit} | Mon–Fri, {zeit}
Mo–Sa, {zeit} Uhr | Lun–sam, {zeit} | Lun–sab, {zeit} | Gli–so, {zeit} | Mon–Sat, {zeit}
Zone {id} | Zone {id} | Zona {id} | Zona {id} | Zone {id}
Beschilderung vor Ort prüfen | Vérifier la signalisation sur place | Verificare la segnaletica sul posto | Controllar la signalisaziun al lieu | Check signs on site
Parkdauer vor Ort prüfen | Vérifier la durée autorisée sur place | Verificare la durata consentita sul posto | Controllar la durada permessa al lieu | Check permitted parking duration on site
Kostenlos bis zu 60 min | Gratuit jusqu’à 60 min | Gratuito fino a 60 min | Gratuit fin a 60 min | Free for up to 60 min
bis 3,5 t | jusqu’à 3,5 t | fino a 3,5 t | fin a 3,5 t | Up to 3.5 t
Vor Ort prüfen | Vérifier sur place | Verificare sul posto | Controllar al lieu | Check on site
Nutzbarkeit prüfen | Vérifier les conditions d’utilisation | Verificare l'utilizzabilità | Controllar l'utilisaziun | Check whether use is permitted
Kurzzeitparkfeld | Place de stationnement de courte durée | Posteggio a sosta breve | Plaz da parcar per curta durada | Short-stay parking space
Lastwagenparkplatz | Place pour poids lourds | Parcheggio per camion | Plaz da parcar per camiuns | Lorry parking space
Parkdauer vor Ort prüfen · Kostenlos | Vérifier la durée autorisée sur place · Gratuit | Verificare la durata sul posto · Gratuito | Controllar la durada al lieu · Gratuit | Check parking duration on site · Free
Zum Parkplatz navigieren → | Naviguer vers la place de stationnement → | Naviga verso il parcheggio → | Navigar al plaz da parcar → | Navigate to parking space →
Standortdaten der Stadt Bern | Données géographiques de la Ville de Berne | Dati geografici della città di Berna | Datas geograficas da la citad da Berna | City of Bern location data
keine Belegungsdaten | aucune donnée de disponibilité | nessun dato sulla disponibilità | naginas datas davart la disponibilitad | no occupancy data
Nicht in den Geodaten enthalten | Non indiqué dans les géodonnées | Non indicato nei geodati | Betg inditgà en las geodatas | Not included in the geodata
Die offizielle maximale Parkdauer ist hier nicht bekannt. Schilder beachten. | La durée de stationnement maximale officielle est inconnue. Respectez la signalisation. | La durata massima ufficiale non è nota. Rispetta la segnaletica. | La durada maximala uffiziala n'è betg enconuschenta. Resguarda la signalisaziun. | The official maximum parking duration is unknown. Follow the signs.
Die passenden Standorte sind nicht verfügbar. Ändere deine Filter, um Alternativen zu sehen. | Les emplacements correspondants ne sont pas disponibles. Modifiez les filtres pour voir des alternatives. | I parcheggi corrispondenti non sono disponibili. Modifica i filtri per vedere le alternative. | Ils lieus adattads n'èn betg disponibels. Mida ils filters per alternativas. | Matching locations are unavailable. Change your filters to see alternatives.
Offizielle Standortkoordinaten, keine bestätigten Ladezonen. Nutzung und Beschilderung vor Ort prüfen. | Coordonnées officielles, mais zones de livraison non confirmées. Vérifiez l'utilisation et la signalisation sur place. | Coordinate ufficiali, ma zone di carico non confermate. Verifica le condizioni e la segnaletica. | Coordinatas uffizialas, ma naginas zonas da chargiar confermadas. Controlla la signalisaziun al lieu. | Official location coordinates, but not confirmed loading zones. Check permitted use and signs on site.
Keine erfassten Kurzzeit- oder Lastwagenparkfelder im Suchradius gefunden. Erweitere den Suchradius oder suche eine andere Adresse. | Aucune place de courte durée ou pour poids lourds trouvée dans le rayon. Augmentez le rayon ou cherchez une autre adresse. | Nessun parcheggio a sosta breve o per camion trovato nel raggio. Aumenta il raggio o cerca un altro indirizzo. | Nagins parcadis curts u per camiuns chattads en il radius. Engrondescha il radius u tschertga in'autra adressa. | No recorded short-stay or lorry spaces found within the search radius. Increase the radius or try another address.
Parkdauer vor Ort prüfen · Kostenlos | Vérifier la durée sur place · Gratuit | Verificare la durata sul posto · Gratuito | Controllar la durada al lieu · Gratuit | Check duration on site · Free
Kostenlos · Parkdauer vor Ort prüfen | Gratuit · Vérifier la durée sur place | Gratuito · Verificare la durata sul posto | Gratuit · Controllar la durada al lieu | Free · Check duration on site
Erinnerungsdauer frei wählbar | Durée du rappel au choix | Durata del promemoria a scelta | Durada da regurdientscha tschernibla | Choose your reminder duration
Parkregeln vor Ort prüfen. | Vérifiez les règles sur place. | Verifica le regole sul posto. | Controlla las reglas al lieu. | Check parking rules on site.
Erinnerungsdauer | Durée du rappel | Durata del promemoria | Durada da regurdientscha | Reminder duration
{zahl} Minuten | {zahl} minutes | {zahl} minuti | {zahl} minutas | {zahl} minutes
(Maximum) | (maximum) | (massimo) | (maximum) | (maximum)
Timer starten | Démarrer le minuteur | Avvia il timer | Cumenzar il timer | Start timer
Timer läuft | Minuteur en cours | Timer attivo | Timer en funcziun | Timer running
Timer pausiert | Minuteur en pause | Timer in pausa | Timer en pausa | Timer paused
Bereit zum Starten | Prêt à démarrer | Pronto per iniziare | Pront per cumenzar | Ready to start
Pausieren | Mettre en pause | Metti in pausa | Far pausa | Pause
Fortsetzen | Reprendre | Riprendi | Cuntinuar | Resume
Zurücksetzen | Réinitialiser | Reimposta | Redefinir | Reset
Zeit abgelaufen – Beschilderung prüfen. | Temps écoulé – vérifiez la signalisation. | Tempo scaduto – verifica la segnaletica. | Temp scadì – controlla la signalisaziun. | Time is up – check the signs.
Achtung: Weniger als 2 Minuten! | Attention : moins de 2 minutes ! | Attenzione: meno di 2 minuti! | Attenziun: main che 2 minutas! | Warning: less than 2 minutes!
Ein Timer läuft bereits | Un minuteur est déjà en cours | Un timer è già attivo | In timer è gia en funcziun | A timer is already running
Laufenden Timer anzeigen | Afficher le minuteur en cours | Mostra il timer attivo | Mussar il timer current | Show running timer
{zeit} verbleibend | {zeit} restantes | {zeit} rimanenti | {zeit} restantas | {zeit} remaining
Warnung 2 Minuten vor Ablauf, solange die App geöffnet ist. Der Timer ist keine Parkberechtigung. | Alerte 2 minutes avant la fin, tant que l’application est ouverte. Le minuteur ne constitue pas une autorisation de stationnement. | Avviso 2 minuti prima della scadenza, se l’app è aperta. Il timer non costituisce un permesso di sosta. | Avis 2 minutas avant la fin, sche l'app è averta. Il timer na dat nagina permissiun da parcar. | Alert 2 minutes before expiry while the app is open. The timer is not a parking permit.
Noch 2 Minuten bis zum Ende deiner Erinnerung! | Plus que 2 minutes avant la fin du rappel ! | Mancano 2 minuti alla fine del promemoria! | Anc 2 minutas fin a la fin da la regurdientscha! | 2 minutes left on your reminder!
Prüfe Entfernung, bekannte Angaben und die Beschilderung. | Vérifiez la distance, les informations disponibles et la signalisation. | Verifica la distanza, i dati disponibili e la segnaletica. | Controlla la distanza, las indicaziuns e la signalisaziun. | Check the distance, available details and signs.
Standortdaten konnten nicht geladen werden. Prüfe die Datei public/parkflaechen-bern.json. | Impossible de charger les données. Vérifiez le fichier public/parkflaechen-bern.json. | Impossibile caricare i dati. Controlla il file public/parkflaechen-bern.json. | Las datas na pon betg vegnir chargiadas. Controlla la datoteca public/parkflaechen-bern.json. | Could not load location data. Check public/parkflaechen-bern.json.
Zonen | Zones | Zone | Zonas | Zones
im Umkreis von {radius} m | dans un rayon de {radius} m | entro {radius} m | en in radius da {radius} m | within {radius} m
{zahl} Zone | {zahl} zone | {zahl} zona | {zahl} zona | {zahl} zone
{zahl} Zonen | {zahl} zones | {zahl} zone | {zahl} zonas | {zahl} zones
Nicht verfügbar | Indisponible | Non disponibile | Betg disponibel | Unavailable
{typ} – Nutzbarkeit prüfen | {typ} – vérifier les conditions d’utilisation | {typ} – verificare le condizioni d’uso | {typ} – controllar l’utilisaziun | {typ} – check permitted use
{zahl} Minuten (Maximum) | {zahl} minutes (maximum) | {zahl} minuti (massimo) | {zahl} minutas (maximum) | {zahl} minutes (maximum)
Parkdauer vor Ort prüfen | Vérifier la durée autorisée sur place | Verificare la durata consentita sul posto | Controllar la durada permessa al lieu | Check permitted parking duration on site

Navigation zum Parkplatz | Navigation vers le parking | Navigazione verso il parcheggio | Navigaziun al parcadi | Navigation to parking
Zum Parkplatz navigieren → | Naviguer vers le parking → | Naviga verso il parcheggio → | Navigar al parcadi → | Navigate to parking →
Route neu berechnen | Recalculer l’itinéraire | Ricalcola il percorso | Calculà danovamain la ruta | Recalculate route
Sprachausgabe einschalten | Activer les instructions vocales | Attiva le indicazioni vocali | Activar las indicaziuns vocalas | Enable voice guidance
Sprachausgabe ausschalten | Désactiver les instructions vocales | Disattiva le indicazioni vocali | Deactivar las indicaziuns vocalas | Disable voice guidance
Navigation beenden | Terminer la navigation | Termina la navigazione | Terminar la navigaziun | End navigation
Warte auf GPS und Route … | En attente du GPS et de l’itinéraire… | In attesa del GPS e del percorso… | Spetgar GPS e ruta… | Waiting for GPS and route…
Route wird vorbereitet … | Préparation de l’itinéraire… | Preparazione del percorso… | Preparar la ruta… | Preparing route…
Strassenroute wird berechnet … | Calcul de l’itinéraire routier… | Calcolo del percorso stradale… | Calculaziun da la ruta… | Calculating road route…
Navigation bereit | Navigation prête | Navigazione pronta | Navigaziun pronta | Navigation ready
Ziel erreicht | Destination atteinte | Destinazione raggiunta | Destinaziun cuntanschida | Destination reached
Weiterfahren | Continuez | Prosegui | Cuntinuar | Continue
Losfahren | Démarrez | Parti | Partir | Set off
Links abbiegen | Tournez à gauche | Svolta a sinistra | Volver a sanestra | Turn left
Rechts abbiegen | Tournez à droite | Svolta a destra | Volver a dretga | Turn right
Leicht links halten | Serrez légèrement à gauche | Tieni leggermente la sinistra | Sa tegnair levamain a sanestra | Keep slightly left
Leicht rechts halten | Serrez légèrement à droite | Tieni leggermente la destra | Sa tegnair levamain a dretga | Keep slightly right
Wenden | Faites demi-tour | Fai inversione | Volver enavos | Make a U-turn
Geradeaus weiterfahren | Continuez tout droit | Prosegui dritto | Ir vinavant dretg | Continue straight
In den Kreisverkehr fahren | Entrez dans le rond-point | Entra nella rotonda | Entrar en la rundella | Enter the roundabout
Einfädeln | Insérez-vous | Immettiti | Sa integrar en il traffic | Merge
Auf die Abzweigung fahren | Prenez la bretelle | Prendi la rampa | Prender la sortida | Take the ramp
Dieses Gerät unterstützt keine GPS-Ortung. | Cet appareil ne prend pas en charge le GPS. | Questo dispositivo non supporta il GPS. | Quest apparat na sustegna betg GPS. | This device does not support GPS.
Standortzugriff verweigert. Bitte GPS in den Browser-Einstellungen erlauben. | Accès à la position refusé. Autorisez-le dans le navigateur. | Accesso alla posizione negato. Abilitalo nel browser. | Access al lieu refusà. Permetter GPS en il navigatur. | Location access denied. Allow GPS in browser settings.
GPS derzeit nicht verfügbar. Bitte Standortdienste prüfen. | GPS indisponible. Vérifiez la localisation. | GPS non disponibile. Controlla la posizione. | GPS betg disponibel. Controllar ils servetschs da localisaziun. | GPS unavailable. Check location services.
Route nicht verfügbar. Internetverbindung prüfen und erneut versuchen. | Itinéraire indisponible. Vérifiez Internet et réessayez. | Percorso non disponibile. Verifica Internet e riprova. | Ruta betg disponibla. Controllar internet e provar danovamain. | Route unavailable. Check internet and try again.
GPS-Position wird ermittelt. Standortzugriff bitte erlauben. | Localisation GPS en cours. Autorisez l’accès. | Rilevamento GPS in corso. Consenti l’accesso. | Determinar la posiziun GPS. Permetter l’access. | Locating GPS position. Please allow access.
Du befindest dich in der Nähe des Parkplatzes. Beschilderung prüfen. | Vous êtes près du parking. Vérifiez les panneaux. | Sei vicino al parcheggio. Controlla i segnali. | Ti es damanaivel dal parcadi. Controllar ils signals. | You are near the parking area. Check the signs.
Nur Navigationshilfe für den MVP. Verkehrsregeln, Beschilderung und Strassensituation vor Ort beachten. Nicht während der Fahrt bedienen. | Aide à la navigation uniquement. Respectez les règles et panneaux. Ne manipulez pas en conduisant. | Solo ausilio alla navigazione. Rispetta le regole e i segnali. Non usare durante la guida. | Agid da navigaziun. Resguardar las reglas e signals. Betg utilisar durant il viadi. | Navigation aid only. Follow traffic rules and signs. Do not operate while driving.
`.trim()

// Kleine Schreibkorrektur für lateinische Buchstaben.
const bereinigteTexte = texte
  .replaceAll('Memorисar', 'Memorisar')
  .replaceAll('Distan­zas', 'Distanzas')

const woerterbuch = new Map()
const muster = []

function regexSicher(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

bereinigteTexte.split('\n').filter((zeile) => zeile.trim() !== '').forEach((zeile) => {
  const spalten = zeile.split(' | ').map((teil) => teil.trim())

  if (spalten.length !== 5) {
    throw new Error(`Ungültige Übersetzungszeile: ${spalten[0]}`)
  }

  const [de, fr, it, rm, en] = spalten
  const eintrag = { de, fr, it, rm, en }

  woerterbuch.set(de, eintrag)

  if (/\{\w+\}/.test(de)) {
    const namen = []

    const quelle = de.split(/(\{\w+\})/g).map((teil) => {
      const platzhalter = teil.match(/^\{(\w+)\}$/)

      if (platzhalter) {
        namen.push(platzhalter[1])
        return '(.+?)'
      }

      return regexSicher(teil)
    }).join('')

    muster.push({
      regex: new RegExp(`^${quelle}$`),
      namen,
      eintrag
    })
  }
})

export function sprachLocale() {
  return sprachen.find(
    (sprache) => sprache.code === aktuelleSprache
  ).locale
}

export function uebersetzen(value) {
  if (aktuelleSprache === 'de') return value

  const original = String(value)
  const normal = original.replace(/\s+/g, ' ').trim()

  if (!normal) return original

  let ergebnis

  // Zuerst vollständige Texte übersetzen.
  const direkt = woerterbuch.get(normal)

  if (direkt) {
    ergebnis = direkt[aktuelleSprache]
  }

  // Zusammengesetzte Angaben einzeln übersetzen.
  // Beispiel: "Kostenlos · Max. 20 Min."
  if (!ergebnis && normal.includes(' · ')) {
    ergebnis = normal
      .split(' · ')
      .map((teil) => uebersetzen(teil))
      .join(' · ')
  }

  // Zahlen und Buchstaben in dynamischen Texten einsetzen.
  if (!ergebnis) {
    for (const vorlage of muster) {
      const treffer = normal.match(vorlage.regex)
      if (!treffer) continue

      ergebnis = vorlage.eintrag[aktuelleSprache]

      vorlage.namen.forEach((name, index) => {
        ergebnis = ergebnis.replaceAll(
          `{${name}}`,
          treffer[index + 1]
        )
      })

      break
    }
  }

  // Unbekannte Texte, beispielsweise Adressen, beibehalten.
  if (!ergebnis) return original

  const vorne = original.match(/^\s*/)[0]
  const hinten = original.match(/\s*$/)[0]

  return vorne + ergebnis + hinten
}

export function spracheAnwenden(startseite, neuRendern) {
  document.documentElement.lang = aktuelleSprache
  document.title = 'DeliverySpot · Bern'

  const app = document.querySelector('#app')
  if (!app) return

  // Sichtbare Texte übersetzen.
  const walker = document.createTreeWalker(
    app,
    NodeFilter.SHOW_TEXT
  )

  const textKnoten = []

  while (walker.nextNode()) {
    textKnoten.push(walker.currentNode)
  }

  textKnoten.forEach((knoten) => {
    const eltern = knoten.parentElement

    if (
      !eltern ||
      eltern.closest(
        'script, style, textarea, .leaflet-control-attribution'
      )
    ) {
      return
    }

    knoten.nodeValue = uebersetzen(knoten.nodeValue)
  })

  // Platzhalter und Beschriftungen für Bedienhilfen übersetzen.
  app.querySelectorAll(
    '[placeholder], [aria-label], [title], [alt]'
  ).forEach((element) => {
    if (element.closest('.leaflet-control-attribution')) return

    for (const attribut of [
      'placeholder',
      'aria-label',
      'title',
      'alt'
    ]) {
      if (!element.hasAttribute(attribut)) continue

      element.setAttribute(
        attribut,
        uebersetzen(element.getAttribute(attribut))
      )
    }
  })

  // Sprachauswahl nur auf der Startseite einfügen.
  if (!startseite) return

  const bereich = document.createElement('div')
  bereich.className = 'sprachwahl'

  const label = document.createElement('label')
  label.htmlFor = 'app-sprache'
  label.textContent = {
    de: 'Sprache',
    fr: 'Langue',
    it: 'Lingua',
    rm: 'Lingua',
    en: 'Language'
  }[aktuelleSprache]

  const auswahl = document.createElement('select')
  auswahl.id = 'app-sprache'
  auswahl.name = 'sprache'

  sprachen.forEach((sprache) => {
    const option = document.createElement('option')
    option.value = sprache.code
    option.textContent = sprache.name
    option.lang = sprache.code
    option.selected = sprache.code === aktuelleSprache

    auswahl.appendChild(option)
  })

  auswahl.addEventListener('change', () => {
    aktuelleSprache = auswahl.value

    try {
      localStorage.setItem(
        'deliveryspot-sprache',
        aktuelleSprache
      )
    } catch {
      // Die Auswahl gilt auch ohne Speicherung für diese Sitzung.
    }

    neuRendern()

    document.querySelector('#app-sprache')?.focus({
      preventScroll: true
    })
  })

  bereich.append(label, auswahl)
  app.querySelector('main').prepend(bereich)
}
