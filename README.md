# Maanbasis

Een klein 3D-spel: een kale maan met een kolonie erop. Je draait eromheen,
zoomt in en uit, en houdt de basis draaiende. Gemaakt met HTML, CSS en JS;
de enige afhankelijkheid is [three.js](https://threejs.org) (r128, van een CDN).

## Starten

Open `index.html` in de browser — dubbelklikken volstaat, er is geen server
nodig. Wel internet, want three.js komt van cdnjs.

## Besturing

| Actie | Hoe |
| --- | --- |
| Draaien | slepen met de muis, of de pijltjestoetsen |
| Randscroll | cursor tegen de schermrand houden |
| Draaipunt kiezen | muiswiel indrukken en slepen, zoals in Cities: Skylines |
| Zoomen | scrollen, knijpen op touch, of `+` / `−` |
| Selecteren | klik op een module |
| Bouwen | klik een module in de balk, dan een blauwe ring op de maan |
| Annuleren | `Esc` |

Normaal draait de camera om het middelpunt van de maan. Druk je het muiswiel
in, dan verhuist het draaipunt naar wat er onder de cursor zit — een module,
de raket op het platform of gewoon een plek op de maan — en draai je daaromheen.
Een oranje ringetje markeert het punt. Zonder muiswiel kan het ook: selecteer
een module en klik *Camera hieromheen draaien* in het zijpaneel. `Esc` zet het
draaipunt terug in het midden van de maan.

Het draaipunt loopt mee met wat het volgt: bij een module draait het met de maan
mee, en volg je de raket, dan gaat de camera mee de ruimte in.

Houd je de cursor in de laatste 30 pixels voor de schermrand, dan schuift het
beeld die kant op — hoe dichter tegen de rand, hoe sneller. Boven het zijpaneel,
de bouwbalk of een knop in de bovenbalk gebeurt er niets; de rest van de
bovenbalk laat de muis door, zodat de bovenrand gewoon werkt.

`Volg basis` houdt de camera boven de kolonie terwijl de maan draait.
`Draaiing` zet het etmaal (≈140 s) stil. `Randscroll` zet het meeschuiven uit.

## Naam en bewaren

Linksboven staat de naam van je basis; klik erop en typ een nieuwe. Die naam
komt ook in de titelbalk van het tabblad en bepaalt de bestandsnaam als je
opslaat.

`Opslaan` schrijft de hele basis naar `<jouw-naam>.maanbasis.json`: de naam,
alle modules met hun plek en toestand, de voorraden, het aantal kolonisten, de
stand van de maan en de knoppen in de bovenbalk. `Laden` opent zo'n bestand
weer — of sleep het gewoon op het venster. Wat er níét in gaat: waar de
poppetjes precies liepen en waar de camera hing; die zoeken hun weg zelf weer.

Het is één plat JSON-bestand met een `versie`-veld, dus je kunt er ook met de
hand in rommelen als je jezelf krediet wilt toestoppen.

## Het spel

De basis begint met een woonmodule, een lanceerplatform, een brandstoftank,
een kweekkas en twee zonnepanelen.

- **Zonnepanelen** leveren alleen stroom aan de dagzijde en volgen de zon.
  De accu moet je door de nacht helpen.
- **Kweekkassen** maken voedsel, maar alleen mét stroom. Kolonisten eten
  0,16 per seconde.
- **Brandstoftanks** winnen brandstof uit het regoliet en slurpen stroom.
- **Het lanceerplatform** stuurt voor 60 brandstof een vracht weg; de
  opbrengst groeit met het aantal kolonisten.
- Genoeg voedsel én woonruimte? Dan komt er af en toe een kolonist bij.
  Raakt het voedsel op, dan vertrekt er een.

Elke kolonist loopt als poppetje in een ruimtepak over de laagvlakte: van
module naar module, met een lage-zwaartekrachtwip in de pas en een borstlampje
dat 's nachts brandt. Ze lopen om de modules heen en je kunt er met het
muiswiel eentje als draaipunt kiezen om achter hem of haar aan te lopen. Boven
de twintig houdt het op met poppetjes; de rest werkt binnen.

Bij stroomtekort draaien alle verbruikers evenredig langzamer — dat zie je
terug in de tarieven in de bovenbalk.

## Opbouw

| Bestand | Wat erin zit |
| --- | --- |
| `index.html` | de HUD, het hulpscherm en de scripttags |
| `style.css` | de opmaak van alles wat over de 3D-scène heen ligt |
| `utils.js` | rekenhulpjes en gezaaide random |
| `moon.js` | de bol: kraters, hoogtefunctie, de vlakke landingsvlakte en het tangentiële stelsel waarin de basis ligt |
| `buildings.js` | de vijf modules als losse `THREE.Group`s, plus hun kosten en opbrengsten |
| `colonists.js` | de poppetjes: model, looproutes en de wandelanimatie |
| `world.js` | renderer, camera, licht, sterren, zon en de aarde aan de hemel |
| `controls.js` | camera die om een draaipunt cirkelt; slepen, scrollen, knijpen, klikken |
| `game.js` | bouwplekken, huishouding, HUD, selectie, opslaan en de lancering |
| `main.js` | alles aan elkaar knopen en de tekenlus |

Alles staat plat naast elkaar; de bestanden verwijzen niet naar elkaar via
paden, maar hangen zich allemaal aan de globale `MB`. Alleen de volgorde van de
scripttags in `index.html` telt: `utils` eerst, `main` als laatste.

De maan is één icosaëder waarvan elk hoekpunt langs zijn eigen richting naar
buiten of naar binnen wordt geschoven (`hoogteBij`). Dezelfde functie bepaalt
waar de modules op de grond staan, dus die zweven nooit. Rond de basis wordt
het oppervlak naar precies de straal toe gemengd; dat is de laagvlakte.

Vanuit de console zijn `MB.wereld`, `MB.controls` en `MB.spel` bereikbaar —
`MB.spel.staat.krediet = 9999` doet wat je verwacht.
