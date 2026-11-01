# RIVA

Esplorazione 3D in prima persona su una spiaggia fuori stagione. Reale, ma emotiva ed evanescente. Grafica e palette prese dalle foto di riferimento: cielo blu profondo al mattino, acqua turchese e trasparente sulla riva, tramonto con la fascia rosa sul mare, cielo viola‑grigio e sabbia arancio.

## Avvio
```
python3 -m http.server 8000
```
Poi apri http://localhost:8000. Gira nel browser con Three.js incluso in `vendor/`, senza build.

## Comandi
- WASD / frecce: cammina, nuota, pagaia · Mouse: guarda · Shift: corri / nuota più forte
- Spazio: salta, o risali quando sei sott'acqua · C: immergiti
- E: azione (sali e scendi dal SUP, prendi maschera e pinne, siediti sulle panchine)
- T: fase successiva del giorno · J: diario · M: audio on/off
- Touch: metà sinistra per muoverti, metà destra per guardare, tasti SU / GIÙ / AZIONE / ORA / DIARIO

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

**Esplorazione: tutto quello che può fare una persona**
- **Camminare**, anche nell'acqua bassa: più è alta più rallenti, con schizzi e cerchi sull'acqua.
- **Nuotare** dove non si tocca, a pelo d'acqua, con il suono delle bracciate.
- **Immergersi** (C): sotto la superficie tutto diventa ovattato, la luce scende a fasci e dall'alto si vede la finestra del cielo. Il respiro è limitato. Senza maschera si vede sfocato.
- **Maschera e pinne**: le trovi davanti a una cabina dello stabilimento. Con la maschera vedi nitido sott'acqua, con le pinne nuoti più veloce e resti sotto più a lungo.
- **Moto da enduro**: parcheggiata sul lungomare. Con E ci sali, W accelera, A e D sterzano. Ti porta su per le colline fino al belvedere. Di notte accende il faro.
- **SUP**: la tavola è sulla sabbia davanti allo stabilimento. Con E la spingi in acqua e ci sali, poi pagai fino al largo. Quando scendi resta dove l'hai lasciata.
- **Fondale vivo**: prati di posidonia che ondeggiano, banchi di salpe che si allontanano se ti avvicini, scogli con ricci.
- **Gabbiani**: alcuni volano alti e planano, altri riposano su sabbia e pali del pontile e si alzano in volo se ti avvicini. Si sentono, e la voce si sposta nello spazio.
- **Luce**: c'è una foschia solare, un velo luminoso attorno al sole quando l'aria è umida. Le nuvole fanno ombra, la pergola disegna strisce sulla sabbia.
- Impronte che svaniscono, panchine (E) dove il tempo scorre più veloce, suono dei passi.

**Luoghi (tutti reali, un po' dimenticati)**
- Le colline e le montagne dietro la spiaggia, vere e raggiungibili: erba secca, macchia, pini marittimi, roccia sui pendii.
- Il belvedere in collina: muretto a secco, una panchina rivolta al mare, un vecchio cipresso.
- La foce: un canale d'acqua bassa che taglia la sabbia e riflette il cielo.
- Il chiosco chiuso sotto la pergola: le travi disegnano strisce d'ombra sulla sabbia.
- Il pontile di legno che entra nel mare. Ci si cammina sopra fino in fondo.
- Lo stabilimento chiuso per la stagione: cabine colorate, ombrelloni chiusi, lettini impilati, la torretta del bagnino.
- Una barca da pesca tirata in secco.
- La scogliera di massi, su cui si può salire.
- Il lungomare: muretto basso, lampioni che si accendono al tramonto, palme mosse dal vento.
- La passerella con la bandiera rossa mossa dal vento, la piattaforma offshore con le boe.

**Vento, mare e cielo**
- Il vento gira piano e va a raffiche: chiazze increspate corrono sull'acqua, la sabbia scivola a terra, palme e macchia si piegano, il suono del vento segue le raffiche.
- Onde che arrivano a riva e si rompono, con la schiuma e la scia bianca dietro.
- Cumuli con la base scura e, in certi momenti, il cielo a pecorelle che vela la luce.
- Una barca a vela e un traghetto passano lenti all'orizzonte.
- Luce riflessa dal cielo su tutti i materiali; sassi, cespugli e scogli con superfici levigate.

**Storia**
- Fine settembre, gli ultimi giorni prima che chiudano tutto. Qualcuno ha lasciato otto oggetti lungo la riva, uno per ogni ora del giorno: una candela alle 06:40, un libro alle 08:15, dei sandali alle 10:30, un orologio sul fondo a mezzogiorno, un cappello alle 15:20, una lettera alle 17:45, una lanterna alle 19:30. Al largo, una bottiglia. In cima alle colline, al belvedere, un binocolo alle 18:30.
- **Ogni oggetto riflette la luce soltanto alla sua ora**: per trovarli bisogna leggere il tempo, aspettare, tornare. L'ora è sempre in alto a sinistra.
- I frammenti, nel diario (J), sembrano lettere a qualcuno. Solo alla fine si capisce che quegli oggetti erano segnavia lasciati per sé, per i giorni in cui la strada si dimentica, e che adesso la strada la conosci anche tu.
- Ogni tanto una persona cammina lontana sul bagnasciuga e si dissolve se ti avvicini. Quando hai trovato tutto, ti aspetta vicino alla bandiera.

## Parametri di debug (URL)
`?t=0.75` per l'ora (0–1), `&x=..&z=..&yaw=..&pitch=..` per la posizione, `&freeze` per fermare il tempo, `&clouds=0.5` per fissare le nuvole, `&gear` per avere maschera e pinne, `&mode=swim|dive|sup|bike`, `&alto=1` per il cielo a pecorelle per partire in acqua, `&autostart` per saltare la schermata iniziale.
