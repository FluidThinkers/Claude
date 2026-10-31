# RIVA

Esplorazione 3D in prima persona su una spiaggia fuori dal tempo. Grafica e palette prese dalle foto di riferimento: cielo blu profondo al mattino, acqua turchese e trasparente sulla riva, tramonto con la fascia rosa sul mare, cielo viola‑grigio e sabbia arancio.

## Avvio
```
python3 -m http.server 8000
```
Poi apri http://localhost:8000. Gira nel browser con Three.js incluso in `vendor/`, senza build.

## Comandi
- WASD / frecce: cammina · Mouse: guarda · Shift: corri · Spazio: salta
- T: passa alla fase successiva del giorno · M: audio on/off
- Touch: metà sinistra per camminare, metà destra per guardare, tasti ORA / SALTA

## Cosa c'è
- Ciclo giorno/notte completo in 12 minuti (notte, alba, mattino, mezzogiorno, pomeriggio, ora dorata, tramonto, crepuscolo), con cielo, luce, nebbia e color grading che cambiano insieme. Di notte ci sono stelle e luna.
- Spiaggia infinita con il cumulo di sabbia, la fascia di ciottoli e la sabbia bagnata. Il fondale ha caustiche, l'acqua passa dal turchese al blu profondo.
- Sul mare si cammina: i passi lasciano cerchi sull'acqua, che di notte si illuminano.
- Passerella di cemento con la bandiera rossa, che punta sempre verso il lume più vicino.
- La piattaforma offshore con le boe. All'orizzonte promontorio, gru del porto e ciminiera, che restano sempre alla stessa distanza.
- **La Soglia**: un telaio di legno piantato nel mare. Attraversarlo fa avanzare l'ora del giorno.
- **7 lumi** da trovare, ognuno con una frase. Raccolti tutti, all'orizzonte si accende una colonna di luce.
- Pietre che levitano e una figura lontana che svanisce quando ti avvicini.
- Audio procedurale: risacca, vento, rintocchi.

## Parametri di debug (URL)
`?t=0.75` per l'ora (0–1), `&x=..&z=..&yaw=..&pitch=..` per la posizione, `&freeze` per fermare il tempo, `&autostart` per saltare la schermata iniziale.
