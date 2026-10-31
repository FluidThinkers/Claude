# RIVA

Esplorazione 3D in prima persona su una spiaggia fuori dal tempo. Grafica e palette prese dalle foto di riferimento: cielo blu profondo al mattino, acqua turchese e trasparente sulla riva, tramonto con la fascia rosa sul mare, cielo viola‑grigio e sabbia arancio.

## Avvio
```
python3 -m http.server 8000
```
Poi apri http://localhost:8000. Gira nel browser con Three.js incluso in `vendor/`, senza build.

## Comandi
- WASD / frecce: cammina · Mouse: guarda · Shift: corri · Spazio: salta
- T: passa alla fase successiva del giorno · J: diario · M: audio on/off
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
- Sul mare si cammina: i passi lasciano cerchi sull'acqua, che di notte si illuminano.
- Impronte sulla sabbia: le tue svaniscono col tempo, e vicino all'acqua in pochi secondi. Una scia di impronte di qualcun altro porta alla Scala.
- Suono dei passi, diverso su sabbia e acqua.

**Luoghi**
- **La Soglia**: un telaio di legno nel mare. Attraversarlo fa avanzare l'ora del giorno.
- **La Porta**: una porta socchiusa sulla sabbia. Attraversarla ti porta ogni volta in un luogo diverso.
- **La Scala**: 36 gradini di pietra chiara che salgono verso il nulla. Si sale davvero fino in cima.
- **Le Colonne**: rovine di un tempio che emergono dall'acqua bassa.
- **Lo Specchio**: un cerchio di mare perfettamente immobile, con un lampione che si accende al tramonto.
- La piattaforma offshore con le boe, la passerella con la bandiera rossa (che punta sempre verso il lume più vicino) e le pietre che levitano.

**Storia**
- Qualcuno veniva su questa riva ogni giorno, alla stessa ora, e ha lasciato 7 luci. Ogni luce custodisce un frammento di ciò che ha scritto. Tasto **J** apre il diario.
- Una figura lontana compare e svanisce se ti avvicini. Trovate tutte le luci, è alle tue spalle: raggiungila per il finale.

## Parametri di debug (URL)
`?t=0.75` per l'ora (0–1), `&x=..&z=..&yaw=..&pitch=..` per la posizione, `&freeze` per fermare il tempo, `&clouds=0.5` per fissare le nuvole, `&autostart` per saltare la schermata iniziale.
