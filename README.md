# RIVA

Esplorazione 3D in prima persona su una spiaggia fuori stagione. Reale, ma emotiva ed evanescente. Grafica e palette prese dalle foto di riferimento: cielo blu profondo al mattino, acqua turchese e trasparente sulla riva, tramonto con la fascia rosa sul mare, cielo viola‑grigio e sabbia arancio.

## Avvio
```
python3 -m http.server 8000
```
Poi apri http://localhost:8000. Gira nel browser con Three.js incluso in `vendor/`, senza build.

## Comandi
- WASD / frecce: cammina · Mouse: guarda · Shift: corri · Spazio: salta
- E: siediti sulle panchine · T: passa alla fase successiva del giorno · J: diario · M: audio on/off
- Touch: metà sinistra per camminare, metà destra per guardare, tasti ORA / SALTA / DIARIO

## Cosa c'è
**Ambiente**
- Ciclo giorno/notte completo in 12 minuti (notte, alba, mattino, mezzogiorno, pomeriggio, ora dorata, tramonto, crepuscolo). Cielo, luce, nebbia e color grading cambiano insieme. Di notte ci sono stelle e luna.
- Nuvole vere: cumuli e cirri che si muovono e cambiano copertura nel tempo. Le loro ombre corrono su sabbia e mare.
- Foschia mattutina e notturna che sale sull'orizzonte.
- Orizzonte a strati: catena lontana, promontorio, colline, porto con gru e ciminiera, un'isola appena visibile. Le sagome sono morbide e velate, senza poligoni a vista, e restano sempre alla stessa distanza.
- Spiaggia infinita: cumulo di sabbia, fascia di ciottoli, sabbia bagnata. Increspature del vento sulla sabbia asciutta e onde di sabbia sul fondale.
- Ciottoli, conchiglie e legnetti in 3D sparsi attorno a te.
- L'acqua passa dal turchese trasparente al blu profondo. Ci sono caustiche sul fondale, schiuma, riflessi delle nuvole e scintille del sole.
- Post-processing: bloom, raggi di luce dal sole (god rays), lens flare, grana e vignettatura.

**Esplorazione**
- Si cammina anche sul mare: i passi lasciano cerchi sull'acqua.
- Impronte sulla sabbia: le tue svaniscono col tempo, e vicino all'acqua in pochi secondi. Una scia di impronte di qualcun altro porta al chiosco.
- Panchine: premi **E** per sederti. Il tempo scorre più veloce e guardi la luce cambiare.
- Suono dei passi, diverso su sabbia e acqua.

**Luoghi (tutti reali, un po' dimenticati)**
- Il chiosco chiuso sotto la pergola: le travi disegnano strisce d'ombra sulla sabbia.
- Il pontile di legno che entra nel mare. Ci si cammina sopra fino in fondo.
- Lo stabilimento chiuso per la stagione: cabine colorate, ombrelloni chiusi, lettini impilati, la torretta del bagnino.
- Una barca da pesca tirata in secco.
- La scogliera di massi, su cui si può salire.
- Il lungomare: muretto, lampioni che si accendono al tramonto, palme, case basse con qualche finestra accesa la sera.
- La passerella con la bandiera rossa mossa dal vento, la piattaforma offshore con le boe.

**Storia**
- Qualcuno veniva su questa riva ogni giorno, alla stessa ora, e ha lasciato sette oggetti: un barattolo con una candela, un libro, dei sandali, un cappello di paglia, una lettera, una lanterna e una bottiglia. Da lontano li tradisce solo un riflesso di luce. Ognuno custodisce un frammento di ciò che ha scritto. Tasto **J** apre il diario.
- Ogni tanto una persona cammina lontana sul bagnasciuga e si dissolve se ti avvicini. Trovati tutti gli oggetti, ti aspetta vicino alla bandiera.

## Parametri di debug (URL)
`?t=0.75` per l'ora (0–1), `&x=..&z=..&yaw=..&pitch=..` per la posizione, `&freeze` per fermare il tempo, `&clouds=0.5` per fissare le nuvole, `&autostart` per saltare la schermata iniziale.
